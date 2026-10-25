import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { useSync } from '../../context/SyncContext';
import {
  BarChart3,
  Calendar,
  Download,
  Printer,
  Filter,
  Search,
  CheckSquare,
  Square,
  FileSpreadsheet,
  FileText,
  DollarSign,
  TrendingUp,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Layers,
  Plane,
  MapPin,
  Car,
  User,
  Building2,
  Clock,
  ShieldCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Driver, Vehicle, Supplier } from '../../types';

interface ReportConfig {
  id: string;
  name: string;
  emoji: string;
  group: 'Bookings' | 'Operations' | 'Finance' | 'Administration';
  description: string;
  defaultSortBy: string;
}

export const ReportsPage: React.FC = () => {
  const { syncVersion } = useSync();

  // Active Report
  const [selectedReport, setSelectedReport] = useState<string>('booking_register');
  const [reportSearchQuery, setReportSearchQuery] = useState<string>('');

  // Common Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [quickSearch, setQuickSearch] = useState<string>('');

  // Context-specific Filters
  const [selectedDriverId, setSelectedDriverId] = useState<string>('all');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all');
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>('all');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('all');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('all');
  const [flightNumberFilter, setFlightNumberFilter] = useState<string>('');
  const [specificDate, setSpecificDate] = useState<string>('');

  // Dropdown options loaded from DB
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Sorting State
  const [sortBy, setSortBy] = useState<string>('pickup_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Column Customization Modal
  const [columnModalOpen, setColumnModalOpen] = useState<boolean>(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({});

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Data & Loading
  const [reportData, setReportData] = useState<{ records: any[]; summary: Record<string, any> }>({ records: [], summary: {} });
  const [loading, setLoading] = useState<boolean>(true);

  // Report Catalog Definition
  const reportList: ReportConfig[] = [
    // 📅 Booking Reports
    { id: 'booking_register', name: 'Booking Register', emoji: '📋', group: 'Bookings', description: 'Comprehensive registry of all customer transport bookings', defaultSortBy: 'pickup_date' },
    { id: 'daily_booking', name: 'Daily Booking Report', emoji: '🗓️', group: 'Bookings', description: 'Scheduled single-day operational dispatch manifests', defaultSortBy: 'pickup_time' },
    { id: 'monthly_booking', name: 'Monthly Booking Summary', emoji: '📆', group: 'Bookings', description: 'Monthly turnover, volume trends, and gross margin totals', defaultSortBy: 'pickup_date' },
    { id: 'date_wise_trips', name: 'Date-wise Trip Report', emoji: '📅', group: 'Bookings', description: 'Trips partitioned by dates with financial cost breakdowns', defaultSortBy: 'pickup_date' },
    { id: 'completed_trips', name: 'Completed Trips Report', emoji: '✅', group: 'Bookings', description: 'Audited log of successfully delivered chauffeur journeys', defaultSortBy: 'pickup_date' },
    { id: 'cancelled_trips', name: 'Cancelled Trips Report', emoji: '❌', group: 'Bookings', description: 'Voided reservations with dispatcher cancellation remarks', defaultSortBy: 'pickup_date' },

    // 🚘 Operations Reports
    { id: 'route_wise', name: 'Route-wise Analysis', emoji: '🗺️', group: 'Operations', description: 'Airport & hotel route frequencies, demand, and yield', defaultSortBy: 'trip_count' },
    { id: 'flight_wise', name: 'Flight-wise Schedule', emoji: '✈️', group: 'Operations', description: 'Terminal arrival and departure flights manifest', defaultSortBy: 'pickup_date' },
    { id: 'driver_wise', name: 'Driver Performance Report', emoji: '🧑✈️', group: 'Operations', description: 'Driver trip counts, completed rates, and balances', defaultSortBy: 'total_trips' },
    { id: 'vehicle_wise', name: 'Fleet Utilization Report', emoji: '🚐', group: 'Operations', description: 'Vehicle operational days, mileage, and revenue yield', defaultSortBy: 'total_trips' },

    // 🏢 Supplier and Finance Reports
    { id: 'supplier_wise', name: 'Supplier Purchase Report', emoji: '🏢', group: 'Finance', description: 'Vendor transport purchase totals, payouts, and balances', defaultSortBy: 'total_cost' },
    { id: 'customer_payment_report', name: 'Customer Payment Report', emoji: '💳', group: 'Finance', description: 'Itemized customer payment receipts and remittance log', defaultSortBy: 'payment_date' },
    { id: 'outstanding_balances', name: 'Outstanding Balances (Receivables)', emoji: '⚠️', group: 'Finance', description: 'Uncollected customer trip receivables and ageing', defaultSortBy: 'outstanding_balance' },
    { id: 'profit_and_loss', name: 'Profit & Loss Statement (P&L)', emoji: '📈', group: 'Finance', description: 'Executive revenue, cost of sales, and net income', defaultSortBy: 'category' },

    // 🛡️ Administration Reports
    { id: 'user_activity_report', name: 'User Audit & Activity Log', emoji: '👤', group: 'Administration', description: 'System security audit trail of staff actions and edits', defaultSortBy: 'timestamp' },
  ];

  // Load auxiliary data (drivers, vehicles, suppliers) once
  useEffect(() => {
    const loadAuxData = async () => {
      try {
        const [dRes, vRes, sRes] = await Promise.all([
          api.getDrivers(),
          api.getVehicles(),
          api.getSuppliers(),
        ]);
        setDrivers(dRes.drivers || []);
        setVehicles(vRes.vehicles || []);
        setSuppliers(sRes.suppliers || []);
      } catch (err) {
        console.error('Error loading filter options:', err);
      }
    };
    loadAuxData();
  }, [syncVersion]);

  // Set default sorting when report changes
  useEffect(() => {
    const currentConf = reportList.find((r) => r.id === selectedReport);
    if (currentConf) {
      setSortBy(currentConf.defaultSortBy);
      setSortOrder('desc');
    }
    setCurrentPage(1);
    setVisibleColumns({});
  }, [selectedReport]);

  // Fetch report data from server
  const fetchReport = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        startDate: specificDate || startDate || undefined,
        endDate: specificDate || endDate || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        paymentStatus: paymentFilter !== 'all' ? paymentFilter : undefined,
        driverId: selectedDriverId !== 'all' ? selectedDriverId : undefined,
        vehicleId: selectedVehicleId !== 'all' ? selectedVehicleId : undefined,
        vehicleType: selectedVehicleType !== 'all' ? selectedVehicleType : undefined,
        supplierId: selectedSupplierId !== 'all' ? selectedSupplierId : undefined,
        currency: selectedCurrency !== 'all' ? selectedCurrency : undefined,
        flightNumber: flightNumberFilter || undefined,
        search: quickSearch || undefined,
      };

      const res = await api.getReport(selectedReport, params);
      setReportData({
        records: res.records || [],
        summary: res.summary || {},
      });

      // Initialize visible columns if empty
      if (res.records && res.records.length > 0 && Object.keys(visibleColumns).length === 0) {
        const initialCols: Record<string, boolean> = {};
        Object.keys(res.records[0]).forEach((k) => {
          // Hide internal technical IDs by default unless needed
          if (k === 'id' || k === 'created_at' || k === 'updated_at' || k === 'password_hash') {
            initialCols[k] = false;
          } else {
            initialCols[k] = true;
          }
        });
        setVisibleColumns(initialCols);
      }
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [
    syncVersion,
    selectedReport,
    startDate,
    endDate,
    specificDate,
    statusFilter,
    paymentFilter,
    selectedDriverId,
    selectedVehicleId,
    selectedVehicleType,
    selectedSupplierId,
    selectedCurrency,
    flightNumberFilter,
    quickSearch,
  ]);

  // Filtered & Sorted Client Data
  const sortedRecords = useMemo(() => {
    let list = [...(reportData.records || [])];

    if (!sortBy) return list;

    list.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      // Numeric comparison
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      // Date string comparison
      if (typeof valA === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valA) && /^\d{4}-\d{2}-\d{2}/.test(valB)) {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      // String comparison
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });

    return list;
  }, [reportData.records, sortBy, sortOrder]);

  // Pagination calculation
  const totalRecords = sortedRecords.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  // Toggle header sort
  const handleSortHeader = (key: string) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSpecificDate('');
    setStatusFilter('all');
    setPaymentFilter('all');
    setQuickSearch('');
    setSelectedDriverId('all');
    setSelectedVehicleId('all');
    setSelectedVehicleType('all');
    setSelectedSupplierId('all');
    setSelectedCurrency('all');
    setFlightNumberFilter('');
    setCurrentPage(1);
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (sortedRecords.length === 0) {
      alert('No records available to export.');
      return;
    }

    // Filter by visible columns
    const activeCols = Object.keys(visibleColumns).filter((k) => visibleColumns[k]);
    const exportRows = sortedRecords.map((row) => {
      const formatted: Record<string, any> = {};
      activeCols.forEach((col) => {
        formatted[col.replace(/_/g, ' ').toUpperCase()] = row[col];
      });
      return formatted;
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    const sheetName = selectedReport.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(
      wb,
      `Gulf_Taxis_${selectedReport}_${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (sortedRecords.length === 0) return;
    const activeCols = Object.keys(visibleColumns).filter((k) => visibleColumns[k]);
    const headers = activeCols.map((c) => `"${c.replace(/_/g, ' ').toUpperCase()}"`).join(',');
    const rows = sortedRecords.map((r) =>
      activeCols
        .map((k) => `"${(r[k] !== undefined && r[k] !== null ? String(r[k]) : '').replace(/"/g, '""')}"`)
        .join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Gulf_Taxis_${selectedReport}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to PDF
  const handleExportPdf = () => {
    if (sortedRecords.length === 0) return;
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(16);
    doc.setTextColor(11, 19, 43); // Navy #0b132b
    doc.text(`GULF TAXIS — ${selectedReport.replace(/_/g, ' ').toUpperCase()}`, 14, 18);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Generated: ${new Date().toLocaleString()} | Period: ${startDate || 'All Time'} to ${endDate || 'Present'} | Records: ${totalRecords}`,
      14,
      24
    );

    const activeCols = Object.keys(visibleColumns).filter((k) => visibleColumns[k]).slice(0, 10);
    const head = [activeCols.map((k) => k.replace(/_/g, ' ').toUpperCase())];
    const body = sortedRecords.slice(0, 120).map((r: any) => activeCols.map((k) => String(r[k] ?? '')));

    autoTable(doc, {
      startY: 28,
      head,
      body,
      theme: 'striped',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [11, 19, 43], textColor: [255, 255, 255] },
    });

    doc.save(`Gulf_Taxis_${selectedReport}.pdf`);
  };

  // Native Print
  const handlePrint = () => {
    window.print();
  };

  // Filter report list by search query
  const filteredReportList = useMemo(() => {
    if (!reportSearchQuery.trim()) return reportList;
    const q = reportSearchQuery.toLowerCase();
    return reportList.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.group.toLowerCase().includes(q)
    );
  }, [reportList, reportSearchQuery]);

  const currentReportObj = reportList.find((r) => r.id === selectedReport) || reportList[0];

  // Helper badge stylers
  const renderCellContent = (key: string, val: any) => {
    if (val === null || val === undefined) return <span className="text-slate-300">-</span>;

    if (key.includes('status') || key === 'status') {
      const s = String(val);
      if (s === 'Trip Completed' || s === 'available' || s === 'paid' || s === 'active') {
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
            <span>🟢</span>
            <span>{s}</span>
          </span>
        );
      }
      if (s === 'Awaiting Assignment' || s === 'partial' || s === 'maintenance') {
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full font-bold text-[10px]">
            <span>🟠</span>
            <span>{s}</span>
          </span>
        );
      }
      if (s === 'Cancelled' || s === 'unpaid' || s === 'inactive') {
        return (
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
            <span>🔴</span>
            <span>{s}</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
          <span>🔵</span>
          <span>{s}</span>
        </span>
      );
    }

    if (key === 'booking_ref' || key === 'flight_number' || key === 'driver_code' || key === 'supplier_code') {
      return <span className="font-mono font-bold text-blue-600">{String(val)}</span>;
    }

    if (typeof val === 'number') {
      return <span className="font-mono font-semibold text-slate-900">{val.toLocaleString()}</span>;
    }

    return String(val);
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Bar with Controls */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-2xl">{currentReportObj.emoji}</span>
            <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight">
              Reports & Analytics Centre
            </h1>
            <span className="bg-indigo-50 text-indigo-800 text-[12.5px] font-bold px-3 py-1 rounded-full border border-indigo-200">
              {currentReportObj.name}
            </span>
          </div>
          <p className="text-[13.5px] text-slate-500 mt-1">
            Real-time business intelligence, dynamic filters, column customization, and multi-format exports
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {/* Column Chooser */}
          <button
            onClick={() => setColumnModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer text-sm"
            title="Choose visible report columns"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-600" />
            <span>🧩 Choose Columns</span>
          </button>

          {/* Export to Excel */}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer text-sm"
            title="Export report to Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Excel (.xlsx)</span>
          </button>

          {/* Export to CSV */}
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer text-sm"
            title="Export to CSV"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>CSV</span>
          </button>

          {/* Export to PDF */}
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer text-sm"
            title="Export formatted PDF"
          >
            <FileText className="w-4 h-4 text-rose-600" />
            <span>PDF</span>
          </button>

          {/* Print */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 min-h-[38px] bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer text-sm"
            title="Print report"
          >
            <Printer className="w-4 h-4" />
            <span>🖨️ Print</span>
          </button>
        </div>
      </div>

      {/* 2. Attractive Small Report Widgets Selector */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Select Operational Report</span>
            </span>
            <span className="text-xs text-slate-500 font-medium">
              ({reportList.length} report modules connected)
            </span>
          </div>

          {/* Report Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="🔍 Search reports..."
              value={reportSearchQuery}
              onChange={(e) => setReportSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 min-h-[38px] bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {/* Small Report Widgets Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 pt-1">
          {filteredReportList.map((r) => {
            const isSelected = selectedReport === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedReport(r.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between group min-h-[82px] ${
                  isSelected
                    ? 'bg-blue-50/80 border-blue-500 shadow-xs ring-2 ring-blue-500/20'
                    : 'bg-white border-slate-200/90 hover:border-blue-300 hover:bg-slate-50/70'
                }`}
              >
                <div className="flex items-start justify-between gap-1 mb-1.5">
                  <span className="text-lg shrink-0 group-hover:scale-110 transition-transform">
                    {r.emoji}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      r.group === 'Bookings'
                        ? 'bg-blue-100/80 text-blue-800'
                        : r.group === 'Operations'
                        ? 'bg-emerald-100/80 text-emerald-800'
                        : r.group === 'Finance'
                        ? 'bg-purple-100/80 text-purple-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {r.group}
                  </span>
                </div>
                <div>
                  <div
                    className={`text-[13.5px] font-bold truncate leading-snug ${
                      isSelected ? 'text-blue-900' : 'text-slate-800 group-hover:text-blue-600'
                    }`}
                  >
                    {r.name}
                  </div>
                  <div className="text-xs text-slate-500 truncate mt-0.5 font-medium">
                    {r.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Advanced Report Filters & Sorting Control Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-sm font-bold text-slate-900">
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-blue-600" />
            <span className="text-sm sm:text-[14.5px]">Advanced Filters for {currentReportObj.name}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetFilters}
              className="text-xs sm:text-[13px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer font-bold px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
            <button
              onClick={fetchReport}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 min-h-[36px] bg-blue-50 text-blue-700 font-bold rounded-xl border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer text-xs sm:text-[13px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Apply Filters</span>
            </button>
          </div>
        </div>

        {/* Filter Fields Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
          {/* Quick Search */}
          <div className="lg:col-span-2">
            <label className="block text-[13px] font-bold text-slate-700 mb-1.5">🔍 Quick Search</label>
            <input
              type="text"
              placeholder="Ref, passenger, route, flight, notes..."
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              className="w-full px-3 py-2 min-h-[38px] bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
            />
          </div>

          {/* Date Range Start */}
          <div>
            <label className="block text-[13px] font-bold text-slate-700 mb-1.5">📅 Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 min-h-[38px] bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>

          {/* Date Range End */}
          <div>
            <label className="block text-[13px] font-bold text-slate-700 mb-1.5">📅 End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 min-h-[38px] bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>

          {/* Trip Status filter */}
          <div>
            <label className="block text-[13px] font-bold text-slate-700 mb-1.5">🚦 Trip Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 min-h-[38px] bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="Awaiting Assignment">🟠 Awaiting Assignment</option>
              <option value="Assigned">🔵 Assigned</option>
              <option value="Driver Notified">📲 Driver Notified</option>
              <option value="Driver on the Way">🚗 En Route</option>
              <option value="Trip Completed">🟢 Completed</option>
              <option value="Cancelled">🔴 Cancelled</option>
            </select>
          </div>

          {/* Payment Status filter */}
          <div>
            <label className="block text-[13px] font-bold text-slate-700 mb-1.5">💳 Payment Status</label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full px-3 py-2 min-h-[38px] bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
            >
              <option value="all">All Payments</option>
              <option value="paid">🟢 Paid</option>
              <option value="partial">🟡 Partial</option>
              <option value="unpaid">🔴 Unpaid</option>
            </select>
          </div>
        </div>

        {/* Dynamic Context-Specific Filter Row */}
        {(selectedReport === 'driver_wise' ||
          selectedReport === 'vehicle_wise' ||
          selectedReport === 'supplier_wise' ||
          selectedReport === 'flight_wise' ||
          selectedReport === 'daily_booking' ||
          selectedReport === 'booking_register' ||
          selectedReport === 'completed_trips') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-sm">
            {/* Driver Filter */}
            {(selectedReport === 'driver_wise' || selectedReport === 'booking_register' || selectedReport === 'completed_trips') && (
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">🧑✈️ Filter Driver</label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full px-3 py-2 min-h-[38px] bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                >
                  <option value="all">All Chauffeurs</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name} ({d.driver_code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Vehicle Type Filter */}
            {(selectedReport === 'vehicle_wise' || selectedReport === 'booking_register') && (
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">🚐 Vehicle Type</label>
                <select
                  value={selectedVehicleType}
                  onChange={(e) => setSelectedVehicleType(e.target.value)}
                  className="w-full px-3 py-2 min-h-[38px] bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                >
                  <option value="all">All Vehicle Types</option>
                  <option value="Sedan (Camry / Lexus ES)">Sedan</option>
                  <option value="SUV (Yukon / Tahoe)">SUV</option>
                  <option value="Hyundai Staria VIP">Hyundai Staria VIP</option>
                  <option value="Toyota Coaster Minibus">Toyota Coaster Minibus</option>
                </select>
              </div>
            )}

            {/* Supplier Filter */}
            {(selectedReport === 'supplier_wise' || selectedReport === 'booking_register') && (
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">🏢 Filter Supplier</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 min-h-[38px] bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                >
                  <option value="all">All Suppliers</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.supplier_code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Flight Filter */}
            {selectedReport === 'flight_wise' && (
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">✈️ Flight Number</label>
                <input
                  type="text"
                  placeholder="e.g. SV 1024, EK 805"
                  value={flightNumberFilter}
                  onChange={(e) => setFlightNumberFilter(e.target.value)}
                  className="w-full px-3 py-2 min-h-[38px] bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
            )}

            {/* Specific Day Picker */}
            {selectedReport === 'daily_booking' && (
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">🗓️ Specific Manifest Date</label>
                <input
                  type="date"
                  value={specificDate}
                  onChange={(e) => setSpecificDate(e.target.value)}
                  className="w-full px-3 py-2 min-h-[38px] bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
            )}
          </div>
        )}

        {/* Sorting Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-sm">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-bold text-slate-700 flex items-center gap-1.5 text-sm">
              <ArrowUpDown className="w-4 h-4 text-blue-600" />
              <span>Sort By:</span>
            </span>

            {/* Field Selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 min-h-[38px] bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm"
            >
              {reportData.records && reportData.records.length > 0 ? (
                Object.keys(reportData.records[0]).map((key) => (
                  <option key={key} value={key}>
                    {key.replace(/_/g, ' ').toUpperCase()}
                  </option>
                ))
              ) : (
                <option value="pickup_date">Pickup Date</option>
              )}
            </select>

            {/* Ascending / Descending Toggle Buttons */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setSortOrder('asc')}
                className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[32px] rounded-lg font-bold transition-all cursor-pointer text-xs sm:text-[13px] ${
                  sortOrder === 'asc'
                    ? 'bg-white text-blue-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Ascending (A-Z / Oldest / Smallest)"
              >
                <ArrowUp className="w-3.5 h-3.5" />
                <span>⬆️ Ascending</span>
              </button>
              <button
                onClick={() => setSortOrder('desc')}
                className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[32px] rounded-lg font-bold transition-all cursor-pointer text-xs sm:text-[13px] ${
                  sortOrder === 'desc'
                    ? 'bg-white text-blue-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Descending (Z-A / Newest / Largest)"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                <span>⬇️ Descending</span>
              </button>
            </div>
          </div>

          <div className="text-slate-500 font-medium text-xs sm:text-[13px]">
            Showing <strong className="text-slate-900 font-bold">{paginatedRecords.length}</strong> of{' '}
            <strong className="text-slate-900 font-bold">{totalRecords}</strong> records
          </div>
        </div>
      </div>

      {/* 4. Financial & Summary KPI Dashboard Cards */}
      {reportData.summary && Object.keys(reportData.summary).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Object.entries(reportData.summary).map(([key, val]: any, i) => {
            const isHighlight = key.toLowerCase().includes('profit') || key.toLowerCase().includes('revenue');
            return (
              <div
                key={key}
                className={`p-3.5 rounded-xl border shadow-xs flex flex-col justify-between ${
                  isHighlight
                    ? 'bg-gradient-to-br from-[#0b132b] to-blue-950 text-white border-slate-800'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className={`text-xs font-bold truncate uppercase tracking-wider ${isHighlight ? 'text-blue-300' : 'text-slate-500'}`}>
                  {key.replace(/([A-Z])/g, ' $1')}
                </div>
                <div className={`text-2xl sm:text-[28px] font-black font-mono mt-1.5 truncate ${isHighlight ? 'text-emerald-400' : 'text-slate-900'}`}>
                  {typeof val === 'number' ? val.toLocaleString() : String(val)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Compact Single-Line Report Results Table - Full Available Width */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left table-auto text-sm border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-slate-100 via-slate-50 to-blue-50/50 border-b border-slate-200 text-slate-700 uppercase font-semibold text-[13.5px] tracking-wider whitespace-nowrap">
                {reportData.records && reportData.records.length > 0 ? (
                  Object.keys(reportData.records[0])
                    .filter((col) => visibleColumns[col] !== false)
                    .map((key) => {
                      const isCurrentSort = sortBy === key;
                      return (
                        <th
                          key={key}
                          onClick={() => handleSortHeader(key)}
                          className="py-3 px-3.5 cursor-pointer hover:bg-blue-100/40 select-none transition-colors"
                          title="Click to sort by this column"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{key.replace(/_/g, ' ')}</span>
                            {isCurrentSort ? (
                              sortOrder === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                            )}
                          </div>
                        </th>
                      );
                    })
                ) : (
                  <th className="py-3 px-3.5 text-sm font-semibold uppercase">No Columns</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-blue-600" />
                    <span className="text-sm font-medium">Querying real database records...</span>
                  </td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-700 text-sm">No records found for the selected parameters.</p>
                    <button
                      onClick={handleResetFilters}
                      className="mt-2 text-sm font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      Reset All Filters
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((row: any, idx: number) => {
                  const activeCols = Object.keys(row).filter((col) => visibleColumns[col] !== false);
                  return (
                    <tr key={idx} className="hover:bg-blue-50/40 transition-colors group">
                      {activeCols.map((colKey) => (
                        <td key={colKey} className="py-3 px-3.5 whitespace-nowrap text-slate-800 text-sm">
                          {renderCellContent(colKey, row[colKey])}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3.5 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-slate-400">|</span>
            <span className="text-slate-600 font-medium">
              Page <strong className="text-slate-900 font-bold">{currentPage}</strong> of{' '}
              <strong className="text-slate-900 font-bold">{totalPages}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-colors text-sm min-h-[36px]"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-colors text-sm min-h-[36px]"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Column Customizer Modal */}
      {columnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-slate-900 text-lg sm:text-[19px]">
                  Customize Visible Columns ({currentReportObj.name})
                </h3>
              </div>
              <button
                onClick={() => setColumnModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <p className="text-[13px] text-slate-500 mb-3">
                Select the column fields you want to view and export in this report:
              </p>
              <div className="grid grid-cols-2 gap-2.5 text-sm">
                {Object.keys(visibleColumns).map((col) => (
                  <label
                    key={col}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-blue-50/50 cursor-pointer select-none transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns[col] !== false}
                      onChange={() =>
                        setVisibleColumns((prev) => ({
                          ...prev,
                          [col]: !prev[col],
                        }))
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                    />
                    <span className="font-semibold text-slate-800 capitalize text-sm">
                      {col.replace(/_/g, ' ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between">
              <button
                onClick={() => {
                  const allOn: Record<string, boolean> = {};
                  Object.keys(visibleColumns).forEach((k) => (allOn[k] = true));
                  setVisibleColumns(allOn);
                }}
                className="text-sm font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Select All
              </button>
              <button
                onClick={() => setColumnModalOpen(false)}
                className="px-5 py-2 min-h-[38px] bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow cursor-pointer transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
