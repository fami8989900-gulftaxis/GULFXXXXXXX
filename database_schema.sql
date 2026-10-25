-- =============================================================================
-- GULF TAXIS DISPATCH CLOUD — ENTERPRISE DATABASE SCHEMA & MIGRATION SCRIPT
-- Compatible with: PostgreSQL 14+, SQLite 3, MySQL 8.0, Supabase, Cloud SQL
-- =============================================================================

-- 1. USERS & ACCESS CONTROL TABLE
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  email VARCHAR(128) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(128) NOT NULL,
  role VARCHAR(64) NOT NULL, -- 'super_admin' | 'admin' | 'booking_agent' | 'dispatcher' | 'finance_executive' | 'report_viewer'
  phone VARCHAR(32),
  permissions TEXT, -- JSON array of granted module identifiers
  is_active INT DEFAULT 1,
  last_login TIMESTAMP,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

-- 2. FLEET VEHICLES TABLE
CREATE TABLE IF NOT EXISTS vehicles (
  id VARCHAR(64) PRIMARY KEY,
  reg_number VARCHAR(32) UNIQUE NOT NULL,
  vehicle_type VARCHAR(64) NOT NULL, -- 'Sedan', 'SUV', 'Minivan', 'Hyundai Staria', 'Hiace', 'Coaster', 'Bus', 'Luxury'
  make_model VARCHAR(128) NOT NULL,
  passenger_capacity INT DEFAULT 4,
  luggage_capacity INT DEFAULT 3,
  supplier_id VARCHAR(64),
  assigned_driver_id VARCHAR(64),
  status VARCHAR(32) DEFAULT 'available', -- 'available' | 'on_trip' | 'maintenance' | 'inactive'
  color VARCHAR(32),
  model_year INT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

-- 3. CHAUFFEUR DRIVERS TABLE
CREATE TABLE IF NOT EXISTS drivers (
  id VARCHAR(64) PRIMARY KEY,
  driver_code VARCHAR(32) UNIQUE NOT NULL,
  full_name VARCHAR(128) NOT NULL,
  mobile VARCHAR(32) NOT NULL,
  email VARCHAR(128),
  license_number VARCHAR(64) NOT NULL,
  license_expiry VARCHAR(32) NOT NULL,
  assigned_vehicle_id VARCHAR(64),
  payment_arrangement VARCHAR(32) DEFAULT 'per_trip', -- 'per_trip' | 'monthly' | 'commission' | 'fixed_plus_trip'
  rate_or_salary DECIMAL(10,2) DEFAULT 0,
  currency VARCHAR(16) DEFAULT 'SAR',
  is_active INT DEFAULT 1,
  current_balance DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

-- 4. PARTNER SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS suppliers (
  id VARCHAR(64) PRIMARY KEY,
  supplier_code VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(128) NOT NULL,
  contact_person VARCHAR(128),
  mobile VARCHAR(32) NOT NULL,
  email VARCHAR(128),
  address TEXT,
  default_currency VARCHAR(16) DEFAULT 'SAR',
  opening_balance DECIMAL(10,2) DEFAULT 0,
  current_balance DECIMAL(10,2) DEFAULT 0,
  payment_terms VARCHAR(32) DEFAULT '15_days',
  is_active INT DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

-- 5. TRANSPORT BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(64) PRIMARY KEY,
  booking_ref VARCHAR(64) UNIQUE NOT NULL,
  booking_date VARCHAR(32) NOT NULL,
  pickup_date VARCHAR(32) NOT NULL,
  pickup_time VARCHAR(16) NOT NULL, -- 24-hour format HH:MM
  passenger_name VARCHAR(128) NOT NULL,
  contact_number VARCHAR(32) NOT NULL,
  passengers_count INT DEFAULT 1,
  luggage_count INT DEFAULT 1,
  pickup_location VARCHAR(255) NOT NULL,
  dropoff_location VARCHAR(255) NOT NULL,
  flight_number VARCHAR(64),
  airline VARCHAR(64),
  vehicle_type VARCHAR(64) NOT NULL,
  vehicle_id VARCHAR(64),
  driver_id VARCHAR(64),
  supplier_id VARCHAR(64),
  customer_name VARCHAR(128) NOT NULL,
  customer_phone VARCHAR(32),
  customer_price DECIMAL(10,2) DEFAULT 0,
  supplier_cost DECIMAL(10,2) DEFAULT 0,
  driver_payout DECIMAL(10,2) DEFAULT 0,
  currency VARCHAR(16) DEFAULT 'SAR',
  payment_status VARCHAR(32) DEFAULT 'unpaid', -- 'unpaid' | 'partial' | 'paid' | 'refunded'
  paid_amount DECIMAL(10,2) DEFAULT 0,
  trip_status VARCHAR(64) DEFAULT 'New Booking',
  cancellation_reason TEXT,
  special_instructions TEXT,
  dispatcher_notes TEXT,
  supplier_reference VARCHAR(64),
  created_by_id VARCHAR(64),
  created_by_name VARCHAR(128),
  updated_by_id VARCHAR(64),
  updated_by_name VARCHAR(128),
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

-- 6. FINANCIAL TRANSACTIONS & PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(64) PRIMARY KEY,
  payment_ref VARCHAR(64) UNIQUE NOT NULL,
  entity_type VARCHAR(32) NOT NULL, -- 'customer_receipt' | 'driver_payment' | 'supplier_payment' | 'general_expense' | 'refund_adjustment'
  entity_id VARCHAR(64),
  entity_name VARCHAR(128),
  booking_id VARCHAR(64),
  booking_ref VARCHAR(64),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(16) DEFAULT 'SAR',
  payment_method VARCHAR(32) NOT NULL, -- 'Cash' | 'Bank Transfer' | 'Credit Card' | 'Mada' | 'POS' | 'Cheque'
  payment_date VARCHAR(32) NOT NULL,
  reference_no VARCHAR(64),
  notes TEXT,
  created_by_id VARCHAR(64),
  created_by_name VARCHAR(128),
  created_at TIMESTAMP NOT NULL
);

-- 7. DISPATCH STATUS AUDIT TRAIL TABLE
CREATE TABLE IF NOT EXISTS trip_status_logs (
  id VARCHAR(64) PRIMARY KEY,
  booking_id VARCHAR(64) NOT NULL,
  booking_ref VARCHAR(64) NOT NULL,
  old_status VARCHAR(64),
  new_status VARCHAR(64) NOT NULL,
  changed_by_id VARCHAR(64),
  changed_by_name VARCHAR(128),
  notes TEXT,
  timestamp TIMESTAMP NOT NULL
);

-- 8. SYSTEM AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64),
  user_name VARCHAR(128),
  action VARCHAR(32) NOT NULL,
  entity VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64),
  details TEXT,
  ip_address VARCHAR(64),
  timestamp TIMESTAMP NOT NULL
);

-- 9. SYSTEM SETTINGS TABLE
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(64) PRIMARY KEY,
  value TEXT NOT NULL
);

-- 10. SYSTEM BACKUPS LOG TABLE
CREATE TABLE IF NOT EXISTS backups (
  id VARCHAR(64) PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  status VARCHAR(32) DEFAULT 'completed',
  type VARCHAR(32) DEFAULT 'automated'
);
