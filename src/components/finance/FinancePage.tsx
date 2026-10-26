import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useSync } from '../../context/SyncContext';
import { useAuth } from '../../context/AuthContext';
import { Payment, EntityType, Booking, Driver, Supplier } from '../../types';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Printer,
  Calendar,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Edit2,
  Trash2,
  XCircle,
  RefreshCw,
  Users,
  Building2
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const EXPENSE_CATEGORIES = [
  'Fuel & Petrol',
  'Vehicle Maintenance & Service',
  'Salaries & Wages',
  'Office Rent & Utilities',
  'Tolls & Parking',
  'Insurance & Registration',
  'Marketing & Business Dev',
  'Vehicle Lease / Rental',
  'Cleaning & Sanitization',
  'Other Operating Expense',
];

interface FinancePageProps {
  onViewReceipt: (p: Payment) => void;
}

export const FinancePage: React.FC<FinancePageProps> = ({ onViewReceipt }) => {
  const { syncVersion, forceSync } = useSync();
  const { hasRole, hasPermission } = useAuth();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [overview, setOverview] = useState<any>({ metrics: {} });
  const [activeTab, setActiveTab] = useState<EntityType | 'all'>('all');
  
  // Search & Filter States
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [driverFilter, setDriverFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [currencyFilter, setCurrencyFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  // Entities for dropdowns
  const [bookingsList, setBookingsList] = useState<Booking[]>([]);
  const [driversList, setDriversList] = useState<Driver[]>([]);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);

  // New Payment Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    entity_type: 'customer_receipt' as EntityType,
    entity_id: '',
    entity_name: '',
    booking_id: '',
    booking_ref: '',
    amount: 350,
    currency: 'SAR',
    payment_method: 'Bank Transfer',
    payment_date: new Date().toISOString().split('T')[0],
    reference_no: '',
    notes: '',
    expense_category: 'Fuel & Petrol',
  });

  // Edit Expense / Payment State
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    payment_date: '',
    expense_category: 'Fuel & Petrol',
    entity_type: 'general_expense' as EntityType,
    entity_name: '',
    entity_id: '',
    amount: 0,
    currency: 'SAR',
    payment_method: 'Bank Transfer',
    reference_no: '',
    notes: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  // Delete Expense / Payment State
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  // Pre-load driver & supplier entities for filters and assignment
  useEffect(() => {
    const loadEntities = async () => {
      try {
        const [dRes, sRes] = await Promise.all([
          api.getDrivers(),
          api.getSuppliers(),
        ]);
        setDriversList(dRes.drivers || []);
        setSuppliersList(sRes.suppliers || []);
      } catch (err) {
        console.error('Failed to load drivers and suppliers for finance filters:', err);
      }
    };
    loadEntities();
  }, [syncVersion]);

  const fetchFinance = async () => {
    setLoading(true);
    try {
      const [pRes, oRes] = await Promise.all([
        api.getPayments({
          type: activeTab !== 'all' ? activeTab : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          search: search || undefined,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
          driverId: driverFilter !== 'all' ? driverFilter : undefined,
          supplierId: supplierFilter !== 'all' ? supplierFilter : undefined,
          currency: currencyFilter !== 'all' ? currencyFilter : undefined,
        }),
        api.getFinanceOverview({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      ]);
      setPayments(pRes.payments || []);
      setOverview(oRes);
    } catch (err) {
      console.error('Failed to load finance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinance();
  }, [syncVersion, activeTab, search, startDate, endDate, categoryFilter, driverFilter, supplierFilter, currencyFilter]);

  const handleClearFilters = () => {
    setSearch('');
    setStartDate('');
    setEndDate('');
    setCategoryFilter('all');
    setDriverFilter('all');
    setSupplierFilter('all');
    setCurrencyFilter('all');
  };

  const handleOpenNewPayment = async (defaultType?: EntityType) => {
    try {
      const [bRes, dRes, sRes] = await Promise.all([
        api.getBookings({ limit: 100 }),
        api.getDrivers({ status: 'active' }),
        api.getSuppliers({ status: 'active' }),
      ]);
      setBookingsList(bRes.bookings || []);
      setDriversList(dRes.drivers || []);
      setSuppliersList(sRes.suppliers || []);

      setFormData({
        entity_type: defaultType || 'general_expense',
        entity_id: '',
        entity_name: '',
        booking_id: '',
        booking_ref: '',
        amount: 250,
        currency: 'SAR',
        payment_method: 'Cash',
        payment_date: new Date().toISOString().split('T')[0],
        reference_no: '',
        notes: '',
        expense_category: 'Fuel & Petrol',
      });
      setModalOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBookingSelected = (bookingId: string) => {
    const selected = bookingsList.find((b) => b.id === bookingId);
    if (selected) {
      const remainingBalance = Math.max(0, selected.customer_price - selected.paid_amount);
      setFormData((prev) => ({
        ...prev,
        booking_id: selected.id,
        booking_ref: selected.booking_ref,
        entity_name: selected.customer_name,
        currency: selected.currency,
        amount: remainingBalance > 0 ? remainingBalance : selected.customer_price,
      }));
    }
  };

  const handleDriverSelected = (driverId: string) => {
    const selected = driversList.find((d) => d.id === driverId);
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        entity_id: selected.id,
        entity_name: selected.full_name,
        currency: selected.currency,
        amount: selected.current_balance > 0 ? selected.current_balance : 150,
      }));
    }
  };

  const handleSupplierSelected = (supplierId: string) => {
    const selected = suppliersList.find((s) => s.id === supplierId);
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        entity_id: selected.id,
        entity_name: selected.name,
        currency: selected.default_currency,
        amount: selected.current_balance > 0 ? selected.current_balance : 500,
      }));
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || formData.amount <= 0) {
      alert('Please enter a valid positive payment amount.');
      return;
    }

    try {
      await api.createPayment(formData);
      setModalOpen(false);
      forceSync();
      fetchFinance();
    } catch (err: any) {
      alert(err.message || 'Failed to record transaction');
    }
  };

  // Open Edit Expense Modal
  const handleOpenEditPayment = (p: Payment) => {
    setEditingPayment(p);
    setEditFormData({
      payment_date: p.payment_date,
      expense_category: p.expense_category || 'Other Operating Expense',
      entity_type: p.entity_type,
      entity_name: p.entity_name || '',
      entity_id: p.entity_id || '',
      amount: p.amount,
      currency: p.currency,
      payment_method: p.payment_method,
      reference_no: p.reference_no || '',
      notes: p.notes || '',
    });
    setEditError(null);
    setEditSuccess(null);
    setEditModalOpen(true);
  };

  // Submit Edit Expense
  const handleSaveEditPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;
    if (!editFormData.amount || editFormData.amount <= 0) {
      setEditError('Please enter a valid positive amount.');
      return;
    }

    setEditLoading(true);
    setEditError(null);
    try {
      const res = await api.updatePayment(editingPayment.id, editFormData);
      setEditSuccess(res.message || 'Record successfully updated.');
      forceSync();
      setTimeout(() => {
        setEditModalOpen(false);
        setEditSuccess(null);
        setEditingPayment(null);
        fetchFinance();
      }, 900);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update record.');
    } finally {
      setEditLoading(false);
    }
  };

  // Open Delete Expense Modal
  const handleOpenDeletePayment = (p: Payment) => {
    setPaymentToDelete(p);
    setDeleteError(null);
    setDeleteSuccess(null);
  };

  // Confirm Delete Expense
  const handleConfirmDeletePayment = async () => {
    if (!paymentToDelete) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await api.deletePayment(paymentToDelete.id);
      setDeleteSuccess(res.message || 'Expense deleted successfully.');
      forceSync();
      setTimeout(() => {
        setPaymentToDelete(null);
        setDeleteSuccess(null);
        fetchFinance();
      }, 900);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete expense.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const exportPaymentsExcel = () => {
    const rows = payments.map((p) => ({
      'Receipt / Ref #': p.payment_ref,
      'Transaction Date': p.payment_date,
      'Category': p.expense_category || p.entity_type.replace('_', ' ').toUpperCase(),
      'Entity / Account': p.entity_name || '',
      'Linked Booking': p.booking_ref || '',
      'Method': p.payment_method,
      'Reference #': p.reference_no || '',
      'Amount': p.amount,
      'Currency': p.currency,
      'Notes': p.notes || '',
      'Recorded By': p.created_by_name || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Finance_Transactions');
    XLSX.writeFile(wb, `Gulf_Taxis_Finance_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const m = overview.metrics || {};
  const filteredTotal = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const isFiltered = Boolean(search || startDate || endDate || categoryFilter !== 'all' || driverFilter !== 'all' || supplierFilter !== 'all' || currencyFilter !== 'all');

  return (
    <div className="space-y-4">
      {/* Financial KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* Total Collected */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-950 p-4 sm:p-5 rounded-2xl text-white shadow-sm border border-slate-800">
          <div className="flex items-center justify-between text-blue-200 mb-1.5">
            <span className="text-[13px] sm:text-[14px] font-bold uppercase tracking-wide">Collected Revenue</span>
            <span className="text-base">💵</span>
          </div>
          <div className="text-[26px] sm:text-[30px] font-black font-mono">
            {(m.collectedRevenue || 0).toLocaleString()} <span className="text-xs font-normal text-blue-300">SAR</span>
          </div>
          <div className="text-xs text-blue-300/80 mt-1 font-medium">
            Booked: {(m.bookedRevenue || 0).toLocaleString()} SAR
          </div>
        </div>

        {/* Customer Receivables */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[13px] sm:text-[14px] font-bold uppercase tracking-wide">Customer Receivables</span>
            <span className="text-base">📈</span>
          </div>
          <div className="text-[26px] sm:text-[30px] font-black font-mono text-slate-900">
            {(m.outstandingReceivables || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">SAR</span>
          </div>
          <p className="text-xs text-amber-600 mt-1 font-semibold">Pending client settlements</p>
        </div>

        {/* Supplier Payables */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[13px] sm:text-[14px] font-bold uppercase tracking-wide">Supplier Payables</span>
            <span className="text-base">🏢</span>
          </div>
          <div className="text-[26px] sm:text-[30px] font-black font-mono text-slate-900">
            {(m.supplierOutstandingPayable || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">SAR</span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">Due to partner fleet fleets</p>
        </div>

        {/* Driver Payables */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[13px] sm:text-[14px] font-bold uppercase tracking-wide">Operating Expenses</span>
            <span className="text-base">🧾</span>
          </div>
          <div className="text-[26px] sm:text-[30px] font-black font-mono text-slate-900">
            {(m.generalExpenses || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">SAR</span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">Fuel, maintenance, & utilities</p>
        </div>
      </div>

      {/* Control Bar & Category Tabs */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 flex items-center gap-2.5">
              <span>💳 Payments & Expenses</span>
              <span className="text-xs sm:text-[13px] bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-mono font-bold">
                {payments.length} Transactions
              </span>
            </h1>
            <p className="text-[13.5px] sm:text-sm text-slate-500 mt-1">
              Double-entry receipts, chauffeur disbursements, supplier settlements, and operating expenses
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={exportPaymentsExcel}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold cursor-pointer min-h-[38px] transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Excel</span>
            </button>
            <button
              onClick={() => handleOpenNewPayment('general_expense')}
              className="flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm shadow-xs cursor-pointer min-h-[38px] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>+ Record Expense</span>
            </button>
            <button
              onClick={() => handleOpenNewPayment('customer_receipt')}
              className="flex items-center gap-2 px-4.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/20 cursor-pointer min-h-[38px] transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ Record Payment</span>
            </button>
          </div>
        </div>

        {/* Category Tabs with Meaningful Emojis */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 text-sm font-semibold">
          {[
            { id: 'all', label: 'All Transactions' },
            { id: 'general_expense', label: '🧾 Business Expenses' },
            { id: 'customer_receipt', label: '💵 Customer Receipts' },
            { id: 'driver_payment', label: '👨‍✈️ Driver Payments' },
            { id: 'supplier_payment', label: '🏢 Supplier Payments' },
            { id: 'refund_adjustment', label: '↩️ Refunds & Adjustments' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer text-sm ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Advanced Filters & Search Bar */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
            {/* Search */}
            <div className="relative sm:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search description, reference #, entity, or notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs text-slate-900 min-h-[34px]"
              />
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs text-slate-800 font-medium min-h-[34px]"
              >
                <option value="all">Category: All Categories</option>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Driver Filter */}
            <div>
              <select
                value={driverFilter}
                onChange={(e) => setDriverFilter(e.target.value)}
                className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs text-slate-800 font-medium min-h-[34px]"
              >
                <option value="all">Driver: All Drivers</option>
                {driversList.map((d) => (
                  <option key={d.id} value={d.id}>{d.full_name} ({d.driver_code})</option>
                ))}
              </select>
            </div>

            {/* Supplier Filter */}
            <div>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs text-slate-800 font-medium min-h-[34px]"
              >
                <option value="all">Supplier: All Suppliers</option>
                {suppliersList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.supplier_code})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Date Range, Currency, Clear Filters, and Filtered Total Summary */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500 font-semibold">Date Range:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 min-h-[32px]"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 min-h-[32px]"
              />

              <div className="w-24 ml-1">
                <select
                  value={currencyFilter}
                  onChange={(e) => setCurrencyFilter(e.target.value)}
                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-bold min-h-[32px]"
                >
                  <option value="all">All Currencies</option>
                  <option value="SAR">SAR</option>
                  <option value="AED">AED</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>

              {isFiltered && (
                <button
                  onClick={handleClearFilters}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  title="Reset all active filters"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Clear Filters</span>
                </button>
              )}
            </div>

            {/* Total expenses / transactions summary for filtered results */}
            <div className="ml-auto flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-slate-500 font-semibold">Filtered Total ({payments.length} items):</span>
              <span className="font-mono font-black text-slate-900 text-sm">
                {filteredTotal.toLocaleString()} <span className="text-xs font-normal text-slate-600">SAR</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* COMPACT SINGLE-LINE FINANCE TABLE - FULL AVAILABLE WIDTH */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-auto text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-slate-100 via-slate-50 to-blue-50/50 border-b border-slate-200 text-slate-700 font-semibold text-[13.5px] tracking-normal whitespace-nowrap">
                <th className="py-3 px-3.5">🔖 Ref #</th>
                <th className="py-3 px-3.5">🗓️ Date</th>
                <th className="py-3 px-3.5">🏷️ Category</th>
                <th className="py-3 px-3.5">👤 Description / Payee</th>
                <th className="py-3 px-3.5">💳 Method</th>
                <th className="py-3 px-3.5">🔢 Bank / Receipt #</th>
                <th className="py-3 px-3.5 text-right">💰 Amount</th>
                <th className="py-3 px-3.5 text-center">⚙️ Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium text-sm">
                    No transactions or expenses match the selected filters.
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const isCredit = p.entity_type === 'customer_receipt';
                  return (
                    <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                      {/* Receipt Ref */}
                      <td className="py-3 px-3.5 font-mono font-bold text-blue-600 whitespace-nowrap text-[13.5px]">
                        {p.payment_ref}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-slate-800 font-medium text-[14px]">
                        {p.payment_date}
                      </td>

                      {/* Category Badge */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            isCredit
                              ? 'bg-emerald-100 text-emerald-800'
                              : p.entity_type === 'refund_adjustment'
                              ? 'bg-purple-100 text-purple-800'
                              : p.entity_type === 'general_expense'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300/60'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {p.entity_type === 'customer_receipt' && '💵 '}
                          {p.entity_type === 'driver_payment' && '👨‍✈️ '}
                          {p.entity_type === 'supplier_payment' && '🏢 '}
                          {p.entity_type === 'general_expense' && '🧾 '}
                          {p.entity_type === 'refund_adjustment' && '↩️ '}
                          {p.expense_category || p.entity_type.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>

                      {/* Description / Entity / Account */}
                      <td className="py-3 px-3.5 font-semibold text-slate-900 whitespace-nowrap text-[14px]">
                        <div>{p.entity_name || 'Operating Expense'}</div>
                        {p.booking_ref && (
                          <div className="text-[11px] text-blue-600 font-mono">Booking: {p.booking_ref}</div>
                        )}
                        {p.notes && !p.booking_ref && (
                          <div className="text-[11px] text-slate-500 font-sans truncate max-w-xs">{p.notes}</div>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-slate-700 font-medium text-[13.5px]">
                        {p.payment_method}
                      </td>

                      {/* Bank Ref # */}
                      <td className="py-3 px-3.5 whitespace-nowrap font-mono text-xs text-slate-500">
                        {p.reference_no || '-'}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap font-mono font-bold text-[14.5px]">
                        <span className={isCredit ? 'text-emerald-700' : 'text-slate-900'}>
                          {isCredit ? '+' : '-'}{p.amount.toLocaleString()} <span className="text-xs text-slate-500 font-sans font-normal">{p.currency}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => onViewReceipt(p)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Print Official Payment Voucher / Receipt"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {hasRole('super_admin', 'admin', 'finance_executive') && (
                            <>
                              <button
                                onClick={() => handleOpenEditPayment(p)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit Expense / Transaction Details"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleOpenDeletePayment(p)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete Expense / Transaction"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
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

      {/* Record Payment / Expense Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg sm:text-[19px] font-bold text-slate-900 mb-1 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <span>Record Financial Payment Transaction</span>
            </h3>
            <p className="text-[13px] sm:text-sm text-slate-500 mb-4">
              Permanent double-entry transaction record. Customer receipts update booking paid amounts automatically.
            </p>

            <form onSubmit={handleSavePayment} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="col-span-2">
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Transaction Type *</label>
                  <select
                    value={formData.entity_type}
                    onChange={(e) => setFormData({ ...formData, entity_type: e.target.value as any })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-bold text-sm"
                  >
                    <option value="general_expense">🧾 Business Expense (Fuel, maintenance, office, supplies)</option>
                    <option value="customer_receipt">💵 Customer Receipt (Inflow from client/agency)</option>
                    <option value="driver_payment">👨‍✈️ Driver Payout (Outflow to chauffeur)</option>
                    <option value="supplier_payment">🏢 Supplier Payment (Outflow to fleet partner)</option>
                    <option value="refund_adjustment">↩️ Refund / Financial Adjustment</option>
                  </select>
                </div>

                {formData.entity_type === 'general_expense' && (
                  <div className="col-span-2">
                    <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Expense Category *</label>
                    <select
                      value={formData.expense_category}
                      onChange={(e) => setFormData({ ...formData, expense_category: e.target.value })}
                      className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-semibold text-sm"
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.entity_type === 'customer_receipt' && (
                  <div className="col-span-2">
                    <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Link to Booking Reference</label>
                    <select
                      value={formData.booking_id}
                      onChange={(e) => handleBookingSelected(e.target.value)}
                      className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-medium text-sm"
                    >
                      <option value="">-- General Receipt / No Specific Booking --</option>
                      {bookingsList.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.booking_ref} - {b.passenger_name} ({b.customer_name}) • Total: {b.customer_price} (Paid: {b.paid_amount})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {(formData.entity_type === 'driver_payment' || formData.entity_type === 'general_expense') && (
                  <div className="col-span-2">
                    <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">
                      {formData.entity_type === 'general_expense' ? 'Related Driver (Optional)' : 'Select Chauffeur *'}
                    </label>
                    <select
                      value={formData.entity_id}
                      onChange={(e) => handleDriverSelected(e.target.value)}
                      className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-medium text-sm"
                    >
                      <option value="">-- {formData.entity_type === 'general_expense' ? 'None / General Company Expense' : 'Select Driver'} --</option>
                      {driversList.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.full_name} ({d.driver_code}) • Payable Balance: {d.current_balance} {d.currency}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {(formData.entity_type === 'supplier_payment' || (formData.entity_type === 'general_expense' && !formData.entity_id)) && (
                  <div className="col-span-2">
                    <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">
                      {formData.entity_type === 'general_expense' ? 'Related Partner Supplier (Optional)' : 'Select Supplier Partner *'}
                    </label>
                    <select
                      value={formData.entity_id}
                      onChange={(e) => handleSupplierSelected(e.target.value)}
                      className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-medium text-sm"
                    >
                      <option value="">-- {formData.entity_type === 'general_expense' ? 'None / Internal Fleet' : 'Select Partner Supplier'} --</option>
                      {suppliersList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.supplier_code}) • Payable Balance: {s.current_balance} {s.default_currency}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="col-span-2">
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">
                    {formData.entity_type === 'general_expense' ? 'Expense Description / Payee *' : 'Entity / Account Title *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fuel for Toyota Camry Reg 1044 or SASCO Gas Station"
                    value={formData.entity_name}
                    onChange={(e) => setFormData({ ...formData, entity_name: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-medium text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Amount *</label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="any"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-bold font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-bold text-sm"
                  >
                    <option value="SAR">SAR</option>
                    <option value="AED">AED</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Payment Method *</label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-medium text-sm"
                  >
                    <option value="Cash">Cash at Counter</option>
                    <option value="Bank Transfer">Bank Transfer (Wire)</option>
                    <option value="Credit Card">Credit Card (Online)</option>
                    <option value="Mada">Mada Card</option>
                    <option value="POS">Mobile POS Machine</option>
                    <option value="Cheque">Corporate Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Transaction Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white text-sm"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Invoice # / Bank Reference #</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-9021 or SABB-TRANSFER-8812"
                    value={formData.reference_no}
                    onChange={(e) => setFormData({ ...formData, reference_no: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-mono text-sm"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Remarks / Settlement Notes</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Regular maintenance and oil filter change for vehicle"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white resize-none text-sm"
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
                  Save & Record Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ EDIT EXPENSE / PAYMENT MODAL */}
      {editModalOpen && editingPayment && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg sm:text-[19px] font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                <span>Edit Financial Record</span>
              </h3>
              <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg font-bold">
                {editingPayment.payment_ref}
              </span>
            </div>
            <p className="text-[13px] text-slate-500 mb-4">
              Update existing financial details without changing the original record ID or creation timestamp.
            </p>

            <form onSubmit={handleSaveEditPayment} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3.5">
                {editingPayment.entity_type === 'general_expense' && (
                  <div className="col-span-2">
                    <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Expense Category *</label>
                    <select
                      value={editFormData.expense_category}
                      onChange={(e) => setEditFormData({ ...editFormData, expense_category: e.target.value })}
                      className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-semibold text-sm"
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="col-span-2">
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Description / Payee *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.entity_name}
                    onChange={(e) => setEditFormData({ ...editFormData, entity_name: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-medium text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Amount *</label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="any"
                    value={editFormData.amount}
                    onChange={(e) => setEditFormData({ ...editFormData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-bold font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Currency</label>
                  <select
                    value={editFormData.currency}
                    onChange={(e) => setEditFormData({ ...editFormData, currency: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-bold text-sm"
                  >
                    <option value="SAR">SAR</option>
                    <option value="AED">AED</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Payment Method *</label>
                  <select
                    value={editFormData.payment_method}
                    onChange={(e) => setEditFormData({ ...editFormData, payment_method: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-medium text-sm"
                  >
                    <option value="Cash">Cash at Counter</option>
                    <option value="Bank Transfer">Bank Transfer (Wire)</option>
                    <option value="Credit Card">Credit Card (Online)</option>
                    <option value="Mada">Mada Card</option>
                    <option value="POS">Mobile POS Machine</option>
                    <option value="Cheque">Corporate Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Expense Date *</label>
                  <input
                    type="date"
                    required
                    value={editFormData.payment_date}
                    onChange={(e) => setEditFormData({ ...editFormData, payment_date: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white text-sm"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Reference # / Invoice #</label>
                  <input
                    type="text"
                    value={editFormData.reference_no}
                    onChange={(e) => setEditFormData({ ...editFormData, reference_no: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-mono text-sm"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Notes & Explanations</label>
                  <textarea
                    rows={2}
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white resize-none text-sm"
                  />
                </div>
              </div>

              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {editSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{editSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  disabled={editLoading}
                  className="px-4.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer text-sm min-h-[38px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow cursor-pointer text-sm min-h-[38px] transition-colors"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🗑️ DELETE EXPENSE CONFIRMATION MODAL */}
      {paymentToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete Expense Record</h3>
                <p className="text-xs text-slate-500 font-mono">{paymentToDelete.payment_ref}</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1 mb-4 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Description / Payee:</span>
                <span className="font-bold text-slate-900">{paymentToDelete.entity_name || 'Operating Expense'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Expense Date:</span>
                <span className="font-medium text-slate-800">{paymentToDelete.payment_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Category:</span>
                <span className="font-semibold text-slate-800">{paymentToDelete.expense_category || paymentToDelete.entity_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <span className="font-bold font-mono text-slate-900">
                  {paymentToDelete.amount.toLocaleString()} {paymentToDelete.currency}
                </span>
              </div>
              {paymentToDelete.reference_no && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Reference:</span>
                  <span className="font-mono text-slate-700">{paymentToDelete.reference_no}</span>
                </div>
              )}
            </div>

            {/* If protected transaction (e.g. driver payout or supplier settlement), warn */}
            {(paymentToDelete.entity_type === 'driver_payment' || paymentToDelete.entity_type === 'supplier_payment' || (paymentToDelete.entity_type === 'customer_receipt' && paymentToDelete.booking_id)) ? (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl mb-4 text-xs space-y-2 text-amber-900">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Protected Financial Record</span>
                </div>
                <p>
                  This transaction is tied to an active booking invoice or driver/supplier financial ledger statement. Direct deletion is restricted by accounting rules to prevent orphaned statement discrepancies.
                </p>
                <p className="font-semibold text-amber-800">
                  Recommendation: Use the ✏️ Edit action to adjust the amount, or record a reversal / refund adjustment entry.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-600 mb-4">
                Are you sure you want to permanently delete this expense record? This action will update all expense metrics and cannot be undone.
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

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPaymentToDelete(null)}
                disabled={deleteLoading}
                className="px-4 py-2 min-h-[38px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {!(paymentToDelete.entity_type === 'driver_payment' || paymentToDelete.entity_type === 'supplier_payment' || (paymentToDelete.entity_type === 'customer_receipt' && paymentToDelete.booking_id)) && (
                <button
                  type="button"
                  onClick={handleConfirmDeletePayment}
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
