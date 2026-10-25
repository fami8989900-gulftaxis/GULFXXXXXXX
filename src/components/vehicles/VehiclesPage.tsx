import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useSync } from '../../context/SyncContext';
import { useAuth } from '../../context/AuthContext';
import { Vehicle, Driver, Supplier } from '../../types';
import {
  Car,
  Plus,
  Search,
  Filter,
  Users,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Trash2,
  Calendar,
  History,
  Wrench
} from 'lucide-react';

export const VehiclesPage: React.FC = () => {
  const { syncVersion } = useSync();
  const { hasRole } = useAuth();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState({
    reg_number: '',
    vehicle_type: 'Sedan (Camry / Lexus ES)',
    make_model: '',
    passenger_capacity: 4,
    luggage_capacity: 3,
    supplier_id: '',
    assigned_driver_id: '',
    status: 'available' as any,
    color: 'White',
    model_year: 2025,
    notes: '',
  });

  const fetchFleet = async () => {
    setLoading(true);
    try {
      const [vRes, dRes, sRes] = await Promise.all([
        api.getVehicles({
          search: search || undefined,
          type: typeFilter !== 'all' ? typeFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        }),
        api.getDrivers({ status: 'active' }),
        api.getSuppliers({ status: 'active' }),
      ]);
      setVehicles(vRes.vehicles || []);
      setDrivers(dRes.drivers || []);
      setSuppliers(sRes.suppliers || []);
    } catch (err) {
      console.error('Failed to load fleet vehicles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleet();
  }, [syncVersion, search, typeFilter, statusFilter]);

  const handleOpenAdd = () => {
    setEditingVehicle(null);
    setFormData({
      reg_number: '',
      vehicle_type: 'Sedan (Camry / Lexus ES)',
      make_model: '',
      passenger_capacity: 4,
      luggage_capacity: 3,
      supplier_id: '',
      assigned_driver_id: '',
      status: 'available',
      color: 'White',
      model_year: 2025,
      notes: '',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (v: Vehicle) => {
    setEditingVehicle(v);
    setFormData({
      reg_number: v.reg_number,
      vehicle_type: v.vehicle_type,
      make_model: v.make_model,
      passenger_capacity: v.passenger_capacity,
      luggage_capacity: v.luggage_capacity,
      supplier_id: v.supplier_id || '',
      assigned_driver_id: v.assigned_driver_id || '',
      status: v.status,
      color: v.color || 'White',
      model_year: v.model_year || 2024,
      notes: v.notes || '',
    });
    setModalOpen(true);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingVehicle) {
        await api.updateVehicle(editingVehicle.id, formData);
      } else {
        await api.createVehicle(formData);
      }
      setModalOpen(false);
      fetchFleet();
    } catch (err: any) {
      alert(err.message || 'Failed to save vehicle');
    }
  };

  const handleDelete = async (v: Vehicle) => {
    if (!window.confirm(`Are you sure you want to remove fleet vehicle ${v.reg_number}?`)) return;
    try {
      await api.deleteVehicle(v.id);
      fetchFleet();
    } catch (err: any) {
      alert(err.message || 'Failed to remove vehicle');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'on_trip':
        return 'bg-blue-100 text-blue-800 border-blue-300 font-bold';
      case 'maintenance':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-300';
    }
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'available': return '🟢';
      case 'on_trip': return '🔵';
      case 'maintenance': return '🟠';
      default: return '⚪';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 flex items-center gap-2.5">
            <span>🚗 Vehicle Fleet Register</span>
            <span className="text-xs sm:text-[13px] bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-mono font-bold">
              {vehicles.length} Fleet Units
            </span>
          </h1>
          <p className="text-[13.5px] sm:text-sm text-slate-500 mt-1">
            Compact vehicle fleet register, passenger/luggage capacities, dedicated chauffeurs, and availability
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/20 cursor-pointer transition-all min-h-[38px]"
        >
          <Plus className="w-4 h-4" />
          <span>➕ Add Vehicle</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-3 text-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by license plate, make, model, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm text-slate-900 min-h-[38px]"
          />
        </div>

        <div className="w-full sm:w-56">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm text-slate-800 font-medium min-h-[38px]"
          >
            <option value="all">🚘 All Vehicle Types</option>
            <option value="Sedan (Camry / Lexus ES)">Sedan</option>
            <option value="SUV (Yukon / Tahoe)">SUV</option>
            <option value="Hyundai Staria VIP">Hyundai Staria VIP</option>
            <option value="Toyota Hiace Minivan">Toyota Hiace Minivan</option>
            <option value="Toyota Coaster Minibus">Toyota Coaster Minibus</option>
          </select>
        </div>

        <div className="w-full sm:w-44">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm text-slate-800 font-medium min-h-[38px]"
          >
            <option value="all">🟢 All Statuses</option>
            <option value="available">Available</option>
            <option value="on_trip">On Trip</option>
            <option value="maintenance">Maintenance</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* COMPACT SINGLE-LINE VEHICLE TABLE - FULL AVAILABLE WIDTH */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-auto text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-slate-100 via-slate-50 to-blue-50/50 border-b border-slate-200 text-slate-700 font-semibold text-[13.5px] tracking-normal whitespace-nowrap">
                <th className="py-3 px-3.5">🆔 Vehicle ID</th>
                <th className="py-3 px-3.5">🚐 Vehicle Type</th>
                <th className="py-3 px-3.5">🔢 Registration</th>
                <th className="py-3 px-3.5 text-center">👥 Capacity</th>
                <th className="py-3 px-3.5 text-center">🧳 Luggage</th>
                <th className="py-3 px-3.5">🧑✈️ Driver</th>
                <th className="py-3 px-3.5 text-center">🚦 Availability</th>
                <th className="py-3 px-3.5 text-center">⚙️ Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vehicles.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-medium text-sm">
                    No vehicles found matching criteria.
                  </td>
                </tr>
              ) : (
                vehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-blue-50/40 transition-colors">
                    {/* Vehicle ID */}
                    <td className="py-3 px-3.5 font-mono font-bold text-slate-500 whitespace-nowrap text-[13px]">
                      {v.id}
                    </td>

                    {/* Vehicle Type */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded text-xs border border-blue-200">
                        🚘 {v.vehicle_type}
                      </span>
                    </td>

                    {/* Registration Number */}
                    <td className="py-3 px-3.5 font-mono font-bold text-slate-900 whitespace-nowrap text-[14px]">
                      {v.reg_number}
                    </td>

                    {/* Make & Model */}
                    <td className="py-3 px-3.5 text-slate-800 whitespace-nowrap">
                      <span className="font-semibold text-slate-900 text-[14px]">{v.make_model}</span>
                      <span className="text-slate-400 text-xs ml-1.5">{v.model_year ? `(${v.model_year})` : ''}</span>
                    </td>

                    {/* Capacity Pax */}
                    <td className="py-3 px-3.5 text-center font-bold text-slate-800 whitespace-nowrap font-mono text-[14px]">
                      {v.passenger_capacity}
                    </td>

                    {/* Capacity Bags */}
                    <td className="py-3 px-3.5 text-center font-bold text-slate-800 whitespace-nowrap font-mono text-[14px]">
                      {v.luggage_capacity}
                    </td>

                    {/* Assigned Driver */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      {v.driver_name ? (
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5 text-[14px]">
                          <span>🧑✈️</span>
                          <span>{v.driver_name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[13px]">Pool / Shared</span>
                      )}
                    </td>

                    {/* Availability */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border capitalize ${getStatusBadge(
                          v.status
                        )}`}
                      >
                        <span>{getStatusEmoji(v.status)}</span>
                        <span>{v.status.replace('_', ' ')}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(v)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg font-semibold text-xs cursor-pointer"
                        >
                          ✏️ Edit
                        </button>
                        {hasRole('super_admin', 'admin') && (
                          <button
                            onClick={() => handleDelete(v)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            title="Remove Vehicle"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Vehicle Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg sm:text-[19px] font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Car className="w-5 h-5 text-blue-600" />
              <span>{editingVehicle ? `Edit Fleet Vehicle: ${editingVehicle.reg_number}` : 'Add New Fleet Vehicle'}</span>
            </h3>

            <form onSubmit={handleSaveVehicle} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Registration / Plate # *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. KSA 4512 BDA"
                    value={formData.reg_number}
                    onChange={(e) => setFormData({ ...formData, reg_number: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white uppercase font-mono font-bold text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Vehicle Category *</label>
                  <select
                    value={formData.vehicle_type}
                    onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-medium text-sm"
                  >
                    <option value="Sedan (Camry / Lexus ES)">Sedan (Camry / Lexus ES)</option>
                    <option value="SUV (Yukon / Tahoe)">SUV (Yukon / Tahoe)</option>
                    <option value="Hyundai Staria VIP">Hyundai Staria VIP</option>
                    <option value="Mercedes-Benz S-Class / VIP">Mercedes-Benz S-Class / VIP</option>
                    <option value="Toyota Hiace Minivan">Toyota Hiace Minivan</option>
                    <option value="Toyota Coaster Minibus">Toyota Coaster Minibus</option>
                    <option value="Luxury Coach Bus 49-Seater">Luxury Coach Bus 49-Seater</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Make & Model *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Toyota Camry 2025"
                    value={formData.make_model}
                    onChange={(e) => setFormData({ ...formData, make_model: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Passenger Capacity (Pax)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.passenger_capacity}
                    onChange={(e) => setFormData({ ...formData, passenger_capacity: parseInt(e.target.value) || 4 })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Luggage Capacity (Bags)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.luggage_capacity}
                    onChange={(e) => setFormData({ ...formData, luggage_capacity: parseInt(e.target.value) || 3 })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Availability Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-medium text-sm"
                  >
                    <option value="available">🟢 Available</option>
                    <option value="on_trip">🔵 On Trip</option>
                    <option value="maintenance">🟠 Maintenance</option>
                    <option value="inactive">⚪ Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Dedicated Chauffeur</label>
                  <select
                    value={formData.assigned_driver_id}
                    onChange={(e) => setFormData({ ...formData, assigned_driver_id: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white text-sm"
                  >
                    <option value="">-- No Dedicated Driver --</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name} ({d.driver_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Fleet Partner / Supplier Owner</label>
                  <select
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white text-sm"
                  >
                    <option value="">-- In-House Direct Fleet --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.supplier_code})
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
                  Save Fleet Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
