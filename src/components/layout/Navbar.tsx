import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { api } from '../../services/api';
import {
  Car,
  LogOut,
  RefreshCw,
  Bell,
  Menu,
  ChevronDown,
  Sparkles,
  Search,
  X,
  ArrowRight,
  Clock,
  MapPin,
  Calendar
} from 'lucide-react';
import { UserRole, Booking } from '../../types';

interface NavbarProps {
  onToggleMobileMenu: () => void;
  activeModule: string;
  onNavigate: (module: string) => void;
  onOpenNotifications: () => void;
  unreadCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleMobileMenu,
  activeModule,
  onNavigate,
  onOpenNotifications,
  unreadCount = 3,
}) => {
  const { user, logout, login } = useAuth();
  const { isOnline, lastSyncTime, forceSync } = useSync();

  // Global search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Booking[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Ctrl+K / Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to dismiss search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live search debounced fetch
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.getBookings({ search: searchQuery.trim(), limit: 6 });
        setSearchResults(res.bookings || []);
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getRoleBadge = (role?: UserRole) => {
    switch (role) {
      case 'super_admin':
        return { label: '👑 Super Admin', bg: 'bg-amber-500/10 text-amber-700 border-amber-300' };
      case 'admin':
        return { label: '🛡️ Administrator', bg: 'bg-blue-500/10 text-blue-700 border-blue-300' };
      case 'dispatcher':
        return { label: '🚘 Dispatcher', bg: 'bg-indigo-500/10 text-indigo-700 border-indigo-300 font-bold' };
      case 'booking_agent':
        return { label: '📅 Booking Agent', bg: 'bg-emerald-500/10 text-emerald-700 border-emerald-300' };
      case 'finance_executive':
        return { label: '💳 Finance Exec', bg: 'bg-teal-500/10 text-teal-700 border-teal-300' };
      case 'report_viewer':
        return { label: '📈 Report Viewer', bg: 'bg-slate-100 text-slate-800 border-slate-200' };
      default:
        return { label: 'Staff User', bg: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
  };

  const roleInfo = getRoleBadge(user?.role);

  const handleQuickSwitch = async (role: string) => {
    const creds: Record<string, { u: string; p: string }> = {
      super_admin: { u: 'superadmin', p: 'Admin@123' },
      admin: { u: 'admin', p: 'Admin@123' },
      dispatcher: { u: 'dispatcher', p: 'Dispatch@123' },
      booking_agent: { u: 'agent', p: 'Agent@123' },
      finance_executive: { u: 'finance', p: 'Finance@123' },
      report_viewer: { u: 'viewer', p: 'Viewer@123' },
    };
    if (creds[role]) {
      await login(creds[role].u, creds[role].p, true);
    }
  };

  const handleSelectSearchResult = (booking: Booking) => {
    setSearchOpen(false);
    setSearchQuery('');
    onNavigate('bookings');
  };

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-30 shadow-xs">
      <div className="px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Left section: Hamburger (mobile) + Brand logo */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div
              onClick={() => onNavigate('dashboard')}
              className="flex items-center gap-2.5 cursor-pointer select-none group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0b132b] via-[#1e3a8a] to-[#2563eb] flex items-center justify-center text-white shadow-md shadow-blue-900/20 group-hover:scale-105 transition-all ring-1 ring-white/20">
                <Car className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-slate-900 tracking-tight text-lg sm:text-xl">
                    GULF TAXIS
                  </span>
                  <span className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shadow-2xs">
                    Cloud
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-medium hidden sm:block">
                  Dispatch & Fleet Control
                </div>
              </div>
            </div>
          </div>

          {/* Center section: Global Search Bar */}
          <div ref={searchContainerRef} className="flex-1 max-w-md relative hidden md:block">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Global search (Booking #, passenger, phone, flight, city)..."
                value={searchQuery}
                onFocus={() => setSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchOpen(true);
                }}
                className="w-full pl-9 pr-14 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200/90 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:text-slate-400 min-h-[38px]"
              />
              <div className="absolute right-2.5 top-2.5 flex items-center gap-1">
                {searchQuery ? (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <kbd className="hidden lg:inline-block text-[11px] font-mono px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded border border-slate-300 shadow-2xs">
                    ⌘K
                  </kbd>
                )}
              </div>
            </div>

            {/* Global Search Results Dropdown */}
            {searchOpen && searchQuery.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200/90 py-2 z-50 max-h-96 overflow-y-auto custom-scrollbar animate-in fade-in duration-150">
                <div className="px-3.5 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 pb-2">
                  <span>Search Results</span>
                  {isSearching && <span className="text-blue-600 font-normal">Searching...</span>}
                </div>

                {searchResults.length === 0 && !isSearching ? (
                  <div className="p-4 text-center text-sm text-slate-400">
                    No matching bookings found for &ldquo;{searchQuery}&rdquo;
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {searchResults.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => handleSelectSearchResult(b)}
                        className="p-3 hover:bg-blue-50/60 cursor-pointer transition-colors flex items-center justify-between gap-3 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-xs">
                              {b.booking_ref}
                            </span>
                            <span className="font-bold text-slate-900 truncate text-[14px]">
                              {b.passenger_name}
                            </span>
                            {b.flight_number && (
                              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                                ✈️ {b.flight_number}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 truncate flex items-center gap-1.5">
                            <span className="text-slate-400">🗓️ {b.pickup_date} {b.pickup_time}</span>
                            <span>•</span>
                            <span className="truncate">{b.pickup_location} → {b.dropoff_location}</span>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {b.trip_status}
                          </span>
                          <div className="text-xs font-mono font-bold text-slate-900 mt-1">
                            {b.customer_price?.toLocaleString()} {b.currency || 'SAR'}
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="p-2.5 text-center bg-slate-50 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setSearchOpen(false);
                          onNavigate('bookings');
                        }}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 mx-auto cursor-pointer"
                      >
                        <span>View all bookings in management</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right section: Sync + Notifications + Role Switcher + Profile */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Multi-Device Live Sync Status Indicator */}
            <div
              onClick={forceSync}
              title={`Live Multi-Device Cloud Sync. Click to force refresh. Last sync: ${lastSyncTime.toLocaleTimeString()}`}
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200/90 rounded-full text-xs cursor-pointer hover:bg-slate-100 transition-colors shadow-2xs"
            >
              <div className="relative flex h-2 w-2">
                {isOnline && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isOnline ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                ></span>
              </div>
              <span className="font-semibold text-slate-700 text-xs">
                {isOnline ? 'Cloud Synced' : 'Offline'}
              </span>
              <RefreshCw className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
            </div>

            {/* Notifications Button with Badge */}
            <button
              onClick={onOpenNotifications}
              title="View fleet & dispatch notifications"
              className="relative p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-blue-50/60 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
              )}
            </button>

            {/* Fast Role Switcher */}
            <div className="hidden xl:flex items-center">
              <div className="flex items-center gap-1.5 bg-slate-100/80 border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-800">
                <span className="text-xs font-semibold text-slate-500">Role:</span>
                <select
                  value={user?.role}
                  onChange={(e) => handleQuickSwitch(e.target.value)}
                  className="bg-transparent font-bold text-blue-700 focus:outline-none cursor-pointer text-xs"
                >
                  <option value="super_admin">👑 Super Admin</option>
                  <option value="admin">🛡️ Administrator</option>
                  <option value="dispatcher">🚘 Dispatcher</option>
                  <option value="booking_agent">📅 Booking Agent</option>
                  <option value="finance_executive">💳 Finance Exec</option>
                  <option value="report_viewer">📈 Report Viewer</option>
                </select>
              </div>
            </div>

            {/* User Profile Card */}
            <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-slate-200">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0b132b] to-[#1e3a8a] text-amber-300 font-bold flex items-center justify-center text-sm shadow-xs ring-1 ring-amber-400/20">
                {user?.full_name?.charAt(0) || 'U'}
              </div>

              <div className="hidden sm:block text-left">
                <div className="text-sm font-bold text-slate-900 leading-tight">
                  {user?.full_name || 'Staff User'}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`text-xs px-2 py-0.5 rounded font-bold border ${roleInfo.bg}`}>
                    {roleInfo.label}
                  </span>
                </div>
              </div>

              {/* Logout Button */}
              <button
                type="button"
                onClick={logout}
                title="Sign out of Gulf Taxis"
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

