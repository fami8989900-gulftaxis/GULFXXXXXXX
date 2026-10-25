import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useSync } from '../../context/SyncContext';
import { Booking, Driver, Vehicle, Supplier, TripStatus } from '../../types';
import {
  Send,
  Calendar,
  Clock,
  User,
  Phone,
  Car,
  MapPin,
  Plane,
  AlertTriangle,
  CheckCircle2,
  Filter,
  RefreshCw,
  Printer,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  Search,
  Edit2
} from 'lucide-react';

interface DispatchPageProps {
  onViewVoucher: (b: Booking, type: 'customer_voucher' | 'driver_voucher') => void;
}

export const DispatchPage: React.FC<DispatchPageProps> = ({ onViewVoucher }) => {
  const { syncVersion } = useSync();

  const [trips, setTrips] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [unassignedOnly, setUnassignedOnly] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);

  // Assign Modal State
  const [assignModalTrip, setAssignModalTrip] = useState<Booking | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [conflictWarning, setConflictWarning] = useState<any[]>([]);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // Status Change Modal State
  const [statusModalTrip, setStatusModalTrip] = useState<Booking | null>(null);
  const [newStatus, setNewStatus] = useState<TripStatus>('Assigned');
  const [statusNotes, setStatusNotes] = useState<string>('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchDispatchData = async () => {
    setLoading(true);
    try {
      const res = await api.getDispatch({
        date: selectedDate || undefined,
        unassignedOnly: unassignedOnly ? 'true' : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setTrips(res.trips || []);
      setDrivers(res.availableDrivers || []);
      setVehicles(res.availableVehicles || []);
      setSuppliers(res.suppliers || []);
    } catch (err) {
      console.error('Error fetching dispatch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatchData();
  }, [syncVersion, selectedDate, unassignedOnly, statusFilter]);

  const handleOpenAssign = (trip: Booking) => {
    setAssignModalTrip(trip);
    setSelectedDriverId(trip.driver_id || '');
    setSelectedVehicleId(trip.vehicle_id || '');
    setSelectedSupplierId(trip.supplier_id || '');
    setConflictWarning([]);
  };

  useEffect(() => {
    const check = async () => {
      if (!assignModalTrip || (!selectedDriverId && !selectedVehicleId)) {
        setConflictWarning([]);
        return;
      }
      setCheckingConflict(true);
      try {
        const res = await api.checkConflicts({
          bookingId: assignModalTrip.id,
          driverId: selectedDriverId,
          vehicleId: selectedVehicleId,
          pickupDate: assignModalTrip.pickup_date,
          pickupTime: assignModalTrip.pickup_time,
        });
        if (res.hasConflict) {
          setConflictWarning(res.conflicts || []);
        } else {
          setConflictWarning([]);
        }
      } catch (err) {
        console.error('Failed to check conflicts:', err);
      } finally {
        setCheckingConflict(false);
      }
    };
    check();
  }, [selectedDriverId, selectedVehicleId, assignModalTrip]);

  const handleSaveAssignment = async (force: boolean = false) => {
    if (!assignModalTrip) return;
    setAssigning(true);
    try {
      await api.assignTrip({
        bookingId: assignModalTrip.id,
        driverId: selectedDriverId || null,
        vehicleId: selectedVehicleId || null,
        supplierId: selectedSupplierId || null,
        forceOverride: force,
      });
      setAssignModalTrip(null);
      fetchDispatchData();
    } catch (err: any) {
      alert(err.message || 'Failed to assign trip');
    } finally {
      setAssigning(false);
    }
  };

  const handleOpenStatusModal = (trip: Booking) => {
    setStatusModalTrip(trip);
    setNewStatus(trip.trip_status);
    setStatusNotes('');
  };

  const handleConfirmStatus = async () => {
    if (!statusModalTrip) return;
    setUpdatingStatus(true);
    try {
      await api.updateTripStatus({
        bookingId: statusModalTrip.id,
        status: newStatus,
        notes: statusNotes,
      });
      setStatusModalTrip(null);
      fetchDispatchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update trip status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const statusList: TripStatus[] = [
    'New Booking',
    'Awaiting Assignment',
    'Assigned',
    'Driver Notified',
    'Driver on the Way',
    'Arrived at Pickup',
    'Passenger Picked Up',
    'Trip Completed',
    'Cancelled',
    'No Show',
  ];

  const getStatusBadge = (status: TripStatus) => {
    switch (status) {
      case 'Trip Completed':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
      case 'Awaiting Assignment':
        return 'bg-amber-50 text-amber-900 border-amber-300 font-black';
      case 'Assigned':
        return 'bg-blue-50 text-blue-800 border-blue-300 font-semibold';
      case 'Driver Notified':
        return 'bg-sky-50 text-sky-800 border-sky-300 font-semibold';
      case 'Driver on the Way':
        return 'bg-indigo-50 text-indigo-800 border-indigo-300 font-semibold';
      case 'Arrived at Pickup':
        return 'bg-purple-50 text-purple-800 border-purple-300 font-semibold';
      case 'Passenger Picked Up':
        return 'bg-teal-50 text-teal-800 border-teal-300 font-semibold';
      case 'Cancelled':
      case 'No Show':
        return 'bg-rose-50 text-rose-800 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getStatusEmoji = (status: TripStatus) => {
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

  // Filter trips by search string
  const filteredTrips = trips.filter((t) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      t.booking_ref.toLowerCase().includes(term) ||
      t.passenger_name.toLowerCase().includes(term) ||
      t.contact_number.toLowerCase().includes(term) ||
      t.pickup_location.toLowerCase().includes(term) ||
      t.dropoff_location.toLowerCase().includes(term) ||
      (t.driver_name && t.driver_name.toLowerCase().includes(term)) ||
      (t.flight_number && t.flight_number.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-4">
      {/* Control Header & Filters */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 flex items-center gap-2.5">
              <span>🚘 Dispatch Control Centre</span>
              <span className="text-xs sm:text-[13px] bg-slate-900 text-white px-3 py-1 rounded-full font-mono font-bold">
                {filteredTrips.length} Active Trips
              </span>
            </h1>
            <p className="text-[13.5px] sm:text-sm text-slate-500 mt-1">
              Live trip monitor, conflict avoidance, vehicle fleet status, and instant chauffeur dispatch
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl font-medium min-h-[38px]">
              <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent focus:outline-none text-slate-800 text-sm font-semibold cursor-pointer"
              />
            </div>

            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors cursor-pointer text-sm min-h-[38px]"
            >
              📅 Today
            </button>

            <button
              onClick={() => setUnassignedOnly(!unassignedOnly)}
              className={`px-3.5 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer text-sm min-h-[38px] ${
                unassignedOnly
                  ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {unassignedOnly ? '⚠️ Showing Unassigned Only' : '🟠 Show Unassigned Only'}
            </button>
          </div>
        </div>

        {/* Search & Status Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="🔍 Search Dispatch (booking ref, passenger, chauffeur, flight, route...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm text-slate-900 min-h-[38px]"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm text-slate-800 font-medium min-h-[38px]"
            >
              <option value="all">🚦 All Dispatch Statuses</option>
              {statusList.map((s) => (
                <option key={s} value={s}>
                  {getStatusEmoji(s)} {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* COMPACT SINGLE-LINE DISPATCH TABLE - FULL AVAILABLE WIDTH */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-auto text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-slate-100 via-slate-50 to-blue-50/50 border-b border-slate-200 text-slate-700 font-semibold text-[13.5px] tracking-normal whitespace-nowrap">
                <th className="py-3 px-3.5">🔖 Reference</th>
                <th className="py-3 px-3.5">🗓️ Pickup</th>
                <th className="py-3 px-3.5">🧑 Passenger</th>
                <th className="py-3 px-3.5 min-w-[200px]">📍 Route</th>
                <th className="py-3 px-3 text-center">✈️ Flight</th>
                <th className="py-3 px-3.5">🚐 Vehicle</th>
                <th className="py-3 px-3.5">🧑✈️ Driver</th>
                <th className="py-3 px-3.5">🚦 Trip Status</th>
                <th className="py-3 px-3.5 text-center">⚙️ Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTrips.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-medium text-sm">
                    No trips match the active dispatch filters.
                  </td>
                </tr>
              ) : (
                filteredTrips.map((trip) => {
                  const isUnassigned = !trip.driver_id;
                  return (
                    <tr
                      key={trip.id}
                      className={`transition-colors ${
                        isUnassigned
                          ? 'bg-amber-50/30 hover:bg-amber-50/60'
                          : 'hover:bg-blue-50/40'
                      }`}
                    >
                      {/* 1. 🔖 Reference */}
                      <td className="py-3 px-3.5 whitespace-nowrap align-middle">
                        <span className="inline-block bg-blue-50 text-blue-700 border border-blue-200/90 px-2.5 py-1 rounded font-mono font-bold text-[13.5px]">
                          {trip.booking_ref}
                        </span>
                        {trip.supplier_reference && (
                          <div className="text-xs text-slate-500 font-mono font-normal mt-0.5">
                            🔖 {trip.supplier_reference}
                          </div>
                        )}
                      </td>

                      {/* 2. 🗓️ Pickup */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-slate-800 align-middle">
                        <div className="font-semibold text-slate-900 text-[14px]">{trip.pickup_date}</div>
                        <div className="text-[13px] text-slate-500 font-mono font-semibold flex items-center gap-1 mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>{trip.pickup_time || '00:00'} (24h)</span>
                        </div>
                      </td>

                      {/* 3. 🧑 Passenger */}
                      <td className="py-3 px-3.5 align-middle">
                        <div className="font-semibold text-slate-900 text-[14.5px] break-words max-w-[160px] 2xl:max-w-none">{trip.passenger_name}</div>
                        <div className="text-[13px] text-slate-500 font-mono flex items-center gap-1 mt-0.5 whitespace-nowrap">
                          <span className="text-xs text-slate-400">📞</span>
                          <span>{trip.contact_number || '-'}</span>
                        </div>
                      </td>

                      {/* 4. 📍 Route (Naturally expands without clipping) */}
                      <td className="py-3 px-3.5 text-slate-700 align-middle">
                        <div
                          className="text-[13.5px] font-semibold text-slate-900 flex items-start gap-1 leading-snug break-words max-w-[280px] 2xl:max-w-none"
                          title={`📍 Pickup: ${trip.pickup_location}`}
                        >
                          <span className="shrink-0 text-sm mt-0.5">📍</span>
                          <span className="line-clamp-2">{trip.pickup_location}</span>
                        </div>
                        <div
                          className="text-[13.5px] text-slate-600 flex items-start gap-1 mt-0.5 leading-snug break-words max-w-[280px] 2xl:max-w-none"
                          title={`🏨 Destination: ${trip.dropoff_location}`}
                        >
                          <span className="shrink-0 text-sm mt-0.5">🏨</span>
                          <span className="line-clamp-2">{trip.dropoff_location}</span>
                        </div>
                      </td>

                      {/* 5. ✈️ Flight */}
                      <td className="py-3 px-3 whitespace-nowrap text-center align-middle">
                        {trip.flight_number ? (
                          <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 rounded font-mono font-bold text-xs">
                            ✈️ {trip.flight_number}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* 6. 🚐 Vehicle */}
                      <td className="py-3 px-3.5 whitespace-nowrap align-middle">
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-1 rounded-full text-[13px] font-medium shadow-2xs">
                          <span>{trip.vehicle_type?.toLowerCase().includes('suv') ? '🚙' : trip.vehicle_type?.toLowerCase().includes('van') || trip.vehicle_type?.toLowerCase().includes('staria') ? '🚐' : trip.vehicle_type?.toLowerCase().includes('coaster') ? '🚌' : '🚘'}</span>
                          <span>{trip.vehicle_type || 'Sedan'}</span>
                        </span>
                      </td>

                      {/* 7. 🧑✈️ Driver */}
                      <td className="py-3 px-3.5 align-middle">
                        {trip.driver_name ? (
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5 text-[14px]">
                            <span>🧑✈️</span>
                            <span className="break-words max-w-[130px] 2xl:max-w-none" title={trip.driver_name}>{trip.driver_name}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-900 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-md font-bold text-xs whitespace-nowrap">
                            <span>⚠️</span>
                            <span>Unassigned</span>
                          </span>
                        )}
                      </td>

                      {/* 8. 🚦 Trip Status */}
                      <td className="py-3 px-3.5 whitespace-nowrap align-middle">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12.5px] border shadow-2xs font-bold ${getStatusBadge(
                            trip.trip_status
                          )}`}
                        >
                          <span>{getStatusEmoji(trip.trip_status)}</span>
                          <span>{trip.trip_status}</span>
                        </span>
                      </td>

                      {/* 9. ⚙️ Actions */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap align-middle">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenAssign(trip)}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg border border-blue-200 text-xs sm:text-[13px] cursor-pointer transition-colors"
                            title="Assign Chauffeur & Vehicle"
                          >
                            🚘 {trip.driver_id ? 'Reassign' : 'Assign'}
                          </button>

                          <button
                            onClick={() => handleOpenStatusModal(trip)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs sm:text-[13px] cursor-pointer transition-colors"
                            title="Update Trip Lifecycle Status"
                          >
                            Status
                          </button>

                          <button
                            onClick={() => onViewVoucher(trip, 'driver_voucher')}
                            title="Print Driver Voucher / Trip Sheet"
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Driver & Vehicle Assignment Modal with Conflict Checking */}
      {assignModalTrip && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg sm:text-[19px] font-bold text-slate-900 mb-1 flex items-center gap-2 text-blue-700">
              <Car className="w-5 h-5" />
              <span>Assign Chauffeur & Fleet Vehicle</span>
            </h3>
            <p className="text-[13px] sm:text-sm text-slate-500 mb-4">
              Booking: <span className="font-mono font-bold text-slate-900">{assignModalTrip.booking_ref}</span> •{' '}
              {assignModalTrip.pickup_date} at {assignModalTrip.pickup_time}
            </p>

            {/* Overlapping Conflict Alert */}
            {conflictWarning.length > 0 && (
              <div className="mb-4 p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-[13px] space-y-1.5 animate-pulse">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>Scheduling Overlap Detected (+/- 2 Hours)</span>
                </div>
                {conflictWarning.map((c, i) => (
                  <div key={i} className="text-xs text-amber-800">
                    • {c.type === 'driver' ? 'Chauffeur' : 'Vehicle'} is already assigned to reservation{' '}
                    <span className="font-mono font-bold">{c.bookingRef}</span> ({c.passengerName}) at {c.time}.
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">👨‍✈️ Select Chauffeur</label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => {
                    const dId = e.target.value;
                    setSelectedDriverId(dId);
                    if (dId) {
                      const matched = drivers.find((drv) => drv.id === dId);
                      if (matched?.assigned_vehicle_id) {
                        setSelectedVehicleId(matched.assigned_vehicle_id);
                      }
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium text-sm min-h-[40px]"
                >
                  <option value="">👤 ⏳ No Driver (Awaiting Assignment)</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      👨‍✈️ {d.full_name} ({d.driver_code}) - {d.mobile} {d.assigned_vehicle_id ? '🚗 [Has Car]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">🚗 Select Fleet Vehicle</label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium text-sm min-h-[40px]"
                >
                  <option value="">🚗 ⏳ No Dedicated Vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      🚗 {v.reg_number} - {v.make_model} ({v.vehicle_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">🏢 Supplier Fleet Partner</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm min-h-[40px]"
                >
                  <option value="">🏢 Direct Gulf Taxis Fleet</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      🏢 {s.name} ({s.supplier_code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5 pt-3.5 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setAssignModalTrip(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer min-h-[38px]"
              >
                ✖️ Cancel
              </button>

              <button
                type="button"
                disabled={assigning}
                onClick={() => handleSaveAssignment(conflictWarning.length > 0)}
                className="px-4.5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow cursor-pointer disabled:opacity-50 min-h-[38px]"
              >
                {assigning ? '💾 Saving Assignment...' : conflictWarning.length > 0 ? '⚠️ Override & Confirm' : '💾 Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trip Status Transition Modal */}
      {statusModalTrip && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg sm:text-[19px] font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span>Update Dispatch Trip Status</span>
            </h3>
            <p className="text-[13px] sm:text-sm text-slate-500 mb-4">
              Booking {statusModalTrip.booking_ref} ({statusModalTrip.passenger_name})
            </p>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Lifecycle Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as TripStatus)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm min-h-[40px]"
                >
                  {statusList.map((s) => (
                    <option key={s} value={s}>
                      {getStatusEmoji(s)} {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Dispatcher Log Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Chauffeur arrived at Terminal Gate 4 on time."
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5 pt-3.5 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setStatusModalTrip(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer min-h-[38px]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingStatus}
                onClick={handleConfirmStatus}
                className="px-4.5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow cursor-pointer disabled:opacity-50 min-h-[38px]"
              >
                {updatingStatus ? 'Updating...' : 'Save Status Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
