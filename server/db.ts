import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'gulf_taxis.sqlite');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

let dbInstance: any = null;

export async function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (err) {
      console.error('Failed to read existing database file, creating a new one:', err);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  // Initialize schema & tables
  initSchema(dbInstance);
  persistDb();

  return dbInstance;
}

export function persistDb() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Failed to persist database to file:', err);
  }
}

export function setDbInstance(newDb: any) {
  dbInstance = newDb;
  persistDb();
}

// Helper to execute query with parameters and persist
export function runSql(sql: string, params: any[] = []): void {
  if (!dbInstance) throw new Error('Database not initialized');
  dbInstance.run(sql, params);
  persistDb();
}

// Helper to query multiple rows as objects
export function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

// Helper to query single row as object
export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const all = queryAll<T>(sql, params);
  return all.length > 0 ? all[0] : null;
}

function initSchema(db: any) {
  // Foreign keys enabled
  db.run('PRAGMA foreign_keys = ON;');

  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL, -- 'super_admin' | 'admin' | 'booking_agent' | 'dispatcher' | 'finance_executive' | 'report_viewer'
      phone TEXT,
      permissions TEXT, -- JSON array of module keys
      is_active INTEGER DEFAULT 1,
      last_login TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Vehicles table
  db.run(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      reg_number TEXT UNIQUE NOT NULL,
      vehicle_type TEXT NOT NULL, -- Sedan, SUV, Minivan, Hyundai Staria, Hiace, Coaster, Bus, Luxury
      make_model TEXT NOT NULL,
      passenger_capacity INTEGER DEFAULT 4,
      luggage_capacity INTEGER DEFAULT 3,
      supplier_id TEXT,
      assigned_driver_id TEXT,
      status TEXT DEFAULT 'available', -- 'available' | 'on_trip' | 'maintenance' | 'inactive'
      color TEXT,
      model_year INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Drivers table
  db.run(`
    CREATE TABLE IF NOT EXISTS drivers (
      id TEXT PRIMARY KEY,
      driver_code TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      email TEXT,
      license_number TEXT NOT NULL,
      license_expiry TEXT NOT NULL,
      assigned_vehicle_id TEXT,
      payment_arrangement TEXT DEFAULT 'per_trip', -- 'per_trip' | 'monthly' | 'commission' | 'fixed_plus_trip'
      rate_or_salary REAL DEFAULT 0,
      currency TEXT DEFAULT 'SAR',
      is_active INTEGER DEFAULT 1,
      current_balance REAL DEFAULT 0, -- payable balance
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Suppliers table
  db.run(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      supplier_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      contact_person TEXT,
      mobile TEXT,
      email TEXT,
      address TEXT,
      default_currency TEXT DEFAULT 'SAR',
      opening_balance REAL DEFAULT 0,
      current_balance REAL DEFAULT 0, -- payable balance
      payment_terms TEXT DEFAULT '15_days',
      is_active INTEGER DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Bookings table
  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      booking_ref TEXT UNIQUE NOT NULL,
      booking_date TEXT NOT NULL,
      pickup_date TEXT NOT NULL,
      pickup_time TEXT NOT NULL, -- 24h format HH:mm
      passenger_name TEXT NOT NULL,
      contact_number TEXT NOT NULL,
      passengers_count INTEGER DEFAULT 1,
      luggage_count INTEGER DEFAULT 1,
      pickup_location TEXT NOT NULL,
      dropoff_location TEXT NOT NULL,
      flight_number TEXT,
      airline TEXT,
      vehicle_type TEXT NOT NULL,
      vehicle_id TEXT,
      driver_id TEXT,
      supplier_id TEXT,
      customer_name TEXT NOT NULL, -- Customer or travel agency
      customer_phone TEXT,
      customer_price REAL DEFAULT 0,
      supplier_cost REAL DEFAULT 0,
      driver_payout REAL DEFAULT 0,
      currency TEXT DEFAULT 'SAR',
      payment_status TEXT DEFAULT 'unpaid', -- 'unpaid' | 'partial' | 'paid' | 'refunded'
      paid_amount REAL DEFAULT 0,
      trip_status TEXT DEFAULT 'New Booking', 
      -- 'New Booking' | 'Awaiting Assignment' | 'Assigned' | 'Driver Notified' | 'Driver on the Way' | 'Arrived at Pickup' | 'Passenger Picked Up' | 'Trip Completed' | 'Cancelled' | 'No Show'
      cancellation_reason TEXT,
      special_instructions TEXT,
      dispatcher_notes TEXT,
      supplier_reference TEXT,
      created_by_id TEXT,
      created_by_name TEXT,
      updated_by_id TEXT,
      updated_by_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  try {
    db.run('ALTER TABLE bookings ADD COLUMN supplier_reference TEXT;');
  } catch (e) {
    // column already exists
  }

  // Payments & Financial Transactions table
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      payment_ref TEXT UNIQUE NOT NULL,
      entity_type TEXT NOT NULL, -- 'customer_receipt' | 'driver_payment' | 'supplier_payment' | 'general_expense' | 'refund_adjustment'
      entity_id TEXT, -- customer_name or driver_id or supplier_id
      entity_name TEXT,
      booking_id TEXT,
      booking_ref TEXT,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'SAR',
      payment_method TEXT NOT NULL, -- 'Cash' | 'Bank Transfer' | 'Credit Card' | 'Mada' | 'POS' | 'Cheque'
      payment_date TEXT NOT NULL,
      reference_no TEXT,
      notes TEXT,
      created_by_id TEXT,
      created_by_name TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Trip Status History / Audit
  db.run(`
    CREATE TABLE IF NOT EXISTS trip_status_logs (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      booking_ref TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      changed_by_id TEXT,
      changed_by_name TEXT,
      notes TEXT,
      timestamp TEXT NOT NULL
    );
  `);

  // General Audit Logs
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      action TEXT NOT NULL, -- 'CREATE' | 'UPDATE' | 'DELETE' | 'CANCEL' | 'ASSIGN' | 'PAYMENT' | 'BACKUP'
      entity TEXT NOT NULL, -- 'booking' | 'driver' | 'vehicle' | 'supplier' | 'payment' | 'user' | 'setting'
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      timestamp TEXT NOT NULL
    );
  `);

  // System Settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Automated Backups table
  db.run(`
    CREATE TABLE IF NOT EXISTS backups (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT DEFAULT 'completed',
      type TEXT DEFAULT 'automated' -- 'automated' | 'manual'
    );
  `);

  // Check if default admin user exists, if not seed initial data
  const adminCheck = db.exec("SELECT count(*) as count FROM users WHERE role = 'super_admin'");
  const adminCount = adminCheck[0]?.values[0]?.[0] || 0;

  if (adminCount === 0) {
    seedInitialData(db);
  }
}

function seedInitialData(db: any) {
  const now = new Date().toISOString();
  const defaultSalt = bcrypt.genSaltSync(10);
  const adminPasswordHash = bcrypt.hashSync('Admin@123', defaultSalt);
  const agentPasswordHash = bcrypt.hashSync('Agent@123', defaultSalt);
  const dispatchPasswordHash = bcrypt.hashSync('Dispatch@123', defaultSalt);
  const financePasswordHash = bcrypt.hashSync('Finance@123', defaultSalt);
  const viewerPasswordHash = bcrypt.hashSync('Viewer@123', defaultSalt);

  // Seed default role users
  const users = [
    {
      id: 'usr_superadmin',
      username: 'superadmin',
      email: 'superadmin@gulftaxis.com',
      password_hash: adminPasswordHash,
      full_name: 'Fahad Al-Otaibi',
      role: 'super_admin',
      phone: '+966 50 123 4567',
      permissions: JSON.stringify(['all']),
    },
    {
      id: 'usr_admin',
      username: 'admin',
      email: 'admin@gulftaxis.com',
      password_hash: adminPasswordHash,
      full_name: 'Mansour Al-Harbi',
      role: 'admin',
      phone: '+966 50 234 5678',
      permissions: JSON.stringify(['dashboard', 'bookings', 'dispatch', 'drivers', 'vehicles', 'suppliers', 'payments', 'reports', 'settings']),
    },
    {
      id: 'usr_agent',
      username: 'agent',
      email: 'agent@gulftaxis.com',
      password_hash: agentPasswordHash,
      full_name: 'Sara Al-Ghamdi',
      role: 'booking_agent',
      phone: '+966 50 345 6789',
      permissions: JSON.stringify(['dashboard', 'bookings', 'dispatch', 'reports']),
    },
    {
      id: 'usr_dispatcher',
      username: 'dispatcher',
      email: 'dispatcher@gulftaxis.com',
      password_hash: dispatchPasswordHash,
      full_name: 'Tariq Al-Zahrani',
      role: 'dispatcher',
      phone: '+966 50 456 7890',
      permissions: JSON.stringify(['dashboard', 'bookings', 'dispatch', 'drivers', 'vehicles']),
    },
    {
      id: 'usr_finance',
      username: 'finance',
      email: 'finance@gulftaxis.com',
      password_hash: financePasswordHash,
      full_name: 'Hassan Al-Shehri',
      role: 'finance_executive',
      phone: '+966 50 567 8901',
      permissions: JSON.stringify(['dashboard', 'bookings', 'payments', 'reports']),
    },
    {
      id: 'usr_viewer',
      username: 'viewer',
      email: 'viewer@gulftaxis.com',
      password_hash: viewerPasswordHash,
      full_name: 'Reem Al-Dossari',
      role: 'report_viewer',
      phone: '+966 50 678 9012',
      permissions: JSON.stringify(['dashboard', 'reports']),
    },
  ];

  for (const u of users) {
    db.run(
      `INSERT INTO users (id, username, email, password_hash, full_name, role, phone, permissions, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [u.id, u.username, u.email, u.password_hash, u.full_name, u.role, u.phone, u.permissions, now, now]
    );
  }

  // Seed default vehicle fleet
  const vehicles = [
    {
      id: 'veh_01',
      reg_number: 'KSA 4512 BDA',
      vehicle_type: 'Sedan (Camry / Lexus ES)',
      make_model: 'Toyota Camry 2025',
      passenger_capacity: 4,
      luggage_capacity: 3,
      status: 'available',
      color: 'Pearl White',
      model_year: 2025,
      notes: 'VIP Executive sedan, fully clean with water bottles and phone chargers',
    },
    {
      id: 'veh_02',
      reg_number: 'KSA 8890 RKA',
      vehicle_type: 'SUV (Yukon / Tahoe)',
      make_model: 'GMC Yukon XL 2024',
      passenger_capacity: 7,
      luggage_capacity: 6,
      status: 'available',
      color: 'Onyx Black',
      model_year: 2024,
      notes: 'Luxury family VIP vehicle, airport transfer specialist',
    },
    {
      id: 'veh_03',
      reg_number: 'KSA 6723 HTA',
      vehicle_type: 'Hyundai Staria VIP',
      make_model: 'Hyundai Staria Lounge 2025',
      passenger_capacity: 7,
      luggage_capacity: 5,
      status: 'available',
      color: 'Silver Metallic',
      model_year: 2025,
      notes: 'Executive 7-seater business class reclining seats',
    },
    {
      id: 'veh_04',
      reg_number: 'KSA 1102 NMA',
      vehicle_type: 'Toyota Hiace Minivan',
      make_model: 'Toyota Hiace Grandia 2024',
      passenger_capacity: 10,
      luggage_capacity: 8,
      status: 'available',
      color: 'White',
      model_year: 2024,
      notes: 'Group travel and pilgrim transfer vehicle',
    },
    {
      id: 'veh_05',
      reg_number: 'KSA 3394 LRA',
      vehicle_type: 'Toyota Coaster Minibus',
      make_model: 'Toyota Coaster 2023',
      passenger_capacity: 22,
      luggage_capacity: 15,
      status: 'available',
      color: 'White with Blue Stripe',
      model_year: 2023,
      notes: 'Corporate conference and tour coach',
    },
  ];

  for (const v of vehicles) {
    db.run(
      `INSERT INTO vehicles (id, reg_number, vehicle_type, make_model, passenger_capacity, luggage_capacity, status, color, model_year, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [v.id, v.reg_number, v.vehicle_type, v.make_model, v.passenger_capacity, v.luggage_capacity, v.status, v.color, v.model_year, v.notes, now, now]
    );
  }

  // Seed default Drivers
  const drivers = [
    {
      id: 'drv_01',
      driver_code: 'DRV-101',
      full_name: 'Muhammad Tariq Khan',
      mobile: '+966 54 881 9201',
      email: 'tariq.driver@gulftaxis.com',
      license_number: 'KSA-LIC-891024',
      license_expiry: '2028-06-30',
      assigned_vehicle_id: 'veh_01',
      payment_arrangement: 'per_trip',
      rate_or_salary: 80,
      currency: 'SAR',
      current_balance: 450,
      notes: 'Fluent in English and Arabic. 8 years airport transfer experience.',
    },
    {
      id: 'drv_02',
      driver_code: 'DRV-102',
      full_name: 'Abdulrahman Al-Balawi',
      mobile: '+966 55 334 7781',
      email: 'abdulrahman.driver@gulftaxis.com',
      license_number: 'KSA-LIC-771923',
      license_expiry: '2027-11-15',
      assigned_vehicle_id: 'veh_02',
      payment_arrangement: 'per_trip',
      rate_or_salary: 120,
      currency: 'SAR',
      current_balance: 620,
      notes: 'VIP customer specialist. Knows Riyadh and Jeddah hotel routes thoroughly.',
    },
    {
      id: 'drv_03',
      driver_code: 'DRV-103',
      full_name: 'Sardar Bilal Ahmed',
      mobile: '+966 56 990 4123',
      email: 'bilal.driver@gulftaxis.com',
      license_number: 'KSA-LIC-654091',
      license_expiry: '2028-02-28',
      assigned_vehicle_id: 'veh_03',
      payment_arrangement: 'monthly',
      rate_or_salary: 3500,
      currency: 'SAR',
      current_balance: 0,
      notes: 'Hyundai Staria VIP dedicated chauffeur.',
    },
    {
      id: 'drv_04',
      driver_code: 'DRV-104',
      full_name: 'Kareem Mostafa',
      mobile: '+966 50 119 6432',
      email: 'kareem.driver@gulftaxis.com',
      license_number: 'KSA-LIC-442190',
      license_expiry: '2027-08-20',
      assigned_vehicle_id: 'veh_04',
      payment_arrangement: 'per_trip',
      rate_or_salary: 150,
      currency: 'SAR',
      current_balance: 300,
      notes: 'High passenger capacity license. Excellent safety record.',
    },
  ];

  for (const d of drivers) {
    db.run(
      `INSERT INTO drivers (id, driver_code, full_name, mobile, email, license_number, license_expiry, assigned_vehicle_id, payment_arrangement, rate_or_salary, currency, is_active, current_balance, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      [d.id, d.driver_code, d.full_name, d.mobile, d.email, d.license_number, d.license_expiry, d.assigned_vehicle_id, d.payment_arrangement, d.rate_or_salary, d.currency, d.current_balance, d.notes, now, now]
    );
  }

  // Seed default Suppliers
  const suppliers = [
    {
      id: 'sup_01',
      supplier_code: 'SUP-01',
      name: 'Al-Safwa Transport Fleet Co.',
      contact_person: 'Majid Al-Qahtani',
      mobile: '+966 53 112 4455',
      email: 'dispatch@alsafwatransport.com',
      address: 'King Fahd Road, Al Olaya, Riyadh, Saudi Arabia',
      default_currency: 'SAR',
      opening_balance: 0,
      current_balance: 1400,
      payment_terms: '15_days',
      notes: 'Main luxury SUV & VIP Sedan partner fleet provider in Riyadh',
    },
    {
      id: 'sup_02',
      supplier_code: 'SUP-02',
      name: 'Hijaz Limousine & Bus Services',
      contact_person: 'Osama Radwan',
      mobile: '+966 54 776 2211',
      email: 'operations@hijazlimo.com',
      address: 'Madinah Road, Al-Rawdah, Jeddah, Saudi Arabia',
      default_currency: 'SAR',
      opening_balance: 0,
      current_balance: 850,
      payment_terms: 'weekly',
      notes: 'Coaster and Hiace buses for Makkah, Madinah, and Jeddah routes',
    },
    {
      id: 'sup_03',
      supplier_code: 'SUP-03',
      name: 'Gulf Executive Chauffeur Dubai',
      contact_person: 'Nasser Al-Falasi',
      mobile: '+971 50 882 1993',
      email: 'partners@gulfexecutive.ae',
      address: 'Business Bay, Dubai, UAE',
      default_currency: 'AED',
      opening_balance: 0,
      current_balance: 450,
      payment_terms: '30_days',
      notes: 'Cross-border and UAE partner network for Gulf Taxis VIP accounts',
    },
  ];

  for (const s of suppliers) {
    db.run(
      `INSERT INTO suppliers (id, supplier_code, name, contact_person, mobile, email, address, default_currency, opening_balance, current_balance, payment_terms, is_active, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [s.id, s.supplier_code, s.name, s.contact_person, s.mobile, s.email, s.address, s.default_currency, s.opening_balance, s.current_balance, s.payment_terms, s.notes, now, now]
    );
  }

  // Seed realistic bookings across statuses
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const bookings = [
    {
      id: 'bk_001',
      booking_ref: 'GT-2026-0001',
      booking_date: yesterday,
      pickup_date: yesterday,
      pickup_time: '14:30',
      passenger_name: 'Dr. Khalid Al-Mutairi',
      contact_number: '+966 50 998 1122',
      passengers_count: 2,
      luggage_count: 2,
      pickup_location: 'King Khalid International Airport (RUH) - Terminal 4',
      dropoff_location: 'Four Seasons Hotel Riyadh, Kingdom Centre',
      flight_number: 'SV 1024',
      airline: 'Saudia',
      vehicle_type: 'Sedan (Camry / Lexus ES)',
      vehicle_id: 'veh_01',
      driver_id: 'drv_01',
      supplier_id: 'sup_01',
      customer_name: 'Al-Rajhi Corporate Travel',
      customer_price: 350,
      supplier_cost: 200,
      driver_payout: 80,
      currency: 'SAR',
      payment_status: 'paid',
      paid_amount: 350,
      trip_status: 'Trip Completed',
      special_instructions: 'Name board: Dr. Khalid Al-Mutairi. Meet inside arrivals hall.',
      created_by_name: 'Sara Al-Ghamdi',
    },
    {
      id: 'bk_002',
      booking_ref: 'GT-2026-0002',
      booking_date: todayStr,
      pickup_date: todayStr,
      pickup_time: '11:00',
      passenger_name: 'Mr. James Sterling',
      contact_number: '+44 7700 900123',
      passengers_count: 3,
      luggage_count: 4,
      pickup_location: 'Ritz-Carlton Riyadh, Al Hada Area',
      dropoff_location: 'King Khalid International Airport (RUH) - Terminal 1',
      flight_number: 'BA 262',
      airline: 'British Airways',
      vehicle_type: 'SUV (Yukon / Tahoe)',
      vehicle_id: 'veh_02',
      driver_id: 'drv_02',
      supplier_id: 'sup_01',
      customer_name: 'Global Business Travel UK',
      customer_price: 550,
      supplier_cost: 320,
      driver_payout: 120,
      currency: 'SAR',
      payment_status: 'partial',
      paid_amount: 250,
      trip_status: 'Passenger Picked Up',
      special_instructions: 'Executive client, luggage assistance required',
      created_by_name: 'Fahad Al-Otaibi',
    },
    {
      id: 'bk_003',
      booking_ref: 'GT-2026-0003',
      booking_date: todayStr,
      pickup_date: todayStr,
      pickup_time: '16:45',
      passenger_name: 'Eng. Salem Bakhsh',
      contact_number: '+966 55 441 2288',
      passengers_count: 4,
      luggage_count: 4,
      pickup_location: 'King Abdulaziz International Airport (JED) - Terminal 1',
      dropoff_location: 'Hilton Makkah Convention Hotel',
      flight_number: 'EK 803',
      airline: 'Emirates',
      vehicle_type: 'Hyundai Staria VIP',
      vehicle_id: 'veh_03',
      driver_id: 'drv_03',
      supplier_id: 'sup_02',
      customer_name: 'Dar Al-Iman Umrah Tours',
      customer_price: 650,
      supplier_cost: 400,
      driver_payout: 0, // monthly salaried driver
      currency: 'SAR',
      payment_status: 'unpaid',
      paid_amount: 0,
      trip_status: 'Driver Notified',
      special_instructions: 'Family with two children. Please provide child safety booster.',
      created_by_name: 'Sara Al-Ghamdi',
    },
    {
      id: 'bk_004',
      booking_ref: 'GT-2026-0004',
      booking_date: todayStr,
      pickup_date: todayStr,
      pickup_time: '19:15',
      passenger_name: 'Madame Sophie Laurent',
      contact_number: '+33 6 12 34 56 78',
      passengers_count: 1,
      luggage_count: 2,
      pickup_location: 'King Khalid International Airport (RUH) - Terminal 2',
      dropoff_location: 'Fairmont Riyadh, Business Gate',
      flight_number: 'AF 742',
      airline: 'Air France',
      vehicle_type: 'Sedan (Camry / Lexus ES)',
      vehicle_id: null,
      driver_id: null,
      supplier_id: null,
      customer_name: 'Direct Online Client',
      customer_price: 320,
      supplier_cost: 180,
      driver_payout: 80,
      currency: 'SAR',
      payment_status: 'unpaid',
      paid_amount: 0,
      trip_status: 'Awaiting Assignment',
      special_instructions: 'Flight on time. VIP meet and greet requested.',
      created_by_name: 'Mansour Al-Harbi',
    },
    {
      id: 'bk_005',
      booking_ref: 'GT-2026-0005',
      booking_date: todayStr,
      pickup_date: tomorrow,
      pickup_time: '08:30',
      passenger_name: 'Tech Delegation (Group of 8)',
      contact_number: '+966 50 771 9900',
      passengers_count: 8,
      luggage_count: 8,
      pickup_location: 'Crowne Plaza Riyadh RDC Hotel',
      dropoff_location: 'King Abdullah Financial District (KAFD) Conference Center',
      flight_number: '',
      airline: '',
      vehicle_type: 'Toyota Hiace Minivan',
      vehicle_id: 'veh_04',
      driver_id: 'drv_04',
      supplier_id: 'sup_01',
      customer_name: 'Saudi Tech Summit Organizers',
      customer_price: 900,
      supplier_cost: 500,
      driver_payout: 150,
      currency: 'SAR',
      payment_status: 'paid',
      paid_amount: 900,
      trip_status: 'Assigned',
      special_instructions: 'Full day standby transfer service for summit attendees.',
      created_by_name: 'Tariq Al-Zahrani',
    },
  ];

  for (const b of bookings) {
    db.run(
      `INSERT INTO bookings (
        id, booking_ref, booking_date, pickup_date, pickup_time, passenger_name, contact_number,
        passengers_count, luggage_count, pickup_location, dropoff_location, flight_number, airline,
        vehicle_type, vehicle_id, driver_id, supplier_id, customer_name, customer_price, supplier_cost,
        driver_payout, currency, payment_status, paid_amount, trip_status, special_instructions,
        created_by_id, created_by_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'usr_admin', ?, ?, ?)`,
      [
        b.id, b.booking_ref, b.booking_date, b.pickup_date, b.pickup_time, b.passenger_name, b.contact_number,
        b.passengers_count, b.luggage_count, b.pickup_location, b.dropoff_location, b.flight_number, b.airline,
        b.vehicle_type, b.vehicle_id, b.driver_id, b.supplier_id, b.customer_name, b.customer_price, b.supplier_cost,
        b.driver_payout, b.currency, b.payment_status, b.paid_amount, b.trip_status, b.special_instructions,
        b.created_by_name, now, now
      ]
    );

    // Initial status log
    db.run(
      `INSERT INTO trip_status_logs (id, booking_id, booking_ref, old_status, new_status, changed_by_name, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['log_' + b.id, b.id, b.booking_ref, 'New Booking', b.trip_status, 'System Initializer', now]
    );
  }

  // Seed sample payments
  const payments = [
    {
      id: 'pay_001',
      payment_ref: 'RCT-2026-0001',
      entity_type: 'customer_receipt',
      entity_name: 'Al-Rajhi Corporate Travel',
      booking_id: 'bk_001',
      booking_ref: 'GT-2026-0001',
      amount: 350,
      currency: 'SAR',
      payment_method: 'Bank Transfer',
      payment_date: yesterday,
      reference_no: 'FT-SA-9812450',
      notes: 'Full payment for Airport to Four Seasons transfer',
    },
    {
      id: 'pay_002',
      payment_ref: 'RCT-2026-0002',
      entity_type: 'customer_receipt',
      entity_name: 'Global Business Travel UK',
      booking_id: 'bk_002',
      booking_ref: 'GT-2026-0002',
      amount: 250,
      currency: 'SAR',
      payment_method: 'Credit Card',
      payment_date: todayStr,
      reference_no: 'CC-AUTH-887123',
      notes: 'Partial advance payment (balance 300 SAR payable upon trip completion)',
    },
    {
      id: 'pay_003',
      payment_ref: 'RCT-2026-0003',
      entity_type: 'customer_receipt',
      entity_name: 'Saudi Tech Summit Organizers',
      booking_id: 'bk_005',
      booking_ref: 'GT-2026-0005',
      amount: 900,
      currency: 'SAR',
      payment_method: 'Bank Transfer',
      payment_date: todayStr,
      reference_no: 'SABB-CORP-4401',
      notes: 'Full invoice settlement for Tech Delegation Hiace transfer',
    },
    {
      id: 'pay_004',
      payment_ref: 'PAY-DRV-0001',
      entity_type: 'driver_payment',
      entity_id: 'drv_01',
      entity_name: 'Muhammad Tariq Khan',
      booking_id: 'bk_001',
      booking_ref: 'GT-2026-0001',
      amount: 80,
      currency: 'SAR',
      payment_method: 'Cash',
      payment_date: yesterday,
      reference_no: 'CASH-REC-101',
      notes: 'Trip completion payout to driver',
    },
    {
      id: 'pay_005',
      payment_ref: 'PAY-SUP-0001',
      entity_type: 'supplier_payment',
      entity_id: 'sup_01',
      entity_name: 'Al-Safwa Transport Fleet Co.',
      booking_id: null,
      booking_ref: null,
      amount: 1500,
      currency: 'SAR',
      payment_method: 'Bank Transfer',
      payment_date: yesterday,
      reference_no: 'NCB-WIRE-77312',
      notes: 'Weekly supplier statement batch settlement',
    },
  ];

  for (const p of payments) {
    db.run(
      `INSERT INTO payments (id, payment_ref, entity_type, entity_id, entity_name, booking_id, booking_ref, amount, currency, payment_method, payment_date, reference_no, notes, created_by_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Hassan Al-Shehri', ?)`,
      [p.id, p.payment_ref, p.entity_type, p.entity_id || null, p.entity_name, p.booking_id || null, p.booking_ref || null, p.amount, p.currency, p.payment_method, p.payment_date, p.reference_no, p.notes, now]
    );
  }

  // System Settings Defaults
  const settings = [
    {
      key: 'company_profile',
      value: JSON.stringify({
        company_name: 'Gulf Taxis Dispatch Cloud System',
        short_name: 'Gulf Taxis',
        tagline: 'Premium Transport Booking & Fleet Dispatch Solutions',
        email: 'dispatch@gulftaxis.com',
        phone: '+966 11 234 5678',
        whatsapp: '+966 50 123 4567',
        address: 'King Fahd Road, Al Olaya District, Riyadh 12211, Kingdom of Saudi Arabia',
        cr_number: '1010892341',
        vat_number: '310293847500003',
        default_currency: 'SAR',
        supported_currencies: ['SAR', 'USD', 'AED', 'EUR', 'GBP', 'KWD', 'QAR', 'BHD', 'OMR'],
        timezone: 'Asia/Riyadh',
        booking_prefix: 'GT-2026-',
      }),
    },
    {
      key: 'vehicle_types',
      value: JSON.stringify([
        'Sedan (Camry / Lexus ES)',
        'SUV (Yukon / Tahoe)',
        'Hyundai Staria VIP',
        'Mercedes-Benz S-Class / VIP',
        'Toyota Hiace Minivan',
        'Toyota Coaster Minibus',
        'Luxury Coach Bus 49-Seater',
      ]),
    },
    {
      key: 'cancellation_policy',
      value: JSON.stringify({
        allow_refund: true,
        cancellation_fee_percentage: 15,
        free_cancellation_hours: 6,
      }),
    },
  ];

  for (const s of settings) {
    db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
  }

  // Record initial audit log
  db.run(
    `INSERT INTO audit_logs (id, user_id, user_name, action, entity, entity_id, details, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['aud_init', 'usr_superadmin', 'Fahad Al-Otaibi', 'CREATE', 'system', 'system', 'Gulf Taxis dispatch system initialized with default configurations', now]
  );
}
