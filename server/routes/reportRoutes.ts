import { Router, Response } from 'express';
import { queryAll, queryOne } from '../db.js';
import { requireAuth, requirePermission, AuthenticatedRequest } from '../auth.js';

const router = Router();

// GET /api/reports/:reportType
router.get('/:reportType', requireAuth, requirePermission('reports'), (req: AuthenticatedRequest, res: Response) => {
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
    search,
  } = req.query;

  let records: any[] = [];
  let summary: Record<string, any> = {};

  switch (reportType) {
    case 'booking_register':
    case 'date_wise_trips': {
      let sql = `
        SELECT b.*, d.full_name as driver_name, v.reg_number as vehicle_reg, s.name as supplier_name
        FROM bookings b
        LEFT JOIN drivers d ON b.driver_id = d.id
        LEFT JOIN vehicles v ON b.vehicle_id = v.id
        LEFT JOIN suppliers s ON b.supplier_id = s.id
        WHERE 1=1
      `;
      const params: any[] = [];
      if (startDate) {
        sql += ` AND b.pickup_date >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        sql += ` AND b.pickup_date <= ?`;
        params.push(endDate);
      }
      if (status && status !== 'all') {
        sql += ` AND b.trip_status = ?`;
        params.push(status);
      }
      if (paymentStatus && paymentStatus !== 'all') {
        sql += ` AND b.payment_status = ?`;
        params.push(paymentStatus);
      }
      if (driverId && driverId !== 'all') {
        sql += ` AND b.driver_id = ?`;
        params.push(driverId);
      }
      if (supplierId && supplierId !== 'all') {
        sql += ` AND b.supplier_id = ?`;
        params.push(supplierId);
      }
      if (vehicleId && vehicleId !== 'all') {
        sql += ` AND b.vehicle_id = ?`;
        params.push(vehicleId);
      }
      if (vehicleType && vehicleType !== 'all') {
        sql += ` AND b.vehicle_type = ?`;
        params.push(vehicleType);
      }
      if (currency && currency !== 'all') {
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
        grossProfit: records.reduce((s, r) => s + ((r.customer_price || 0) - (r.supplier_cost || 0) - (r.driver_payout || 0)), 0),
      };
      break;
    }

    case 'daily_booking': {
      const targetDate = startDate || new Date().toISOString().split('T')[0];
      let sql = `
        SELECT b.*, d.full_name as driver_name, v.reg_number as vehicle_reg, s.name as supplier_name
        FROM bookings b
        LEFT JOIN drivers d ON b.driver_id = d.id
        LEFT JOIN vehicles v ON b.vehicle_id = v.id
        LEFT JOIN suppliers s ON b.supplier_id = s.id
        WHERE b.pickup_date = ?
      `;
      const params: any[] = [targetDate];
      if (status && status !== 'all') {
        sql += ` AND b.trip_status = ?`;
        params.push(status);
      }
      if (driverId && driverId !== 'all') {
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
        totalCompleted: records.filter((r) => r.trip_status === 'Trip Completed').length,
        totalPending: records.filter((r) => r.trip_status === 'Awaiting Assignment').length,
      };
      break;
    }

    case 'monthly_booking': {
      const yearMonth = startDate ? (startDate as string).substring(0, 7) : new Date().toISOString().substring(0, 7);
      let sql = `
        SELECT b.*, d.full_name as driver_name, v.reg_number as vehicle_reg, s.name as supplier_name
        FROM bookings b
        LEFT JOIN drivers d ON b.driver_id = d.id
        LEFT JOIN vehicles v ON b.vehicle_id = v.id
        LEFT JOIN suppliers s ON b.supplier_id = s.id
        WHERE b.pickup_date LIKE ?
      `;
      const params: any[] = [`${yearMonth}%`];
      if (status && status !== 'all') {
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
        totalProfit: records.reduce((s, r) => s + ((r.customer_price || 0) - (r.supplier_cost || 0) - (r.driver_payout || 0)), 0),
      };
      break;
    }

    case 'driver_wise': {
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
      const params: any[] = [];
      if (startDate) {
        sql += ` AND (b.pickup_date >= ? OR b.pickup_date IS NULL)`;
        params.push(startDate);
      }
      if (endDate) {
        sql += ` AND (b.pickup_date <= ? OR b.pickup_date IS NULL)`;
        params.push(endDate);
      }
      if (driverId && driverId !== 'all') {
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
        totalBalanceDue: records.reduce((s, r) => s + (r.current_balance || 0), 0),
      };
      break;
    }

    case 'vehicle_wise': {
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
      const params: any[] = [];
      if (vehicleId && vehicleId !== 'all') {
        sql += ` AND v.id = ?`;
        params.push(vehicleId);
      }
      if (vehicleType && vehicleType !== 'all') {
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
        totalRevenue: records.reduce((s, r) => s + (r.generated_revenue || 0), 0),
      };
      break;
    }

    case 'supplier_wise': {
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
      const params: any[] = [];
      if (supplierId && supplierId !== 'all') {
        sql += ` AND s.id = ?`;
        params.push(supplierId);
      }
      if (currency && currency !== 'all') {
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
        totalOutstandingPayables: records.reduce((s, r) => s + (r.current_balance || 0), 0),
      };
      break;
    }

    case 'route_wise':
    case 'pickup_location': {
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
      const params: any[] = [];
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
        totalRevenue: records.reduce((s, r) => s + (r.total_revenue || 0), 0),
      };
      break;
    }

    case 'flight_wise': {
      let sql = `
        SELECT 
          flight_number, pickup_date, pickup_time, passenger_name, contact_number, pickup_location, dropoff_location, trip_status, customer_price
        FROM bookings
        WHERE flight_number IS NOT NULL AND flight_number != ''
      `;
      const params: any[] = [];
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
        totalPassengers: records.length,
      };
      break;
    }

    case 'cancelled_trips': {
      let sql = `
        SELECT b.*, d.full_name as driver_name, v.reg_number as vehicle_reg, s.name as supplier_name
        FROM bookings b
        LEFT JOIN drivers d ON b.driver_id = d.id
        LEFT JOIN vehicles v ON b.vehicle_id = v.id
        LEFT JOIN suppliers s ON b.supplier_id = s.id
        WHERE b.trip_status = 'Cancelled'
      `;
      const params: any[] = [];
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
        lostRevenue: records.reduce((s, r) => s + (r.customer_price || 0), 0),
      };
      break;
    }

    case 'completed_trips': {
      let sql = `
        SELECT b.*, d.full_name as driver_name, v.reg_number as vehicle_reg, s.name as supplier_name
        FROM bookings b
        LEFT JOIN drivers d ON b.driver_id = d.id
        LEFT JOIN vehicles v ON b.vehicle_id = v.id
        LEFT JOIN suppliers s ON b.supplier_id = s.id
        WHERE b.trip_status = 'Trip Completed'
      `;
      const params: any[] = [];
      if (startDate) {
        sql += ` AND b.pickup_date >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        sql += ` AND b.pickup_date <= ?`;
        params.push(endDate);
      }
      if (driverId && driverId !== 'all') {
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
        netMargin: records.reduce((s, r) => s + ((r.customer_price || 0) - (r.supplier_cost || 0) - (r.driver_payout || 0)), 0),
      };
      break;
    }

    case 'outstanding_balances': {
      let sql = `
        SELECT 
          booking_ref, passenger_name as customer_name, pickup_date, customer_price, paid_amount,
          (customer_price - paid_amount) as outstanding_balance,
          currency, payment_status, contact_number
        FROM bookings
        WHERE (customer_price - paid_amount) > 0 AND trip_status != 'Cancelled'
      `;
      const params: any[] = [];
      if (search) {
        sql += ` AND (booking_ref LIKE ? OR passenger_name LIKE ? OR contact_number LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s);
      }
      sql += ` ORDER BY outstanding_balance DESC`;
      records = queryAll(sql, params);
      summary = {
        totalOutstanding: records.reduce((s, r) => s + (r.outstanding_balance || 0), 0),
        pendingAccounts: records.length,
      };
      break;
    }

    case 'customer_payment_report': {
      let sql = `SELECT * FROM payments WHERE entity_type = 'customer_receipt'`;
      const params: any[] = [];
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
        transactionCount: records.length,
      };
      break;
    }

    case 'profit_and_loss': {
      let bSql = `SELECT customer_price, supplier_cost, driver_payout, currency FROM bookings WHERE trip_status != 'Cancelled'`;
      const bParams: any[] = [];
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
      const eParams: any[] = [];
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
      const marginPercentage = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';

      records = [
        { item: 'Operating Revenue (Trips & Bookings)', category: 'Income', amount: totalRevenue, currency: 'SAR', percentage: '100%' },
        { item: 'Supplier Fleet Purchase Rates', category: 'Cost of Sales', amount: totalSupplierCost, currency: 'SAR', percentage: totalRevenue > 0 ? `${((totalSupplierCost / totalRevenue) * 100).toFixed(1)}%` : '0%' },
        { item: 'Driver Trip Payouts & Salaries', category: 'Cost of Sales', amount: totalDriverCost, currency: 'SAR', percentage: totalRevenue > 0 ? `${((totalDriverCost / totalRevenue) * 100).toFixed(1)}%` : '0%' },
        { item: 'Gross Profit', category: 'Summary', amount: grossProfit, currency: 'SAR', percentage: totalRevenue > 0 ? `${((grossProfit / totalRevenue) * 100).toFixed(1)}%` : '0%' },
        { item: 'General Business & Administrative Expenses', category: 'Operating Expense', amount: totalOperatingExpenses, currency: 'SAR', percentage: totalRevenue > 0 ? `${((totalOperatingExpenses / totalRevenue) * 100).toFixed(1)}%` : '0%' },
        { item: 'Net Operating Profit / (Loss)', category: 'Net Result', amount: netProfit, currency: 'SAR', percentage: `${marginPercentage}%` },
      ];

      summary = {
        totalRevenue,
        costOfSales: totalSupplierCost + totalDriverCost,
        grossProfit,
        operatingExpenses: totalOperatingExpenses,
        netProfit,
        marginPercentage: `${marginPercentage}%`,
      };
      break;
    }

    case 'user_activity_report': {
      let sql = `SELECT * FROM audit_logs WHERE 1=1`;
      const params: any[] = [];
      if (startDate) {
        sql += ` AND timestamp >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        sql += ` AND timestamp <= ?`;
        params.push(endDate + 'T23:59:59.999Z');
      }
      if (search) {
        sql += ` AND (user_name LIKE ? OR action LIKE ? OR entity LIKE ? OR details LIKE ?)`;
        const s = `%${search}%`;
        params.push(s, s, s, s);
      }
      sql += ` ORDER BY timestamp DESC LIMIT 500`;
      records = queryAll(sql, params);
      summary = {
        totalAuditLogs: records.length,
      };
      break;
    }

    default:
      return res.status(400).json({ error: `Unknown report type: ${reportType}` });
  }

  return res.json({
    reportType,
    period: { startDate: startDate || 'All', endDate: endDate || 'Present' },
    records,
    summary,
  });
});

export default router;
