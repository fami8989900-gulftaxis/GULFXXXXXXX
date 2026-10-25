import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { useSync } from '../../context/SyncContext';
import { useAuth } from '../../context/AuthContext';
import {
  CalendarDays,
  Send,
  Users,
  Car,
  Building2,
  CreditCard,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  ArrowUpRight,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  Activity,
  Eye,
  Edit2,
  Printer,
  Download,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  GripVertical,
  Lock,
  Unlock,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Booking } from '../../types';

interface DashboardPageProps {
  onNavigate: (module: string) => void;
  onOpenNewBooking: () => void;
  onViewBooking: (b: Booking) => void;
  onEditBooking?: (b: Booking) => void;
}

const DEFAULT_WIDGET_IDS = [
  'today_bookings',
  'active_trips',
  'awaiting_driver',
  'completed_trips',
  'active_drivers',
  'fleet_available',
  'receivables',
  'revenue',
];

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onOpenNewBooking,
  onViewBooking,
  onEditBooking,
}) => {
  const { syncVersion } = useSync();
  const { user, hasPermission } = useAuth();

  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Table controls & filters
  const [tableSearch, setTableSearch] = useState('');
  const [tableStatusFilter, setTableStatusFilter] = useState('all');
  const [tablePaymentFilter, setTablePaymentFilter] = useState('all');
  const [tablePickupDate, setTablePickupDate] = useState('');
  const [tableSortBy, setTableSortBy] = useState<'datetime-desc' | 'datetime-asc' | 'ref' | 'price-desc'>('datetime-desc');

  // Drag and Drop & Widget Order State
  const storageKey = `gulf_taxis_widget_layout_${user?.id || 'default'}`;
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === DEFAULT_WIDGET_IDS.length && parsed.every((id) => DEFAULT_WIDGET_IDS.includes(id))) {
          return parsed;
        }
      }
    } catch (e) {
      // ignore
    }
    return DEFAULT_WIDGET_IDS;
  });

  const [isLayoutLocked, setIsLayoutLocked] = useState<boolean>(true);
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<string | null>(null);
  const [layoutNotification, setLayoutNotification] = useState<string | null>(null);

  const [stats, setStats] = useState({
    todayBookings: 0,
    activeTrips: 0,
    awaitingAssignment: 0,
    completedTrips: 0,
    availableDrivers: 0,
    availableVehicles: 0,
    pendingPayments: 0,
    monthlyRevenue: 0,
    totalBookings: 0,
    cancelledTrips: 0,
  });

  const [allFetchedBookings, setAllFetchedBookings] = useState<Booking[]>([]);

  const loadDashboardData = async (manualRefresh = false) => {
    if (manualRefresh) setIsRefreshing(true);
    else setLoading(true);

    try {
      const todayStr = new Date().toISOString().split('T')[0];

      let startDate = '';
      if (dateFilter === 'today') {
        startDate = todayStr;
      } else if (dateFilter === 'week') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        startDate = d.toISOString().split('T')[0];
      } else if (dateFilter === 'month') {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        startDate = d.toISOString().split('T')[0];
      }

      const [bookingsRes, driversRes, vehiclesRes, financeRes] = await Promise.all([
        api.getBookings({ startDate: startDate || undefined, limit: 150 }),
        api.getDrivers(),
        api.getVehicles(),
        api.getFinanceOverview({ startDate: startDate || undefined }).catch(() => ({ metrics: {} })),
      ]);

      const allBookings: Booking[] = bookingsRes.bookings || [];
      const drivers = driversRes.drivers || [];
      const vehicles = vehiclesRes.vehicles || [];
      const metrics = financeRes.metrics || {};

      const todayList = allBookings.filter((b) => b.pickup_date === todayStr);
      const awaitingList = allBookings.filter(
        (b) => (!b.driver_id || b.driver_id === '') && b.trip_status !== 'Cancelled' && b.trip_status !== 'Trip Completed'
      );
      const activeList = allBookings.filter(
        (b) => b.driver_id && b.trip_status !== 'Cancelled' && b.trip_status !== 'Trip Completed'
      );
      const completedList = allBookings.filter((b) => b.trip_status === 'Trip Completed');
      const cancelledList = allBookings.filter((b) => b.trip_status === 'Cancelled');

      setStats({
        todayBookings: todayList.length,
        activeTrips: activeList.length,
        awaitingAssignment: awaitingList.length,
        completedTrips: completedList.length,
        availableDrivers: drivers.filter((d: any) => d.is_active === 1).length,
        availableVehicles: vehicles.filter((v: any) => v.status === 'available').length,
        pendingPayments: metrics.outstandingReceivables || 0,
        monthlyRevenue: metrics.bookedRevenue || allBookings.reduce((s, b) => s + (b.customer_price || 0), 0),
        totalBookings: allBookings.length,
        cancelledTrips: cancelledList.length,
      });

      setAllFetchedBookings(allBookings);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [syncVersion, dateFilter]);

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (isLayoutLocked) return;
    setDraggedWidgetId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    if (isLayoutLocked) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverWidgetId !== id) {
      setDragOverWidgetId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (isLayoutLocked || !draggedWidgetId || draggedWidgetId === targetId) {
      setDraggedWidgetId(null);
      setDragOverWidgetId(null);
      return;
    }

    const oldIndex = widgetOrder.indexOf(draggedWidgetId);
    const newIndex = widgetOrder.indexOf(targetId);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = [...widgetOrder];
    const [removed] = newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, removed);

    setWidgetOrder(newOrder);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newOrder));
      setLayoutNotification('✅ Widget layout saved to your device');
      setTimeout(() => setLayoutNotification(null), 2500);
    } catch (err) {
      console.error('Could not save widget layout:', err);
    }

    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
  };

  const handleResetLayout = () => {
    setWidgetOrder(DEFAULT_WIDGET_IDS);
    try {
      localStorage.removeItem(storageKey);
      setLayoutNotification('↩️ Dashboard layout restored to default');
      setTimeout(() => setLayoutNotification(null), 2500);
    } catch (err) {
      console.error('Could not reset layout:', err);
    }
  };

  const handleShiftWidget = (id: string, direction: 'prev' | 'next', e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = widgetOrder.indexOf(id);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= widgetOrder.length) return;

    const newOrder = [...widgetOrder];
    const [removed] = newOrder.splice(currentIndex, 1);
    newOrder.splice(targetIndex, 0, removed);

    setWidgetOrder(newOrder);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newOrder));
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered & sorted live feed records
  const filteredBookings = useMemo(() => {
    let list = [...allFetchedBookings];

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      list = list.filter((b) =>
        (b.booking_ref && b.booking_ref.toLowerCase().includes(q)) ||
        (b.supplier_reference && b.supplier_reference.toLowerCase().includes(q)) ||
        (b.passenger_name && b.passenger_name.toLowerCase().includes(q)) ||
        (b.contact_number && b.contact_number.toLowerCase().includes(q)) ||
        (b.pickup_location && b.pickup_location.toLowerCase().includes(q)) ||
        (b.dropoff_location && b.dropoff_location.toLowerCase().includes(q)) ||
        (b.flight_number && b.flight_number.toLowerCase().includes(q)) ||
        (b.driver_name && b.driver_name.toLowerCase().includes(q)) ||
        (b.vehicle_type && b.vehicle_type.toLowerCase().includes(q))
      );
    }

    if (tableStatusFilter !== 'all') {
      list = list.filter((b) => b.trip_status === tableStatusFilter);
    }

    if (tablePaymentFilter !== 'all') {
      list = list.filter((b) => b.payment_status === tablePaymentFilter);
    }

    if (tablePickupDate) {
      list = list.filter((b) => b.pickup_date === tablePickupDate);
    }

    list.sort((a, b) => {
      if (tableSortBy === 'datetime-desc') {
        const timeA = `${a.pickup_date} ${a.pickup_time || '00:00'}`;
        const timeB = `${b.pickup_date} ${b.pickup_time || '00:00'}`;
        return timeB.localeCompare(timeA);
      }
      if (tableSortBy === 'datetime-asc') {
        const timeA = `${a.pickup_date} ${a.pickup_time || '00:00'}`;
        const timeB = `${b.pickup_date} ${b.pickup_time || '00:00'}`;
        return timeA.localeCompare(timeB);
      }
      if (tableSortBy === 'ref') {
        return (a.booking_ref || '').localeCompare(b.booking_ref || '');
      }
      if (tableSortBy === 'price-desc') {
        return (b.customer_price || 0) - (a.customer_price || 0);
      }
      return 0;
    });

    return list;
  }, [allFetchedBookings, tableSearch, tableStatusFilter, tablePaymentFilter, tablePickupDate, tableSortBy]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Trip Completed':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
      case 'Awaiting Assignment':
        return 'bg-amber-50 text-amber-900 border-amber-300 font-black animate-pulse';
      case 'Assigned':
      case 'Driver Notified':
        return 'bg-blue-50 text-blue-800 border-blue-300 font-semibold';
      case 'Driver on the Way':
      case 'Arrived at Pickup':
      case 'Passenger Picked Up':
        return 'bg-indigo-50 text-indigo-800 border-indigo-300 font-semibold';
      case 'Cancelled':
      case 'No Show':
        return 'bg-rose-50 text-rose-800 border-rose-300 font-semibold';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
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

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'partial':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'unpaid':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'refunded':
      case 'outstanding':
        return 'bg-amber-50 text-amber-900 border-amber-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getPaymentEmoji = (status: string) => {
    switch (status) {
      case 'paid': return '🟢';
      case 'partial': return '🟡';
      case 'unpaid': return '🔴';
      case 'outstanding': return '🟠';
      default: return '⚪';
    }
  };

  const getVehicleEmoji = (type: string = '') => {
    const t = type.toLowerCase();
    if (t.includes('suv')) return '🚙';
    if (t.includes('staria') || t.includes('van') || t.includes('hiace')) return '🚐';
    if (t.includes('coaster') || t.includes('bus')) return '🚌';
    return '🚘';
  };

  const resetTableFilters = () => {
    setTableSearch('');
    setTableStatusFilter('all');
    setTablePaymentFilter('all');
    setTablePickupDate('');
    setTableSortBy('datetime-desc');
  };

  const hasActiveFilters = tableSearch !== '' || tableStatusFilter !== 'all' || tablePaymentFilter !== 'all' || tablePickupDate !== '';

  const exportToExcel = () => {
    const dataToExport = filteredBookings.map((b) => ({
      'Reference': b.booking_ref,
      'Supplier Ref': b.supplier_reference || '-',
      'Pickup Date': b.pickup_date,
      'Pickup Time': b.pickup_time,
      'Passenger': b.passenger_name,
      'Contact': b.contact_number,
      'Pickup Location': b.pickup_location,
      'Dropoff Location': b.dropoff_location,
      'Flight': b.flight_number || '-',
      'Vehicle': b.vehicle_type,
      'Driver': b.driver_name || 'Unassigned',
      'Trip Status': b.trip_status,
      'Payment Status': b.payment_status,
      'Fare (SAR)': b.customer_price,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Live Bookings');
    XLSX.writeFile(wb, `Gulf_Taxis_Live_Bookings_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToCsv = () => {
    const headers = ['Reference,Pickup Date,Pickup Time,Passenger,Contact,Pickup,Dropoff,Flight,Vehicle,Driver,Status,Payment,Price'];
    const rows = filteredBookings.map((b) =>
      [
        `"${b.booking_ref}"`,
        `"${b.pickup_date}"`,
        `"${b.pickup_time}"`,
        `"${b.passenger_name}"`,
        `"${b.contact_number}"`,
        `"${b.pickup_location.replace(/"/g, '""')}"`,
        `"${b.dropoff_location.replace(/"/g, '""')}"`,
        `"${b.flight_number || ''}"`,
        `"${b.vehicle_type}"`,
        `"${b.driver_name || 'Unassigned'}"`,
        `"${b.trip_status}"`,
        `"${b.payment_status}"`,
        b.customer_price,
      ].join(',')
    );

    const blob = new Blob([headers.concat(rows).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Gulf_Taxis_Live_Feed_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Widget Metadata Configuration
  const widgetDefinitions: Record<
    string,
    {
      title: string;
      emoji: string;
      icon: any;
      value: string | number;
      sublabel: string;
      targetModule: string;
      badgeText?: string;
      // Vibrant Color Identities
      bgGradient: string;
      borderClass: string;
      hoverBorderClass: string;
      iconGradient: string;
      valTextColor: string;
      sublabelColor: string;
      badgeClass: string;
      isDark?: boolean;
    }
  > = {
    today_bookings: {
      title: "Today's Bookings",
      emoji: '📅',
      icon: CalendarDays,
      value: stats.todayBookings,
      sublabel: 'Scheduled Today',
      targetModule: 'bookings',
      bgGradient: 'bg-gradient-to-br from-blue-500/10 via-white to-blue-500/5',
      borderClass: 'border-blue-200/90',
      hoverBorderClass: 'hover:border-blue-500',
      iconGradient: 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/20',
      valTextColor: 'text-slate-900 group-hover:text-blue-700',
      sublabelColor: 'text-blue-600 font-semibold',
      badgeClass: 'bg-blue-100 text-blue-800',
    },
    active_trips: {
      title: 'Active Trips',
      emoji: '🚘',
      icon: Activity,
      value: stats.activeTrips,
      sublabel: 'En Route & In Progress',
      targetModule: 'dispatch',
      bgGradient: 'bg-gradient-to-br from-cyan-500/10 via-white to-teal-500/5',
      borderClass: 'border-cyan-200/90',
      hoverBorderClass: 'hover:border-teal-500',
      iconGradient: 'bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-md shadow-cyan-500/20',
      valTextColor: 'text-slate-900 group-hover:text-teal-700',
      sublabelColor: 'text-teal-600 font-semibold',
      badgeClass: 'bg-teal-100 text-teal-800',
    },
    awaiting_driver: {
      title: 'Awaiting Driver',
      emoji: '⏳',
      icon: AlertCircle,
      value: stats.awaitingAssignment,
      sublabel: stats.awaitingAssignment > 0 ? '⚠️ Require Assignment' : 'All Trips Assigned',
      targetModule: 'dispatch',
      badgeText: stats.awaitingAssignment > 0 ? 'Action Needed' : 'Good',
      bgGradient: 'bg-gradient-to-br from-amber-500/15 via-white to-orange-500/5',
      borderClass: stats.awaitingAssignment > 0 ? 'border-amber-300 ring-1 ring-amber-200/60' : 'border-amber-200/90',
      hoverBorderClass: 'hover:border-orange-500',
      iconGradient: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-orange-500/20',
      valTextColor: 'text-amber-950 group-hover:text-orange-900',
      sublabelColor: 'text-amber-800 font-bold',
      badgeClass: stats.awaitingAssignment > 0 ? 'bg-amber-200 text-amber-900 font-black animate-pulse' : 'bg-amber-100 text-amber-800',
    },
    completed_trips: {
      title: 'Completed Trips',
      emoji: '✅',
      icon: CheckCircle,
      value: stats.completedTrips,
      sublabel: 'Delivered Safely',
      targetModule: 'reports',
      bgGradient: 'bg-gradient-to-br from-emerald-500/10 via-white to-emerald-500/5',
      borderClass: 'border-emerald-200/90',
      hoverBorderClass: 'hover:border-emerald-500',
      iconGradient: 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md shadow-emerald-500/20',
      valTextColor: 'text-emerald-700 group-hover:text-emerald-800',
      sublabelColor: 'text-emerald-600 font-semibold',
      badgeClass: 'bg-emerald-100 text-emerald-800',
    },
    active_drivers: {
      title: 'Active Drivers',
      emoji: '🧑✈️',
      icon: Users,
      value: stats.availableDrivers,
      sublabel: 'On Duty & Available',
      targetModule: 'drivers',
      bgGradient: 'bg-gradient-to-br from-violet-500/10 via-white to-purple-500/5',
      borderClass: 'border-violet-200/90',
      hoverBorderClass: 'hover:border-purple-500',
      iconGradient: 'bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-md shadow-violet-500/20',
      valTextColor: 'text-slate-900 group-hover:text-purple-700',
      sublabelColor: 'text-purple-600 font-semibold',
      badgeClass: 'bg-purple-100 text-purple-800',
    },
    fleet_available: {
      title: 'Fleet Available',
      emoji: '🚐',
      icon: Car,
      value: stats.availableVehicles,
      sublabel: 'Ready for Dispatch',
      targetModule: 'vehicles',
      bgGradient: 'bg-gradient-to-br from-sky-500/10 via-white to-blue-500/5',
      borderClass: 'border-sky-200/90',
      hoverBorderClass: 'hover:border-sky-500',
      iconGradient: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20',
      valTextColor: 'text-slate-900 group-hover:text-blue-700',
      sublabelColor: 'text-sky-600 font-semibold',
      badgeClass: 'bg-sky-100 text-sky-800',
    },
    receivables: {
      title: 'Receivables',
      emoji: '💳',
      icon: CreditCard,
      value: `${stats.pendingPayments.toLocaleString()} SAR`,
      sublabel: 'Pending Collection',
      targetModule: 'finance',
      bgGradient: 'bg-gradient-to-br from-rose-500/10 via-white to-orange-500/5',
      borderClass: 'border-orange-200/90',
      hoverBorderClass: 'hover:border-orange-500',
      iconGradient: 'bg-gradient-to-br from-rose-500 to-orange-600 text-white shadow-md shadow-orange-500/20',
      valTextColor: 'text-slate-900 group-hover:text-orange-700',
      sublabelColor: 'text-orange-600 font-bold',
      badgeClass: 'bg-orange-100 text-orange-800',
    },
    revenue: {
      title: 'Revenue',
      emoji: '💰',
      icon: DollarSign,
      value: `${stats.monthlyRevenue.toLocaleString()} SAR`,
      sublabel: 'Booked Revenue',
      targetModule: 'finance',
      isDark: true,
      bgGradient: 'bg-gradient-to-br from-[#0b132b] via-[#0f1d40] to-[#091124]',
      borderClass: 'border-blue-900/60',
      hoverBorderClass: 'hover:border-amber-400',
      iconGradient: 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-md shadow-amber-500/25',
      valTextColor: 'text-amber-300 font-mono',
      sublabelColor: 'text-amber-400 font-bold',
      badgeClass: 'bg-amber-400/20 text-amber-300 border border-amber-400/30',
    },
  };

  return (
    <div className="space-y-4">
      {/* 1. Dashboard Operational Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200/90 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-2xl">🚘</span>
            <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Gulf Taxis Central Dispatch Operations</span>
            </h1>
            <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-300 flex items-center gap-1.5 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              🟢 Live Fleet Status ({stats.availableDrivers} Drivers On Duty)
            </span>
          </div>
          <p className="text-[13px] text-slate-500 mt-1.5 flex items-center gap-2 flex-wrap">
            <span>👤 Logged in as <strong className="text-slate-800 font-semibold">{user?.full_name || 'Dispatcher'}</strong> ({user?.role || 'Operations'})</span>
            <span className="text-slate-300">•</span>
            <span>🌍 Operational Timezone: <strong className="text-slate-700 font-mono font-semibold">Asia/Riyadh (UTC+3)</strong></span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-sm">
          {/* Date range filter buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold border border-slate-200">
            {(['today', 'week', 'month', 'all'] as const).map((filterKey) => (
              <button
                key={filterKey}
                onClick={() => setDateFilter(filterKey)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                  dateFilter === filterKey
                    ? 'bg-white text-blue-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {filterKey === 'today' ? '🗓️ Today' : filterKey === 'week' ? '🗓️ 7 Days' : filterKey === 'month' ? '🗓️ 30 Days' : '🌐 All'}
              </button>
            ))}
          </div>

          {/* Refresh button */}
          <button
            onClick={() => loadDashboardData(true)}
            disabled={isRefreshing || loading}
            title="Refresh operational data"
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing || loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* New Booking Primary Button */}
          {hasPermission('bookings') && (
            <button
              onClick={onOpenNewBooking}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/20 transition-all cursor-pointer hover:shadow-lg hover:shadow-blue-500/30 active:scale-98"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>➕ New Booking</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Colourful, Interactive, Draggable KPI Summary Cards Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Interactive Operational Cockpit</span>
          </span>
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">
            • Hover for dynamic lift • Drag and drop to rearrange
          </span>
        </div>

        {/* Lock / Customize & Reset Controls */}
        <div className="flex items-center gap-2 text-xs">
          {layoutNotification && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md animate-in fade-in">
              {layoutNotification}
            </span>
          )}

          <button
            onClick={() => setIsLayoutLocked(!isLayoutLocked)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
              !isLayoutLocked
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title={isLayoutLocked ? 'Unlock to drag and reposition widgets' : 'Lock widget layout'}
          >
            {!isLayoutLocked ? (
              <>
                <Unlock className="w-3.5 h-3.5" />
                <span>🔓 Customize Layout (Draggable)</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>🔒 Lock Layout</span>
              </>
            )}
          </button>

          <button
            onClick={handleResetLayout}
            className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 font-bold rounded-lg border border-slate-200 transition-colors cursor-pointer text-xs"
            title="Reset to default widget arrangement"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Draggable Summary Widgets Grid: 4-Column Balanced SaaS Layout (Eliminates Narrow Clipping) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {widgetOrder.map((widgetId, index) => {
          const w = widgetDefinitions[widgetId];
          if (!w) return null;

          const isDragging = draggedWidgetId === widgetId;
          const isDragOver = dragOverWidgetId === widgetId;
          const IconComponent = w.icon;

          return (
            <div
              key={widgetId}
              draggable={!isLayoutLocked}
              onDragStart={(e) => handleDragStart(e, widgetId)}
              onDragOver={(e) => handleDragOver(e, widgetId)}
              onDrop={(e) => handleDrop(e, widgetId)}
              onClick={() => {
                if (isLayoutLocked) {
                  onNavigate(w.targetModule);
                }
              }}
              className={`relative p-4 rounded-2xl border transition-all duration-200 ease-out flex flex-col justify-between group select-none saas-card-lift ${
                w.bgGradient
              } ${w.borderClass} ${w.hoverBorderClass} ${
                isLayoutLocked ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
              } hover:-translate-y-1 hover:shadow-xl motion-reduce:hover:transform-none motion-reduce:transition-none ${
                isDragging ? 'opacity-40 scale-95 border-dashed border-blue-500' : ''
              } ${isDragOver ? 'ring-2 ring-blue-500 ring-offset-2 bg-blue-100/50' : ''}`}
            >
              {/* Drag Handle & Reorder controls when unlocked */}
              {!isLayoutLocked && (
                <div className="absolute top-2 right-2 flex items-center gap-0.5 z-10 bg-white/95 backdrop-blur-xs rounded-md px-1 py-0.5 border border-slate-200 shadow-2xs">
                  <button
                    onClick={(e) => handleShiftWidget(widgetId, 'prev', e)}
                    disabled={index === 0}
                    className="p-0.5 hover:bg-slate-200 rounded text-slate-600 disabled:opacity-20 cursor-pointer"
                    title="Move left"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <GripVertical className="w-3.5 h-3.5 text-slate-400" />
                  <button
                    onClick={(e) => handleShiftWidget(widgetId, 'next', e)}
                    disabled={index === widgetOrder.length - 1}
                    className="p-0.5 hover:bg-slate-200 rounded text-slate-600 disabled:opacity-20 cursor-pointer"
                    title="Move right"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Widget Header: Icon Badge & Title */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 truncate">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${w.iconGradient}`}
                  >
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[14.5px] font-bold truncate ${
                      w.isDark ? 'text-blue-100' : 'text-slate-800'
                    }`}
                  >
                    {w.emoji} {w.title}
                  </span>
                </div>

                {w.badgeText && (
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border shrink-0 ${w.badgeClass}`}>
                    {w.badgeText}
                  </span>
                )}
              </div>

              {/* Large Bold Metric Value (28–32px per Typography Standard) */}
              <div className="my-1.5">
                <div
                  className={`text-[28px] sm:text-[30px] font-bold font-mono transition-colors truncate leading-tight ${w.valTextColor}`}
                >
                  {w.value}
                </div>
              </div>

              {/* Footer: Sublabel & Arrow Link */}
              <div className="text-xs mt-1 flex items-center justify-between pt-1.5 border-t border-slate-200/60">
                <span className={`truncate font-semibold ${w.sublabelColor}`}>{w.sublabel}</span>
                <ArrowUpRight
                  className={`w-4 h-4 shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all ${
                    w.isDark ? 'text-amber-400' : 'text-blue-600'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Operational Velocity & Fleet Utilization Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">⚡</span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Fleet Dispatch Velocity & Operational Throughput
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time trip progression and active fleet resource balance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 text-xs flex-wrap">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Completed ({stats.completedTrips})</span>
            </div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
              <span>Active ({stats.activeTrips})</span>
            </div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>Awaiting ({stats.awaitingAssignment})</span>
            </div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span>Cancelled ({stats.cancelledTrips})</span>
            </div>
          </div>
        </div>

        {/* Multi-Segment Operational Progress Bar */}
        <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
          {stats.totalBookings > 0 ? (
            <>
              <div
                style={{ width: `${(stats.completedTrips / stats.totalBookings) * 100}%` }}
                className="bg-emerald-500 h-full transition-all duration-500"
                title={`Completed: ${stats.completedTrips}`}
              />
              <div
                style={{ width: `${(stats.activeTrips / stats.totalBookings) * 100}%` }}
                className="bg-indigo-500 h-full transition-all duration-500"
                title={`Active En Route: ${stats.activeTrips}`}
              />
              <div
                style={{ width: `${(stats.awaitingAssignment / stats.totalBookings) * 100}%` }}
                className="bg-amber-400 h-full transition-all duration-500"
                title={`Awaiting Driver: ${stats.awaitingAssignment}`}
              />
              <div
                style={{ width: `${(stats.cancelledTrips / stats.totalBookings) * 100}%` }}
                className="bg-rose-400 h-full transition-all duration-500"
                title={`Cancelled: ${stats.cancelledTrips}`}
              />
            </>
          ) : (
            <div className="w-full bg-slate-200 h-full" />
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-1.5 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span>Fleet Utilization:</span>
            <span className="font-bold font-mono text-slate-800 text-[13px]">
              {stats.availableDrivers > 0
                ? `${Math.min(100, Math.round((stats.activeTrips / stats.availableDrivers) * 100))}% Capacity`
                : 'Standby'}
            </span>
          </div>
          <div>
            <span>Total Operational Records: </span>
            <strong className="text-slate-800 font-mono text-[13px]">{stats.totalBookings}</strong>
          </div>
        </div>
      </div>

      {/* 4. Live Recent Bookings Feed (Compact Single-Line Operational Table) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Feed Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>📋 Live Recent Bookings Feed</span>
              </h2>
              <span className="text-xs bg-blue-100 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                Central Real-Time Stream
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Compact single-line operational records across all terminals & routes
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">
              Showing <strong className="text-slate-800 font-semibold">{filteredBookings.length}</strong> of {allFetchedBookings.length}
            </span>
            <button
              onClick={() => onNavigate('bookings')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
            >
              <span>🔗 View All Bookings</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 5. Operational Search & Filter Bar (Compact & Full Featured) */}
        <div className="p-3 bg-white border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 text-sm">
          {/* Quick Search */}
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="🔍 Quick Search (ref, passenger, phone, flight, route, vehicle, driver...)"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm text-slate-900"
            />
          </div>

          {/* Trip Status Filter */}
          <div className="lg:col-span-2">
            <select
              value={tableStatusFilter}
              onChange={(e) => setTableStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm text-slate-700"
            >
              <option value="all">🚦 All Trip Statuses</option>
              <option value="Awaiting Assignment">🟠 Awaiting Assignment</option>
              <option value="Assigned">🔵 Assigned</option>
              <option value="Driver Notified">📲 Driver Notified</option>
              <option value="Driver on the Way">🚗 Driver on the Way</option>
              <option value="Arrived at Pickup">📍 Arrived at Pickup</option>
              <option value="Passenger Picked Up">👥 Passenger Picked Up</option>
              <option value="Trip Completed">🟢 Trip Completed</option>
              <option value="Cancelled">🔴 Cancelled</option>
            </select>
          </div>

          {/* Payment Status Filter */}
          <div className="lg:col-span-2">
            <select
              value={tablePaymentFilter}
              onChange={(e) => setTablePaymentFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm text-slate-700"
            >
              <option value="all">💳 All Payments</option>
              <option value="paid">🟢 Paid</option>
              <option value="partial">🟡 Partial</option>
              <option value="unpaid">🔴 Unpaid</option>
              <option value="outstanding">🟠 Outstanding</option>
            </select>
          </div>

          {/* Pickup Date filter */}
          <div className="lg:col-span-2">
            <input
              type="date"
              value={tablePickupDate}
              onChange={(e) => setTablePickupDate(e.target.value)}
              title="Filter by Pickup Date"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm text-slate-700"
            />
          </div>

          {/* Sort By & Export Buttons */}
          <div className="lg:col-span-2 flex items-center gap-1.5">
            <select
              value={tableSortBy}
              onChange={(e: any) => setTableSortBy(e.target.value)}
              className="flex-1 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm text-slate-700"
            >
              <option value="datetime-desc">↕️ Pickup (Newest)</option>
              <option value="datetime-asc">↕️ Pickup (Oldest)</option>
              <option value="ref">↕️ Ref (A-Z)</option>
              <option value="price-desc">↕️ Fare (High-Low)</option>
            </select>

            <button
              onClick={exportToExcel}
              title="📥 Export to Excel (.xlsx)"
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 cursor-pointer transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            </button>

            <button
              onClick={exportToCsv}
              title="📄 Export to CSV"
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4 text-blue-700" />
            </button>

            {hasActiveFilters && (
              <button
                onClick={resetTableFilters}
                title="Reset active search & filters"
                className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 4. Compact Single-Line Operational Table - Full Available Width */}
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
                <th className="py-3 px-2.5">💳 Payment</th>
                <th className="py-3 px-3.5 text-center">⚙️ Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && allFetchedBookings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span className="text-sm">Loading real-time dispatch feed...</span>
                  </td>
                </tr>
              ) : filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    <p className="font-semibold text-slate-600 text-sm">No bookings match the selected criteria.</p>
                    {hasActiveFilters && (
                      <button
                        onClick={resetTableFilters}
                        className="mt-2 text-xs text-blue-600 hover:underline font-bold cursor-pointer"
                      >
                        Reset Search & Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-blue-50/50 transition-colors group"
                  >
                    {/* 1. 🔖 Reference */}
                    <td className="py-3 px-3.5 whitespace-nowrap align-middle">
                      <button
                        onClick={() => onViewBooking(b)}
                        className="inline-block bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/90 px-2.5 py-1 rounded font-mono font-bold text-[13.5px] cursor-pointer transition-colors"
                        title="Click to view transport voucher"
                      >
                        {b.booking_ref}
                      </button>
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
                        <span>{getVehicleEmoji(b.vehicle_type)}</span>
                        <span>{b.vehicle_type || 'Sedan'}</span>
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

                    {/* 9. 💳 Payment Status */}
                    <td className="py-3 px-2.5 whitespace-nowrap align-middle">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border font-bold capitalize ${getPaymentBadge(
                          b.payment_status
                        )}`}
                      >
                        <span>{getPaymentEmoji(b.payment_status)}</span>
                        <span>{b.payment_status}</span>
                      </span>
                    </td>

                    {/* 10. ⚙️ Actions */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap align-middle">
                      <div className="inline-flex items-center gap-1.5">
                        {/* 👁️ View */}
                        <button
                          onClick={() => onViewBooking(b)}
                          title="👁️ View Details & Voucher"
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md font-bold text-xs border border-blue-200 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>

                        {/* ✏️ Edit */}
                        {onEditBooking && hasPermission('bookings') && (
                          <button
                            onClick={() => onEditBooking(b)}
                            title="✏️ Edit Booking"
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-bold text-xs border border-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        )}

                        {/* 🚘 Dispatch shortcut */}
                        {(!b.driver_id || b.trip_status === 'Awaiting Assignment') && (
                          <button
                            onClick={() => onNavigate('dispatch')}
                            title="🚘 Dispatch Driver"
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-md font-bold text-xs border border-amber-300 transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <span>🚘</span>
                            <span>Dispatch</span>
                          </button>
                        )}

                        {/* 🖨️ Print Voucher */}
                        <button
                          onClick={() => onViewBooking(b)}
                          title="🖨️ Print Voucher"
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
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
    </div>
  );
};
