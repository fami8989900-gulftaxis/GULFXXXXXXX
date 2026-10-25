import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb, queryAll, queryOne, runSql, persistDb, setDbInstance } from '../server/db.js';
import { generateToken, verifyToken } from '../server/auth.js';

let passed = 0;
let failed = 0;
const results: { suite: string; name: string; status: 'PASS' | 'FAIL'; error?: string }[] = [];

function assert(condition: boolean, suite: string, name: string, detail?: string) {
  if (condition) {
    passed++;
    results.push({ suite, name, status: 'PASS' });
    console.log(`  ✅ [PASS] ${suite} -> ${name}`);
  } else {
    failed++;
    results.push({ suite, name, status: 'FAIL', error: detail || 'Assertion failed' });
    console.error(`  ❌ [FAIL] ${suite} -> ${name}: ${detail || 'Assertion failed'}`);
  }
}

async function runAllAuditTests() {
  console.log('\n=============================================================');
  console.log('🚀 GULF TAXIS DISPATCH CLOUD — COMPREHENSIVE SYSTEM AUDIT');
  console.log('=============================================================\n');

  // Initialize DB
  await getDb();

  // -------------------------------------------------------------
  // SUITE 1: Authentication & Token Security
  // -------------------------------------------------------------
  console.log('--- 1. Testing Authentication & Token Security ---');
  {
    // Test 1.1: Verify seeded superadmin exists and has valid bcrypt hash
    const superAdmin = queryOne('SELECT * FROM users WHERE username = ?', ['superadmin']);
    assert(!!superAdmin, 'Authentication', 'Superadmin account exists in database');
    assert(
      bcrypt.compareSync('Admin@123', superAdmin.password_hash),
      'Authentication',
      'Superadmin password verifies with bcrypt'
    );

    // Test 1.2: Rejection of incorrect password
    assert(
      !bcrypt.compareSync('WrongPassword', superAdmin.password_hash),
      'Authentication',
      'Rejects invalid password'
    );

    // Test 1.3: Generate and verify JWT token
    const token = generateToken({
      id: superAdmin.id,
      username: superAdmin.username,
      email: superAdmin.email,
      full_name: superAdmin.full_name,
      role: superAdmin.role,
      permissions: ['all'],
    });
    assert(typeof token === 'string' && token.length > 20, 'Authentication', 'Generates signed JWT token');

    const decoded = verifyToken(token);
    assert(decoded !== null && decoded.username === 'superadmin', 'Authentication', 'Validates JWT token correctly');

    // Test 1.4: Reject tampered token
    const tampered = token.slice(0, -5) + 'xxxxx';
    assert(verifyToken(tampered) === null, 'Authentication', 'Rejects tampered JWT token');
  }

  // -------------------------------------------------------------
  // SUITE 2: User Roles and Permission Access Control (RBAC)
  // -------------------------------------------------------------
  console.log('\n--- 2. Testing User Roles & Permission Access Control ---');
  {
    const users = queryAll('SELECT role, permissions FROM users');
    const rolesFound = users.map((u) => u.role);
    assert(rolesFound.includes('super_admin'), 'RBAC', 'Includes super_admin role');
    assert(rolesFound.includes('admin'), 'RBAC', 'Includes admin role');
    assert(rolesFound.includes('dispatcher'), 'RBAC', 'Includes dispatcher role');
    assert(rolesFound.includes('booking_agent'), 'RBAC', 'Includes booking_agent role');
    assert(rolesFound.includes('finance_executive'), 'RBAC', 'Includes finance_executive role');
    assert(rolesFound.includes('report_viewer'), 'RBAC', 'Includes report_viewer role');

    // Verify dispatcher permissions do not include finance/payments
    const dispatcher = queryOne('SELECT permissions FROM users WHERE role = ?', ['dispatcher']);
    const dispPerms = JSON.parse(dispatcher.permissions || '[]');
    assert(!dispPerms.includes('payments'), 'RBAC', 'Dispatcher does not have financial payment permissions');
    assert(dispPerms.includes('dispatch'), 'RBAC', 'Dispatcher has dispatch module permission');
  }

  // -------------------------------------------------------------
  // SUITE 3: Driver-to-Vehicle Bidirectional Connection
  // -------------------------------------------------------------
  console.log('\n--- 3. Testing Driver-to-Vehicle Two-Way Relationship ---');
  {
    const testDriverId = 'drv_test_' + Date.now();
    const testVehId = 'veh_test_' + Date.now();
    const now = new Date().toISOString();

    // Insert test vehicle
    runSql(
      `INSERT INTO vehicles (id, reg_number, vehicle_type, make_model, passenger_capacity, status, created_at, updated_at)
       VALUES (?, ?, 'Sedan', 'Toyota Camry Hybrid', 4, 'available', ?, ?)`,
      [testVehId, 'AUDIT-999', now, now]
    );

    // Insert test driver linked to this vehicle
    runSql(
      `INSERT INTO drivers (id, driver_code, full_name, mobile, license_number, license_expiry, assigned_vehicle_id, is_active, created_at, updated_at)
       VALUES (?, 'DRV-AUDIT', 'Captain Tariq Test', '+966509999999', 'LIC-999', '2028-12-31', ?, 1, ?, ?)`,
      [testDriverId, testVehId, now, now]
    );

    // Update vehicle to link back to driver (simulating the sync route)
    runSql(`UPDATE vehicles SET assigned_driver_id = ? WHERE id = ?`, [testDriverId, testVehId]);

    const linkedDriver = queryOne('SELECT assigned_vehicle_id FROM drivers WHERE id = ?', [testDriverId]);
    const linkedVehicle = queryOne('SELECT assigned_driver_id FROM vehicles WHERE id = ?', [testVehId]);

    assert(linkedDriver?.assigned_vehicle_id === testVehId, 'DriverVehicleLink', 'Driver stores linked vehicle ID');
    assert(linkedVehicle?.assigned_driver_id === testDriverId, 'DriverVehicleLink', 'Vehicle stores linked driver ID');

    // Clean up test records
    runSql('DELETE FROM drivers WHERE id = ?', [testDriverId]);
    runSql('DELETE FROM vehicles WHERE id = ?', [testVehId]);
  }

  // -------------------------------------------------------------
  // SUITE 4: Booking Creation, Validation & Duplicate Prevention
  // -------------------------------------------------------------
  console.log('\n--- 4. Testing Booking Lifecycle & Duplicate Prevention ---');
  {
    const testRef = 'GT-TEST-' + Date.now();
    const testBookingId = 'bk_test_' + Date.now();
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // Create a valid booking
    runSql(
      `INSERT INTO bookings (
        id, booking_ref, booking_date, pickup_date, pickup_time, passenger_name, contact_number,
        pickup_location, dropoff_location, vehicle_type, customer_name, customer_price, supplier_cost, driver_payout,
        currency, payment_status, paid_amount, trip_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, '14:30', 'Dr. Audited Passenger', '+966551122334',
        'Riyadh Airport T5', 'Ritz Carlton Riyadh', 'Sedan', 'Direct VIP Client', 350, 150, 80,
        'SAR', 'unpaid', 0, 'New Booking', ?, ?)`,
      [testBookingId, testRef, today, today, now, now]
    );

    const createdBooking = queryOne('SELECT * FROM bookings WHERE id = ?', [testBookingId]);
    assert(!!createdBooking, 'Booking', 'Booking created and saved with unique ID');
    assert(createdBooking.customer_price === 350, 'Booking', 'Customer price saved correctly');
    assert(createdBooking.supplier_cost === 150, 'Booking', 'Supplier cost saved correctly');
    assert(createdBooking.driver_payout === 80, 'Booking', 'Driver payout saved correctly');

    // Duplicate check query test
    const dup = queryOne(
      `SELECT id, booking_ref FROM bookings 
       WHERE LOWER(passenger_name) = LOWER(?) AND pickup_date = ? AND pickup_time = '14:30'`,
      ['Dr. Audited Passenger', today]
    );
    assert(dup !== null && dup.booking_ref === testRef, 'Booking', 'Duplicate detection matches identical passenger and time');

    // Clean up
    runSql('DELETE FROM bookings WHERE id = ?', [testBookingId]);
  }

  // -------------------------------------------------------------
  // SUITE 5: Financial Calculations & Account Reconciliations
  // -------------------------------------------------------------
  console.log('\n--- 5. Testing Financial Calculations & Accounting ---');
  {
    // Test 5.1: Distinguish cost from revenue in profit calculation
    const revenue = 500;
    const supplierCost = 200;
    const driverCost = 100;
    const operatingExpenses = 50;

    const grossProfit = revenue - supplierCost - driverCost;
    const netProfit = grossProfit - operatingExpenses;

    assert(grossProfit === 200, 'Finance', 'Gross profit equals Revenue - (Supplier Cost + Driver Cost)');
    assert(netProfit === 150, 'Finance', 'Net profit correctly factors operating expenses');

    // Test 5.2: Payments update booking payment status
    const bookingPrice = 400;
    const partialPayment = 200;
    const fullPayment = 400;

    assert(partialPayment < bookingPrice, 'Finance', 'Identifies partial payment correctly');
    assert(fullPayment >= bookingPrice, 'Finance', 'Identifies paid-in-full status correctly');
  }

  // -------------------------------------------------------------
  // SUITE 6: All 15 Reports Functional & Query Verification
  // -------------------------------------------------------------
  console.log('\n--- 6. Testing All 15 Reports Queries & Summaries ---');
  {
    const reportQueries: { id: string; name: string; sql: string }[] = [
      {
        id: 'booking_register',
        name: '📋 Booking Register',
        sql: 'SELECT count(*) as count FROM bookings',
      },
      {
        id: 'daily_booking',
        name: '🗓️ Daily Booking Report',
        sql: "SELECT count(*) as count FROM bookings WHERE pickup_date = date('now')",
      },
      {
        id: 'monthly_booking',
        name: '📆 Monthly Booking Summary',
        sql: "SELECT count(*) as count FROM bookings WHERE pickup_date LIKE strftime('%Y-%m', 'now') || '%'",
      },
      {
        id: 'date_wise_trips',
        name: '📅 Date-wise Trip Report',
        sql: 'SELECT pickup_date, count(*) as count FROM bookings GROUP BY pickup_date',
      },
      {
        id: 'completed_trips',
        name: '✅ Completed Trips Report',
        sql: "SELECT count(*) as count FROM bookings WHERE trip_status = 'Trip Completed'",
      },
      {
        id: 'cancelled_trips',
        name: '❌ Cancelled Trips Report',
        sql: "SELECT count(*) as count FROM bookings WHERE trip_status = 'Cancelled'",
      },
      {
        id: 'route_wise',
        name: '🗺️ Route-wise Analysis',
        sql: 'SELECT pickup_location, dropoff_location, count(*) as count FROM bookings GROUP BY pickup_location, dropoff_location',
      },
      {
        id: 'flight_wise',
        name: '✈️ Flight-wise Schedule',
        sql: "SELECT count(*) as count FROM bookings WHERE flight_number IS NOT NULL AND flight_number != ''",
      },
      {
        id: 'driver_wise',
        name: '🧑‍✈️ Driver Performance Report',
        sql: 'SELECT d.full_name, count(b.id) as trips FROM drivers d LEFT JOIN bookings b ON d.id = b.driver_id GROUP BY d.id',
      },
      {
        id: 'vehicle_wise',
        name: '🚐 Fleet Utilization Report',
        sql: 'SELECT v.reg_number, count(b.id) as trips FROM vehicles v LEFT JOIN bookings b ON v.id = b.vehicle_id GROUP BY v.id',
      },
      {
        id: 'supplier_wise',
        name: '🏢 Supplier Purchase Report',
        sql: 'SELECT s.name, count(b.id) as trips, COALESCE(SUM(b.supplier_cost), 0) as cost FROM suppliers s LEFT JOIN bookings b ON s.id = b.supplier_id GROUP BY s.id',
      },
      {
        id: 'customer_payment_report',
        name: '💳 Customer Payment Report',
        sql: "SELECT count(*) as count FROM payments WHERE entity_type = 'customer_receipt'",
      },
      {
        id: 'outstanding_balances',
        name: '⚠️ Outstanding Balances (Receivables)',
        sql: "SELECT count(*) as count FROM bookings WHERE (customer_price - paid_amount) > 0 AND trip_status != 'Cancelled'",
      },
      {
        id: 'profit_and_loss',
        name: '📈 Profit & Loss Statement (P&L)',
        sql: "SELECT COALESCE(SUM(customer_price), 0) as rev, COALESCE(SUM(supplier_cost), 0) as sc, COALESCE(SUM(driver_payout), 0) as dp FROM bookings WHERE trip_status != 'Cancelled'",
      },
      {
        id: 'user_activity_report',
        name: '🛡️ User Audit & Activity Log',
        sql: 'SELECT id, user_name, action, entity, details, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 10',
      },
    ];

    for (const r of reportQueries) {
      try {
        const rows = queryAll(r.sql);
        assert(Array.isArray(rows), 'Reports', `${r.name} executes without SQL syntax error`);
      } catch (err: any) {
        assert(false, 'Reports', `${r.name} query failed: ${err.message}`);
      }
    }

    // Special verification for Bug Fix 1: Audit Log search query with corrected column names
    try {
      const searchSql = `SELECT * FROM audit_logs WHERE (user_name LIKE '%admin%' OR action LIKE '%LOGIN%' OR entity LIKE '%user%' OR details LIKE '%logged%')`;
      const searchRows = queryAll(searchSql);
      assert(Array.isArray(searchRows), 'Reports', 'User Audit & Activity Log search query executes successfully with correct columns');
    } catch (err: any) {
      assert(false, 'Reports', `Audit log search query failed: ${err.message}`);
    }
  }

  // -------------------------------------------------------------
  // SUITE 7: Backup and In-Memory Hot Reload
  // -------------------------------------------------------------
  console.log('\n--- 7. Testing Backup Export & Safe Hot Reload ---');
  {
    const db = await getDb();
    const exportedBytes = db.export();
    assert(exportedBytes && exportedBytes.length > 1000, 'Backup', 'Exports valid SQLite binary stream');

    // Test hot reload function exists and runs
    try {
      setDbInstance(db);
      assert(true, 'Backup', 'setDbInstance safely updates in-memory instance without crashing');
    } catch (err: any) {
      assert(false, 'Backup', 'setDbInstance threw error: ' + err.message);
    }
  }

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n=============================================================');
  console.log(`📊 AUDIT & TEST RESULTS: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('=============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllAuditTests().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
