import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useSync } from '../../context/SyncContext';
import { useAuth } from '../../context/AuthContext';
import { Supplier } from '../../types';
import {
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  FileText,
  DollarSign,
  Printer,
  Edit2,
  Download,
  Calendar,
  CreditCard,
  Trash2,
  AlertTriangle,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const SuppliersPage: React.FC = () => {
  const { syncVersion, forceSync } = useSync();
  const { hasRole } = useAuth();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    mobile: '+966 ',
    email: '',
    address: '',
    default_currency: 'SAR',
    opening_balance: 0,
    payment_terms: '15_days',
    notes: '',
  });

  // Statement Modal
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);
  const [statementData, setStatementData] = useState<any | null>(null);
  const [statementStart, setStatementStart] = useState('');
  const [statementEnd, setStatementEnd] = useState('');
  const [statementLoading, setStatementLoading] = useState(false);

  // Delete Supplier State
  const [supplierToDelete, setSupplierToDelete] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  const handleOpenDelete = (s: any) => {
    setSupplierToDelete(s);
    setDeleteError(null);
    setDeleteSuccess(null);
  };

  const handleConfirmDelete = async () => {
    if (!supplierToDelete) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await api.deleteSupplier(supplierToDelete.id);
      setDeleteSuccess(res.message || 'Supplier deleted successfully.');
      forceSync();
      setTimeout(() => {
        setSupplierToDelete(null);
        setDeleteSuccess(null);
        fetchSuppliers();
      }, 900);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete supplier.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeactivateInstead = async () => {
    if (!supplierToDelete) return;
    setDeactivateLoading(true);
    setDeleteError(null);
    try {
      await api.updateSupplier(supplierToDelete.id, { is_active: 0 });
      setDeleteSuccess(`Supplier ${supplierToDelete.name} has been deactivated. They will no longer appear for new bookings.`);
      forceSync();
      setTimeout(() => {
        setSupplierToDelete(null);
        setDeleteSuccess(null);
        fetchSuppliers();
      }, 1000);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to deactivate supplier.');
    } finally {
      setDeactivateLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await api.getSuppliers({
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setSuppliers(res.suppliers || []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [syncVersion, search, statusFilter]);

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      contact_person: '',
      mobile: '+966 ',
      email: '',
      address: '',
      default_currency: 'SAR',
      opening_balance: 0,
      payment_terms: '15_days',
      notes: '',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setFormData({
      name: s.name,
      contact_person: s.contact_person || '',
      mobile: s.mobile,
      email: s.email || '',
      address: s.address || '',
      default_currency: s.default_currency,
      opening_balance: s.opening_balance,
      payment_terms: s.payment_terms,
      notes: s.notes || '',
    });
    setModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSupplier) {
        await api.updateSupplier(editingSupplier.id, formData);
      } else {
        await api.createSupplier(formData);
      }
      setModalOpen(false);
      fetchSuppliers();
    } catch (err: any) {
      alert(err.message || 'Failed to save supplier');
    }
  };

  const handleOpenStatement = async (s: Supplier) => {
    setStatementSupplier(s);
    setStatementLoading(true);
    try {
      const res = await api.getSupplierStatement(s.id, {
        startDate: statementStart || undefined,
        endDate: statementEnd || undefined,
      });
      setStatementData(res);
    } catch (err) {
      console.error('Failed to fetch supplier statement:', err);
    } finally {
      setStatementLoading(false);
    }
  };

  const exportStatementToExcel = () => {
    if (!statementData || !statementSupplier) return;
    const rows = statementData.entries.map((e: any) => ({
      'Date & Time': e.date,
      'Reference': e.reference,
      'Type': e.type,
      'Description / Route': e.description,
      [`Payable (${e.currency})`]: e.payable,
      [`Paid (${e.currency})`]: e.paid,
      [`Balance (${e.currency})`]: e.balance,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Supplier_Statement');
    XLSX.writeFile(wb, `${statementSupplier.supplier_code}_statement.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 flex items-center gap-2.5">
            <span>🏢 Supplier Fleet Management</span>
            <span className="text-xs sm:text-[13px] bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-mono font-bold">
              {suppliers.length} Vendors
            </span>
          </h1>
          <p className="text-[13.5px] sm:text-sm text-slate-500 mt-1">
            Single-line supplier register, payable balances, contractual terms, and statement settlements
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/20 cursor-pointer transition-all min-h-[38px]"
        >
          <Plus className="w-4 h-4" />
          <span>➕ Add Supplier</span>
        </button>
      </div>

      {/* Filter & Search */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-3 text-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by supplier code (SUP-01), company name, contact person, or phone..."
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
            <option value="all">🟢 All Suppliers</option>
            <option value="active">Active Vendors</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* COMPACT SINGLE-LINE SUPPLIER TABLE - FULL AVAILABLE WIDTH */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-auto text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-slate-100 via-slate-50 to-blue-50/50 border-b border-slate-200 text-slate-700 font-semibold text-[13.5px] tracking-normal whitespace-nowrap">
                <th className="py-3 px-3.5">🆔 Supplier ID</th>
                <th className="py-3 px-3.5">🏢 Supplier Name</th>
                <th className="py-3 px-3.5">📞 Contact</th>
                <th className="py-3 px-3.5">🚘 Service Type</th>
                <th className="py-3 px-3.5 text-center">🗓️ Trips</th>
                <th className="py-3 px-3.5 text-right">💰 Balance</th>
                <th className="py-3 px-3.5 text-center">💱 Currency</th>
                <th className="py-3 px-3.5 text-center">🟢 Status</th>
                <th className="py-3 px-3.5 text-center">⚙️ Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-medium text-sm">
                    No suppliers found matching criteria.
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-blue-50/40 transition-colors">
                    {/* Supplier ID */}
                    <td className="py-3 px-3.5 font-mono font-bold text-blue-600 whitespace-nowrap text-[13.5px]">
                      {s.supplier_code}
                    </td>

                    {/* Supplier Name */}
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 text-[14.5px]">{s.name}</div>
                      <div className="text-xs text-slate-500">Attn: {s.contact_person || 'Fleet Office'}</div>
                    </td>

                    {/* Contact */}
                    <td className="py-3 px-3.5 whitespace-nowrap font-mono text-[13.5px] text-slate-800">
                      📞 {s.mobile}
                    </td>

                    {/* Vehicle Service Type */}
                    <td className="py-3 px-3.5 whitespace-nowrap text-slate-800 text-xs sm:text-[13px]">
                      <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded font-medium">
                        🚘 Fleet Partner ({s.payment_terms?.replace('_', ' ') || 'Terms'})
                      </span>
                    </td>

                    {/* Total Trips */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap font-mono font-bold text-slate-800 text-[14px]">
                      {s.total_bookings_count || 0}
                    </td>

                    {/* Outstanding Balance */}
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap text-[14px]">
                      {s.current_balance?.toLocaleString() || 0}
                    </td>

                    {/* Currency */}
                    <td className="py-3 px-3.5 text-center font-bold text-slate-700 whitespace-nowrap text-[13.5px]">
                      {s.default_currency}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                          s.is_active === 1
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {s.is_active === 1 ? '🟢 Active' : '⚪ Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleOpenStatement(s)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold text-xs cursor-pointer"
                          title="View Supplier Statement"
                        >
                          💳 Statement
                        </button>
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg cursor-pointer hover:bg-slate-100"
                          title="Edit Supplier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {hasRole('super_admin', 'admin') && (
                          <button
                            onClick={() => handleOpenDelete(s)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer hover:bg-rose-50 transition-colors"
                            title="Delete Supplier"
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

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg sm:text-[19px] font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <span>{editingSupplier ? `Edit Supplier: ${editingSupplier.name}` : 'Add Partner Supplier Fleet'}</span>
            </h3>

            <form onSubmit={handleSaveSupplier} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="col-span-2">
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Company / Supplier Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
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
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Default Currency</label>
                  <select
                    value={formData.default_currency}
                    onChange={(e) => setFormData({ ...formData, default_currency: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white text-sm"
                  >
                    <option value="SAR">SAR</option>
                    <option value="AED">AED</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Opening Balance</label>
                  <input
                    type="number"
                    value={formData.opening_balance}
                    onChange={(e) => setFormData({ ...formData, opening_balance: parseFloat(e.target.value) || 0 })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Payment Terms</label>
                  <select
                    value={formData.payment_terms}
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white text-sm"
                  >
                    <option value="weekly">Weekly Settlement</option>
                    <option value="15_days">15 Days</option>
                    <option value="30_days">30 Days</option>
                    <option value="cash_on_delivery">Cash per Trip</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Physical Address</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white text-sm"
                  />
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
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Statement Modal with clean header */}
      {statementSupplier && statementData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-sm">Partner Supplier Financial Statement</h3>
                  <p className="text-[11px] text-blue-200">
                    Vendor: <strong className="text-white">{statementSupplier.name}</strong> ({statementSupplier.supplier_code}) • Currency: {statementSupplier.default_currency}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportStatementToExcel}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="p-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setStatementSupplier(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 text-xs">
              <div className="text-right ml-auto">
                <span className="text-slate-500 text-[11px]">Closing Balance Payable: </span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  {statementData.summary.closingBalance.toLocaleString()} {statementSupplier.default_currency}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Description / Route</th>
                    <th className="py-2.5 px-3 text-right">Payable ({statementSupplier.default_currency})</th>
                    <th className="py-2.5 px-3 text-right">Paid ({statementSupplier.default_currency})</th>
                    <th className="py-2.5 px-3 text-right">Balance ({statementSupplier.default_currency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {statementData.entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                        No transactions recorded for this supplier.
                      </td>
                    </tr>
                  ) : (
                    statementData.entries.map((entry: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-blue-600">{entry.reference}</td>
                        <td className="py-2 px-3 whitespace-nowrap text-slate-700 font-sans">{entry.date}</td>
                        <td className="py-2 px-3 font-sans text-slate-800">{entry.description}</td>
                        <td className="py-2 px-3 text-right text-slate-900 font-semibold">
                          {entry.payable > 0 ? entry.payable.toLocaleString() : '-'}
                        </td>
                        <td className="py-2 px-3 text-right text-emerald-700 font-semibold">
                          {entry.paid > 0 ? entry.paid.toLocaleString() : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-black text-slate-900">
                          {entry.balance.toLocaleString()}
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

      {/* Delete Supplier Modal */}
      {supplierToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete Supplier Partner</h3>
                <p className="text-xs text-slate-500 font-mono">{supplierToDelete.supplier_code}</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1 mb-4 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Company Name:</span>
                <span className="font-bold text-slate-900">{supplierToDelete.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Contact:</span>
                <span className="font-mono text-slate-800">{supplierToDelete.mobile}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Linked Bookings:</span>
                <span className="font-bold text-slate-900">{supplierToDelete.total_bookings_count || 0} trip(s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fleet Vehicles:</span>
                <span className="font-bold text-slate-900">{supplierToDelete.fleet_vehicles_count || 0} vehicle(s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Financial Payments:</span>
                <span className="font-bold text-slate-900">{supplierToDelete.payments_count || 0} transaction(s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Balance:</span>
                <span className="font-bold font-mono text-slate-900">
                  {(supplierToDelete.calculated_balance ?? supplierToDelete.current_balance ?? 0).toLocaleString()} {supplierToDelete.default_currency || 'SAR'}
                </span>
              </div>
            </div>

            {/* If supplier has linked bookings, vehicles, or payments */}
            {((Number(supplierToDelete.total_bookings_count || 0) > 0) ||
              (Number(supplierToDelete.fleet_vehicles_count || 0) > 0) ||
              (Number(supplierToDelete.payments_count || 0) > 0)) ? (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl mb-4 text-xs space-y-2 text-amber-900">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Unsafe Deletion Warning</span>
                </div>
                <p>
                  This supplier has <strong>{supplierToDelete.total_bookings_count || 0} linked bookings</strong>, {supplierToDelete.fleet_vehicles_count || 0} fleet vehicles, and {supplierToDelete.payments_count || 0} financial payment transactions. Permanent deletion is blocked to prevent breaking audit trails and dispatch history.
                </p>
                <p className="font-semibold text-amber-800">
                  Recommended: Deactivate this supplier instead. Deactivating immediately hides them from new booking assignments while preserving existing statements and invoices.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-600 mb-4">
                Are you sure you want to permanently delete supplier partner <strong>{supplierToDelete.name}</strong>? This supplier has no dependent trips, vehicles, or transactions. This action cannot be undone.
              </p>
            )}

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{deleteError}</span>
              </div>
            )}

            {deleteSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{deleteSuccess}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSupplierToDelete(null)}
                disabled={deleteLoading || deactivateLoading}
                className="px-3.5 py-2 min-h-[38px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {((Number(supplierToDelete.total_bookings_count || 0) > 0) ||
                (Number(supplierToDelete.fleet_vehicles_count || 0) > 0) ||
                (Number(supplierToDelete.payments_count || 0) > 0)) ? (
                <>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={deleteLoading || deactivateLoading}
                    className="px-3.5 py-2 min-h-[38px] bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
                    title="Attempt deletion and verify server validation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{deleteLoading ? 'Deleting...' : 'Delete Anyway'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeactivateInstead}
                    disabled={deactivateLoading || deleteLoading}
                    className="px-4 py-2 min-h-[38px] bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow cursor-pointer transition-colors flex items-center gap-1.5"
                  >
                    {deactivateLoading ? 'Deactivating...' : 'Deactivate Supplier (Recommended)'}
                  </button>
                </>
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
