import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useSync } from '../../context/SyncContext';
import { useAuth } from '../../context/AuthContext';
import { Booking, TripStatus, PaymentStatus } from '../../types';
import {
  Search,
  Filter,
  Plus,
  Download,
  Calendar,
  Eye,
  Edit2,
  Copy,
  XCircle,
  FileText,
  Printer,
  Trash2,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  Clock
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface BookingsPageProps {
  onOpenNewBooking: () => void;
  onEditBooking: (b: Booking) => void;
  onViewVoucher: (b: Booking, type: 'customer_voucher' | 'driver_voucher') => void;
}

export const BookingsPage: React.FC<BookingsPageProps> = ({
  onOpenNewBooking,
  onEditBooking,
  onViewVoucher,
}) => {
  const { syncVersion } = useSync();
  const { user, hasRole } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Cancel modal state
  const [cancelModalBooking, setCancelModalBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('Customer requested cancellation');
  const [cancelling, setCancelling] = useState(false);

  // Success alert
  const [notification, setNotification] = useState<string | null>(null);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await api.getBookings({
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        paymentStatus: paymentFilter !== 'all' ? paymentFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setBookings(res.bookings || []);
    } catch (err) {
      console.error('Failed to load bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [syncVersion, search, statusFilter, paymentFilter, startDate, endDate]);

  const handleDuplicate = async (b: Booking) => {
    try {
      const res = await api.duplicateBooking(b.id);
      setNotification(`Booking duplicated successfully with new reference: ${res.booking.booking_ref}`);
      fetchBookings();
    } catch (err: any) {
      alert(err.message || 'Failed to duplicate booking');
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalBooking) return;
    setCancelling(true);
    try {
      await api.cancelBooking(cancelModalBooking.id, cancelReason);
      setNotification(`Booking ${cancelModalBooking.booking_ref} marked as Cancelled.`);
      setCancelModalBooking(null);
      fetchBookings();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel booking');
    } finally {
      setCancelling(false);
    }
  };

  const handleDelete = async (b: Booking) => {
    if (!window.confirm(`Are you sure you want to permanently delete booking ${b.booking_ref}? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.deleteBooking(b.id);
      setNotification(`Booking ${b.booking_ref} has been removed.`);
      fetchBookings();
    } catch (err: any) {
      alert(err.message || 'Failed to delete booking');
    }
  };

  // Export to Excel (.xlsx)
  const exportToExcel = () => {
    const dataToExport = bookings.map((b) => ({
      'Reference': b.booking_ref,
      'Pickup Date': b.pickup_date,
      'Pickup Time (24h)': b.pickup_time,
      'Passenger': b.passenger_name,
      'Contact': b.contact_number,
      'Pax': b.passengers_count,
      'Luggage': b.luggage_count,
      'Pickup Location': b.pickup_location,
      'Drop-off Location': b.dropoff_location,
      'Flight': b.flight_number || '',
      'Vehicle': b.vehicle_type,
      'Driver': b.driver_name || 'Unassigned',
      'Client / Agency': b.customer_name,
      'Selling Price': b.customer_price,
      'Currency': b.currency,
      'Trip Status': b.trip_status,
      'Payment Status': b.payment_status,
      'Paid Amount': b.paid_amount,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bookings');
    XLSX.writeFile(wb, `Gulf_Taxis_Bookings_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Export to CSV
  const exportToCsv = () => {
    const headers = [
      'Reference',
      'Pickup Date',
      'Pickup Time',
      'Passenger',
      'Contact',
      'Pickup Location',
      'Drop-off Location',
      'Vehicle Type',
      'Driver',
      'Price',
      'Currency',
      'Trip Status',
      'Payment Status',
    ];

    const rows = bookings.map((b) => [
      b.booking_ref,
      b.pickup_date,
      b.pickup_time,
      `"${b.passenger_name.replace(/"/g, '""')}"`,
      `"${b.contact_number}"`,
      `"${b.pickup_location.replace(/"/g, '""')}"`,
      `"${b.dropoff_location.replace(/"/g, '""')}"`,
      `"${b.vehicle_type}"`,
      `"${b.driver_name || 'Unassigned'}"`,
      b.customer_price,
      b.currency,
      b.trip_status,
      b.payment_status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Gulf_Taxis_Bookings_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Trip Completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold';
      case 'Awaiting Assignment':
        return 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
      case 'Assigned':
      case 'Driver Notified':
        return 'bg-blue-50 text-blue-700 border-blue-300 font-semibold';
      case 'Driver on the Way':
      case 'Arrived at Pickup':
      case 'Passenger Picked Up':
        return 'bg-indigo-50 text-indigo-700 border-indigo-300 font-semibold';
      case 'Cancelled':
      case 'No Show':
        return 'bg-rose-50 text-rose-700 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'Trip Completed': return '🟢';
      case 'Awaiting Assignment': return '🟠';
      case 'Assigned': return '🔵';
      case 'Driver Notified': return '📲';
      case 'Driver on the Way': return '🚗';
      case 'Arrived at Pickup': return '📍';
      case 'Passenger Picked Up': return '👥';
      case 'Cancelled': return '🔴';
      case 'No Show': return '⚠️';
      default: return '⚪';
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Toast Notification */}
      {notification && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{notification}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Control Header & Filters */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 flex items-center gap-2">
              <span>📅 Booking Management</span>
              <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-mono font-bold">
                {bookings.length} Bookings
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Live reservations, routing, customer vouchers, and dispatch assignment
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              title="Export to Excel (.xlsx)"
            >
              <span>💾</span>
              <span>Excel (.xlsx)</span>
            </button>
            <button
              onClick={exportToCsv}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              title="Export to CSV"
            >
              <span>📥</span>
              <span>CSV</span>
            </button>
            <button
              onClick={onOpenNewBooking}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/20 transition-all cursor-pointer hover:shadow-lg hover:shadow-blue-500/30"
            >
              <span>📅</span>
              <span>Create New Booking</span>
            </button>
          </div>
        </div>

        {/* Quick Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-sm">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="🔍 Search Booking (ref, passenger, phone, airport, hotel, flight...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm text-slate-900 min-h-[38px]"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm text-slate-700 min-h-[38px]"
            >
              <option value="all">🚦 All Trip Statuses</option>
              <option value="New Booking">New Booking</option>
              <option value="Awaiting Assignment">🟠 Awaiting Assignment</option>
              <option value="Assigned">🔵 Assigned</option>
              <option value="Driver Notified">📲 Driver Notified</option>
              <option value="Driver on the Way">🚗 Driver on the Way</option>
              <option value="Arrived at Pickup">📍 Arrived at Pickup</option>
              <option value="Passenger Picked Up">👥 Passenger Picked Up</option>
              <option value="Trip Completed">🟢 Trip Completed</option>
              <option value="Cancelled">🔴 Cancelled</option>
              <option value="No Show">⚠️ No Show</option>
            </select>
          </div>

          <div>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm text-slate-700 min-h-[38px]"
            >
              <option value="all">💳 All Payment Statuses</option>
              <option value="unpaid">🔴 Unpaid</option>
              <option value="partial">🟠 Partial Payment</option>
              <option value="paid">🟢 Fully Paid</option>
              <option value="refunded">🟣 Refunded</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-1/2 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 min-h-[38px]"
              title="From date"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-1/2 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 min-h-[38px]"
              title="To date"
            />
          </div>
        </div>
      </div>

      {/* COMPACT SINGLE-LINE TABLE DESIGN - FULL AVAILABLE WIDTH */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-auto text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-slate-100 via-slate-50 to-blue-50/50 border-b border-slate-200 text-slate-700 uppercase font-semibold text-[13.5px] tracking-wider whitespace-nowrap">
                <th className="py-3 px-3.5">🔖 Reference</th>
                <th className="py-3 px-3.5">🗓️ Pickup</th>
                <th className="py-3 px-3.5">🧑 Passenger</th>
                <th className="py-3 px-3.5 min-w-[200px]">📍 Route</th>
                <th className="py-3 px-2.5 text-center">✈️ Flight</th>
                <th className="py-3 px-3.5">🚐 Vehicle</th>
                <th className="py-3 px-3.5">🧑✈️ Driver</th>
                <th className="py-3 px-3.5">🚦 Trip Status</th>
                <th className="py-3 px-3.5 text-center">⚙️ Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-medium text-sm">
                    No bookings found matching criteria.
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-blue-50/40 transition-colors group">
                    {/* 1. 🔖 Reference */}
                    <td className="py-3 px-3.5 whitespace-nowrap align-middle">
                      <span className="inline-block bg-blue-50 text-blue-700 border border-blue-200/90 px-2.5 py-1 rounded font-mono font-bold text-[13.5px]">
                        {b.booking_ref}
                      </span>
                      {b.supplier_reference && (
                        <div className="text-xs text-slate-400 font-mono font-normal mt-0.5">
                          🔖 {b.supplier_reference}
                        </div>
                      )}
                    </td>

                    {/* 2. 🗓️ Pickup */}
                    <td className="py-3 px-3.5 whitespace-nowrap text-slate-800 align-middle">
                      <div className="font-semibold text-slate-900 text-[14px]">{b.pickup_date}</div>
                      <div className="text-[13px] text-slate-500 font-mono font-semibold flex items-center gap-1 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span>{b.pickup_time || '00:00'} (24h)</span>
                      </div>
                    </td>

                    {/* 3. 🧑 Passenger */}
                    <td className="py-3 px-3.5 align-middle">
                      <div className="font-semibold text-slate-900 text-[14.5px] break-words max-w-[170px] 2xl:max-w-none">{b.passenger_name}</div>
                      <div className="text-[13px] text-slate-500 font-mono flex items-center gap-1 mt-0.5 whitespace-nowrap">
                        <span className="text-xs text-slate-400">📞</span>
                        <span>{b.contact_number || '-'}</span>
                      </div>
                    </td>

                    {/* 4. 📍 Route (Naturally expands without clipping) */}
                    <td className="py-3 px-3.5 text-slate-700 align-middle">
                      <div
                        className="text-[13.5px] font-semibold text-slate-900 flex items-start gap-1.5 leading-snug break-words max-w-[280px] 2xl:max-w-none"
                        title={`📍 Pickup: ${b.pickup_location}`}
                      >
                        <span className="shrink-0 text-sm mt-0.5">📍</span>
                        <span className="line-clamp-2">{b.pickup_location}</span>
                      </div>
                      <div
                        className="text-[13px] text-slate-600 flex items-start gap-1.5 mt-0.5 leading-snug break-words max-w-[280px] 2xl:max-w-none"
                        title={`🏨 Destination: ${b.dropoff_location}`}
                      >
                        <span className="shrink-0 text-sm mt-0.5">🏨</span>
                        <span className="line-clamp-2">{b.dropoff_location}</span>
                      </div>
                    </td>

                    {/* 5. ✈️ Flight */}
                    <td className="py-3 px-2.5 whitespace-nowrap text-center align-middle">
                      {b.flight_number ? (
                        <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 rounded font-mono font-bold text-xs">
                          ✈️ {b.flight_number}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* 6. 🚐 Vehicle */}
                    <td className="py-3 px-3.5 whitespace-nowrap align-middle">
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-1 rounded-full text-[13px] font-semibold shadow-2xs">
                        <span>{b.vehicle_type?.toLowerCase().includes('suv') ? '🚙' : b.vehicle_type?.toLowerCase().includes('van') || b.vehicle_type?.toLowerCase().includes('staria') ? '🚐' : b.vehicle_type?.toLowerCase().includes('coaster') ? '🚌' : '🚘'}</span>
                        <span>{b.vehicle_type}</span>
                      </span>
                    </td>

                    {/* 7. 🧑✈️ Driver */}
                    <td className="py-3 px-3.5 align-middle">
                      {b.driver_name ? (
                        <div className="font-semibold text-slate-900 flex items-center gap-1 text-[14px]">
                          <span>🧑✈️</span>
                          <span className="break-words max-w-[130px] 2xl:max-w-none" title={b.driver_name}>{b.driver_name}</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-900 bg-amber-50 border border-amber-300 px-2.5 py-0.5 rounded-md font-bold text-xs whitespace-nowrap">
                          <span>⚠️</span>
                          <span>Unassigned</span>
                        </span>
                      )}
                    </td>

                    {/* 8. 🚦 Trip Status */}
                    <td className="py-3 px-3.5 whitespace-nowrap align-middle">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border shadow-2xs font-semibold ${getStatusBadge(
                          b.trip_status
                        )}`}
                      >
                        <span>{getStatusEmoji(b.trip_status)}</span>
                        <span>{b.trip_status}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => onViewVoucher(b, 'customer_voucher')}
                          title="Print Customer Travel Voucher (Prices Masked)"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onViewVoucher(b, 'driver_voucher')}
                          title="Driver Trip Sheet Voucher"
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onEditBooking(b)}
                          title="Edit Booking Record"
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(b)}
                          title="Duplicate as New Reservation"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        {b.trip_status !== 'Cancelled' && (
                          <button
                            onClick={() => setCancelModalBooking(b)}
                            title="Cancel Booking"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        {hasRole('super_admin', 'admin') && (
                          <button
                            onClick={() => handleDelete(b)}
                            title="Delete Permanently"
                            className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancellation Modal */}
      {cancelModalBooking && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2 text-rose-600">
              <AlertCircle className="w-5 h-5" />
              <span>Cancel Booking: {cancelModalBooking.booking_ref}</span>
            </h3>
            <p className="text-sm text-slate-600 mb-3.5">
              Confirm cancellation for passenger <span className="font-bold">{cancelModalBooking.passenger_name}</span>. Financial records and previous receipts remain retained.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Reason for Cancellation
              </label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCancelModalBooking(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Keep Booking
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={handleConfirmCancel}
                className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow cursor-pointer disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
