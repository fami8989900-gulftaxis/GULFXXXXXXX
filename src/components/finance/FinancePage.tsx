import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useSync } from '../../context/SyncContext';
import { useAuth } from '../../context/AuthContext';
import { Payment, EntityType, Booking } from '../../types';
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
  Download,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface FinancePageProps {
  onViewReceipt: (p: Payment) => void;
}

export const FinancePage: React.FC<FinancePageProps> = ({ onViewReceipt }) => {
  const { syncVersion } = useSync();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [overview, setOverview] = useState<any>({ metrics: {} });
  const [activeTab, setActiveTab] = useState<EntityType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);

  // New Payment Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [bookingsList, setBookingsList] = useState<Booking[]>([]);
  const [driversList, setDriversList] = useState<any[]>([]);
  const [suppliersList, setSuppliersList] = useState<any[]>([]);

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
  });

  const fetchFinance = async () => {
    setLoading(true);
    try {
      const [pRes, oRes] = await Promise.all([
        api.getPayments({
          type: activeTab !== 'all' ? activeTab : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          search: search || undefined,
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
  }, [syncVersion, activeTab, search, startDate, endDate]);

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
        entity_type: defaultType || 'customer_receipt',
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
      fetchFinance();
    } catch (err: any) {
      alert(err.message || 'Failed to record transaction');
    }
  };

  const exportPaymentsExcel = () => {
    const rows = payments.map((p) => ({
      'Receipt #': p.payment_ref,
      'Transaction Date': p.payment_date,
      'Category': p.entity_type.replace('_', ' ').toUpperCase(),
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
            <span className="text-[13px] sm:text-[14px] font-bold uppercase tracking-wide">Driver Payouts Due</span>
            <span className="text-base">👨‍✈️</span>
          </div>
          <div className="text-[26px] sm:text-[30px] font-black font-mono text-slate-900">
            {(m.driverOutstandingPayable || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">SAR</span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">Due to completed chauffeurs</p>
        </div>
      </div>

      {/* Control Bar & Category Tabs */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3.5">
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

          <div className="flex items-center gap-2">
            <button
              onClick={exportPaymentsExcel}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold cursor-pointer min-h-[38px]"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Excel</span>
            </button>
            <button
              onClick={() => handleOpenNewPayment('customer_receipt')}
              className="flex items-center gap-2 px-4.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/20 cursor-pointer min-h-[38px]"
            >
              <Plus className="w-4 h-4" />
              <span>+ Record Payment</span>
            </button>
          </div>
        </div>

        {/* Category Tabs with Meaningful Emojis per prompt */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 text-sm font-semibold">
          {[
            { id: 'all', label: 'All Transactions' },
            { id: 'customer_receipt', label: '💵 Customer Receipts' },
            { id: 'driver_payment', label: '👨‍✈️ Driver Payments' },
            { id: 'supplier_payment', label: '🏢 Supplier Payments' },
            { id: 'general_expense', label: '🧾 Business Expenses' },
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

        {/* Search & Date Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm pt-1">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search reference #, client name, booking ref, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm text-slate-900 min-h-[38px]"
            />
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <span className="text-slate-500 text-sm font-medium">Date:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 min-h-[38px]"
            />
            <span className="text-slate-400 text-sm">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 min-h-[38px]"
            />
          </div>
        </div>
      </div>

      {/* COMPACT SINGLE-LINE FINANCE TABLE - FULL AVAILABLE WIDTH */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-auto text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-slate-100 via-slate-50 to-blue-50/50 border-b border-slate-200 text-slate-700 font-semibold text-[13.5px] tracking-normal whitespace-nowrap">
                <th className="py-3 px-3.5">🔖 Receipt Ref</th>
                <th className="py-3 px-3.5">🗓️ Date</th>
                <th className="py-3 px-3.5">🏷️ Category</th>
                <th className="py-3 px-3.5">👤 Entity / Account</th>
                <th className="py-3 px-3.5">🔗 Linked Booking</th>
                <th className="py-3 px-3.5">💳 Payment Method</th>
                <th className="py-3 px-3.5">🔢 Bank Ref #</th>
                <th className="py-3 px-3.5 text-right">💰 Amount</th>
                <th className="py-3 px-3.5 text-center">🧾 Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-medium text-sm">
                    No transactions match the selected filters.
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
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {p.entity_type === 'customer_receipt' && '💵 '}
                          {p.entity_type === 'driver_payment' && '👨‍✈️ '}
                          {p.entity_type === 'supplier_payment' && '🏢 '}
                          {p.entity_type === 'general_expense' && '🧾 '}
                          {p.entity_type === 'refund_adjustment' && '↩️ '}
                          {p.entity_type.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>

                      {/* Entity / Account */}
                      <td className="py-3 px-3.5 font-semibold text-slate-900 whitespace-nowrap text-[14.5px]">
                        {p.entity_name || 'N/A'}
                      </td>

                      {/* Linked Booking */}
                      <td className="py-3 px-3.5 whitespace-nowrap font-mono text-blue-600 font-bold text-[13.5px]">
                        {p.booking_ref || '-'}
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

                      {/* Receipt Action */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <button
                          onClick={() => onViewReceipt(p)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Print Official Payment Receipt"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
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
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Transaction Category *</label>
                  <select
                    value={formData.entity_type}
                    onChange={(e) => setFormData({ ...formData, entity_type: e.target.value as any })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-bold text-sm"
                  >
                    <option value="customer_receipt">💵 Customer Receipt (Inflow from client/agency)</option>
                    <option value="driver_payment">👨‍✈️ Driver Payout (Outflow to chauffeur)</option>
                    <option value="supplier_payment">🏢 Supplier Payment (Outflow to fleet partner)</option>
                    <option value="general_expense">🧾 General Business Expense (Fuel, office, maintenance)</option>
                    <option value="refund_adjustment">↩️ Refund / Financial Adjustment</option>
                  </select>
                </div>

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

                {formData.entity_type === 'driver_payment' && (
                  <div className="col-span-2">
                    <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Select Chauffeur</label>
                    <select
                      value={formData.entity_id}
                      onChange={(e) => handleDriverSelected(e.target.value)}
                      className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-medium text-sm"
                    >
                      <option value="">-- Select Driver --</option>
                      {driversList.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.full_name} ({d.driver_code}) • Current Payable Due: {d.current_balance} {d.currency}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.entity_type === 'supplier_payment' && (
                  <div className="col-span-2">
                    <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Select Supplier Partner</label>
                    <select
                      value={formData.entity_id}
                      onChange={(e) => handleSupplierSelected(e.target.value)}
                      className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-medium text-sm"
                    >
                      <option value="">-- Select Partner Supplier --</option>
                      {suppliersList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.supplier_code}) • Current Payable Due: {s.current_balance} {s.default_currency}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="col-span-2">
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Entity / Account Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Al-Rajhi Corporate Travel or Driver Name"
                    value={formData.entity_name}
                    onChange={(e) => setFormData({ ...formData, entity_name: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-medium text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Payment Amount *</label>
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
                    <option value="USD">USD</option>
                    <option value="AED">AED</option>
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
                    <option value="Bank Transfer">Bank Transfer (Wire)</option>
                    <option value="Credit Card">Credit Card (Online)</option>
                    <option value="Mada">Mada Card</option>
                    <option value="Cash">Cash at Counter</option>
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
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Bank Reference # / Cheque #</label>
                  <input
                    type="text"
                    placeholder="e.g. SABB-WIRE-981240"
                    value={formData.reference_no}
                    onChange={(e) => setFormData({ ...formData, reference_no: e.target.value })}
                    className="w-full min-h-[40px] px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-mono text-sm"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Remarks / Settlement Notes</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Advance partial payment for VIP airport transfer"
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
    </div>
  );
};
