// server.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path4 from "path";
import fs4 from "fs";

// server/db.ts
import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
var DATA_DIR = path.resolve(process.cwd(), "data");
var DB_FILE = path.join(DATA_DIR, "gulf_taxis.sqlite");
var BACKUPS_DIR = path.join(DATA_DIR, "backups");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}
var dbInstance = null;
async function getDb() {
  if (dbInstance) {
    return dbInstance;
  }
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (err) {
      console.error("Failed to read existing database file, creating a new one:", err);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }
  initSchema(dbInstance);
  persistDb();
  return dbInstance;
}
function persistDb() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error("Failed to persist database to file:", err);
  }
}
function setDbInstance(newDb) {
  dbInstance = newDb;
  persistDb();
}
function runSql(sql, params = []) {
  if (!dbInstance) throw new Error("Database not initialized");
  dbInstance.run(sql, params);
  persistDb();
}
function runTransaction(callback) {
  if (!dbInstance) throw new Error("Database not initialized");
  dbInstance.run("BEGIN TRANSACTION;");
  try {
    const result = callback();
    dbInstance.run("COMMIT;");
    persistDb();
    return result;
  } catch (err) {
    try {
      dbInstance.run("ROLLBACK;");
    } catch (rbErr) {
      console.error("Failed to rollback transaction:", rbErr);
    }
    throw err;
  }
}
function queryAll(sql, params = []) {
  if (!dbInstance) throw new Error("Database not initialized");
  const stmt = dbInstance.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}
function queryOne(sql, params = []) {
  const all = queryAll(sql, params);
  return all.length > 0 ? all[0] : null;
}
function initSchema(db) {
  db.run("PRAGMA foreign_keys = ON;");
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
    db.run("ALTER TABLE bookings ADD COLUMN supplier_reference TEXT;");
  } catch (e) {
  }
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
  try {
    db.run("ALTER TABLE payments ADD COLUMN expense_category TEXT;");
  } catch (e) {
  }
  try {
    db.run("ALTER TABLE payments ADD COLUMN updated_at TEXT;");
  } catch (e) {
  }
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
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
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
  const adminCheck = db.exec("SELECT count(*) as count FROM users WHERE role = 'super_admin'");
  const adminCount = adminCheck[0]?.values[0]?.[0] || 0;
  if (adminCount === 0) {
    seedInitialData(db);
  }
}
function seedInitialData(db) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const defaultSalt = bcrypt.genSaltSync(10);
  const adminPasswordHash = bcrypt.hashSync("Admin@123", defaultSalt);
  const agentPasswordHash = bcrypt.hashSync("Agent@123", defaultSalt);
  const dispatchPasswordHash = bcrypt.hashSync("Dispatch@123", defaultSalt);
  const financePasswordHash = bcrypt.hashSync("Finance@123", defaultSalt);
  const viewerPasswordHash = bcrypt.hashSync("Viewer@123", defaultSalt);
  const users = [
    {
      id: "usr_superadmin",
      username: "superadmin",
      email: "superadmin@gulftaxis.com",
      password_hash: adminPasswordHash,
      full_name: "Fahad Al-Otaibi",
      role: "super_admin",
      phone: "+966 50 123 4567",
      permissions: JSON.stringify(["all"])
    },
    {
      id: "usr_admin",
      username: "admin",
      email: "admin@gulftaxis.com",
      password_hash: adminPasswordHash,
      full_name: "Mansour Al-Harbi",
      role: "admin",
      phone: "+966 50 234 5678",
      permissions: JSON.stringify(["dashboard", "bookings", "dispatch", "drivers", "vehicles", "suppliers", "payments", "reports", "settings"])
    },
    {
      id: "usr_agent",
      username: "agent",
      email: "agent@gulftaxis.com",
      password_hash: agentPasswordHash,
      full_name: "Sara Al-Ghamdi",
      role: "booking_agent",
      phone: "+966 50 345 6789",
      permissions: JSON.stringify(["dashboard", "bookings", "dispatch", "reports"])
    },
    {
      id: "usr_dispatcher",
      username: "dispatcher",
      email: "dispatcher@gulftaxis.com",
      password_hash: dispatchPasswordHash,
      full_name: "Tariq Al-Zahrani",
      role: "dispatcher",
      phone: "+966 50 456 7890",
      permissions: JSON.stringify(["dashboard", "bookings", "dispatch", "drivers", "vehicles"])
    },
    {
      id: "usr_finance",
      username: "finance",
      email: "finance@gulftaxis.com",
      password_hash: financePasswordHash,
      full_name: "Hassan Al-Shehri",
      role: "finance_executive",
      phone: "+966 50 567 8901",
      permissions: JSON.stringify(["dashboard", "bookings", "payments", "reports"])
    },
    {
      id: "usr_viewer",
      username: "viewer",
      email: "viewer@gulftaxis.com",
      password_hash: viewerPasswordHash,
      full_name: "Reem Al-Dossari",
      role: "report_viewer",
      phone: "+966 50 678 9012",
      permissions: JSON.stringify(["dashboard", "reports"])
    }
  ];
  for (const u of users) {
    db.run(
      `INSERT INTO users (id, username, email, password_hash, full_name, role, phone, permissions, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [u.id, u.username, u.email, u.password_hash, u.full_name, u.role, u.phone, u.permissions, now, now]
    );
  }
  const vehicles = [
    {
      id: "veh_01",
      reg_number: "KSA 4512 BDA",
      vehicle_type: "Sedan (Camry / Lexus ES)",
      make_model: "Toyota Camry 2025",
      passenger_capacity: 4,
      luggage_capacity: 3,
      status: "available",
      color: "Pearl White",
      model_year: 2025,
      notes: "VIP Executive sedan, fully clean with water bottles and phone chargers"
    },
    {
      id: "veh_02",
      reg_number: "KSA 8890 RKA",
      vehicle_type: "SUV (Yukon / Tahoe)",
      make_model: "GMC Yukon XL 2024",
      passenger_capacity: 7,
      luggage_capacity: 6,
      status: "available",
      color: "Onyx Black",
      model_year: 2024,
      notes: "Luxury family VIP vehicle, airport transfer specialist"
    },
    {
      id: "veh_03",
      reg_number: "KSA 6723 HTA",
      vehicle_type: "Hyundai Staria VIP",
      make_model: "Hyundai Staria Lounge 2025",
      passenger_capacity: 7,
      luggage_capacity: 5,
      status: "available",
      color: "Silver Metallic",
      model_year: 2025,
      notes: "Executive 7-seater business class reclining seats"
    },
    {
      id: "veh_04",
      reg_number: "KSA 1102 NMA",
      vehicle_type: "Toyota Hiace Minivan",
      make_model: "Toyota Hiace Grandia 2024",
      passenger_capacity: 10,
      luggage_capacity: 8,
      status: "available",
      color: "White",
      model_year: 2024,
      notes: "Group travel and pilgrim transfer vehicle"
    },
    {
      id: "veh_05",
      reg_number: "KSA 3394 LRA",
      vehicle_type: "Toyota Coaster Minibus",
      make_model: "Toyota Coaster 2023",
      passenger_capacity: 22,
      luggage_capacity: 15,
      status: "available",
      color: "White with Blue Stripe",
      model_year: 2023,
      notes: "Corporate conference and tour coach"
    }
  ];
  for (const v of vehicles) {
    db.run(
      `INSERT INTO vehicles (id, reg_number, vehicle_type, make_model, passenger_capacity, luggage_capacity, status, color, model_year, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [v.id, v.reg_number, v.vehicle_type, v.make_model, v.passenger_capacity, v.luggage_capacity, v.status, v.color, v.model_year, v.notes, now, now]
    );
  }
  const drivers = [
    {
      id: "drv_01",
      driver_code: "DRV-101",
      full_name: "Muhammad Tariq Khan",
      mobile: "+966 54 881 9201",
      email: "tariq.driver@gulftaxis.com",
      license_number: "KSA-LIC-891024",
      license_expiry: "2028-06-30",
      assigned_vehicle_id: "veh_01",
      payment_arrangement: "per_trip",
      rate_or_salary: 80,
      currency: "SAR",
      current_balance: 450,
      notes: "Fluent in English and Arabic. 8 years airport transfer experience."
    },
    {
      id: "drv_02",
      driver_code: "DRV-102",
      full_name: "Abdulrahman Al-Balawi",
      mobile: "+966 55 334 7781",
      email: "abdulrahman.driver@gulftaxis.com",
      license_number: "KSA-LIC-771923",
      license_expiry: "2027-11-15",
      assigned_vehicle_id: "veh_02",
      payment_arrangement: "per_trip",
      rate_or_salary: 120,
      currency: "SAR",
      current_balance: 620,
      notes: "VIP customer specialist. Knows Riyadh and Jeddah hotel routes thoroughly."
    },
    {
      id: "drv_03",
      driver_code: "DRV-103",
      full_name: "Sardar Bilal Ahmed",
      mobile: "+966 56 990 4123",
      email: "bilal.driver@gulftaxis.com",
      license_number: "KSA-LIC-654091",
      license_expiry: "2028-02-28",
      assigned_vehicle_id: "veh_03",
      payment_arrangement: "monthly",
      rate_or_salary: 3500,
      currency: "SAR",
      current_balance: 0,
      notes: "Hyundai Staria VIP dedicated chauffeur."
    },
    {
      id: "drv_04",
      driver_code: "DRV-104",
      full_name: "Kareem Mostafa",
      mobile: "+966 50 119 6432",
      email: "kareem.driver@gulftaxis.com",
      license_number: "KSA-LIC-442190",
      license_expiry: "2027-08-20",
      assigned_vehicle_id: "veh_04",
      payment_arrangement: "per_trip",
      rate_or_salary: 150,
      currency: "SAR",
      current_balance: 300,
      notes: "High passenger capacity license. Excellent safety record."
    }
  ];
  for (const d of drivers) {
    db.run(
      `INSERT INTO drivers (id, driver_code, full_name, mobile, email, license_number, license_expiry, assigned_vehicle_id, payment_arrangement, rate_or_salary, currency, is_active, current_balance, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      [d.id, d.driver_code, d.full_name, d.mobile, d.email, d.license_number, d.license_expiry, d.assigned_vehicle_id, d.payment_arrangement, d.rate_or_salary, d.currency, d.current_balance, d.notes, now, now]
    );
  }
  const suppliers = [
    {
      id: "sup_01",
      supplier_code: "SUP-01",
      name: "Al-Safwa Transport Fleet Co.",
      contact_person: "Majid Al-Qahtani",
      mobile: "+966 53 112 4455",
      email: "dispatch@alsafwatransport.com",
      address: "King Fahd Road, Al Olaya, Riyadh, Saudi Arabia",
      default_currency: "SAR",
      opening_balance: 0,
      current_balance: 1400,
      payment_terms: "15_days",
      notes: "Main luxury SUV & VIP Sedan partner fleet provider in Riyadh"
    },
    {
      id: "sup_02",
      supplier_code: "SUP-02",
      name: "Hijaz Limousine & Bus Services",
      contact_person: "Osama Radwan",
      mobile: "+966 54 776 2211",
      email: "operations@hijazlimo.com",
      address: "Madinah Road, Al-Rawdah, Jeddah, Saudi Arabia",
      default_currency: "SAR",
      opening_balance: 0,
      current_balance: 850,
      payment_terms: "weekly",
      notes: "Coaster and Hiace buses for Makkah, Madinah, and Jeddah routes"
    },
    {
      id: "sup_03",
      supplier_code: "SUP-03",
      name: "Gulf Executive Chauffeur Dubai",
      contact_person: "Nasser Al-Falasi",
      mobile: "+971 50 882 1993",
      email: "partners@gulfexecutive.ae",
      address: "Business Bay, Dubai, UAE",
      default_currency: "AED",
      opening_balance: 0,
      current_balance: 450,
      payment_terms: "30_days",
      notes: "Cross-border and UAE partner network for Gulf Taxis VIP accounts"
    }
  ];
  for (const s of suppliers) {
    db.run(
      `INSERT INTO suppliers (id, supplier_code, name, contact_person, mobile, email, address, default_currency, opening_balance, current_balance, payment_terms, is_active, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [s.id, s.supplier_code, s.name, s.contact_person, s.mobile, s.email, s.address, s.default_currency, s.opening_balance, s.current_balance, s.payment_terms, s.notes, now, now]
    );
  }
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 864e5).toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 864e5).toISOString().split("T")[0];
  const bookings = [
    {
      id: "bk_001",
      booking_ref: "GT-2026-0001",
      booking_date: yesterday,
      pickup_date: yesterday,
      pickup_time: "14:30",
      passenger_name: "Dr. Khalid Al-Mutairi",
      contact_number: "+966 50 998 1122",
      passengers_count: 2,
      luggage_count: 2,
      pickup_location: "King Khalid International Airport (RUH) - Terminal 4",
      dropoff_location: "Four Seasons Hotel Riyadh, Kingdom Centre",
      flight_number: "SV 1024",
      airline: "Saudia",
      vehicle_type: "Sedan (Camry / Lexus ES)",
      vehicle_id: "veh_01",
      driver_id: "drv_01",
      supplier_id: "sup_01",
      customer_name: "Al-Rajhi Corporate Travel",
      customer_price: 350,
      supplier_cost: 200,
      driver_payout: 80,
      currency: "SAR",
      payment_status: "paid",
      paid_amount: 350,
      trip_status: "Trip Completed",
      special_instructions: "Name board: Dr. Khalid Al-Mutairi. Meet inside arrivals hall.",
      created_by_name: "Sara Al-Ghamdi"
    },
    {
      id: "bk_002",
      booking_ref: "GT-2026-0002",
      booking_date: todayStr,
      pickup_date: todayStr,
      pickup_time: "11:00",
      passenger_name: "Mr. James Sterling",
      contact_number: "+44 7700 900123",
      passengers_count: 3,
      luggage_count: 4,
      pickup_location: "Ritz-Carlton Riyadh, Al Hada Area",
      dropoff_location: "King Khalid International Airport (RUH) - Terminal 1",
      flight_number: "BA 262",
      airline: "British Airways",
      vehicle_type: "SUV (Yukon / Tahoe)",
      vehicle_id: "veh_02",
      driver_id: "drv_02",
      supplier_id: "sup_01",
      customer_name: "Global Business Travel UK",
      customer_price: 550,
      supplier_cost: 320,
      driver_payout: 120,
      currency: "SAR",
      payment_status: "partial",
      paid_amount: 250,
      trip_status: "Passenger Picked Up",
      special_instructions: "Executive client, luggage assistance required",
      created_by_name: "Fahad Al-Otaibi"
    },
    {
      id: "bk_003",
      booking_ref: "GT-2026-0003",
      booking_date: todayStr,
      pickup_date: todayStr,
      pickup_time: "16:45",
      passenger_name: "Eng. Salem Bakhsh",
      contact_number: "+966 55 441 2288",
      passengers_count: 4,
      luggage_count: 4,
      pickup_location: "King Abdulaziz International Airport (JED) - Terminal 1",
      dropoff_location: "Hilton Makkah Convention Hotel",
      flight_number: "EK 803",
      airline: "Emirates",
      vehicle_type: "Hyundai Staria VIP",
      vehicle_id: "veh_03",
      driver_id: "drv_03",
      supplier_id: "sup_02",
      customer_name: "Dar Al-Iman Umrah Tours",
      customer_price: 650,
      supplier_cost: 400,
      driver_payout: 0,
      // monthly salaried driver
      currency: "SAR",
      payment_status: "unpaid",
      paid_amount: 0,
      trip_status: "Driver Notified",
      special_instructions: "Family with two children. Please provide child safety booster.",
      created_by_name: "Sara Al-Ghamdi"
    },
    {
      id: "bk_004",
      booking_ref: "GT-2026-0004",
      booking_date: todayStr,
      pickup_date: todayStr,
      pickup_time: "19:15",
      passenger_name: "Madame Sophie Laurent",
      contact_number: "+33 6 12 34 56 78",
      passengers_count: 1,
      luggage_count: 2,
      pickup_location: "King Khalid International Airport (RUH) - Terminal 2",
      dropoff_location: "Fairmont Riyadh, Business Gate",
      flight_number: "AF 742",
      airline: "Air France",
      vehicle_type: "Sedan (Camry / Lexus ES)",
      vehicle_id: null,
      driver_id: null,
      supplier_id: null,
      customer_name: "Direct Online Client",
      customer_price: 320,
      supplier_cost: 180,
      driver_payout: 80,
      currency: "SAR",
      payment_status: "unpaid",
      paid_amount: 0,
      trip_status: "Awaiting Assignment",
      special_instructions: "Flight on time. VIP meet and greet requested.",
      created_by_name: "Mansour Al-Harbi"
    },
    {
      id: "bk_005",
      booking_ref: "GT-2026-0005",
      booking_date: todayStr,
      pickup_date: tomorrow,
      pickup_time: "08:30",
      passenger_name: "Tech Delegation (Group of 8)",
      contact_number: "+966 50 771 9900",
      passengers_count: 8,
      luggage_count: 8,
      pickup_location: "Crowne Plaza Riyadh RDC Hotel",
      dropoff_location: "King Abdullah Financial District (KAFD) Conference Center",
      flight_number: "",
      airline: "",
      vehicle_type: "Toyota Hiace Minivan",
      vehicle_id: "veh_04",
      driver_id: "drv_04",
      supplier_id: "sup_01",
      customer_name: "Saudi Tech Summit Organizers",
      customer_price: 900,
      supplier_cost: 500,
      driver_payout: 150,
      currency: "SAR",
      payment_status: "paid",
      paid_amount: 900,
      trip_status: "Assigned",
      special_instructions: "Full day standby transfer service for summit attendees.",
      created_by_name: "Tariq Al-Zahrani"
    }
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
        b.id,
        b.booking_ref,
        b.booking_date,
        b.pickup_date,
        b.pickup_time,
        b.passenger_name,
        b.contact_number,
        b.passengers_count,
        b.luggage_count,
        b.pickup_location,
        b.dropoff_location,
        b.flight_number,
        b.airline,
        b.vehicle_type,
        b.vehicle_id,
        b.driver_id,
        b.supplier_id,
        b.customer_name,
        b.customer_price,
        b.supplier_cost,
        b.driver_payout,
        b.currency,
        b.payment_status,
        b.paid_amount,
        b.trip_status,
        b.special_instructions,
        b.created_by_name,
        now,
        now
      ]
    );
    db.run(
      `INSERT INTO trip_status_logs (id, booking_id, booking_ref, old_status, new_status, changed_by_name, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ["log_" + b.id, b.id, b.booking_ref, "New Booking", b.trip_status, "System Initializer", now]
    );
  }
  const payments = [
    {
      id: "pay_001",
      payment_ref: "RCT-2026-0001",
      entity_type: "customer_receipt",
      entity_name: "Al-Rajhi Corporate Travel",
      booking_id: "bk_001",
      booking_ref: "GT-2026-0001",
      amount: 350,
      currency: "SAR",
      payment_method: "Bank Transfer",
      payment_date: yesterday,
      reference_no: "FT-SA-9812450",
      notes: "Full payment for Airport to Four Seasons transfer"
    },
    {
      id: "pay_002",
      payment_ref: "RCT-2026-0002",
      entity_type: "customer_receipt",
      entity_name: "Global Business Travel UK",
      booking_id: "bk_002",
      booking_ref: "GT-2026-0002",
      amount: 250,
      currency: "SAR",
      payment_method: "Credit Card",
      payment_date: todayStr,
      reference_no: "CC-AUTH-887123",
      notes: "Partial advance payment (balance 300 SAR payable upon trip completion)"
    },
    {
      id: "pay_003",
      payment_ref: "RCT-2026-0003",
      entity_type: "customer_receipt",
      entity_name: "Saudi Tech Summit Organizers",
      booking_id: "bk_005",
      booking_ref: "GT-2026-0005",
      amount: 900,
      currency: "SAR",
      payment_method: "Bank Transfer",
      payment_date: todayStr,
      reference_no: "SABB-CORP-4401",
      notes: "Full invoice settlement for Tech Delegation Hiace transfer"
    },
    {
      id: "pay_004",
      payment_ref: "PAY-DRV-0001",
      entity_type: "driver_payment",
      entity_id: "drv_01",
      entity_name: "Muhammad Tariq Khan",
      booking_id: "bk_001",
      booking_ref: "GT-2026-0001",
      amount: 80,
      currency: "SAR",
      payment_method: "Cash",
      payment_date: yesterday,
      reference_no: "CASH-REC-101",
      notes: "Trip completion payout to driver"
    },
    {
      id: "pay_005",
      payment_ref: "PAY-SUP-0001",
      entity_type: "supplier_payment",
      entity_id: "sup_01",
      entity_name: "Al-Safwa Transport Fleet Co.",
      booking_id: null,
      booking_ref: null,
      amount: 1500,
      currency: "SAR",
      payment_method: "Bank Transfer",
      payment_date: yesterday,
      reference_no: "NCB-WIRE-77312",
      notes: "Weekly supplier statement batch settlement"
    }
  ];
  for (const p of payments) {
    db.run(
      `INSERT INTO payments (id, payment_ref, entity_type, entity_id, entity_name, booking_id, booking_ref, amount, currency, payment_method, payment_date, reference_no, notes, created_by_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Hassan Al-Shehri', ?)`,
      [p.id, p.payment_ref, p.entity_type, p.entity_id || null, p.entity_name, p.booking_id || null, p.booking_ref || null, p.amount, p.currency, p.payment_method, p.payment_date, p.reference_no, p.notes, now]
    );
  }
  const settings = [
    {
      key: "company_profile",
      value: JSON.stringify({
        company_name: "Gulf Taxis Dispatch Cloud System",
        short_name: "Gulf Taxis",
        tagline: "Premium Transport Booking & Fleet Dispatch Solutions",
        email: "dispatch@gulftaxis.com",
        phone: "+966 11 234 5678",
        whatsapp: "+966 50 123 4567",
        address: "King Fahd Road, Al Olaya District, Riyadh 12211, Kingdom of Saudi Arabia",
        cr_number: "1010892341",
        vat_number: "310293847500003",
        default_currency: "SAR",
        supported_currencies: ["SAR", "USD", "AED", "EUR", "GBP", "KWD", "QAR", "BHD", "OMR"],
        timezone: "Asia/Riyadh",
        booking_prefix: "GT-2026-"
      })
    },
    {
      key: "vehicle_types",
      value: JSON.stringify([
        "Sedan (Camry / Lexus ES)",
        "SUV (Yukon / Tahoe)",
        "Hyundai Staria VIP",
        "Mercedes-Benz S-Class / VIP",
        "Toyota Hiace Minivan",
        "Toyota Coaster Minibus",
        "Luxury Coach Bus 49-Seater"
      ])
    },
    {
      key: "cancellation_policy",
      value: JSON.stringify({
        allow_refund: true,
        cancellation_fee_percentage: 15,
        free_cancellation_hours: 6
      })
    }
  ];
  for (const s of settings) {
    db.run("INSERT INTO settings (key, value) VALUES (?, ?)", [s.key, s.value]);
  }
  db.run(
    `INSERT INTO audit_logs (id, user_id, user_name, action, entity, entity_id, details, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ["aud_init", "usr_superadmin", "Fahad Al-Otaibi", "CREATE", "system", "system", "Gulf Taxis dispatch system initialized with default configurations", now]
  );
}

// server/routes/authRoutes.ts
import { Router } from "express";
import bcrypt2 from "bcryptjs";

// server/auth.ts
import jwt from "jsonwebtoken";
var JWT_SECRET = process.env.JWT_SECRET || "gulf_taxis_dispatch_secure_key_2026_riyadh_cloud";
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      permissions: user.permissions
    },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    return null;
  }
}
function requireAuth(req, res, next) {
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.gt_token) {
    token = req.cookies.gt_token;
  }
  if (!token) {
    return res.status(401).json({ error: "Authentication required. Please log in." });
  }
  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: "Session expired or invalid token. Please log in again." });
  }
  const dbUser = queryOne("SELECT id, is_active FROM users WHERE id = ?", [user.id]);
  if (!dbUser || dbUser.is_active !== 1) {
    return res.status(403).json({ error: "User account has been deactivated or removed." });
  }
  req.user = user;
  next();
}
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if (req.user.role === "super_admin") {
      return next();
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Permission denied. Your role (${req.user.role}) is not authorized for this operation.`
      });
    }
    next();
  };
}
function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if (req.user.role === "super_admin") {
      return next();
    }
    const permissions = req.user.permissions || [];
    if (permissions.includes("all") || permissions.includes(permissionKey)) {
      return next();
    }
    return res.status(403).json({
      error: `Access restricted. You do not have permission to access the '${permissionKey}' module.`
    });
  };
}
function recordAuditLog(userId, userName, action, entity, entityId, details, ipAddress) {
  try {
    const id = "aud_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    runSql(
      `INSERT INTO audit_logs (id, user_id, user_name, action, entity, entity_id, details, ip_address, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId || "system", userName || "System Action", action, entity, entityId, details, ipAddress || "", now]
    );
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

// server/routes/authRoutes.ts
var router = Router();
router.post("/login", async (req, res) => {
  const { usernameOrEmail, password } = req.body;
  if (!usernameOrEmail || !password) {
    return res.status(400).json({ error: "Please enter both username/email and password." });
  }
  const user = queryOne(
    `SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)`,
    [usernameOrEmail.trim(), usernameOrEmail.trim()]
  );
  if (!user) {
    return res.status(401).json({ error: "Invalid username/email or password." });
  }
  if (user.is_active !== 1) {
    return res.status(403).json({ error: "Your account has been deactivated. Please contact an administrator." });
  }
  const isMatch = bcrypt2.compareSync(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: "Invalid username/email or password." });
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  runSql(`UPDATE users SET last_login = ? WHERE id = ?`, [now, user.id]);
  let permissions = [];
  try {
    permissions = JSON.parse(user.permissions || "[]");
  } catch (e) {
    permissions = [];
  }
  const authUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    phone: user.phone,
    permissions
  };
  const token = generateToken(authUser);
  res.cookie("gt_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1e3
  });
  recordAuditLog(user.id, user.full_name, "LOGIN", "user", user.id, "User logged in successfully", req.ip);
  return res.json({
    token,
    user: authUser
  });
});
router.get("/me", requireAuth, (req, res) => {
  const user = queryOne(`SELECT id, username, email, full_name, role, phone, permissions, is_active FROM users WHERE id = ?`, [req.user.id]);
  if (!user || user.is_active !== 1) {
    return res.status(401).json({ error: "User session invalid." });
  }
  let permissions = [];
  try {
    permissions = JSON.parse(user.permissions || "[]");
  } catch (e) {
    permissions = [];
  }
  return res.json({
    user: {
      ...user,
      permissions
    }
  });
});
router.post("/logout", requireAuth, (req, res) => {
  res.clearCookie("gt_token");
  recordAuditLog(req.user?.id, req.user?.full_name, "LOGOUT", "user", req.user?.id || null, "User logged out", req.ip);
  return res.json({ success: true, message: "Logged out successfully" });
});
router.post("/forgot-password", (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Please provide your registered email address." });
  }
  const user = queryOne(`SELECT id, email, full_name FROM users WHERE LOWER(email) = LOWER(?)`, [email.trim()]);
  if (!user) {
    return res.json({
      success: true,
      message: "If the email exists in our records, password reset instructions have been dispatched to your system administrator."
    });
  }
  recordAuditLog(user.id, user.full_name, "FORGOT_PASSWORD", "user", user.id, `Password reset requested for ${user.email}`);
  return res.json({
    success: true,
    message: `A password reset link or temporary security code has been generated. Please contact your Gulf Taxis Super Administrator (admin@gulftaxis.com) to complete the verification.`
  });
});
router.post("/change-password", requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Both current and new passwords are required." });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }
  const user = queryOne(`SELECT password_hash FROM users WHERE id = ?`, [req.user.id]);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }
  const isMatch = bcrypt2.compareSync(currentPassword, user.password_hash);
  if (!isMatch) {
    return res.status(400).json({ error: "Current password is incorrect." });
  }
  const newHash = bcrypt2.hashSync(newPassword, 10);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  runSql(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`, [newHash, now, req.user.id]);
  recordAuditLog(req.user?.id, req.user?.full_name, "CHANGE_PASSWORD", "user", req.user?.id || null, "User changed their password");
  return res.json({ success: true, message: "Password successfully updated." });
});
var authRoutes_default = router;

// server/routes/bookingRoutes.ts
import { Router as Router2 } from "express";
var router2 = Router2();
function generateBookingRef() {
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const prefix = `GT-${currentYear}-`;
  const rows = queryAll(
    `SELECT booking_ref FROM bookings WHERE booking_ref LIKE ? ORDER BY booking_ref DESC LIMIT 1`,
    [`${prefix}%`]
  );
  let nextNum = 1;
  if (rows.length > 0 && rows[0].booking_ref) {
    const parts = rows[0].booking_ref.split("-");
    const lastNumStr = parts[parts.length - 1];
    const parsed = parseInt(lastNumStr, 10);
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }
  return `${prefix}${nextNum.toString().padStart(4, "0")}`;
}
router2.get("/", requireAuth, requirePermission("bookings"), (req, res) => {
  const {
    search,
    status,
    startDate,
    endDate,
    driverId,
    supplierId,
    vehicleId,
    vehicleType,
    flightNumber,
    paymentStatus,
    limit,
    offset
  } = req.query;
  let sql = `
    SELECT 
      b.*,
      d.full_name as driver_name,
      d.mobile as driver_phone,
      v.reg_number as vehicle_reg,
      v.make_model as vehicle_model,
      s.name as supplier_name
    FROM bookings b
    LEFT JOIN drivers d ON b.driver_id = d.id
    LEFT JOIN vehicles v ON b.vehicle_id = v.id
    LEFT JOIN suppliers s ON b.supplier_id = s.id
    WHERE 1=1
  `;
  const params = [];
  if (search && typeof search === "string" && search.trim() !== "") {
    const term = `%${search.trim()}%`;
    sql += ` AND (
      b.booking_ref LIKE ? OR 
      b.passenger_name LIKE ? OR 
      b.contact_number LIKE ? OR 
      b.pickup_location LIKE ? OR 
      b.dropoff_location LIKE ? OR 
      b.customer_name LIKE ? OR 
      b.flight_number LIKE ?
    )`;
    params.push(term, term, term, term, term, term, term);
  }
  if (status && status !== "all") {
    sql += ` AND b.trip_status = ?`;
    params.push(status);
  }
  if (startDate) {
    sql += ` AND b.pickup_date >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    sql += ` AND b.pickup_date <= ?`;
    params.push(endDate);
  }
  if (driverId && driverId !== "all") {
    sql += ` AND b.driver_id = ?`;
    params.push(driverId);
  }
  if (supplierId && supplierId !== "all") {
    sql += ` AND b.supplier_id = ?`;
    params.push(supplierId);
  }
  if (vehicleId && vehicleId !== "all") {
    sql += ` AND b.vehicle_id = ?`;
    params.push(vehicleId);
  }
  if (vehicleType && vehicleType !== "all") {
    sql += ` AND b.vehicle_type = ?`;
    params.push(vehicleType);
  }
  if (flightNumber) {
    sql += ` AND b.flight_number LIKE ?`;
    params.push(`%${flightNumber}%`);
  }
  if (paymentStatus && paymentStatus !== "all") {
    sql += ` AND b.payment_status = ?`;
    params.push(paymentStatus);
  }
  sql += ` ORDER BY b.pickup_date DESC, b.pickup_time DESC`;
  const parsedLimit = limit ? parseInt(limit, 10) : 500;
  sql += ` LIMIT ${parsedLimit}`;
  if (offset) {
    sql += ` OFFSET ${parseInt(offset, 10)}`;
  }
  const bookings = queryAll(sql, params);
  return res.json({ bookings, count: bookings.length });
});
router2.get("/:id", requireAuth, requirePermission("bookings"), (req, res) => {
  const { id } = req.params;
  const booking = queryOne(
    `
    SELECT 
      b.*,
      d.full_name as driver_name,
      d.mobile as driver_phone,
      v.reg_number as vehicle_reg,
      v.make_model as vehicle_model,
      s.name as supplier_name
    FROM bookings b
    LEFT JOIN drivers d ON b.driver_id = d.id
    LEFT JOIN vehicles v ON b.vehicle_id = v.id
    LEFT JOIN suppliers s ON b.supplier_id = s.id
    WHERE b.id = ? OR b.booking_ref = ?
  `,
    [id, id]
  );
  if (!booking) {
    return res.status(404).json({ error: "Booking not found." });
  }
  const statusHistory = queryAll(
    `SELECT * FROM trip_status_logs WHERE booking_id = ? ORDER BY timestamp DESC`,
    [booking.id]
  );
  const payments = queryAll(
    `SELECT * FROM payments WHERE booking_id = ? ORDER BY payment_date DESC, created_at DESC`,
    [booking.id]
  );
  return res.json({
    booking,
    statusHistory,
    payments
  });
});
router2.post("/", requireAuth, requirePermission("bookings"), (req, res) => {
  const {
    booking_date,
    pickup_date,
    pickup_time,
    passenger_name,
    contact_number,
    passengers_count,
    luggage_count,
    pickup_location,
    dropoff_location,
    flight_number,
    airline,
    vehicle_type,
    vehicle_id,
    driver_id,
    supplier_id,
    customer_name,
    customer_phone,
    customer_price,
    supplier_cost,
    driver_payout,
    currency,
    payment_status,
    paid_amount,
    trip_status,
    special_instructions,
    dispatcher_notes,
    supplier_reference
  } = req.body;
  if (!pickup_date || !pickup_time || !passenger_name || !contact_number || !pickup_location || !dropoff_location) {
    return res.status(400).json({
      error: "Please fill in all required fields: Pickup Date, Pickup Time, Passenger Name, Contact Number, Pickup Location, and Drop-off Location."
    });
  }
  let effectiveCustomerName = customer_name ? customer_name.trim() : "";
  if (!effectiveCustomerName) {
    if (supplier_id) {
      const s = queryOne("SELECT name FROM suppliers WHERE id = ?", [supplier_id]);
      effectiveCustomerName = s?.name ? `Supplier: ${s.name}` : "Direct Client";
    } else {
      effectiveCustomerName = passenger_name.trim();
    }
  }
  if (driver_id) {
    const drv = queryOne("SELECT full_name, is_active FROM drivers WHERE id = ?", [driver_id]);
    if (drv && drv.is_active === 0) {
      return res.status(400).json({ error: `Driver ${drv.full_name} is marked as inactive and cannot receive new assignments.` });
    }
  }
  if (vehicle_id) {
    const veh = queryOne("SELECT reg_number, status FROM vehicles WHERE id = ?", [vehicle_id]);
    if (veh && veh.status === "inactive") {
      return res.status(400).json({ error: `Vehicle ${veh.reg_number} is marked as inactive and cannot receive new assignments.` });
    }
  }
  const effectiveVehicleType = vehicle_type || "Sedan (Camry / Lexus ES)";
  const duplicateCheck = queryOne(
    `SELECT id, booking_ref FROM bookings 
     WHERE LOWER(passenger_name) = LOWER(?) 
       AND pickup_date = ? 
       AND pickup_time = ? 
       AND LOWER(pickup_location) = LOWER(?)
     LIMIT 1`,
    [passenger_name.trim(), pickup_date, pickup_time, pickup_location.trim()]
  );
  if (duplicateCheck) {
    return res.status(409).json({
      error: `A matching booking already exists (${duplicateCheck.booking_ref}) for this passenger, date, and pickup location. If this is intentional, modify the time or special notes.`,
      duplicateBookingRef: duplicateCheck.booking_ref
    });
  }
  const id = "bk_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
  const booking_ref = generateBookingRef();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const actualBookingDate = booking_date || now.split("T")[0];
  const initialStatus = trip_status || (driver_id ? "Assigned" : "Awaiting Assignment");
  runSql(
    `INSERT INTO bookings (
      id, booking_ref, booking_date, pickup_date, pickup_time, passenger_name, contact_number,
      passengers_count, luggage_count, pickup_location, dropoff_location, flight_number, airline,
      vehicle_type, vehicle_id, driver_id, supplier_id, customer_name, customer_phone,
      customer_price, supplier_cost, driver_payout, currency, payment_status, paid_amount,
      trip_status, special_instructions, dispatcher_notes, supplier_reference,
      created_by_id, created_by_name, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )`,
    [
      id,
      booking_ref,
      actualBookingDate,
      pickup_date,
      pickup_time,
      passenger_name.trim(),
      contact_number.trim(),
      parseInt(passengers_count, 10) || 1,
      parseInt(luggage_count, 10) || 0,
      pickup_location.trim(),
      dropoff_location.trim(),
      flight_number?.trim() || null,
      airline?.trim() || null,
      effectiveVehicleType,
      vehicle_id || null,
      driver_id || null,
      supplier_id || null,
      effectiveCustomerName,
      customer_phone?.trim() || null,
      parseFloat(customer_price) || 0,
      parseFloat(supplier_cost) || 0,
      parseFloat(driver_payout) || 0,
      currency || "SAR",
      payment_status || "unpaid",
      parseFloat(paid_amount) || 0,
      initialStatus,
      special_instructions || null,
      dispatcher_notes || null,
      supplier_reference?.trim() || null,
      req.user?.id || "system",
      req.user?.full_name || "System User",
      now,
      now
    ]
  );
  runSql(
    `INSERT INTO trip_status_logs (id, booking_id, booking_ref, old_status, new_status, changed_by_id, changed_by_name, notes, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "log_" + Date.now(),
      id,
      booking_ref,
      "New Booking",
      initialStatus,
      req.user?.id,
      req.user?.full_name,
      "Initial booking creation",
      now
    ]
  );
  if (driver_id && vehicle_id) {
    runSql(`UPDATE vehicles SET status = 'on_trip' WHERE id = ?`, [vehicle_id]);
  }
  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    "CREATE",
    "booking",
    id,
    `Created booking ${booking_ref} for ${passenger_name} (${pickup_date} ${pickup_time})`
  );
  const createdBooking = queryOne(`SELECT * FROM bookings WHERE id = ?`, [id]);
  return res.status(201).json({
    success: true,
    message: `Booking ${booking_ref} successfully created and saved.`,
    booking: createdBooking
  });
});
router2.put("/:id", requireAuth, requirePermission("bookings"), (req, res) => {
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM bookings WHERE id = ?`, [id]);
  if (!existing) {
    return res.status(404).json({ error: "Booking not found." });
  }
  const {
    booking_date,
    pickup_date,
    pickup_time,
    passenger_name,
    contact_number,
    passengers_count,
    luggage_count,
    pickup_location,
    dropoff_location,
    flight_number,
    airline,
    vehicle_type,
    vehicle_id,
    driver_id,
    supplier_id,
    customer_name,
    customer_phone,
    customer_price,
    supplier_cost,
    driver_payout,
    currency,
    payment_status,
    paid_amount,
    trip_status,
    special_instructions,
    dispatcher_notes,
    cancellation_reason,
    supplier_reference
  } = req.body;
  if (driver_id && driver_id !== existing.driver_id) {
    const drv = queryOne("SELECT full_name, is_active FROM drivers WHERE id = ?", [driver_id]);
    if (drv && drv.is_active === 0) {
      return res.status(400).json({ error: `Driver ${drv.full_name} is marked as inactive and cannot receive new assignments.` });
    }
  }
  if (vehicle_id && vehicle_id !== existing.vehicle_id) {
    const veh = queryOne("SELECT reg_number, status FROM vehicles WHERE id = ?", [vehicle_id]);
    if (veh && veh.status === "inactive") {
      return res.status(400).json({ error: `Vehicle ${veh.reg_number} is marked as inactive and cannot receive new assignments.` });
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const newStatus = trip_status || existing.trip_status;
  if (newStatus !== existing.trip_status) {
    runSql(
      `INSERT INTO trip_status_logs (id, booking_id, booking_ref, old_status, new_status, changed_by_id, changed_by_name, notes, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "log_" + Date.now(),
        id,
        existing.booking_ref,
        existing.trip_status,
        newStatus,
        req.user?.id,
        req.user?.full_name,
        cancellation_reason || dispatcher_notes || "Status updated via booking edit",
        now
      ]
    );
  }
  runSql(
    `UPDATE bookings SET
      booking_date = ?,
      pickup_date = ?,
      pickup_time = ?,
      passenger_name = ?,
      contact_number = ?,
      passengers_count = ?,
      luggage_count = ?,
      pickup_location = ?,
      dropoff_location = ?,
      flight_number = ?,
      airline = ?,
      vehicle_type = ?,
      vehicle_id = ?,
      driver_id = ?,
      supplier_id = ?,
      customer_name = ?,
      customer_phone = ?,
      customer_price = ?,
      supplier_cost = ?,
      driver_payout = ?,
      currency = ?,
      payment_status = ?,
      paid_amount = ?,
      trip_status = ?,
      special_instructions = ?,
      dispatcher_notes = ?,
      cancellation_reason = ?,
      supplier_reference = ?,
      updated_by_id = ?,
      updated_by_name = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      booking_date || existing.booking_date,
      pickup_date || existing.pickup_date,
      pickup_time || existing.pickup_time,
      passenger_name ? passenger_name.trim() : existing.passenger_name,
      contact_number ? contact_number.trim() : existing.contact_number,
      parseInt(passengers_count, 10) || existing.passengers_count,
      parseInt(luggage_count, 10) || existing.luggage_count,
      pickup_location ? pickup_location.trim() : existing.pickup_location,
      dropoff_location ? dropoff_location.trim() : existing.dropoff_location,
      flight_number !== void 0 ? flight_number : existing.flight_number,
      airline !== void 0 ? airline : existing.airline,
      vehicle_type || existing.vehicle_type,
      vehicle_id !== void 0 ? vehicle_id : existing.vehicle_id,
      driver_id !== void 0 ? driver_id : existing.driver_id,
      supplier_id !== void 0 ? supplier_id : existing.supplier_id,
      customer_name ? customer_name.trim() : existing.customer_name,
      customer_phone !== void 0 ? customer_phone : existing.customer_phone,
      customer_price !== void 0 ? parseFloat(customer_price) : existing.customer_price,
      supplier_cost !== void 0 ? parseFloat(supplier_cost) : existing.supplier_cost,
      driver_payout !== void 0 ? parseFloat(driver_payout) : existing.driver_payout,
      currency || existing.currency,
      payment_status || existing.payment_status,
      paid_amount !== void 0 ? parseFloat(paid_amount) : existing.paid_amount,
      newStatus,
      special_instructions !== void 0 ? special_instructions : existing.special_instructions,
      dispatcher_notes !== void 0 ? dispatcher_notes : existing.dispatcher_notes,
      cancellation_reason !== void 0 ? cancellation_reason : existing.cancellation_reason,
      supplier_reference !== void 0 ? supplier_reference : existing.supplier_reference,
      req.user?.id,
      req.user?.full_name,
      now,
      id
    ]
  );
  if (newStatus !== existing.trip_status) {
    if (newStatus === "Trip Completed" && existing.trip_status !== "Trip Completed") {
      const effDriverId = driver_id !== void 0 ? driver_id : existing.driver_id;
      const effPayout = driver_payout !== void 0 ? parseFloat(driver_payout) : existing.driver_payout;
      if (effDriverId && effPayout > 0) {
        runSql(`UPDATE drivers SET current_balance = current_balance + ? WHERE id = ?`, [effPayout, effDriverId]);
      }
      const effSupplierId = supplier_id !== void 0 ? supplier_id : existing.supplier_id;
      const effCost = supplier_cost !== void 0 ? parseFloat(supplier_cost) : existing.supplier_cost;
      if (effSupplierId && effCost > 0) {
        runSql(`UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ?`, [effCost, effSupplierId]);
      }
      const effVehId = vehicle_id !== void 0 ? vehicle_id : existing.vehicle_id;
      if (effVehId) {
        runSql(`UPDATE vehicles SET status = 'available' WHERE id = ?`, [effVehId]);
      }
    } else if (existing.trip_status === "Trip Completed" && newStatus !== "Trip Completed") {
      if (existing.driver_id && existing.driver_payout > 0) {
        runSql(`UPDATE drivers SET current_balance = current_balance - ? WHERE id = ?`, [existing.driver_payout, existing.driver_id]);
      }
      if (existing.supplier_id && existing.supplier_cost > 0) {
        runSql(`UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ?`, [existing.supplier_cost, existing.supplier_id]);
      }
      const effVehId = vehicle_id !== void 0 ? vehicle_id : existing.vehicle_id;
      if (effVehId && (newStatus === "Cancelled" || newStatus === "No Show")) {
        runSql(`UPDATE vehicles SET status = 'available' WHERE id = ?`, [effVehId]);
      }
    } else if (newStatus === "Cancelled" || newStatus === "No Show") {
      const effVehId = vehicle_id !== void 0 ? vehicle_id : existing.vehicle_id;
      if (effVehId) {
        runSql(`UPDATE vehicles SET status = 'available' WHERE id = ?`, [effVehId]);
      }
    }
  }
  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    "UPDATE",
    "booking",
    id,
    `Updated booking ${existing.booking_ref}`
  );
  const updated = queryOne(`SELECT * FROM bookings WHERE id = ?`, [id]);
  return res.json({
    success: true,
    message: `Booking ${existing.booking_ref} updated successfully.`,
    booking: updated
  });
});
router2.post("/:id/duplicate", requireAuth, requirePermission("bookings"), (req, res) => {
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM bookings WHERE id = ?`, [id]);
  if (!existing) {
    return res.status(404).json({ error: "Original booking not found." });
  }
  const newId = "bk_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
  const newRef = generateBookingRef();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  runSql(
    `INSERT INTO bookings (
      id, booking_ref, booking_date, pickup_date, pickup_time, passenger_name, contact_number,
      passengers_count, luggage_count, pickup_location, dropoff_location, flight_number, airline,
      vehicle_type, vehicle_id, driver_id, supplier_id, customer_name, customer_phone,
      customer_price, supplier_cost, driver_payout, currency, payment_status, paid_amount,
      trip_status, special_instructions, dispatcher_notes,
      created_by_id, created_by_name, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      'Awaiting Assignment', ?, ?,
      ?, ?, ?, ?
    )`,
    [
      newId,
      newRef,
      now.split("T")[0],
      existing.pickup_date,
      existing.pickup_time,
      existing.passenger_name + " (Duplicate)",
      existing.contact_number,
      existing.passengers_count,
      existing.luggage_count,
      existing.pickup_location,
      existing.dropoff_location,
      existing.flight_number,
      existing.airline,
      existing.vehicle_type,
      null,
      // Reset vehicle for dispatch
      null,
      // Reset driver
      existing.supplier_id,
      existing.customer_name,
      existing.customer_phone,
      existing.customer_price,
      existing.supplier_cost,
      existing.driver_payout,
      existing.currency,
      "unpaid",
      0,
      existing.special_instructions,
      `Duplicated from ${existing.booking_ref}`,
      req.user?.id,
      req.user?.full_name,
      now,
      now
    ]
  );
  runSql(
    `INSERT INTO trip_status_logs (id, booking_id, booking_ref, old_status, new_status, changed_by_name, notes, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "log_" + Date.now(),
      newId,
      newRef,
      "New Booking",
      "Awaiting Assignment",
      req.user?.full_name,
      `Duplicated from ${existing.booking_ref}`,
      now
    ]
  );
  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    "CREATE",
    "booking",
    newId,
    `Duplicated booking ${existing.booking_ref} to new booking ${newRef}`
  );
  const newBooking = queryOne(`SELECT * FROM bookings WHERE id = ?`, [newId]);
  return res.status(201).json({
    success: true,
    message: `Booking successfully duplicated with new reference ${newRef}.`,
    booking: newBooking
  });
});
router2.post("/:id/cancel", requireAuth, requirePermission("bookings"), (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const existing = queryOne(`SELECT * FROM bookings WHERE id = ?`, [id]);
  if (!existing) {
    return res.status(404).json({ error: "Booking not found." });
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  runSql(
    `UPDATE bookings SET trip_status = 'Cancelled', cancellation_reason = ?, updated_by_id = ?, updated_by_name = ?, updated_at = ? WHERE id = ?`,
    [reason || "Cancelled by dispatcher", req.user?.id, req.user?.full_name, now, id]
  );
  runSql(
    `INSERT INTO trip_status_logs (id, booking_id, booking_ref, old_status, new_status, changed_by_id, changed_by_name, notes, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "log_" + Date.now(),
      id,
      existing.booking_ref,
      existing.trip_status,
      "Cancelled",
      req.user?.id,
      req.user?.full_name,
      reason || "Cancelled",
      now
    ]
  );
  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    "CANCEL",
    "booking",
    id,
    `Cancelled booking ${existing.booking_ref}. Reason: ${reason || "Not specified"}`
  );
  return res.json({
    success: true,
    message: `Booking ${existing.booking_ref} has been marked as Cancelled.`
  });
});
router2.delete("/:id", requireAuth, (req, res) => {
  if (req.user?.role !== "super_admin" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Only administrators can delete booking records." });
  }
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM bookings WHERE id = ?`, [id]);
  if (!existing) {
    return res.status(404).json({ error: "Booking not found." });
  }
  runSql(`DELETE FROM bookings WHERE id = ?`, [id]);
  runSql(`DELETE FROM trip_status_logs WHERE booking_id = ?`, [id]);
  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    "DELETE",
    "booking",
    id,
    `Deleted booking ${existing.booking_ref} (${existing.passenger_name})`
  );
  return res.json({ success: true, message: `Booking ${existing.booking_ref} deleted.` });
});
var bookingRoutes_default = router2;

// server/routes/dispatchRoutes.ts
import { Router as Router3 } from "express";
var router3 = Router3();
router3.get("/", requireAuth, requirePermission("dispatch"), (req, res) => {
  const { date, status, unassignedOnly } = req.query;
  let sql = `
    SELECT 
      b.*,
      d.full_name as driver_name,
      d.mobile as driver_phone,
      d.driver_code,
      v.reg_number as vehicle_reg,
      v.make_model as vehicle_model,
      v.vehicle_type as vehicle_category,
      s.name as supplier_name
    FROM bookings b
    LEFT JOIN drivers d ON b.driver_id = d.id
    LEFT JOIN vehicles v ON b.vehicle_id = v.id
    LEFT JOIN suppliers s ON b.supplier_id = s.id
    WHERE 1=1
  `;
  const params = [];
  if (date) {
    sql += ` AND b.pickup_date = ?`;
    params.push(date);
  }
  if (unassignedOnly === "true") {
    sql += ` AND (b.driver_id IS NULL OR b.driver_id = '') AND b.trip_status NOT IN ('Cancelled', 'Trip Completed')`;
  } else if (status && status !== "all") {
    sql += ` AND b.trip_status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY b.pickup_date ASC, b.pickup_time ASC`;
  const trips = queryAll(sql, params);
  const availableDrivers = queryAll(
    `SELECT id, driver_code, full_name, mobile, assigned_vehicle_id, is_active FROM drivers WHERE is_active = 1 ORDER BY full_name ASC`
  );
  const availableVehicles = queryAll(
    `SELECT id, reg_number, vehicle_type, make_model, passenger_capacity, status FROM vehicles WHERE status != 'inactive' ORDER BY make_model ASC`
  );
  const suppliers = queryAll(
    `SELECT id, supplier_code, name, mobile FROM suppliers WHERE is_active = 1 ORDER BY name ASC`
  );
  return res.json({
    trips,
    availableDrivers,
    availableVehicles,
    suppliers
  });
});
router3.post("/check-conflicts", requireAuth, requirePermission("dispatch"), (req, res) => {
  const { bookingId, driverId, vehicleId, pickupDate, pickupTime } = req.body;
  const conflicts = [];
  if (!pickupDate || !pickupTime) {
    return res.json({ conflicts: [] });
  }
  const [targetH, targetM] = pickupTime.split(":").map((n) => parseInt(n, 10));
  const targetMinutes = (targetH || 0) * 60 + (targetM || 0);
  const existingTrips = queryAll(
    `SELECT id, booking_ref, passenger_name, pickup_date, pickup_time, driver_id, vehicle_id 
     FROM bookings 
     WHERE pickup_date = ? 
       AND id != ? 
       AND trip_status NOT IN ('Cancelled', 'Trip Completed', 'No Show')`,
    [pickupDate, bookingId || ""]
  );
  for (const t of existingTrips) {
    const [h, m] = (t.pickup_time || "00:00").split(":").map((n) => parseInt(n, 10));
    const tripMinutes = (h || 0) * 60 + (m || 0);
    const diffHours = Math.abs(tripMinutes - targetMinutes) / 60;
    if (diffHours < 2) {
      if (driverId && t.driver_id === driverId) {
        conflicts.push({
          type: "driver",
          bookingRef: t.booking_ref,
          passengerName: t.passenger_name,
          time: t.pickup_time
        });
      }
      if (vehicleId && t.vehicle_id === vehicleId) {
        conflicts.push({
          type: "vehicle",
          bookingRef: t.booking_ref,
          passengerName: t.passenger_name,
          time: t.pickup_time
        });
      }
    }
  }
  return res.json({
    hasConflict: conflicts.length > 0,
    conflicts
  });
});
router3.post("/assign", requireAuth, requirePermission("dispatch"), (req, res) => {
  const { bookingId, driverId, vehicleId, supplierId, forceOverride, dispatcherNotes } = req.body;
  const booking = queryOne(`SELECT * FROM bookings WHERE id = ?`, [bookingId]);
  if (!booking) {
    return res.status(404).json({ error: "Booking not found." });
  }
  const driver = driverId ? queryOne(`SELECT * FROM drivers WHERE id = ?`, [driverId]) : null;
  const vehicle = vehicleId ? queryOne(`SELECT * FROM vehicles WHERE id = ?`, [vehicleId]) : null;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let newStatus = booking.trip_status;
  if (driverId && (booking.trip_status === "New Booking" || booking.trip_status === "Awaiting Assignment")) {
    newStatus = "Assigned";
  }
  runSql(
    `UPDATE bookings SET
      driver_id = ?,
      vehicle_id = ?,
      supplier_id = ?,
      trip_status = ?,
      dispatcher_notes = COALESCE(?, dispatcher_notes),
      updated_by_id = ?,
      updated_by_name = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      driverId || null,
      vehicleId || null,
      supplierId !== void 0 ? supplierId : booking.supplier_id,
      newStatus,
      dispatcherNotes || null,
      req.user?.id,
      req.user?.full_name,
      now,
      bookingId
    ]
  );
  runSql(
    `INSERT INTO trip_status_logs (id, booking_id, booking_ref, old_status, new_status, changed_by_id, changed_by_name, notes, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "log_" + Date.now(),
      booking.id,
      booking.booking_ref,
      booking.trip_status,
      newStatus,
      req.user?.id,
      req.user?.full_name,
      `Assigned Driver: ${driver ? driver.full_name : "None"}, Vehicle: ${vehicle ? vehicle.reg_number : "None"}`,
      now
    ]
  );
  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    "ASSIGN",
    "booking",
    bookingId,
    `Assigned ${driver ? driver.full_name : "No driver"} to booking ${booking.booking_ref}`
  );
  const updatedBooking = queryOne(
    `SELECT b.*, d.full_name as driver_name, d.mobile as driver_phone, v.reg_number as vehicle_reg, v.make_model as vehicle_model
     FROM bookings b
     LEFT JOIN drivers d ON b.driver_id = d.id
     LEFT JOIN vehicles v ON b.vehicle_id = v.id
     WHERE b.id = ?`,
    [bookingId]
  );
  return res.json({
    success: true,
    message: `Dispatch assignment saved for ${booking.booking_ref}.`,
    booking: updatedBooking
  });
});
router3.post("/update-status", requireAuth, requirePermission("dispatch"), (req, res) => {
  const { bookingId, status, notes } = req.body;
  const validStatuses = [
    "New Booking",
    "Awaiting Assignment",
    "Assigned",
    "Driver Notified",
    "Driver on the Way",
    "Arrived at Pickup",
    "Passenger Picked Up",
    "Trip Completed",
    "Cancelled",
    "No Show"
  ];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid trip status." });
  }
  const booking = queryOne(`SELECT * FROM bookings WHERE id = ?`, [bookingId]);
  if (!booking) {
    return res.status(404).json({ error: "Booking not found." });
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  runSql(
    `UPDATE bookings SET
      trip_status = ?,
      dispatcher_notes = CASE WHEN ? IS NOT NULL THEN ? ELSE dispatcher_notes END,
      updated_by_id = ?,
      updated_by_name = ?,
      updated_at = ?
    WHERE id = ?`,
    [status, notes || null, notes || null, req.user?.id, req.user?.full_name, now, bookingId]
  );
  if ((status === "Trip Completed" || status === "Cancelled" || status === "No Show") && booking.vehicle_id) {
    runSql(`UPDATE vehicles SET status = 'available' WHERE id = ?`, [booking.vehicle_id]);
  } else if (booking.vehicle_id && (status === "Driver on the Way" || status === "Passenger Picked Up")) {
    runSql(`UPDATE vehicles SET status = 'on_trip' WHERE id = ?`, [booking.vehicle_id]);
  }
  if (status === "Trip Completed" && booking.trip_status !== "Trip Completed") {
    if (booking.driver_id && booking.driver_payout > 0) {
      runSql(`UPDATE drivers SET current_balance = current_balance + ? WHERE id = ?`, [booking.driver_payout, booking.driver_id]);
    }
    if (booking.supplier_id && booking.supplier_cost > 0) {
      runSql(`UPDATE suppliers SET current_balance = current_balance + ? WHERE id = ?`, [booking.supplier_cost, booking.supplier_id]);
    }
  }
  runSql(
    `INSERT INTO trip_status_logs (id, booking_id, booking_ref, old_status, new_status, changed_by_id, changed_by_name, notes, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      "log_" + Date.now(),
      booking.id,
      booking.booking_ref,
      booking.trip_status,
      status,
      req.user?.id,
      req.user?.full_name,
      notes || `Status changed from ${booking.trip_status} to ${status}`,
      now
    ]
  );
  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    "UPDATE",
    "dispatch",
    bookingId,
    `Trip ${booking.booking_ref} status changed to ${status}`
  );
  return res.json({
    success: true,
    message: `Trip ${booking.booking_ref} status updated to '${status}'.`,
    newStatus: status
  });
});
var dispatchRoutes_default = router3;

// server/routes/driverRoutes.ts
import { Router as Router4 } from "express";
var router4 = Router4();
router4.get("/", requireAuth, requirePermission("drivers"), (req, res) => {
  const { search, status } = req.query;
  let sql = `
    SELECT 
      d.*,
      v.reg_number as vehicle_reg,
      v.make_model as vehicle_model,
      (SELECT COUNT(*) FROM bookings WHERE driver_id = d.id) as total_bookings_count,
      (SELECT COUNT(*) FROM bookings WHERE driver_id = d.id AND trip_status = 'Trip Completed') as completed_trips_count,
      (SELECT COUNT(*) FROM bookings WHERE driver_id = d.id AND trip_status NOT IN ('Trip Completed', 'Cancelled', 'No Show')) as active_trips_count,
      (SELECT COUNT(*) FROM payments WHERE entity_type = 'driver_payment' AND entity_id = d.id) as payments_count,
      ((SELECT COALESCE(SUM(driver_payout), 0) FROM bookings WHERE driver_id = d.id AND trip_status = 'Trip Completed') - 
       (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE entity_type = 'driver_payment' AND entity_id = d.id)) as calculated_balance
    FROM drivers d
    LEFT JOIN vehicles v ON d.assigned_vehicle_id = v.id
    WHERE 1=1
  `;
  const params = [];
  if (search && typeof search === "string") {
    sql += ` AND (d.full_name LIKE ? OR d.mobile LIKE ? OR d.driver_code LIKE ? OR d.license_number LIKE ?)`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }
  if (status === "active") {
    sql += ` AND d.is_active = 1`;
  } else if (status === "inactive") {
    sql += ` AND d.is_active = 0`;
  }
  sql += ` ORDER BY d.full_name ASC`;
  const drivers = queryAll(sql, params);
  return res.json({ drivers });
});
router4.get("/:id", requireAuth, requirePermission("drivers"), (req, res) => {
  const { id } = req.params;
  const driver = queryOne(
    `SELECT d.*, v.reg_number as vehicle_reg, v.make_model as vehicle_model 
     FROM drivers d 
     LEFT JOIN vehicles v ON d.assigned_vehicle_id = v.id 
     WHERE d.id = ? OR d.driver_code = ?`,
    [id, id]
  );
  if (!driver) {
    return res.status(404).json({ error: "Driver not found." });
  }
  const trips = queryAll(
    `SELECT * FROM bookings WHERE driver_id = ? ORDER BY pickup_date DESC, pickup_time DESC`,
    [driver.id]
  );
  const payments = queryAll(
    `SELECT * FROM payments WHERE entity_type = 'driver_payment' AND entity_id = ? ORDER BY payment_date DESC, created_at DESC`,
    [driver.id]
  );
  const earnedRow = queryOne(
    `SELECT COALESCE(SUM(driver_payout), 0) as total_earned FROM bookings WHERE driver_id = ? AND trip_status = 'Trip Completed'`,
    [driver.id]
  );
  const paidRow = queryOne(
    `SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE entity_type = 'driver_payment' AND entity_id = ?`,
    [driver.id]
  );
  const totalEarned = earnedRow?.total_earned || 0;
  const totalPaid = paidRow?.total_paid || 0;
  const calculatedBalance = Math.round((totalEarned - totalPaid) * 100) / 100;
  return res.json({
    driver,
    trips,
    payments,
    financials: {
      totalEarned,
      totalPaid,
      outstandingBalance: calculatedBalance
    }
  });
});
router4.post("/", requireAuth, requirePermission("drivers"), (req, res) => {
  const {
    full_name,
    mobile,
    email,
    license_number,
    license_expiry,
    assigned_vehicle_id,
    payment_arrangement,
    rate_or_salary,
    currency,
    notes
  } = req.body;
  if (!full_name || !mobile || !license_number || !license_expiry) {
    return res.status(400).json({ error: "Please provide full name, mobile number, license number, and license expiry." });
  }
  const lastDriver = queryOne(`SELECT driver_code FROM drivers ORDER BY driver_code DESC LIMIT 1`);
  let codeNum = 101;
  if (lastDriver && lastDriver.driver_code) {
    const parsed = parseInt(lastDriver.driver_code.replace("DRV-", ""), 10);
    if (!isNaN(parsed)) codeNum = parsed + 1;
  }
  const driver_code = `DRV-${codeNum}`;
  const id = "drv_" + Date.now();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  runSql(
    `INSERT INTO drivers (
      id, driver_code, full_name, mobile, email, license_number, license_expiry,
      assigned_vehicle_id, payment_arrangement, rate_or_salary, currency, is_active,
      current_balance, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)`,
    [
      id,
      driver_code,
      full_name.trim(),
      mobile.trim(),
      email?.trim() || null,
      license_number.trim(),
      license_expiry,
      assigned_vehicle_id || null,
      payment_arrangement || "per_trip",
      parseFloat(rate_or_salary) || 0,
      currency || "SAR",
      notes || null,
      now,
      now
    ]
  );
  if (assigned_vehicle_id) {
    runSql(`UPDATE drivers SET assigned_vehicle_id = NULL WHERE assigned_vehicle_id = ? AND id != ?`, [assigned_vehicle_id, id]);
    runSql(`UPDATE vehicles SET assigned_driver_id = ? WHERE id = ?`, [id, assigned_vehicle_id]);
  }
  recordAuditLog(req.user?.id, req.user?.full_name, "CREATE", "driver", id, `Added driver ${full_name} (${driver_code})`);
  const created = queryOne(`SELECT * FROM drivers WHERE id = ?`, [id]);
  return res.status(201).json({ success: true, driver: created, message: `Driver ${full_name} successfully added.` });
});
router4.put("/:id", requireAuth, requirePermission("drivers"), (req, res) => {
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM drivers WHERE id = ?`, [id]);
  if (!existing) {
    return res.status(404).json({ error: "Driver not found." });
  }
  const {
    full_name,
    mobile,
    email,
    license_number,
    license_expiry,
    assigned_vehicle_id,
    payment_arrangement,
    rate_or_salary,
    currency,
    is_active,
    notes
  } = req.body;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const targetVehicleId = assigned_vehicle_id !== void 0 ? assigned_vehicle_id : existing.assigned_vehicle_id;
  runSql(
    `UPDATE drivers SET
      full_name = ?,
      mobile = ?,
      email = ?,
      license_number = ?,
      license_expiry = ?,
      assigned_vehicle_id = ?,
      payment_arrangement = ?,
      rate_or_salary = ?,
      currency = ?,
      is_active = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      full_name ? full_name.trim() : existing.full_name,
      mobile ? mobile.trim() : existing.mobile,
      email !== void 0 ? email ? email.trim() : null : existing.email,
      license_number ? license_number.trim() : existing.license_number,
      license_expiry || existing.license_expiry,
      targetVehicleId || null,
      payment_arrangement || existing.payment_arrangement,
      rate_or_salary !== void 0 ? parseFloat(rate_or_salary) : existing.rate_or_salary,
      currency || existing.currency,
      is_active !== void 0 ? is_active ? 1 : 0 : existing.is_active,
      notes !== void 0 ? notes : existing.notes,
      now,
      id
    ]
  );
  if (existing.assigned_vehicle_id && existing.assigned_vehicle_id !== targetVehicleId) {
    runSql(`UPDATE vehicles SET assigned_driver_id = NULL WHERE id = ? AND assigned_driver_id = ?`, [existing.assigned_vehicle_id, id]);
  }
  if (targetVehicleId) {
    runSql(`UPDATE drivers SET assigned_vehicle_id = NULL WHERE assigned_vehicle_id = ? AND id != ?`, [targetVehicleId, id]);
    runSql(`UPDATE vehicles SET assigned_driver_id = ? WHERE id = ?`, [id, targetVehicleId]);
  }
  recordAuditLog(req.user?.id, req.user?.full_name, "UPDATE", "driver", id, `Updated driver ${existing.driver_code}`);
  const updated = queryOne(`SELECT * FROM drivers WHERE id = ?`, [id]);
  return res.json({ success: true, driver: updated, message: `Driver ${updated.full_name} updated successfully.` });
});
router4.post("/:id/reactivate", requireAuth, requireRole("super_admin", "admin"), (req, res) => {
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM drivers WHERE id = ? OR driver_code = ?`, [id, id]);
  if (!existing) {
    return res.status(404).json({ error: "Chauffeur not found." });
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  runSql(`UPDATE drivers SET is_active = 1, updated_at = ? WHERE id = ?`, [now, existing.id]);
  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    "UPDATE",
    "driver",
    existing.id,
    `Reactivated chauffeur ${existing.full_name} (${existing.driver_code})`
  );
  const updated = queryOne(`SELECT * FROM drivers WHERE id = ?`, [existing.id]);
  return res.json({
    success: true,
    driver: updated,
    message: `Chauffeur '${existing.full_name}' (${existing.driver_code}) successfully reactivated.`
  });
});
router4.get("/:id/statement", requireAuth, (req, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;
  const driver = queryOne(`SELECT * FROM drivers WHERE id = ?`, [id]);
  if (!driver) {
    return res.status(404).json({ error: "Driver not found." });
  }
  let tripSql = `SELECT id, booking_ref, pickup_date, pickup_time, pickup_location, dropoff_location, driver_payout, currency, trip_status 
                 FROM bookings WHERE driver_id = ? AND trip_status = 'Trip Completed'`;
  const tripParams = [id];
  if (startDate) {
    tripSql += ` AND pickup_date >= ?`;
    tripParams.push(startDate);
  }
  if (endDate) {
    tripSql += ` AND pickup_date <= ?`;
    tripParams.push(endDate);
  }
  tripSql += ` ORDER BY pickup_date ASC, pickup_time ASC`;
  const trips = queryAll(tripSql, tripParams);
  let paySql = `SELECT id, payment_ref, payment_date, amount, currency, payment_method, reference_no, notes 
                FROM payments WHERE entity_type = 'driver_payment' AND entity_id = ?`;
  const payParams = [id];
  if (startDate) {
    paySql += ` AND payment_date >= ?`;
    payParams.push(startDate);
  }
  if (endDate) {
    paySql += ` AND payment_date <= ?`;
    payParams.push(endDate);
  }
  paySql += ` ORDER BY payment_date ASC`;
  const payments = queryAll(paySql, payParams);
  const entries = [];
  let runningBalance = 0;
  for (const t of trips) {
    runningBalance += t.driver_payout;
    entries.push({
      date: `${t.pickup_date} ${t.pickup_time}`,
      reference: t.booking_ref,
      type: "Trip Earned",
      description: `${t.pickup_location} \u2192 ${t.dropoff_location}`,
      payable: t.driver_payout,
      paid: 0,
      balance: runningBalance,
      currency: t.currency || "SAR"
    });
  }
  for (const p of payments) {
    runningBalance -= p.amount;
    entries.push({
      date: p.payment_date,
      reference: p.payment_ref,
      type: "Payment Paid",
      description: `Payment via ${p.payment_method} (${p.reference_no || "No ref"})`,
      payable: 0,
      paid: p.amount,
      balance: runningBalance,
      currency: p.currency || "SAR"
    });
  }
  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let seqBalance = 0;
  for (const entry of entries) {
    seqBalance += entry.payable - entry.paid;
    entry.balance = Math.round(seqBalance * 100) / 100;
  }
  return res.json({
    driver,
    statementPeriod: {
      startDate: startDate || "All Time",
      endDate: endDate || "Present"
    },
    entries,
    summary: {
      totalEarned: entries.reduce((s, e) => s + e.payable, 0),
      totalPaid: entries.reduce((s, e) => s + e.paid, 0),
      closingBalance: seqBalance
    }
  });
});
router4.delete("/:id", requireAuth, requireRole("super_admin", "admin"), (req, res) => {
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM drivers WHERE id = ? OR driver_code = ?`, [id, id]);
  if (!existing) {
    return res.status(404).json({ error: "Chauffeur not found." });
  }
  const bookingsCount = queryOne(`SELECT COUNT(*) as count FROM bookings WHERE driver_id = ?`, [existing.id])?.count || 0;
  const paymentsCount = queryOne(`SELECT COUNT(*) as count FROM payments WHERE entity_type = 'driver_payment' AND entity_id = ?`, [existing.id])?.count || 0;
  if (bookingsCount > 0 || paymentsCount > 0) {
    return res.status(400).json({
      hasDependencies: true,
      counts: {
        bookings: bookingsCount,
        payments: paymentsCount
      },
      error: `Cannot permanently delete chauffeur '${existing.full_name}' because they have active records: [${bookingsCount} booking(s), ${paymentsCount} payment transaction(s)]. Please deactivate this driver instead to preserve trip records and financial audits.`
    });
  }
  runSql(`UPDATE vehicles SET assigned_driver_id = NULL WHERE assigned_driver_id = ?`, [existing.id]);
  runSql(`DELETE FROM drivers WHERE id = ?`, [existing.id]);
  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    "DELETE",
    "driver",
    existing.id,
    `Permanently deleted driver ${existing.full_name} (${existing.driver_code})`
  );
  return res.json({
    success: true,
    message: `Chauffeur '${existing.full_name}' (${existing.driver_code}) successfully deleted.`
  });
});
var driverRoutes_default = router4;

// server/routes/vehicleRoutes.ts
import { Router as Router5 } from "express";
var router5 = Router5();
router5.get("/", requireAuth, requirePermission("vehicles"), (req, res) => {
  const { search, type, status } = req.query;
  let sql = `
    SELECT 
      v.*,
      d.full_name as driver_name,
      d.mobile as driver_phone,
      s.name as supplier_name,
      (SELECT COUNT(*) FROM bookings WHERE vehicle_id = v.id) as total_trips_count
    FROM vehicles v
    LEFT JOIN drivers d ON v.assigned_driver_id = d.id
    LEFT JOIN suppliers s ON v.supplier_id = s.id
    WHERE 1=1
  `;
  const params = [];
  if (search && typeof search === "string") {
    sql += ` AND (v.reg_number LIKE ? OR v.make_model LIKE ? OR v.vehicle_type LIKE ?)`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }
  if (type && type !== "all") {
    sql += ` AND v.vehicle_type = ?`;
    params.push(type);
  }
  if (status && status !== "all") {
    sql += ` AND v.status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY v.vehicle_type ASC, v.make_model ASC`;
  const vehicles = queryAll(sql, params);
  return res.json({ vehicles });
});
router5.post("/", requireAuth, requirePermission("vehicles"), (req, res) => {
  const {
    reg_number,
    vehicle_type,
    make_model,
    passenger_capacity,
    luggage_capacity,
    supplier_id,
    assigned_driver_id,
    status,
    color,
    model_year,
    notes
  } = req.body;
  if (!reg_number || !vehicle_type || !make_model) {
    return res.status(400).json({ error: "Please enter Registration Number, Vehicle Type, and Make/Model." });
  }
  const existing = queryOne(`SELECT id FROM vehicles WHERE LOWER(reg_number) = LOWER(?)`, [reg_number.trim()]);
  if (existing) {
    return res.status(409).json({ error: `A vehicle with registration number '${reg_number}' already exists.` });
  }
  const id = "veh_" + Date.now();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  runSql(
    `INSERT INTO vehicles (
      id, reg_number, vehicle_type, make_model, passenger_capacity, luggage_capacity,
      supplier_id, assigned_driver_id, status, color, model_year, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      reg_number.trim().toUpperCase(),
      vehicle_type,
      make_model.trim(),
      parseInt(passenger_capacity, 10) || 4,
      parseInt(luggage_capacity, 10) || 3,
      supplier_id || null,
      assigned_driver_id || null,
      status || "available",
      color || null,
      parseInt(model_year, 10) || (/* @__PURE__ */ new Date()).getFullYear(),
      notes || null,
      now,
      now
    ]
  );
  if (assigned_driver_id) {
    runSql(`UPDATE drivers SET assigned_vehicle_id = ? WHERE id = ?`, [id, assigned_driver_id]);
  }
  recordAuditLog(req.user?.id, req.user?.full_name, "CREATE", "vehicle", id, `Added vehicle ${reg_number} (${make_model})`);
  const created = queryOne(`SELECT * FROM vehicles WHERE id = ?`, [id]);
  return res.status(201).json({ success: true, vehicle: created, message: `Vehicle ${reg_number} created successfully.` });
});
router5.put("/:id", requireAuth, requirePermission("vehicles"), (req, res) => {
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM vehicles WHERE id = ?`, [id]);
  if (!existing) {
    return res.status(404).json({ error: "Vehicle not found." });
  }
  const {
    reg_number,
    vehicle_type,
    make_model,
    passenger_capacity,
    luggage_capacity,
    supplier_id,
    assigned_driver_id,
    status,
    color,
    model_year,
    notes
  } = req.body;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  runSql(
    `UPDATE vehicles SET
      reg_number = ?,
      vehicle_type = ?,
      make_model = ?,
      passenger_capacity = ?,
      luggage_capacity = ?,
      supplier_id = ?,
      assigned_driver_id = ?,
      status = ?,
      color = ?,
      model_year = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      reg_number ? reg_number.trim().toUpperCase() : existing.reg_number,
      vehicle_type || existing.vehicle_type,
      make_model ? make_model.trim() : existing.make_model,
      passenger_capacity !== void 0 ? parseInt(passenger_capacity, 10) : existing.passenger_capacity,
      luggage_capacity !== void 0 ? parseInt(luggage_capacity, 10) : existing.luggage_capacity,
      supplier_id !== void 0 ? supplier_id : existing.supplier_id,
      assigned_driver_id !== void 0 ? assigned_driver_id : existing.assigned_driver_id,
      status || existing.status,
      color !== void 0 ? color : existing.color,
      model_year !== void 0 ? parseInt(model_year, 10) : existing.model_year,
      notes !== void 0 ? notes : existing.notes,
      now,
      id
    ]
  );
  const targetDriverId = assigned_driver_id !== void 0 ? assigned_driver_id : existing.assigned_driver_id;
  if (existing.assigned_driver_id && existing.assigned_driver_id !== targetDriverId) {
    runSql(`UPDATE drivers SET assigned_vehicle_id = NULL WHERE id = ? AND assigned_vehicle_id = ?`, [existing.assigned_driver_id, id]);
  }
  if (targetDriverId) {
    runSql(`UPDATE vehicles SET assigned_driver_id = NULL WHERE assigned_driver_id = ? AND id != ?`, [targetDriverId, id]);
    runSql(`UPDATE drivers SET assigned_vehicle_id = ? WHERE id = ?`, [id, targetDriverId]);
  }
  recordAuditLog(req.user?.id, req.user?.full_name, "UPDATE", "vehicle", id, `Updated vehicle ${existing.reg_number}`);
  const updated = queryOne(`SELECT * FROM vehicles WHERE id = ?`, [id]);
  return res.json({ success: true, vehicle: updated, message: `Vehicle ${updated.reg_number} updated successfully.` });
});
router5.delete("/:id", requireAuth, (req, res) => {
  if (req.user?.role !== "super_admin" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Only administrators can delete fleet vehicles." });
  }
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM vehicles WHERE id = ?`, [id]);
  if (!existing) {
    return res.status(404).json({ error: "Vehicle not found." });
  }
  runSql(`DELETE FROM vehicles WHERE id = ?`, [id]);
  recordAuditLog(req.user?.id, req.user?.full_name, "DELETE", "vehicle", id, `Deleted vehicle ${existing.reg_number}`);
  return res.json({ success: true, message: `Vehicle ${existing.reg_number} deleted.` });
});
var vehicleRoutes_default = router5;

// server/routes/supplierRoutes.ts
import { Router as Router6 } from "express";
var router6 = Router6();
router6.get("/", requireAuth, requirePermission("suppliers"), (req, res) => {
  const { search, status } = req.query;
  let sql = `
    SELECT 
      s.*,
      (SELECT COUNT(*) FROM bookings WHERE supplier_id = s.id) as total_bookings_count,
      (SELECT COUNT(*) FROM vehicles WHERE supplier_id = s.id) as fleet_vehicles_count,
      (SELECT COUNT(*) FROM payments WHERE entity_type = 'supplier_payment' AND entity_id = s.id) as payments_count,
      (COALESCE(s.opening_balance, 0) + 
       (SELECT COALESCE(SUM(supplier_cost), 0) FROM bookings WHERE supplier_id = s.id AND trip_status != 'Cancelled') - 
       (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE entity_type = 'supplier_payment' AND entity_id = s.id)) as calculated_balance
    FROM suppliers s
    WHERE 1=1
  `;
  const params = [];
  if (search && typeof search === "string") {
    sql += ` AND (s.name LIKE ? OR s.contact_person LIKE ? OR s.supplier_code LIKE ? OR s.mobile LIKE ?)`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }
  if (status === "active") {
    sql += ` AND s.is_active = 1`;
  } else if (status === "inactive") {
    sql += ` AND s.is_active = 0`;
  }
  sql += ` ORDER BY s.name ASC`;
  const suppliers = queryAll(sql, params);
  return res.json({ suppliers });
});
router6.get("/:id", requireAuth, requirePermission("suppliers"), (req, res) => {
  const { id } = req.params;
  const supplier = queryOne(`SELECT * FROM suppliers WHERE id = ? OR supplier_code = ?`, [id, id]);
  if (!supplier) {
    return res.status(404).json({ error: "Supplier not found." });
  }
  const trips = queryAll(
    `SELECT b.*, d.full_name as driver_name, v.reg_number as vehicle_reg 
     FROM bookings b 
     LEFT JOIN drivers d ON b.driver_id = d.id 
     LEFT JOIN vehicles v ON b.vehicle_id = v.id 
     WHERE b.supplier_id = ? 
     ORDER BY b.pickup_date DESC, b.pickup_time DESC`,
    [supplier.id]
  );
  const payments = queryAll(
    `SELECT * FROM payments WHERE entity_type = 'supplier_payment' AND entity_id = ? ORDER BY payment_date DESC, created_at DESC`,
    [supplier.id]
  );
  const costRow = queryOne(
    `SELECT COALESCE(SUM(supplier_cost), 0) as total_payable FROM bookings WHERE supplier_id = ? AND trip_status != 'Cancelled'`,
    [supplier.id]
  );
  const paidRow = queryOne(
    `SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE entity_type = 'supplier_payment' AND entity_id = ?`,
    [supplier.id]
  );
  const totalPayable = (costRow?.total_payable || 0) + (supplier.opening_balance || 0);
  const totalPaid = paidRow?.total_paid || 0;
  const outstandingBalance = Math.round((totalPayable - totalPaid) * 100) / 100;
  return res.json({
    supplier,
    trips,
    payments,
    financials: {
      openingBalance: supplier.opening_balance,
      totalPayable,
      totalPaid,
      outstandingBalance
    }
  });
});
router6.post("/", requireAuth, requirePermission("suppliers"), (req, res) => {
  const {
    name,
    contact_person,
    mobile,
    email,
    address,
    default_currency,
    opening_balance,
    payment_terms,
    notes
  } = req.body;
  if (!name || !mobile) {
    return res.status(400).json({ error: "Please provide Supplier / Company Name and Contact Mobile Number." });
  }
  const lastCode = queryOne(`SELECT supplier_code FROM suppliers ORDER BY supplier_code DESC LIMIT 1`);
  let codeNum = 1;
  if (lastCode && lastCode.supplier_code) {
    const parsed = parseInt(lastCode.supplier_code.replace("SUP-", ""), 10);
    if (!isNaN(parsed)) codeNum = parsed + 1;
  }
  const supplier_code = `SUP-${codeNum.toString().padStart(2, "0")}`;
  const id = "sup_" + Date.now();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const openBal = parseFloat(opening_balance) || 0;
  runSql(
    `INSERT INTO suppliers (
      id, supplier_code, name, contact_person, mobile, email, address,
      default_currency, opening_balance, current_balance, payment_terms, is_active, notes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [
      id,
      supplier_code,
      name.trim(),
      contact_person?.trim() || null,
      mobile.trim(),
      email?.trim() || null,
      address?.trim() || null,
      default_currency || "SAR",
      openBal,
      openBal,
      payment_terms || "15_days",
      notes || null,
      now,
      now
    ]
  );
  recordAuditLog(req.user?.id, req.user?.full_name, "CREATE", "supplier", id, `Added supplier ${name} (${supplier_code})`);
  const created = queryOne(`SELECT * FROM suppliers WHERE id = ?`, [id]);
  return res.status(201).json({ success: true, supplier: created, message: `Supplier ${name} created successfully.` });
});
router6.put("/:id", requireAuth, requirePermission("suppliers"), (req, res) => {
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM suppliers WHERE id = ?`, [id]);
  if (!existing) {
    return res.status(404).json({ error: "Supplier not found." });
  }
  const {
    name,
    contact_person,
    mobile,
    email,
    address,
    default_currency,
    opening_balance,
    payment_terms,
    is_active,
    notes
  } = req.body;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  runSql(
    `UPDATE suppliers SET
      name = ?,
      contact_person = ?,
      mobile = ?,
      email = ?,
      address = ?,
      default_currency = ?,
      opening_balance = ?,
      payment_terms = ?,
      is_active = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      name ? name.trim() : existing.name,
      contact_person !== void 0 ? contact_person ? contact_person.trim() : null : existing.contact_person,
      mobile ? mobile.trim() : existing.mobile,
      email !== void 0 ? email ? email.trim() : null : existing.email,
      address !== void 0 ? address ? address.trim() : null : existing.address,
      default_currency || existing.default_currency,
      opening_balance !== void 0 ? parseFloat(opening_balance) : existing.opening_balance,
      payment_terms || existing.payment_terms,
      is_active !== void 0 ? is_active ? 1 : 0 : existing.is_active,
      notes !== void 0 ? notes : existing.notes,
      now,
      id
    ]
  );
  recordAuditLog(req.user?.id, req.user?.full_name, "UPDATE", "supplier", id, `Updated supplier ${existing.supplier_code}`);
  const updated = queryOne(`SELECT * FROM suppliers WHERE id = ?`, [id]);
  return res.json({ success: true, supplier: updated, message: `Supplier ${updated.name} updated successfully.` });
});
router6.post("/:id/reactivate", requireAuth, requireRole("super_admin", "admin"), (req, res) => {
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM suppliers WHERE id = ? OR supplier_code = ?`, [id, id]);
  if (!existing) {
    return res.status(404).json({ error: "Supplier not found." });
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  runSql(`UPDATE suppliers SET is_active = 1, updated_at = ? WHERE id = ?`, [now, existing.id]);
  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    "UPDATE",
    "supplier",
    existing.id,
    `Reactivated supplier ${existing.name} (${existing.supplier_code})`
  );
  const updated = queryOne(`SELECT * FROM suppliers WHERE id = ?`, [existing.id]);
  return res.json({
    success: true,
    supplier: updated,
    message: `Supplier '${existing.name}' (${existing.supplier_code}) successfully reactivated.`
  });
});
router6.get("/:id/statement", requireAuth, (req, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.query;
  const supplier = queryOne(`SELECT * FROM suppliers WHERE id = ?`, [id]);
  if (!supplier) {
    return res.status(404).json({ error: "Supplier not found." });
  }
  let tripSql = `SELECT id, booking_ref, pickup_date, pickup_time, pickup_location, dropoff_location, passenger_name, supplier_cost, currency, trip_status 
                 FROM bookings WHERE supplier_id = ? AND trip_status != 'Cancelled'`;
  const tripParams = [id];
  if (startDate) {
    tripSql += ` AND pickup_date >= ?`;
    tripParams.push(startDate);
  }
  if (endDate) {
    tripSql += ` AND pickup_date <= ?`;
    tripParams.push(endDate);
  }
  tripSql += ` ORDER BY pickup_date ASC, pickup_time ASC`;
  const trips = queryAll(tripSql, tripParams);
  let paySql = `SELECT id, payment_ref, payment_date, amount, currency, payment_method, reference_no, notes 
                FROM payments WHERE entity_type = 'supplier_payment' AND entity_id = ?`;
  const payParams = [id];
  if (startDate) {
    paySql += ` AND payment_date >= ?`;
    payParams.push(startDate);
  }
  if (endDate) {
    paySql += ` AND payment_date <= ?`;
    payParams.push(endDate);
  }
  paySql += ` ORDER BY payment_date ASC`;
  const payments = queryAll(paySql, payParams);
  const entries = [];
  let runningBalance = supplier.opening_balance || 0;
  for (const t of trips) {
    runningBalance += t.supplier_cost;
    entries.push({
      date: `${t.pickup_date} ${t.pickup_time}`,
      reference: t.booking_ref,
      type: "Trip Purchase",
      description: `${t.passenger_name} (${t.pickup_location} \u2192 ${t.dropoff_location})`,
      payable: t.supplier_cost,
      paid: 0,
      balance: runningBalance,
      currency: t.currency || "SAR"
    });
  }
  for (const p of payments) {
    runningBalance -= p.amount;
    entries.push({
      date: p.payment_date,
      reference: p.payment_ref,
      type: "Supplier Payment",
      description: `Payment via ${p.payment_method} (${p.reference_no || "No ref"})`,
      payable: 0,
      paid: p.amount,
      balance: runningBalance,
      currency: p.currency || "SAR"
    });
  }
  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let seqBalance = supplier.opening_balance || 0;
  for (const entry of entries) {
    seqBalance += entry.payable - entry.paid;
    entry.balance = Math.round(seqBalance * 100) / 100;
  }
  return res.json({
    supplier,
    openingBalance: supplier.opening_balance || 0,
    statementPeriod: {
      startDate: startDate || "All Time",
      endDate: endDate || "Present"
    },
    entries,
    summary: {
      totalPayable: entries.reduce((s, e) => s + e.payable, 0),
      totalPaid: entries.reduce((s, e) => s + e.paid, 0),
      closingBalance: seqBalance
    }
  });
});
router6.delete("/:id", requireAuth, requireRole("super_admin", "admin"), (req, res) => {
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM suppliers WHERE id = ? OR supplier_code = ?`, [id, id]);
  if (!existing) {
    return res.status(404).json({ error: "Supplier not found." });
  }
  const bookingsCount = queryOne(`SELECT COUNT(*) as count FROM bookings WHERE supplier_id = ?`, [existing.id])?.count || 0;
  const vehiclesCount = queryOne(`SELECT COUNT(*) as count FROM vehicles WHERE supplier_id = ?`, [existing.id])?.count || 0;
  const paymentsCount = queryOne(`SELECT COUNT(*) as count FROM payments WHERE entity_type = 'supplier_payment' AND entity_id = ?`, [existing.id])?.count || 0;
  if (bookingsCount > 0 || paymentsCount > 0 || vehiclesCount > 0) {
    return res.status(400).json({
      hasDependencies: true,
      counts: {
        bookings: bookingsCount,
        vehicles: vehiclesCount,
        payments: paymentsCount
      },
      error: `Cannot permanently delete supplier '${existing.name}' because they have active dependent records: [${bookingsCount} booking(s), ${vehiclesCount} vehicle(s), ${paymentsCount} payment transaction(s)]. Please deactivate this supplier instead to preserve financial statements and trip history.`
    });
  }
  runSql(`DELETE FROM suppliers WHERE id = ?`, [existing.id]);
  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    "DELETE",
    "supplier",
    existing.id,
    `Permanently deleted supplier ${existing.name} (${existing.supplier_code})`
  );
  return res.json({
    success: true,
    message: `Supplier '${existing.name}' (${existing.supplier_code}) successfully deleted.`
  });
});
var supplierRoutes_default = router6;

// server/routes/financeRoutes.ts
import { Router as Router7 } from "express";
var router7 = Router7();
function generatePaymentRef(type) {
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  let prefix = `PAY-${currentYear}-`;
  if (type === "customer_receipt") prefix = `RCT-${currentYear}-`;
  else if (type === "driver_payment") prefix = `DRV-PAY-${currentYear}-`;
  else if (type === "supplier_payment") prefix = `SUP-PAY-${currentYear}-`;
  else if (type === "general_expense") prefix = `EXP-${currentYear}-`;
  else if (type === "refund_adjustment") prefix = `REF-${currentYear}-`;
  const rows = queryAll(
    `SELECT payment_ref FROM payments WHERE payment_ref LIKE ? ORDER BY payment_ref DESC LIMIT 1`,
    [`${prefix}%`]
  );
  let nextNum = 1;
  if (rows.length > 0 && rows[0].payment_ref) {
    const parts = rows[0].payment_ref.split("-");
    const lastNumStr = parts[parts.length - 1];
    const parsed = parseInt(lastNumStr, 10);
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }
  return `${prefix}${nextNum.toString().padStart(4, "0")}`;
}
router7.get("/overview", requireAuth, requirePermission("payments"), (req, res) => {
  const { startDate, endDate } = req.query;
  let bookingDateClause = "";
  const bookingParams = [];
  if (startDate) {
    bookingDateClause += ` AND pickup_date >= ?`;
    bookingParams.push(startDate);
  }
  if (endDate) {
    bookingDateClause += ` AND pickup_date <= ?`;
    bookingParams.push(endDate);
  }
  const revenueRow = queryOne(
    `SELECT 
      COALESCE(SUM(customer_price), 0) as total_booked_revenue,
      COALESCE(SUM(paid_amount), 0) as total_collected_revenue,
      COALESCE(SUM(customer_price - paid_amount), 0) as total_outstanding_receivable,
      COALESCE(SUM(supplier_cost), 0) as total_supplier_cost,
      COALESCE(SUM(driver_payout), 0) as total_driver_payout
    FROM bookings 
    WHERE trip_status != 'Cancelled' ${bookingDateClause}`,
    bookingParams
  );
  let payDateClause = "";
  const payParams = [];
  if (startDate) {
    payDateClause += ` AND payment_date >= ?`;
    payParams.push(startDate);
  }
  if (endDate) {
    payDateClause += ` AND payment_date <= ?`;
    payParams.push(endDate);
  }
  const receiptsRow = queryOne(
    `SELECT COALESCE(SUM(amount), 0) as total_receipts FROM payments WHERE entity_type = 'customer_receipt' ${payDateClause}`,
    payParams
  );
  const driverPaymentsRow = queryOne(
    `SELECT COALESCE(SUM(amount), 0) as total_driver_paid FROM payments WHERE entity_type = 'driver_payment' ${payDateClause}`,
    payParams
  );
  const supplierPaymentsRow = queryOne(
    `SELECT COALESCE(SUM(amount), 0) as total_supplier_paid FROM payments WHERE entity_type = 'supplier_payment' ${payDateClause}`,
    payParams
  );
  const expensesRow = queryOne(
    `SELECT COALESCE(SUM(amount), 0) as total_expenses FROM payments WHERE entity_type = 'general_expense' ${payDateClause}`,
    payParams
  );
  const refundsRow = queryOne(
    `SELECT COALESCE(SUM(amount), 0) as total_refunds FROM payments WHERE entity_type = 'refund_adjustment' ${payDateClause}`,
    payParams
  );
  const totalEarnedDrivers = queryOne(
    `SELECT COALESCE(SUM(driver_payout), 0) as val FROM bookings WHERE trip_status = 'Trip Completed'`
  )?.val || 0;
  const totalPaidToDrivers = queryOne(
    `SELECT COALESCE(SUM(amount), 0) as val FROM payments WHERE entity_type = 'driver_payment'`
  )?.val || 0;
  const driverOutstandingPayable = Math.max(0, totalEarnedDrivers - totalPaidToDrivers);
  const totalSupplierCosts = queryOne(
    `SELECT COALESCE(SUM(supplier_cost), 0) as val FROM bookings WHERE trip_status != 'Cancelled'`
  )?.val || 0;
  const supplierOpening = queryOne(
    `SELECT COALESCE(SUM(opening_balance), 0) as val FROM suppliers`
  )?.val || 0;
  const totalPaidToSuppliers = queryOne(
    `SELECT COALESCE(SUM(amount), 0) as val FROM payments WHERE entity_type = 'supplier_payment'`
  )?.val || 0;
  const supplierOutstandingPayable = Math.max(0, totalSupplierCosts + supplierOpening - totalPaidToSuppliers);
  const totalRevenue = receiptsRow?.total_receipts || 0;
  const totalExpenses = (driverPaymentsRow?.total_driver_paid || 0) + (supplierPaymentsRow?.total_supplier_paid || 0) + (expensesRow?.total_expenses || 0) + (refundsRow?.total_refunds || 0);
  const netCashFlow = totalRevenue - totalExpenses;
  const bookedRevenue = revenueRow?.total_booked_revenue || 0;
  const directCosts = (revenueRow?.total_supplier_cost || 0) + (revenueRow?.total_driver_payout || 0) + (expensesRow?.total_expenses || 0);
  const grossProfit = bookedRevenue - directCosts;
  return res.json({
    metrics: {
      bookedRevenue,
      collectedRevenue: receiptsRow?.total_receipts || 0,
      outstandingReceivables: Math.max(0, bookedRevenue - (receiptsRow?.total_receipts || 0)),
      driverOutstandingPayable,
      supplierOutstandingPayable,
      totalExpenses,
      generalExpenses: expensesRow?.total_expenses || 0,
      netCashFlow,
      grossProfit,
      currency: "SAR"
    }
  });
});
router7.get("/payments", requireAuth, requirePermission("payments"), (req, res) => {
  const { type, startDate, endDate, bookingId, search, category, driverId, supplierId, currency } = req.query;
  let sql = `SELECT * FROM payments WHERE 1=1`;
  const params = [];
  if (type && type !== "all") {
    sql += ` AND entity_type = ?`;
    params.push(type);
  }
  if (category && category !== "all") {
    sql += ` AND expense_category = ?`;
    params.push(category);
  }
  if (driverId && driverId !== "all") {
    sql += ` AND (entity_id = ? OR notes LIKE ?)`;
    params.push(driverId, `%${driverId}%`);
  }
  if (supplierId && supplierId !== "all") {
    sql += ` AND (entity_id = ? OR notes LIKE ?)`;
    params.push(supplierId, `%${supplierId}%`);
  }
  if (currency && currency !== "all") {
    sql += ` AND currency = ?`;
    params.push(currency);
  }
  if (startDate) {
    sql += ` AND payment_date >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    sql += ` AND payment_date <= ?`;
    params.push(endDate);
  }
  if (bookingId) {
    sql += ` AND booking_id = ?`;
    params.push(bookingId);
  }
  if (search && typeof search === "string") {
    const term = `%${search.trim()}%`;
    sql += ` AND (payment_ref LIKE ? OR entity_name LIKE ? OR reference_no LIKE ? OR notes LIKE ? OR booking_ref LIKE ? OR expense_category LIKE ?)`;
    params.push(term, term, term, term, term, term);
  }
  sql += ` ORDER BY payment_date DESC, created_at DESC LIMIT 500`;
  const payments = queryAll(sql, params);
  const totalAmount = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
  return res.json({ payments, totalAmount });
});
router7.post("/payments", requireAuth, requirePermission("payments"), (req, res) => {
  const {
    entity_type,
    entity_id,
    entity_name,
    booking_id,
    booking_ref,
    amount,
    currency,
    payment_method,
    payment_date,
    reference_no,
    notes,
    expense_category
  } = req.body;
  if (!entity_type || !amount || !payment_method || !payment_date) {
    return res.status(400).json({ error: "Please provide Transaction Type, Amount, Payment Method, and Payment Date." });
  }
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: "Please provide a valid positive payment amount." });
  }
  const id = "pay_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
  const payment_ref = generatePaymentRef(entity_type);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  runSql(
    `INSERT INTO payments (
      id, payment_ref, entity_type, entity_id, entity_name, booking_id, booking_ref,
      amount, currency, payment_method, payment_date, reference_no, notes,
      expense_category, created_by_id, created_by_name, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payment_ref,
      entity_type,
      entity_id || null,
      entity_name || null,
      booking_id || null,
      booking_ref || null,
      numAmount,
      currency || "SAR",
      payment_method,
      payment_date,
      reference_no || null,
      notes || null,
      expense_category || (entity_type === "general_expense" ? "General Operations" : null),
      req.user?.id,
      req.user?.full_name,
      now,
      now
    ]
  );
  if (entity_type === "customer_receipt" && booking_id) {
    const booking = queryOne(`SELECT id, customer_price, paid_amount FROM bookings WHERE id = ?`, [booking_id]);
    if (booking) {
      const newPaid = Math.round(((booking.paid_amount || 0) + numAmount) * 100) / 100;
      let newPaymentStatus = "partial";
      if (newPaid >= booking.customer_price) {
        newPaymentStatus = "paid";
      } else if (newPaid <= 0) {
        newPaymentStatus = "unpaid";
      }
      runSql(`UPDATE bookings SET paid_amount = ?, payment_status = ?, updated_at = ? WHERE id = ?`, [
        newPaid,
        newPaymentStatus,
        now,
        booking_id
      ]);
    }
  }
  if (entity_type === "driver_payment" && entity_id) {
    runSql(`UPDATE drivers SET current_balance = current_balance - ? WHERE id = ?`, [numAmount, entity_id]);
  }
  if (entity_type === "supplier_payment" && entity_id) {
    runSql(`UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ?`, [numAmount, entity_id]);
  }
  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    "PAYMENT",
    "payment",
    id,
    `Recorded ${entity_type}: ${numAmount} ${currency || "SAR"} (${payment_ref})`
  );
  const created = queryOne(`SELECT * FROM payments WHERE id = ?`, [id]);
  return res.status(201).json({
    success: true,
    payment: created,
    message: `Payment ${payment_ref} for ${numAmount} ${currency || "SAR"} successfully recorded.`
  });
});
router7.put("/payments/:id", requireAuth, requirePermission("payments"), (req, res) => {
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM payments WHERE id = ? OR payment_ref = ?`, [id, id]);
  if (!existing) {
    return res.status(404).json({ error: "Transaction or expense record not found." });
  }
  const {
    amount,
    currency,
    payment_method,
    payment_date,
    reference_no,
    notes,
    expense_category,
    entity_id,
    entity_name,
    booking_id,
    booking_ref
  } = req.body;
  if (!amount || !payment_method || !payment_date) {
    return res.status(400).json({ error: "Please provide Amount, Payment Method, and Payment Date." });
  }
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: "Please provide a valid positive amount." });
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const amountDiff = numAmount - existing.amount;
  if (existing.entity_type === "customer_receipt" && existing.booking_id) {
    const booking = queryOne(`SELECT id, customer_price, paid_amount FROM bookings WHERE id = ?`, [existing.booking_id]);
    if (booking) {
      const newPaid = Math.round(((booking.paid_amount || 0) + amountDiff) * 100) / 100;
      let newPaymentStatus = "partial";
      if (newPaid >= booking.customer_price) newPaymentStatus = "paid";
      else if (newPaid <= 0) newPaymentStatus = "unpaid";
      runSql(`UPDATE bookings SET paid_amount = ?, payment_status = ?, updated_at = ? WHERE id = ?`, [newPaid, newPaymentStatus, now, existing.booking_id]);
    }
  }
  if (existing.entity_type === "driver_payment" && existing.entity_id) {
    runSql(`UPDATE drivers SET current_balance = current_balance - ? WHERE id = ?`, [amountDiff, existing.entity_id]);
  }
  if (existing.entity_type === "supplier_payment" && existing.entity_id) {
    runSql(`UPDATE suppliers SET current_balance = current_balance - ? WHERE id = ?`, [amountDiff, existing.entity_id]);
  }
  runSql(
    `UPDATE payments SET
      amount = ?,
      currency = ?,
      payment_method = ?,
      payment_date = ?,
      reference_no = ?,
      notes = ?,
      expense_category = ?,
      entity_id = ?,
      entity_name = ?,
      booking_id = ?,
      booking_ref = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      numAmount,
      currency || existing.currency,
      payment_method,
      payment_date,
      reference_no !== void 0 ? reference_no : existing.reference_no,
      notes !== void 0 ? notes : existing.notes,
      expense_category !== void 0 ? expense_category : existing.expense_category,
      entity_id !== void 0 ? entity_id : existing.entity_id,
      entity_name !== void 0 ? entity_name : existing.entity_name,
      booking_id !== void 0 ? booking_id : existing.booking_id,
      booking_ref !== void 0 ? booking_ref : existing.booking_ref,
      now,
      existing.id
    ]
  );
  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    "UPDATE",
    "payment",
    existing.id,
    `Updated ${existing.entity_type} ${existing.payment_ref}: ${numAmount} ${currency || existing.currency}`
  );
  const updated = queryOne(`SELECT * FROM payments WHERE id = ?`, [existing.id]);
  return res.json({
    success: true,
    payment: updated,
    message: `Record '${existing.payment_ref}' successfully updated.`
  });
});
router7.delete("/payments/:id", requireAuth, requirePermission("payments"), (req, res) => {
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM payments WHERE id = ? OR payment_ref = ?`, [id, id]);
  if (!existing) {
    return res.status(404).json({ error: "Transaction or expense record not found." });
  }
  if (existing.entity_type === "customer_receipt" && existing.booking_id) {
    const b = queryOne(`SELECT id, booking_ref FROM bookings WHERE id = ?`, [existing.booking_id]);
    if (b) {
      return res.status(400).json({
        error: `Cannot directly delete customer receipt '${existing.payment_ref}' because it is linked to active booking '${b.booking_ref}'. Please edit the receipt amount or issue an adjustment entry to maintain audit integrity.`
      });
    }
  }
  if (existing.entity_type === "driver_payment" && existing.entity_id) {
    return res.status(400).json({
      error: `Cannot delete driver payout '${existing.payment_ref}' as it is an established ledger transaction on the driver's statement. Please edit the payment or issue an adjustment entry.`
    });
  }
  if (existing.entity_type === "supplier_payment" && existing.entity_id) {
    return res.status(400).json({
      error: `Cannot delete supplier payout '${existing.payment_ref}' as it is part of the partner's recorded statement. Please edit or adjust the transaction instead.`
    });
  }
  runSql(`DELETE FROM payments WHERE id = ?`, [existing.id]);
  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    "DELETE",
    "payment",
    existing.id,
    `Deleted expense/transaction ${existing.payment_ref} (${existing.amount} ${existing.currency})`
  );
  return res.json({
    success: true,
    message: `Expense '${existing.payment_ref}' successfully deleted.`
  });
});
router7.get("/receipt/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  const payment = queryOne(`SELECT * FROM payments WHERE id = ? OR payment_ref = ?`, [id, id]);
  if (!payment) {
    return res.status(404).json({ error: "Payment receipt not found." });
  }
  let booking = null;
  if (payment.booking_id) {
    booking = queryOne(`SELECT * FROM bookings WHERE id = ?`, [payment.booking_id]);
  }
  const companySetting = queryOne(`SELECT value FROM settings WHERE key = 'company_profile'`);
  const companyProfile = companySetting ? JSON.parse(companySetting.value) : {};
  return res.json({
    receipt: payment,
    booking,
    company: companyProfile
  });
});
var financeRoutes_default = router7;

// server/routes/reportRoutes.ts
import { Router as Router8 } from "express";
var router8 = Router8();
router8.get("/:reportType", requireAuth, requirePermission("reports"), (req, res) => {
  const { reportType } = req.params;
  const {
    startDate,
    endDate,
    driverId,
    supplierId,
    vehicleId,
    vehicleType,
    status,
    paymentStatus,
    currency,
    flightNumber,
    search
  } = req.query;
  let records = [];
  let summary = {};
  switch (reportType) {
    case "booking_register":
    case "date_wise_trips": {
      let sql = `
        SELECT b.*, d.full_name as driver_name, v.reg_number as vehicle_reg, s.name as supplier_name
        FROM bookings b
        LEFT JOIN drivers d ON b.driver_id = d.id
        LEFT JOIN vehicles v ON b.vehicle_id = v.id
        LEFT JOIN suppliers s ON b.supplier_id = s.id
        WHERE 1=1
      `;
      const params = [];
      if (startDate) {
        sql += ` AND b.pickup_date >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        sql += ` AND b.pickup_date <= ?`;
        params.push(endDate);
      }
      if (status && status !== "all") {
        sql += ` AND b.trip_status = ?`;
        params.push(status);
      }
      if (paymentStatus && paymentStatus !== "all") {
        sql += ` AND b.payment_status = ?`;
        params.push(paymentStatus);
      }
      if (driverId && driverId !== "all") {
        sql += ` AND b.driver_id = ?`;
        params.push(driverId);
      }
      if (supplierId && supplierId !== "all") {
        sql += ` AND b.supplier_id = ?`;
        params.push(supplierId);
      }
      if (vehicleId && vehicleId !== "all") {
        sql += ` AND b.vehicle_id = ?`;
        params.push(vehicleId);
      }
      if (vehicleType && vehicleType !== "all") {
        sql += ` AND b.vehicle_type = ?`;
        params.push(vehicleType);
      }
      if (currency && currency !== "all") {
        sql += ` AND b.currency = ?`;
        params.push(currency);
      }
      if (flightNumber) {
        sql += ` AND b.flight_number LIKE ?`;
        params.push(`%${flightNumber}%`);
      }
      if (search) {
        sql += ` AND (b.booking_ref LIKE ? OR b.passenger_name LIKE ? OR b.contact_number LIKE ? OR b.pickup_location LIKE ? OR b.dropoff_location LIKE ? OR b.flight_number LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s, s, s, s);
      }
      sql += ` ORDER BY b.pickup_date DESC, b.pickup_time DESC`;
      records = queryAll(sql, params);
      summary = {
        totalTrips: records.length,
        totalCustomerPrice: records.reduce((s, r) => s + (r.customer_price || 0), 0),
        totalSupplierCost: records.reduce((s, r) => s + (r.supplier_cost || 0), 0),
        totalDriverPayout: records.reduce((s, r) => s + (r.driver_payout || 0), 0),
        grossProfit: records.reduce((s, r) => s + ((r.customer_price || 0) - (r.supplier_cost || 0) - (r.driver_payout || 0)), 0)
      };
      break;
    }
    case "daily_booking": {
      const targetDate = startDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      let sql = `
        SELECT b.*, d.full_name as driver_name, v.reg_number as vehicle_reg, s.name as supplier_name
        FROM bookings b
        LEFT JOIN drivers d ON b.driver_id = d.id
        LEFT JOIN vehicles v ON b.vehicle_id = v.id
        LEFT JOIN suppliers s ON b.supplier_id = s.id
        WHERE b.pickup_date = ?
      `;
      const params = [targetDate];
      if (status && status !== "all") {
        sql += ` AND b.trip_status = ?`;
        params.push(status);
      }
      if (driverId && driverId !== "all") {
        sql += ` AND b.driver_id = ?`;
        params.push(driverId);
      }
      if (search) {
        sql += ` AND (b.booking_ref LIKE ? OR b.passenger_name LIKE ? OR b.flight_number LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s);
      }
      sql += ` ORDER BY b.pickup_time ASC`;
      records = queryAll(sql, params);
      summary = {
        date: targetDate,
        totalTrips: records.length,
        totalRevenue: records.reduce((s, r) => s + (r.customer_price || 0), 0),
        totalCompleted: records.filter((r) => r.trip_status === "Trip Completed").length,
        totalPending: records.filter((r) => r.trip_status === "Awaiting Assignment").length
      };
      break;
    }
    case "monthly_booking": {
      const yearMonth = startDate ? startDate.substring(0, 7) : (/* @__PURE__ */ new Date()).toISOString().substring(0, 7);
      let sql = `
        SELECT b.*, d.full_name as driver_name, v.reg_number as vehicle_reg, s.name as supplier_name
        FROM bookings b
        LEFT JOIN drivers d ON b.driver_id = d.id
        LEFT JOIN vehicles v ON b.vehicle_id = v.id
        LEFT JOIN suppliers s ON b.supplier_id = s.id
        WHERE b.pickup_date LIKE ?
      `;
      const params = [`${yearMonth}%`];
      if (status && status !== "all") {
        sql += ` AND b.trip_status = ?`;
        params.push(status);
      }
      if (search) {
        sql += ` AND (b.booking_ref LIKE ? OR b.passenger_name LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s);
      }
      sql += ` ORDER BY b.pickup_date ASC, b.pickup_time ASC`;
      records = queryAll(sql, params);
      summary = {
        month: yearMonth,
        totalBookings: records.length,
        totalRevenue: records.reduce((s, r) => s + (r.customer_price || 0), 0),
        totalProfit: records.reduce((s, r) => s + ((r.customer_price || 0) - (r.supplier_cost || 0) - (r.driver_payout || 0)), 0)
      };
      break;
    }
    case "driver_wise": {
      let sql = `
        SELECT 
          d.id, d.driver_code, d.full_name, d.mobile, d.currency,
          COUNT(b.id) as total_trips,
          SUM(CASE WHEN b.trip_status = 'Trip Completed' THEN 1 ELSE 0 END) as completed_trips,
          SUM(CASE WHEN b.trip_status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled_trips,
          COALESCE(SUM(b.driver_payout), 0) as total_earned,
          d.current_balance
        FROM drivers d
        LEFT JOIN bookings b ON d.id = b.driver_id
        WHERE 1=1
      `;
      const params = [];
      if (startDate) {
        sql += ` AND (b.pickup_date >= ? OR b.pickup_date IS NULL)`;
        params.push(startDate);
      }
      if (endDate) {
        sql += ` AND (b.pickup_date <= ? OR b.pickup_date IS NULL)`;
        params.push(endDate);
      }
      if (driverId && driverId !== "all") {
        sql += ` AND d.id = ?`;
        params.push(driverId);
      }
      if (search) {
        sql += ` AND (d.full_name LIKE ? OR d.driver_code LIKE ? OR d.mobile LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s);
      }
      sql += ` GROUP BY d.id ORDER BY total_trips DESC`;
      records = queryAll(sql, params);
      summary = {
        totalDrivers: records.length,
        totalTrips: records.reduce((s, r) => s + (r.total_trips || 0), 0),
        totalPayouts: records.reduce((s, r) => s + (r.total_earned || 0), 0),
        totalBalanceDue: records.reduce((s, r) => s + (r.current_balance || 0), 0)
      };
      break;
    }
    case "vehicle_wise": {
      let sql = `
        SELECT 
          v.id, v.reg_number, v.vehicle_type, v.make_model, v.status,
          COUNT(b.id) as total_trips,
          SUM(CASE WHEN b.trip_status = 'Trip Completed' THEN 1 ELSE 0 END) as completed_trips,
          COALESCE(SUM(b.customer_price), 0) as generated_revenue
        FROM vehicles v
        LEFT JOIN bookings b ON v.id = b.vehicle_id
        WHERE 1=1
      `;
      const params = [];
      if (vehicleId && vehicleId !== "all") {
        sql += ` AND v.id = ?`;
        params.push(vehicleId);
      }
      if (vehicleType && vehicleType !== "all") {
        sql += ` AND v.vehicle_type = ?`;
        params.push(vehicleType);
      }
      if (search) {
        sql += ` AND (v.reg_number LIKE ? OR v.make_model LIKE ? OR v.vehicle_type LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s);
      }
      sql += ` GROUP BY v.id ORDER BY total_trips DESC`;
      records = queryAll(sql, params);
      summary = {
        totalVehicles: records.length,
        totalTrips: records.reduce((s, r) => s + (r.total_trips || 0), 0),
        totalRevenue: records.reduce((s, r) => s + (r.generated_revenue || 0), 0)
      };
      break;
    }
    case "supplier_wise": {
      let sql = `
        SELECT 
          s.id, s.supplier_code, s.name, s.default_currency, s.opening_balance,
          COUNT(b.id) as total_trips,
          COALESCE(SUM(b.supplier_cost), 0) as total_cost,
          s.current_balance
        FROM suppliers s
        LEFT JOIN bookings b ON s.id = b.supplier_id AND b.trip_status != 'Cancelled'
        WHERE 1=1
      `;
      const params = [];
      if (supplierId && supplierId !== "all") {
        sql += ` AND s.id = ?`;
        params.push(supplierId);
      }
      if (currency && currency !== "all") {
        sql += ` AND s.default_currency = ?`;
        params.push(currency);
      }
      if (search) {
        sql += ` AND (s.name LIKE ? OR s.supplier_code LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s);
      }
      sql += ` GROUP BY s.id ORDER BY total_cost DESC`;
      records = queryAll(sql, params);
      summary = {
        totalSuppliers: records.length,
        totalPurchaseCost: records.reduce((s, r) => s + (r.total_cost || 0), 0),
        totalOutstandingPayables: records.reduce((s, r) => s + (r.current_balance || 0), 0)
      };
      break;
    }
    case "route_wise":
    case "pickup_location": {
      let sql = `
        SELECT 
          pickup_location, dropoff_location,
          COUNT(*) as trip_count,
          COALESCE(SUM(customer_price), 0) as total_revenue,
          AVG(customer_price) as avg_price,
          currency
        FROM bookings
        WHERE trip_status != 'Cancelled'
      `;
      const params = [];
      if (startDate) {
        sql += ` AND pickup_date >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        sql += ` AND pickup_date <= ?`;
        params.push(endDate);
      }
      if (search) {
        sql += ` AND (pickup_location LIKE ? OR dropoff_location LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s);
      }
      sql += ` GROUP BY pickup_location, dropoff_location ORDER BY trip_count DESC`;
      records = queryAll(sql, params);
      summary = {
        totalRoutes: records.length,
        totalVolume: records.reduce((s, r) => s + (r.trip_count || 0), 0),
        totalRevenue: records.reduce((s, r) => s + (r.total_revenue || 0), 0)
      };
      break;
    }
    case "flight_wise": {
      let sql = `
        SELECT 
          flight_number, pickup_date, pickup_time, passenger_name, contact_number, pickup_location, dropoff_location, trip_status, customer_price
        FROM bookings
        WHERE flight_number IS NOT NULL AND flight_number != ''
      `;
      const params = [];
      if (startDate) {
        sql += ` AND pickup_date >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        sql += ` AND pickup_date <= ?`;
        params.push(endDate);
      }
      if (flightNumber) {
        sql += ` AND flight_number LIKE ?`;
        params.push(`%${flightNumber}%`);
      }
      if (search) {
        sql += ` AND (flight_number LIKE ? OR passenger_name LIKE ? OR contact_number LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s);
      }
      sql += ` ORDER BY pickup_date DESC, pickup_time DESC`;
      records = queryAll(sql, params);
      summary = {
        totalFlights: records.length,
        totalPassengers: records.length
      };
      break;
    }
    case "cancelled_trips": {
      let sql = `
        SELECT b.*, d.full_name as driver_name, v.reg_number as vehicle_reg, s.name as supplier_name
        FROM bookings b
        LEFT JOIN drivers d ON b.driver_id = d.id
        LEFT JOIN vehicles v ON b.vehicle_id = v.id
        LEFT JOIN suppliers s ON b.supplier_id = s.id
        WHERE b.trip_status = 'Cancelled'
      `;
      const params = [];
      if (startDate) {
        sql += ` AND b.pickup_date >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        sql += ` AND b.pickup_date <= ?`;
        params.push(endDate);
      }
      if (search) {
        sql += ` AND (b.booking_ref LIKE ? OR b.passenger_name LIKE ? OR b.cancellation_reason LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s);
      }
      sql += ` ORDER BY b.pickup_date DESC`;
      records = queryAll(sql, params);
      summary = {
        totalCancelled: records.length,
        lostRevenue: records.reduce((s, r) => s + (r.customer_price || 0), 0)
      };
      break;
    }
    case "completed_trips": {
      let sql = `
        SELECT b.*, d.full_name as driver_name, v.reg_number as vehicle_reg, s.name as supplier_name
        FROM bookings b
        LEFT JOIN drivers d ON b.driver_id = d.id
        LEFT JOIN vehicles v ON b.vehicle_id = v.id
        LEFT JOIN suppliers s ON b.supplier_id = s.id
        WHERE b.trip_status = 'Trip Completed'
      `;
      const params = [];
      if (startDate) {
        sql += ` AND b.pickup_date >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        sql += ` AND b.pickup_date <= ?`;
        params.push(endDate);
      }
      if (driverId && driverId !== "all") {
        sql += ` AND b.driver_id = ?`;
        params.push(driverId);
      }
      if (search) {
        sql += ` AND (b.booking_ref LIKE ? OR b.passenger_name LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s);
      }
      sql += ` ORDER BY b.pickup_date DESC`;
      records = queryAll(sql, params);
      summary = {
        completedCount: records.length,
        totalRevenue: records.reduce((s, r) => s + (r.customer_price || 0), 0),
        totalSupplierCost: records.reduce((s, r) => s + (r.supplier_cost || 0), 0),
        totalDriverPayout: records.reduce((s, r) => s + (r.driver_payout || 0), 0),
        netMargin: records.reduce((s, r) => s + ((r.customer_price || 0) - (r.supplier_cost || 0) - (r.driver_payout || 0)), 0)
      };
      break;
    }
    case "outstanding_balances": {
      let sql = `
        SELECT 
          booking_ref, passenger_name as customer_name, pickup_date, customer_price, paid_amount,
          (customer_price - paid_amount) as outstanding_balance,
          currency, payment_status, contact_number
        FROM bookings
        WHERE (customer_price - paid_amount) > 0 AND trip_status != 'Cancelled'
      `;
      const params = [];
      if (search) {
        sql += ` AND (booking_ref LIKE ? OR passenger_name LIKE ? OR contact_number LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s);
      }
      sql += ` ORDER BY outstanding_balance DESC`;
      records = queryAll(sql, params);
      summary = {
        totalOutstanding: records.reduce((s, r) => s + (r.outstanding_balance || 0), 0),
        pendingAccounts: records.length
      };
      break;
    }
    case "customer_payment_report": {
      let sql = `SELECT * FROM payments WHERE entity_type = 'customer_receipt'`;
      const params = [];
      if (startDate) {
        sql += ` AND payment_date >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        sql += ` AND payment_date <= ?`;
        params.push(endDate);
      }
      if (search) {
        sql += ` AND (payment_ref LIKE ? OR entity_name LIKE ? OR booking_ref LIKE ? OR reference_no LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s, s);
      }
      sql += ` ORDER BY payment_date DESC`;
      records = queryAll(sql, params);
      summary = {
        totalCollected: records.reduce((s, r) => s + (r.amount || 0), 0),
        transactionCount: records.length
      };
      break;
    }
    case "profit_and_loss": {
      let bSql = `SELECT customer_price, supplier_cost, driver_payout, currency FROM bookings WHERE trip_status != 'Cancelled'`;
      const bParams = [];
      if (startDate) {
        bSql += ` AND pickup_date >= ?`;
        bParams.push(startDate);
      }
      if (endDate) {
        bSql += ` AND pickup_date <= ?`;
        bParams.push(endDate);
      }
      const bRows = queryAll(bSql, bParams);
      let eSql = `SELECT amount, notes, payment_date FROM payments WHERE entity_type = 'general_expense'`;
      const eParams = [];
      if (startDate) {
        eSql += ` AND payment_date >= ?`;
        eParams.push(startDate);
      }
      if (endDate) {
        eSql += ` AND payment_date <= ?`;
        eParams.push(endDate);
      }
      const expenseRows = queryAll(eSql, eParams);
      const totalRevenue = bRows.reduce((s, r) => s + (r.customer_price || 0), 0);
      const totalSupplierCost = bRows.reduce((s, r) => s + (r.supplier_cost || 0), 0);
      const totalDriverCost = bRows.reduce((s, r) => s + (r.driver_payout || 0), 0);
      const totalOperatingExpenses = expenseRows.reduce((s, r) => s + (r.amount || 0), 0);
      const grossProfit = totalRevenue - totalSupplierCost - totalDriverCost;
      const netProfit = grossProfit - totalOperatingExpenses;
      const marginPercentage = totalRevenue > 0 ? (netProfit / totalRevenue * 100).toFixed(1) : "0.0";
      records = [
        { item: "Operating Revenue (Trips & Bookings)", category: "Income", amount: totalRevenue, currency: "SAR", percentage: "100%" },
        { item: "Supplier Fleet Purchase Rates", category: "Cost of Sales", amount: totalSupplierCost, currency: "SAR", percentage: totalRevenue > 0 ? `${(totalSupplierCost / totalRevenue * 100).toFixed(1)}%` : "0%" },
        { item: "Driver Trip Payouts & Salaries", category: "Cost of Sales", amount: totalDriverCost, currency: "SAR", percentage: totalRevenue > 0 ? `${(totalDriverCost / totalRevenue * 100).toFixed(1)}%` : "0%" },
        { item: "Gross Profit", category: "Summary", amount: grossProfit, currency: "SAR", percentage: totalRevenue > 0 ? `${(grossProfit / totalRevenue * 100).toFixed(1)}%` : "0%" },
        { item: "General Business & Administrative Expenses", category: "Operating Expense", amount: totalOperatingExpenses, currency: "SAR", percentage: totalRevenue > 0 ? `${(totalOperatingExpenses / totalRevenue * 100).toFixed(1)}%` : "0%" },
        { item: "Net Operating Profit / (Loss)", category: "Net Result", amount: netProfit, currency: "SAR", percentage: `${marginPercentage}%` }
      ];
      summary = {
        totalRevenue,
        costOfSales: totalSupplierCost + totalDriverCost,
        grossProfit,
        operatingExpenses: totalOperatingExpenses,
        netProfit,
        marginPercentage: `${marginPercentage}%`
      };
      break;
    }
    case "user_activity_report": {
      let sql = `SELECT * FROM audit_logs WHERE 1=1`;
      const params = [];
      if (startDate) {
        sql += ` AND timestamp >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        sql += ` AND timestamp <= ?`;
        params.push(endDate + "T23:59:59.999Z");
      }
      if (search) {
        sql += ` AND (user_name LIKE ? OR action LIKE ? OR entity LIKE ? OR details LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s, s);
      }
      sql += ` ORDER BY timestamp DESC LIMIT 500`;
      records = queryAll(sql, params);
      summary = {
        totalAuditLogs: records.length
      };
      break;
    }
    default:
      return res.status(400).json({ error: `Unknown report type: ${reportType}` });
  }
  return res.json({
    reportType,
    period: { startDate: startDate || "All", endDate: endDate || "Present" },
    records,
    summary
  });
});
var reportRoutes_default = router8;

// server/routes/backupRoutes.ts
import { Router as Router9 } from "express";
import fs2 from "fs";
import path2 from "path";
var router9 = Router9();
var DATA_DIR2 = path2.resolve(process.cwd(), "data");
var BACKUPS_DIR2 = path2.join(DATA_DIR2, "backups");
router9.get("/", requireAuth, requireRole("super_admin", "admin"), (req, res) => {
  const backups = queryAll(`SELECT * FROM backups ORDER BY created_at DESC`);
  const diskBackups = [];
  if (fs2.existsSync(BACKUPS_DIR2)) {
    const files = fs2.readdirSync(BACKUPS_DIR2);
    for (const file of files) {
      if (file.endsWith(".sqlite")) {
        const stats = fs2.statSync(path2.join(BACKUPS_DIR2, file));
        diskBackups.push({
          filename: file,
          size_bytes: stats.size,
          created_at: stats.birthtime.toISOString()
        });
      }
    }
  }
  return res.json({
    backups,
    diskBackups,
    autoBackupEnabled: true,
    schedule: "Every 6 hours & daily midnight snapshot",
    lastBackupTime: backups[0]?.created_at || "None"
  });
});
router9.post("/create", requireAuth, requireRole("super_admin", "admin"), async (req, res) => {
  try {
    const db = await getDb();
    persistDb();
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const filename = `gulf_taxis_backup_${timestamp}.sqlite`;
    const destPath = path2.join(BACKUPS_DIR2, filename);
    const binaryData = db.export();
    const buffer = Buffer.from(binaryData);
    fs2.writeFileSync(destPath, buffer);
    const id = "bkp_" + Date.now();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    runSql(
      `INSERT INTO backups (id, filename, size_bytes, created_at, status, type)
       VALUES (?, ?, ?, ?, 'completed', 'manual')`,
      [id, filename, buffer.length, now]
    );
    recordAuditLog(
      req.user?.id,
      req.user?.full_name,
      "BACKUP",
      "system",
      id,
      `Manual backup created: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`
    );
    return res.status(201).json({
      success: true,
      message: `Database backup '${filename}' successfully created and stored.`,
      backup: { id, filename, size_bytes: buffer.length, created_at: now }
    });
  } catch (err) {
    console.error("Backup creation failed:", err);
    return res.status(500).json({ error: "Failed to create database backup: " + err.message });
  }
});
router9.post("/restore", requireAuth, requireRole("super_admin"), async (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ error: "Backup filename is required." });
  }
  const safeFilename = path2.basename(filename);
  const filePath = path2.join(BACKUPS_DIR2, safeFilename);
  if (!fs2.existsSync(filePath)) {
    return res.status(404).json({ error: "Specified backup file does not exist." });
  }
  try {
    const backupBuffer = fs2.readFileSync(filePath);
    const db = await getDb();
    const safetySnapshotName = `pre_restore_safety_${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.sqlite`;
    fs2.writeFileSync(path2.join(BACKUPS_DIR2, safetySnapshotName), Buffer.from(db.export()));
    const initSqlJs2 = (await import("sql.js")).default;
    const SQL = await initSqlJs2();
    const restoredDb = new SQL.Database(backupBuffer);
    const testResult = restoredDb.exec("SELECT count(*) FROM users");
    if (!testResult || testResult.length === 0) {
      throw new Error("Backup file verification failed: users table not readable.");
    }
    const mainDbFile = path2.join(DATA_DIR2, "gulf_taxis.sqlite");
    fs2.writeFileSync(mainDbFile, backupBuffer);
    setDbInstance(restoredDb);
    recordAuditLog(
      req.user?.id,
      req.user?.full_name,
      "RESTORE",
      "system",
      safeFilename,
      `Database restored from backup: ${safeFilename}`
    );
    return res.json({
      success: true,
      message: `Database successfully restored from '${safeFilename}'. Please refresh your view to see restored data.`
    });
  } catch (err) {
    console.error("Restoration failed:", err);
    return res.status(500).json({ error: "Failed to restore database: " + err.message });
  }
});
router9.get("/export-sql", requireAuth, requireRole("super_admin", "admin"), (req, res) => {
  const users = queryAll(`SELECT * FROM users`);
  const vehicles = queryAll(`SELECT * FROM vehicles`);
  const drivers = queryAll(`SELECT * FROM drivers`);
  const suppliers = queryAll(`SELECT * FROM suppliers`);
  const bookings = queryAll(`SELECT * FROM bookings`);
  const payments = queryAll(`SELECT * FROM payments`);
  const settings = queryAll(`SELECT * FROM settings`);
  let dump = `-- ==========================================================
`;
  dump += `-- GULF TAXIS DISPATCH CLOUD SYSTEM \u2014 DATABASE MIGRATION DUMP
`;
  dump += `-- Generated on: ${(/* @__PURE__ */ new Date()).toISOString()}
`;
  dump += `-- Target Compatible: PostgreSQL 14+, Hostinger VPS, Railway, Supabase
`;
  dump += `-- ==========================================================

`;
  dump += `CREATE TABLE IF NOT EXISTS users (
`;
  dump += `  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  email VARCHAR(128) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(128) NOT NULL,
  role VARCHAR(64) NOT NULL,
  phone VARCHAR(32),
  permissions TEXT,
  is_active INT DEFAULT 1,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

`;
  dump += `CREATE TABLE IF NOT EXISTS vehicles (
`;
  dump += `  id VARCHAR(64) PRIMARY KEY,
  reg_number VARCHAR(64) UNIQUE NOT NULL,
  vehicle_type VARCHAR(128) NOT NULL,
  make_model VARCHAR(128) NOT NULL,
  passenger_capacity INT DEFAULT 4,
  luggage_capacity INT DEFAULT 3,
  supplier_id VARCHAR(64),
  assigned_driver_id VARCHAR(64),
  status VARCHAR(32) DEFAULT 'available',
  color VARCHAR(64),
  model_year INT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

`;
  dump += `CREATE TABLE IF NOT EXISTS drivers (
`;
  dump += `  id VARCHAR(64) PRIMARY KEY,
  driver_code VARCHAR(32) UNIQUE NOT NULL,
  full_name VARCHAR(128) NOT NULL,
  mobile VARCHAR(32) NOT NULL,
  email VARCHAR(128),
  license_number VARCHAR(64) NOT NULL,
  license_expiry VARCHAR(32) NOT NULL,
  assigned_vehicle_id VARCHAR(64),
  payment_arrangement VARCHAR(32) DEFAULT 'per_trip',
  rate_or_salary NUMERIC(12,2) DEFAULT 0,
  currency VARCHAR(16) DEFAULT 'SAR',
  is_active INT DEFAULT 1,
  current_balance NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

`;
  dump += `CREATE TABLE IF NOT EXISTS suppliers (
`;
  dump += `  id VARCHAR(64) PRIMARY KEY,
  supplier_code VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(128) NOT NULL,
  contact_person VARCHAR(128),
  mobile VARCHAR(32),
  email VARCHAR(128),
  address TEXT,
  default_currency VARCHAR(16) DEFAULT 'SAR',
  opening_balance NUMERIC(12,2) DEFAULT 0,
  current_balance NUMERIC(12,2) DEFAULT 0,
  payment_terms VARCHAR(64) DEFAULT '15_days',
  is_active INT DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

`;
  dump += `CREATE TABLE IF NOT EXISTS bookings (
`;
  dump += `  id VARCHAR(64) PRIMARY KEY,
  booking_ref VARCHAR(64) UNIQUE NOT NULL,
  booking_date VARCHAR(32) NOT NULL,
  pickup_date VARCHAR(32) NOT NULL,
  pickup_time VARCHAR(16) NOT NULL,
  passenger_name VARCHAR(128) NOT NULL,
  contact_number VARCHAR(32) NOT NULL,
  passengers_count INT DEFAULT 1,
  luggage_count INT DEFAULT 1,
  pickup_location TEXT NOT NULL,
  dropoff_location TEXT NOT NULL,
  flight_number VARCHAR(32),
  airline VARCHAR(64),
  vehicle_type VARCHAR(128) NOT NULL,
  vehicle_id VARCHAR(64),
  driver_id VARCHAR(64),
  supplier_id VARCHAR(64),
  customer_name VARCHAR(128) NOT NULL,
  customer_phone VARCHAR(32),
  customer_price NUMERIC(12,2) DEFAULT 0,
  supplier_cost NUMERIC(12,2) DEFAULT 0,
  driver_payout NUMERIC(12,2) DEFAULT 0,
  currency VARCHAR(16) DEFAULT 'SAR',
  payment_status VARCHAR(32) DEFAULT 'unpaid',
  paid_amount NUMERIC(12,2) DEFAULT 0,
  trip_status VARCHAR(64) DEFAULT 'New Booking',
  cancellation_reason TEXT,
  special_instructions TEXT,
  dispatcher_notes TEXT,
  created_by_id VARCHAR(64),
  created_by_name VARCHAR(128),
  updated_by_id VARCHAR(64),
  updated_by_name VARCHAR(128),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

`;
  dump += `CREATE TABLE IF NOT EXISTS payments (
`;
  dump += `  id VARCHAR(64) PRIMARY KEY,
  payment_ref VARCHAR(64) UNIQUE NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64),
  entity_name VARCHAR(128),
  booking_id VARCHAR(64),
  booking_ref VARCHAR(64),
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(16) DEFAULT 'SAR',
  payment_method VARCHAR(64) NOT NULL,
  payment_date VARCHAR(32) NOT NULL,
  reference_no VARCHAR(64),
  notes TEXT,
  created_by_id VARCHAR(64),
  created_by_name VARCHAR(128),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

`;
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", 'attachment; filename="gulf_taxis_schema_export.sql"');
  return res.send(dump);
});
var backupRoutes_default = router9;

// server/routes/userRoutes.ts
import { Router as Router10 } from "express";
import bcrypt3 from "bcryptjs";
var router10 = Router10();
router10.get("/", requireAuth, requireRole("super_admin", "admin"), (req, res) => {
  const users = queryAll(
    `SELECT id, username, email, full_name, role, phone, permissions, is_active, last_login, created_at, updated_at 
     FROM users 
     ORDER BY created_at ASC`
  );
  const formatted = users.map((u) => {
    let perms = [];
    try {
      perms = JSON.parse(u.permissions || "[]");
    } catch (e) {
      perms = [];
    }
    return {
      ...u,
      permissions: perms
    };
  });
  return res.json({ users: formatted });
});
router10.post("/", requireAuth, requireRole("super_admin", "admin"), (req, res) => {
  const { username, email, password, full_name, role, phone, permissions } = req.body;
  if (!username || !email || !password || !full_name || !role) {
    return res.status(400).json({ error: "Please enter username, email, password, full name, and role." });
  }
  const existing = queryOne(
    `SELECT id, username, email FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)`,
    [username.trim(), email.trim()]
  );
  if (existing) {
    return res.status(409).json({ error: "A user with this username or email address already exists." });
  }
  const id = "usr_" + Date.now();
  const passwordHash = bcrypt3.hashSync(password, 10);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const permsArray = Array.isArray(permissions) ? permissions : ["dashboard", "bookings"];
  runSql(
    `INSERT INTO users (id, username, email, password_hash, full_name, role, phone, permissions, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      id,
      username.trim().toLowerCase(),
      email.trim().toLowerCase(),
      passwordHash,
      full_name.trim(),
      role,
      phone?.trim() || null,
      JSON.stringify(permsArray),
      now,
      now
    ]
  );
  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    "CREATE",
    "user",
    id,
    `Created user account: ${username} (${role})`
  );
  const created = queryOne(
    `SELECT id, username, email, full_name, role, phone, permissions, is_active, created_at FROM users WHERE id = ?`,
    [id]
  );
  return res.status(201).json({
    success: true,
    user: {
      ...created,
      permissions: permsArray
    },
    message: `User ${full_name} successfully created.`
  });
});
router10.put("/:id", requireAuth, requireRole("super_admin", "admin"), (req, res) => {
  const { id } = req.params;
  const existing = queryOne(`SELECT * FROM users WHERE id = ?`, [id]);
  if (!existing) {
    return res.status(404).json({ error: "User not found." });
  }
  if (existing.role === "super_admin" && req.user?.role !== "super_admin") {
    return res.status(403).json({ error: "Only a Super Administrator can modify Super Admin accounts." });
  }
  const { full_name, role, phone, permissions, is_active, password } = req.body;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let passwordHash = existing.password_hash;
  if (password && password.trim().length >= 6) {
    passwordHash = bcrypt3.hashSync(password.trim(), 10);
  }
  const perms = permissions ? JSON.stringify(permissions) : existing.permissions;
  runSql(
    `UPDATE users SET
      full_name = ?,
      role = ?,
      phone = ?,
      permissions = ?,
      is_active = ?,
      password_hash = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      full_name ? full_name.trim() : existing.full_name,
      role || existing.role,
      phone !== void 0 ? phone : existing.phone,
      perms,
      is_active !== void 0 ? is_active ? 1 : 0 : existing.is_active,
      passwordHash,
      now,
      id
    ]
  );
  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    "UPDATE",
    "user",
    id,
    `Updated profile/permissions for ${existing.username}`
  );
  const updated = queryOne(
    `SELECT id, username, email, full_name, role, phone, permissions, is_active, updated_at FROM users WHERE id = ?`,
    [id]
  );
  return res.json({
    success: true,
    user: {
      ...updated,
      permissions: JSON.parse(updated.permissions || "[]")
    },
    message: `User ${updated.full_name} updated successfully.`
  });
});
router10.post("/:id/toggle-status", requireAuth, requireRole("super_admin", "admin"), (req, res) => {
  const { id } = req.params;
  const target = queryOne(`SELECT id, username, role, is_active FROM users WHERE id = ?`, [id]);
  if (!target) {
    return res.status(404).json({ error: "User not found." });
  }
  if (target.id === req.user?.id) {
    return res.status(400).json({ error: "You cannot deactivate your own active account." });
  }
  const newStatus = target.is_active === 1 ? 0 : 1;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  runSql(`UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?`, [newStatus, now, id]);
  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    "UPDATE",
    "user",
    id,
    `${newStatus === 1 ? "Activated" : "Deactivated"} user account ${target.username}`
  );
  return res.json({
    success: true,
    is_active: newStatus,
    message: `User ${target.username} has been ${newStatus === 1 ? "activated" : "deactivated"}.`
  });
});
router10.delete("/:id", requireAuth, requireRole("super_admin", "admin"), (req, res) => {
  const { id } = req.params;
  const target = queryOne(`SELECT id, username, email, full_name, role, is_active FROM users WHERE id = ?`, [id]);
  if (!target) {
    return res.status(404).json({ error: "User not found." });
  }
  if (target.id === req.user?.id) {
    return res.status(400).json({ error: "You cannot delete your own active account." });
  }
  if (target.role === "super_admin" && req.user?.role !== "super_admin") {
    return res.status(403).json({ error: "Only a Super Administrator can delete Super Admin accounts." });
  }
  if (target.role === "super_admin") {
    const superAdminCount = queryOne(
      `SELECT count(*) as count FROM users WHERE role = 'super_admin' AND is_active = 1`
    )?.count || 0;
    if (superAdminCount <= 1) {
      return res.status(400).json({
        error: "Cannot delete the last active Super Administrator. The system must always retain at least one active Super Admin."
      });
    }
  }
  const totalAdminCount = queryOne(
    `SELECT count(*) as count FROM users WHERE role IN ('super_admin', 'admin') AND is_active = 1`
  )?.count || 0;
  if (totalAdminCount <= 1 && (target.role === "admin" || target.role === "super_admin")) {
    return res.status(400).json({
      error: "Cannot delete the last remaining administrative account capable of managing the system."
    });
  }
  runSql(`DELETE FROM users WHERE id = ?`, [id]);
  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    "DELETE",
    "user",
    id,
    `Permanently deleted staff user account: ${target.username} (${target.full_name}, ${target.role})`
  );
  return res.json({
    success: true,
    message: `User account @${target.username} (${target.full_name}) successfully deleted.`
  });
});
var userRoutes_default = router10;

// server/routes/settingsRoutes.ts
import { Router as Router11 } from "express";
var router11 = Router11();
router11.get("/", requireAuth, (req, res) => {
  const rows = queryAll(`SELECT key, value FROM settings`);
  const settings = {};
  for (const r of rows) {
    try {
      settings[r.key] = JSON.parse(r.value);
    } catch (e) {
      settings[r.key] = r.value;
    }
  }
  return res.json({ settings });
});
router11.put("/", requireAuth, requireRole("super_admin", "admin"), (req, res) => {
  const { key, value } = req.body;
  if (!key || value === void 0) {
    return res.status(400).json({ error: "Settings key and value are required." });
  }
  const jsonVal = typeof value === "object" ? JSON.stringify(value) : value;
  const existing = queryOne(`SELECT key FROM settings WHERE key = ?`, [key]);
  if (existing) {
    runSql(`UPDATE settings SET value = ? WHERE key = ?`, [jsonVal, key]);
  } else {
    runSql(`INSERT INTO settings (key, value) VALUES (?, ?)`, [key, jsonVal]);
  }
  recordAuditLog(
    req.user?.id,
    req.user?.full_name,
    "UPDATE",
    "setting",
    key,
    `Updated system setting '${key}'`
  );
  return res.json({ success: true, message: `Setting '${key}' updated successfully.` });
});
router11.get("/audit-logs", requireAuth, requireRole("super_admin", "admin"), (req, res) => {
  const { entity, action, limit } = req.query;
  let sql = `SELECT * FROM audit_logs WHERE 1=1`;
  const params = [];
  if (entity && entity !== "all") {
    sql += ` AND entity = ?`;
    params.push(entity);
  }
  if (action && action !== "all") {
    sql += ` AND action = ?`;
    params.push(action);
  }
  sql += ` ORDER BY timestamp DESC`;
  const parsedLimit = limit ? parseInt(limit, 10) : 200;
  sql += ` LIMIT ${parsedLimit}`;
  const logs = queryAll(sql, params);
  return res.json({ logs });
});
var settingsRoutes_default = router11;

// server/routes/syncRoutes.ts
import { Router as Router12 } from "express";
var router12 = Router12();
router12.get("/pulse", requireAuth, (req, res) => {
  const lastLog = queryOne(`SELECT id, timestamp, action, entity, entity_id FROM audit_logs ORDER BY timestamp DESC LIMIT 1`);
  const activeCount = queryOne(`SELECT count(*) as count FROM bookings WHERE trip_status NOT IN ('Trip Completed', 'Cancelled')`)?.count || 0;
  const unassignedCount = queryOne(`SELECT count(*) as count FROM bookings WHERE (driver_id IS NULL OR driver_id = '') AND trip_status NOT IN ('Cancelled', 'Trip Completed')`)?.count || 0;
  const completedToday = queryOne(
    `SELECT count(*) as count FROM bookings WHERE trip_status = 'Trip Completed' AND pickup_date = ?`,
    [(/* @__PURE__ */ new Date()).toISOString().split("T")[0]]
  )?.count || 0;
  return res.json({
    serverTime: (/* @__PURE__ */ new Date()).toISOString(),
    lastAuditId: lastLog?.id || "none",
    lastChangeTime: lastLog?.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
    activeCount,
    unassignedCount,
    completedToday,
    user: req.user?.username
  });
});
var syncRoutes_default = router12;

// server/routes/dataManagementRoutes.ts
import { Router as Router13 } from "express";
import bcrypt4 from "bcryptjs";
import fs3 from "fs";
import path3 from "path";
var router13 = Router13();
var DATA_DIR3 = path3.resolve(process.cwd(), "data");
var BACKUPS_DIR3 = path3.join(DATA_DIR3, "backups");
router13.get("/summary", requireAuth, requireRole("super_admin", "admin"), (req, res) => {
  try {
    const bookingsCount = queryOne("SELECT count(*) as count FROM bookings")?.count || 0;
    const activeBookingsCount = queryOne(
      "SELECT count(*) as count FROM bookings WHERE trip_status NOT IN ('Trip Completed', 'Cancelled', 'No Show')"
    )?.count || 0;
    const tripLogsCount = queryOne("SELECT count(*) as count FROM trip_status_logs")?.count || 0;
    const paymentsCount = queryOne("SELECT count(*) as count FROM payments")?.count || 0;
    const driversCount = queryOne("SELECT count(*) as count FROM drivers")?.count || 0;
    const suppliersCount = queryOne("SELECT count(*) as count FROM suppliers")?.count || 0;
    const vehiclesCount = queryOne("SELECT count(*) as count FROM vehicles")?.count || 0;
    const usersCount = queryOne("SELECT count(*) as count FROM users")?.count || 0;
    const settingsCount = queryOne("SELECT count(*) as count FROM settings")?.count || 0;
    const auditLogsCount = queryOne("SELECT count(*) as count FROM audit_logs")?.count || 0;
    const backupsCount = queryOne("SELECT count(*) as count FROM backups")?.count || 0;
    return res.json({
      operational: {
        bookings: bookingsCount,
        active_bookings: activeBookingsCount,
        trip_status_logs: tripLogsCount,
        payments: paymentsCount,
        drivers: driversCount,
        suppliers: suppliersCount,
        vehicles: vehiclesCount
      },
      protected: {
        users: usersCount,
        settings: settingsCount,
        audit_logs: auditLogsCount,
        backups: backupsCount
      }
    });
  } catch (err) {
    console.error("Data summary error:", err);
    return res.status(500).json({ error: "Failed to retrieve data summary: " + err.message });
  }
});
router13.post("/fresh-start", requireAuth, requireRole("super_admin", "admin"), async (req, res) => {
  const { password, confirmationPhrase, mode, categories } = req.body;
  if (!confirmationPhrase || confirmationPhrase.trim() !== "RESET GULF TAXIS") {
    return res.status(400).json({
      error: 'Security confirmation failed. You must type exactly "RESET GULF TAXIS" to proceed.'
    });
  }
  if (!password) {
    return res.status(400).json({ error: "Administrator password is required to authorize Fresh Start." });
  }
  const currentUser = queryOne(
    "SELECT password_hash, username, role FROM users WHERE id = ?",
    [req.user?.id]
  );
  if (!currentUser || !bcrypt4.compareSync(password, currentUser.password_hash)) {
    return res.status(401).json({ error: "Incorrect administrator password. Authentication failed." });
  }
  const toClear = {
    bookings: false,
    drivers: false,
    suppliers: false,
    vehicles: false,
    payments: false
  };
  if (mode === "operational_reset") {
    toClear.bookings = true;
    toClear.payments = true;
    if (categories?.drivers) toClear.drivers = true;
    if (categories?.suppliers) toClear.suppliers = true;
    if (categories?.vehicles) toClear.vehicles = true;
  } else if (mode === "selective_reset") {
    toClear.bookings = !!categories?.bookings;
    toClear.drivers = !!categories?.drivers;
    toClear.suppliers = !!categories?.suppliers;
    toClear.vehicles = !!categories?.vehicles;
    toClear.payments = !!categories?.payments;
  } else {
    return res.status(400).json({ error: "Invalid Fresh Start mode specified." });
  }
  const anySelected = Object.values(toClear).some(Boolean);
  if (!anySelected) {
    return res.status(400).json({ error: "Please select at least one data category to reset." });
  }
  let backupFilename = "";
  try {
    const db = await getDb();
    persistDb();
    if (!fs3.existsSync(BACKUPS_DIR3)) {
      fs3.mkdirSync(BACKUPS_DIR3, { recursive: true });
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    backupFilename = `fresh_start_safety_backup_${timestamp}.sqlite`;
    const destPath = path3.join(BACKUPS_DIR3, backupFilename);
    const binaryData = db.export();
    const buffer = Buffer.from(binaryData);
    fs3.writeFileSync(destPath, buffer);
    if (!fs3.existsSync(destPath) || fs3.statSync(destPath).size < 1e3) {
      throw new Error("Safety backup verification failed: snapshot file is missing or corrupted.");
    }
    runSql(
      `INSERT INTO backups (id, filename, size_bytes, created_at, status, type)
       VALUES (?, ?, ?, ?, 'completed', 'automated')`,
      ["bkp_fresh_start_" + Date.now(), backupFilename, buffer.length, (/* @__PURE__ */ new Date()).toISOString()]
    );
  } catch (backupErr) {
    console.error("Fresh Start aborted due to backup error:", backupErr);
    return res.status(500).json({
      error: `Safety backup creation failed (${backupErr.message}). Fresh Start has been aborted with ZERO changes made to your database.`
    });
  }
  const deletedCounts = {};
  try {
    const db = await getDb();
    runTransaction(() => {
      if (toClear.bookings) {
        const bCount = queryOne("SELECT count(*) as count FROM bookings")?.count || 0;
        const lCount = queryOne("SELECT count(*) as count FROM trip_status_logs")?.count || 0;
        db.run("DELETE FROM trip_status_logs;");
        db.run("DELETE FROM payments WHERE booking_id IS NOT NULL;");
        db.run("DELETE FROM bookings;");
        deletedCounts.bookings = bCount;
        deletedCounts.trip_status_logs = lCount;
      }
      if (toClear.drivers) {
        const dCount = queryOne("SELECT count(*) as count FROM drivers")?.count || 0;
        db.run("DELETE FROM payments WHERE entity_type = 'driver_payment';");
        db.run("UPDATE vehicles SET assigned_driver_id = NULL;");
        db.run("UPDATE bookings SET driver_id = NULL;");
        db.run("DELETE FROM drivers;");
        deletedCounts.drivers = dCount;
      }
      if (toClear.suppliers) {
        const sCount = queryOne("SELECT count(*) as count FROM suppliers")?.count || 0;
        db.run("DELETE FROM payments WHERE entity_type = 'supplier_payment';");
        db.run("UPDATE vehicles SET supplier_id = NULL;");
        db.run("UPDATE bookings SET supplier_id = NULL;");
        db.run("DELETE FROM suppliers;");
        deletedCounts.suppliers = sCount;
      }
      if (toClear.vehicles) {
        const vCount = queryOne("SELECT count(*) as count FROM vehicles")?.count || 0;
        db.run("UPDATE drivers SET assigned_vehicle_id = NULL;");
        db.run("UPDATE bookings SET vehicle_id = NULL;");
        db.run("DELETE FROM vehicles;");
        deletedCounts.vehicles = vCount;
      }
      if (toClear.payments) {
        const pCount = queryOne("SELECT count(*) as count FROM payments")?.count || 0;
        db.run("DELETE FROM payments;");
        deletedCounts.payments = pCount;
      }
    });
    const affectedCategories = Object.keys(toClear).filter((k) => toClear[k]);
    recordAuditLog(
      req.user?.id,
      req.user?.full_name,
      "RESET",
      "system",
      "fresh_start",
      `Executed Fresh Start (${mode}). Cleared: ${affectedCategories.join(", ")}. Safety backup: ${backupFilename}`
    );
    return res.json({
      success: true,
      message: "Fresh Start completed successfully. Selected operational data has been cleared.",
      backupFilename,
      deletedCounts,
      affectedCategories
    });
  } catch (txErr) {
    console.error("Fresh Start transaction failed and rolled back:", txErr);
    return res.status(500).json({
      error: "Database transaction failed during reset. All changes have been completely rolled back. Error: " + txErr.message
    });
  }
});
var dataManagementRoutes_default = router13;

// server.ts
var app = express();
var PORT = parseInt(process.env.PORT || "3000", 10);
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
await getDb();
app.use("/api/auth", authRoutes_default);
app.use("/api/bookings", bookingRoutes_default);
app.use("/api/dispatch", dispatchRoutes_default);
app.use("/api/drivers", driverRoutes_default);
app.use("/api/vehicles", vehicleRoutes_default);
app.use("/api/suppliers", supplierRoutes_default);
app.use("/api/finance", financeRoutes_default);
app.use("/api/reports", reportRoutes_default);
app.use("/api/backups", backupRoutes_default);
app.use("/api/users", userRoutes_default);
app.use("/api/settings", settingsRoutes_default);
app.use("/api/sync", syncRoutes_default);
app.use("/api/data-management", dataManagementRoutes_default);
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    system: "Gulf Taxis Dispatch Cloud System",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    database: "connected",
    timezone: process.env.TZ || "Asia/Riyadh",
    node_version: process.version,
    environment: process.env.NODE_ENV || "production"
  });
});
app.get(["/Gulf_Taxis_Dispatch_Cloud_Complete.zip", "/api/download-package"], (req, res) => {
  const publicZip = path4.resolve(process.cwd(), "public", "Gulf_Taxis_Dispatch_Cloud_Complete.zip");
  const rootZip = path4.resolve(process.cwd(), "Gulf_Taxis_Dispatch_Cloud_Complete.zip");
  const targetZip = fs4.existsSync(publicZip) ? publicZip : rootZip;
  if (fs4.existsSync(targetZip)) {
    res.setHeader("Content-Disposition", 'attachment; filename="Gulf_Taxis_Dispatch_Cloud_Complete.zip"');
    res.setHeader("Content-Type", "application/zip");
    return res.sendFile(targetZip);
  }
  return res.status(404).json({ error: "Package archive not found. Please contact administrator." });
});
var BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1e3;
async function performAutomatedBackup() {
  try {
    const db = await getDb();
    persistDb();
    const backupDir = path4.resolve(process.cwd(), "data", "backups");
    if (!fs4.existsSync(backupDir)) {
      fs4.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const filename = `auto_backup_${timestamp}.sqlite`;
    const dest = path4.join(backupDir, filename);
    const data = Buffer.from(db.export());
    fs4.writeFileSync(dest, data);
    runSql(
      `INSERT INTO backups (id, filename, size_bytes, created_at, status, type)
       VALUES (?, ?, ?, ?, 'completed', 'automated')`,
      ["auto_" + Date.now(), filename, data.length, (/* @__PURE__ */ new Date()).toISOString()]
    );
    console.log(`[Gulf Taxis] Automated backup successfully saved: ${filename}`);
  } catch (err) {
    console.error("[Gulf Taxis] Automated backup error:", err);
  }
}
setInterval(performAutomatedBackup, BACKUP_INTERVAL_MS);
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `API route ${req.method} ${req.originalUrl} not found` });
});
var distPath = path4.resolve(process.cwd(), "dist");
var hasDist = fs4.existsSync(path4.join(distPath, "index.html"));
var isProduction = process.env.NODE_ENV === "production" || hasDist;
if (!isProduction) {
  try {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } catch (err) {
    console.warn("[Gulf Taxis] Vite dev middleware not available, falling back to static files.");
    if (hasDist) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path4.join(distPath, "index.html"));
      });
    }
  }
} else {
  if (hasDist) {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path4.join(distPath, "index.html"));
    });
  } else {
    app.get("*", (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Gulf Taxis Dispatch Cloud</title>
        </head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #0f172a; color: white;">
          <h2>\u{1F696} Gulf Taxis Dispatch Cloud Server Active</h2>
          <p>The backend API and database are online. Frontend assets need to be built.</p>
          <p>Please run <code>npm run build</code> to generate the production frontend.</p>
          <p><a href="/api/health" style="color: #38bdf8;">Check API Health Status</a></p>
        </body>
        </html>
      `);
    });
  }
}
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Gulf Taxis Dispatch System] Server listening on http://0.0.0.0:${PORT}`);
});
