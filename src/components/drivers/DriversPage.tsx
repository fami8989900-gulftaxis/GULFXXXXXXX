import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useSync } from '../../context/SyncContext';
import { useAuth } from '../../context/AuthContext';
import { Driver, Vehicle } from '../../types';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  Car,
  FileText,
  DollarSign,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Printer,
  Edit2,
  Eye,
  History,
  Download,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const DriversPage: React.FC = () => {
  const { syncVersion } = useSync();
  const { hasRole } = useAuth();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  // Driver Edit/Add Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    mobile: '+966 ',
    email: '',
    license_number: '',
    license_expiry: '2028-01-01',
    assigned_vehicle_id: '',
    payment_arrangement: 'per_trip',
    rate_or_salary: 80,
    currency: 'SAR',
    notes: '',
  });

  // Statement Modal
  const [statementDriver, setStatementDriver] = useState<Driver | null>(null);
  const [statementData, setStatementData] = useState<any | null>(null);
  const [statementStart, setStatementStart] = useState('');
  const [statementEnd, setStatementEnd] = useState('');
  const [statementLoading, setStatementLoading] = useState(false);

  // Trip History Modal
  const [historyDriver, setHistoryDriver] = useState<Driver | null>(null);
  const [driverTrips, setDriverTrips] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Delete Driver State
  const [driverToDelete, setDriverToDelete] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  const handleOpenDelete = (d: any) => {
    setDriverToDelete(d);
    setDeleteError(null);
    setDeleteSuccess(null);
  };

  const handleConfirmDelete = async () => {
    if (!driverToDelete) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await api.deleteDriver(driverToDelete.id);
      setDeleteSuccess(res.message || 'Driver deleted successfully.');
      setTimeout(() => {
        setDriverToDelete(null);
        setDeleteSuccess(null);
        fetchDrivers();
      }, 1000);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete driver.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeactivateInstead = async () => {
    if (!driverToDelete) return;
    setDeactivateLoading(true);
    setDeleteError(null);
    try {
      await api.updateDriver(driverToDelete.id, { is_active: 0 });
      setDeleteSuccess(`Driver ${driverToDelete.full_name} has been deactivated. They will not be assigned to new bookings.`);
      setTimeout(() => {
        setDriverToDelete(null);
        setDeleteSuccess(null);
        fetchDrivers();
      }, 1200);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to deactivate driver.');
    } finally {
      setDeactivateLoading(false);
    }
  };

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const [dRes, vRes] = await Promise.all([
        api.getDrivers({ search: search || undefined, status: statusFilter !== 'all' ? statusFilter : undefined }),
        api.getVehicles(),
      ]);
      setDrivers(dRes.drivers || []);
      setVehicles(vRes.vehicles || []);
    } catch (err) {
      console.error('Failed to load drivers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, [syncVersion, search, statusFilter]);

  const handleOpenAdd = () => {
    setEditingDriver(null);
    setFormData({
      full_name: '',
      mobile: '+966 ',
      email: '',
      license_number: '',
      license_expiry: '2028-01-01',
      assigned_vehicle_id: '',
      payment_arrangement: 'per_trip',
      rate_or_salary: 80,
      currency: 'SAR',
      notes: '',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (d: Driver) => {
    setEditingDriver(d);
    setFormData({
      full_name: d.full_name,
      mobile: d.mobile,
      email: d.email || '',
      license_number: d.license_number,
      license_expiry: d.license_expiry,
      assigned_vehicle_id: d.assigned_vehicle_id || '',
      payment_arrangement: d.payment_arrangement,
      rate_or_salary: d.rate_or_salary,
      currency: d.currency,
      notes: d.notes || '',
    });
    setModalOpen(true);
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDriver) {
        await api.updateDriver(editingDriver.id, formData);
      } else {
        await api.createDriver(formData);
      }
      setModalOpen(false);
      fetchDrivers();
    } catch (err: any) {
      alert(err.message || 'Failed to save driver');
    }
  };

  const handleOpenStatement = async (d: Driver) => {
    setStatementDriver(d);
    setStatementLoading(true);
    try {
      const res = await api.getDriverStatement(d.id, {
        startDate: statementStart || undefined,
        endDate: statementEnd || undefined,
      });
      setStatementData(res);
    } catch (err) {
      console.error('Error fetching statement:', err);
    } finally {
      setStatementLoading(false);
    }
  };

  const handleOpenHistory = async (d: Driver) => {
    setHistoryDriver(d);
    setHistoryLoading(true);
    try {
      const res = await api.getDriver(d.id);
      setDriverTrips(res.trips || []);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 flex items-center gap-2.5">
            <span>👨‍✈️ Driver Management</span>
            <span className="text-xs sm:text-[13px] bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-mono font-bold">
              {drivers.length} Drivers
            </span>
          </h1>
          <p className="text-[13.5px] sm:text-sm text-slate-500 mt-1">
            Single-line chauffeur register, license compliance, upcoming trips, and payout statements
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/20 cursor-pointer transition-all min-h-[38px]"
        >
          <Plus className="w-4 h-4" />
          <span>➕ Add Driver</span>
        </button>
      </div>

      {/* Filter & Search */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-3 text-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search driver by ID (DRV-101), name, mobile, or license number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm text-slate-900 min-h-[38px]"
          />
        </div>

        <div className="w-full sm:w-48">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm text-slate-800 font-medium min-h-[38px]"
          >
            <option value="all">🟢 All Drivers</option>
            <option value="active">Active Chauffeurs</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* COMPACT SINGLE-LINE DRIVER TABLE - FULL AVAILABLE WIDTH */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-auto text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-slate-100 via-slate-50 to-blue-50/50 border-b border-slate-200 text-slate-700 font-semibold text-[13.5px] tracking-normal whitespace-nowrap">
                <th className="py-3 px-3.5">🆔 Driver ID</th>
                <th className="py-3 px-3.5">🧑✈️ Driver</th>
                <th className="py-3 px-3.5">📞 Contact</th>
                <th className="py-3 px-3.5">🚐 Vehicle</th>
                <th className="py-3 px-3.5 text-center">🗓️ Trips</th>
                <th className="py-3 px-3.5 text-right">💰 Balance</th>
                <th className="py-3 px-3.5 text-center">🟢 Availability</th>
                <th className="py-3 px-3.5 text-center">⚙️ Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {drivers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium text-sm">
                    No drivers found matching criteria.
                  </td>
                </tr>
              ) : (
                drivers.map((d) => (
                  <tr key={d.id} className="hover:bg-blue-50/40 transition-colors">
                    {/* Driver ID */}
                    <td className="py-3 px-3.5 font-mono font-bold text-blue-600 whitespace-nowrap text-[13.5px]">
                      {d.driver_code}
                    </td>

                    {/* Driver Name & Avatar */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {d.full_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-[14.5px]">{d.full_name}</div>
                          <div className="text-xs text-slate-500 font-mono">Lic: {d.license_number}</div>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="py-3 px-3.5 whitespace-nowrap font-mono text-[13.5px] text-slate-800">
                      📞 {d.mobile}
                    </td>

                    {/* Assigned Vehicle */}
                    <td className="py-3 px-3.5 whitespace-nowrap text-slate-800">
                      {d.vehicle_reg ? (
                        <div className="text-[13.5px] font-semibold text-slate-900">
                          🚘 {d.vehicle_reg} <span className="font-normal text-slate-500">({d.vehicle_model})</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[13px]">Pool / Standby</span>
                      )}
                    </td>

                    {/* Upcoming Trips count */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <span className="inline-block px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-bold font-mono text-xs">
                        {d.active_trips_count || 0} Trips
                      </span>
                    </td>

                    {/* Payment Balance */}
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap text-[14px]">
                      {d.current_balance?.toLocaleString() || 0} <span className="text-xs text-slate-500 font-sans font-normal">{d.currency}</span>
                    </td>

                    {/* Availability Status */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                          d.is_active === 1
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {d.is_active === 1 ? '🟢 Available' : '⚪ Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleOpenStatement(d)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold text-xs cursor-pointer"
                          title="Driver Financial Statement"
                        >
                          💳 Statement
                        </button>
                        <button
                          onClick={() => handleOpenHistory(d)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs cursor-pointer"
                          title="View Trip History"
                        >
                          📋 History
                        </button>
                        <button
                          onClick={() => handleOpenEdit(d)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg cursor-pointer hover:bg-slate-100"
                          title="Edit Chauffeur Details"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(d)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer hover:bg-rose-50 transition-colors"
                          title="Delete Chauffeur"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Driver Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg sm:text-[19px] font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>{editingDriver ? `Edit Driver: ${editingDriver.driver_code}` : 'Add New Fleet Chauffeur'}</span>
            </h3>

            <form onSubmit={handleSaveDriver} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="col-span-2">
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Mobile Phone *</label>
                  <input
                    type="text"
                    required
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Driving License # *</label>
                  <input
                    type="text"
                    required
                    value={formData.license_number}
                    onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">License Expiry Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.license_expiry}
                    onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Payment Arrangement</label>
                  <select
                    value={formData.payment_arrangement}
                    onChange={(e) => setFormData({ ...formData, payment_arrangement: e.target.value as any })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-medium text-sm"
                  >
                    <option value="per_trip">Per Trip Payout</option>
                    <option value="monthly">Monthly Fixed Salary</option>
                    <option value="commission">Commission %</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Rate or Salary Amount</label>
                  <input
                    type="number"
                    value={formData.rate_or_salary}
                    onChange={(e) => setFormData({ ...formData, rate_or_salary: parseFloat(e.target.value) || 0 })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-mono text-sm"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Assigned Vehicle</label>
                  <select
                    value={formData.assigned_vehicle_id}
                    onChange={(e) => setFormData({ ...formData, assigned_vehicle_id: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white text-sm"
                  >
                    <option value="">-- Standby / No Dedicated Vehicle --</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.reg_number} - {v.make_model} ({v.vehicle_type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer text-sm min-h-[38px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow cursor-pointer text-sm min-h-[38px]"
                >
                  Save Chauffeur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Driver Statement Modal */}
      {statementDriver && statementData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-sm">Chauffeur Financial Statement</h3>
                  <p className="text-[11px] text-blue-200">
                    {statementDriver.full_name} ({statementDriver.driver_code}) • {statementDriver.currency}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setStatementDriver(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Filter Date Bar */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 text-xs">
              <div className="text-right ml-auto">
                <span className="text-slate-500 text-[11px]">Outstanding Due to Chauffeur: </span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  {statementData.summary.closingBalance.toLocaleString()} {statementDriver.currency}
                </span>
              </div>
            </div>

            {/* Statement Table */}
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Description / Route</th>
                    <th className="py-2.5 px-3 text-right">Earned</th>
                    <th className="py-2.5 px-3 text-right">Paid</th>
                    <th className="py-2.5 px-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {statementData.entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                        No transactions recorded for this driver.
                      </td>
                    </tr>
                  ) : (
                    statementData.entries.map((entry: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 whitespace-nowrap text-slate-700 font-sans">{entry.date}</td>
                        <td className="py-2 px-3 font-bold text-blue-600">{entry.reference}</td>
                        <td className="py-2 px-3 font-sans text-slate-800">{entry.description}</td>
                        <td className="py-2 px-3 text-right text-emerald-700 font-bold">
                          {entry.payable > 0 ? `+${entry.payable.toLocaleString()}` : '-'}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-800">
                          {entry.paid > 0 ? `-${entry.paid.toLocaleString()}` : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-slate-900">
                          {entry.balance.toLocaleString()} {entry.currency}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Driver Trip History Modal */}
      {historyDriver && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm">
                  Trip History: {historyDriver.full_name} ({historyDriver.driver_code})
                </h3>
              </div>
              <button
                onClick={() => setHistoryDriver(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="py-2.5 px-3">Ref</th>
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Passenger</th>
                    <th className="py-2.5 px-3">Route</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {driverTrips.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No assigned trips for this driver yet.
                      </td>
                    </tr>
                  ) : (
                    driverTrips.map((t: any) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-bold text-blue-600">{t.booking_ref}</td>
                        <td className="py-2 px-3 whitespace-nowrap">{t.pickup_date} {t.pickup_time}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{t.passenger_name}</td>
                        <td className="py-2 px-3 text-[11px] text-slate-600">{t.pickup_location} → {t.dropoff_location}</td>
                        <td className="py-2 px-3 font-semibold text-[11px]">{t.trip_status}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{t.driver_payout} {t.currency}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Delete Driver Modal */}
      {driverToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete Fleet Chauffeur</h3>
                <p className="text-xs text-slate-500 font-mono">{driverToDelete.driver_code}</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1 mb-4 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Chauffeur Name:</span>
                <span className="font-bold text-slate-900">{driverToDelete.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mobile Phone:</span>
                <span className="font-mono text-slate-800">{driverToDelete.mobile}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Completed Trips:</span>
                <span className="font-bold text-slate-900">{driverToDelete.completed_trips_count || 0} trip(s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Balance:</span>
                <span className="font-bold font-mono text-slate-900">
                  {driverToDelete.current_balance?.toLocaleString() || 0} {driverToDelete.currency || 'SAR'}
                </span>
              </div>
            </div>

            {/* If driver has linked trips or non-zero balance, warn and offer Deactivate */}
            {((driverToDelete.completed_trips_count > 0 || driverToDelete.active_trips_count > 0) || (driverToDelete.current_balance && Math.abs(driverToDelete.current_balance) > 0)) ? (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl mb-4 text-xs space-y-2 text-amber-900">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Unsafe Deletion Warning</span>
                </div>
                <p>
                  This chauffeur has <strong>{(driverToDelete.completed_trips_count || 0) + (driverToDelete.active_trips_count || 0)} associated booking trips</strong> and payment records. Permanent deletion is blocked to prevent corrupting past financial logs and trip reports.
                </p>
                <p className="font-semibold text-amber-800">
                  Recommended: Deactivate this driver instead. Deactivating immediately removes them from future booking dispatch lists while preserving all completed records.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-600 mb-4">
                Are you sure you want to permanently delete chauffeur <strong>{driverToDelete.full_name}</strong>? This driver has no dependent trips or transactions. This action cannot be undone.
              </p>
            )}

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            {deleteSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{deleteSuccess}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDriverToDelete(null)}
                disabled={deleteLoading || deactivateLoading}
                className="px-4 py-2 min-h-[38px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {((driverToDelete.completed_trips_count > 0 || driverToDelete.active_trips_count > 0) || (driverToDelete.current_balance && Math.abs(driverToDelete.current_balance) > 0)) ? (
                <button
                  type="button"
                  onClick={handleDeactivateInstead}
                  disabled={deactivateLoading}
                  className="px-4 py-2 min-h-[38px] bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  {deactivateLoading ? 'Deactivating...' : 'Deactivate Driver Instead'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleteLoading}
                  className="px-4 py-2 min-h-[38px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deleteLoading ? 'Deleting...' : 'Confirm Delete'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
