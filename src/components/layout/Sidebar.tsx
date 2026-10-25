import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import {
  LayoutDashboard,
  CalendarDays,
  Send,
  Users,
  Car,
  Building2,
  CreditCard,
  BarChart3,
  Bell,
  Settings,
  X,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

interface SidebarProps {
  activeModule: string;
  onNavigate: (module: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onNavigate,
  mobileOpen,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
  onOpenNotifications,
  unreadNotificationsCount = 3,
}) => {
  const { user, hasPermission } = useAuth();
  const { pulseData } = useSync();

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      emoji: '📊',
      icon: LayoutDashboard,
      permission: 'dashboard',
    },
    {
      id: 'bookings',
      label: 'Booking Management',
      emoji: '📅',
      icon: CalendarDays,
      permission: 'bookings',
      badge: pulseData?.activeCount ? String(pulseData.activeCount) : undefined,
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
    },
    {
      id: 'dispatch',
      label: 'Dispatch Control Centre',
      emoji: '🚘',
      icon: Send,
      permission: 'dispatch',
      badge: pulseData?.unassignedCount ? `${pulseData.unassignedCount} pending` : undefined,
      badgeColor: pulseData?.unassignedCount
        ? 'bg-amber-500 text-slate-950 font-black animate-pulse'
        : undefined,
    },
    {
      id: 'drivers',
      label: 'Driver Management',
      emoji: '🧑✈️',
      icon: Users,
      permission: 'drivers',
    },
    {
      id: 'vehicles',
      label: 'Vehicle Management',
      emoji: '🚐',
      icon: Car,
      permission: 'vehicles',
    },
    {
      id: 'suppliers',
      label: 'Supplier Management',
      emoji: '🏢',
      icon: Building2,
      permission: 'suppliers',
    },
    {
      id: 'finance',
      label: 'Payments & Expenses',
      emoji: '💳',
      icon: CreditCard,
      permission: 'payments',
    },
    {
      id: 'reports',
      label: 'Reports Centre',
      emoji: '📈',
      icon: BarChart3,
      permission: 'reports',
    },
    {
      id: 'notifications',
      label: 'Notifications',
      emoji: '🔔',
      icon: Bell,
      permission: 'dashboard',
      badge: unreadNotificationsCount > 0 ? String(unreadNotificationsCount) : undefined,
      badgeColor: 'bg-rose-500 text-white font-bold',
      isAction: true,
      onClick: onOpenNotifications,
    },
    {
      id: 'settings',
      label: 'Settings',
      emoji: '⚙️',
      icon: Settings,
      permission: 'settings',
    },
  ];

  const visibleItems = navItems.filter((item) => hasPermission(item.permission));

  const handleSelect = (item: any) => {
    if (item.isAction && item.onClick) {
      item.onClick();
    } else {
      onNavigate(item.id);
    }
    onCloseMobile();
  };

  const navContent = (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#091124] via-[#0d1836] to-[#060c1a] text-slate-200 select-none shadow-2xl border-r border-blue-950/80">
      {/* Brand Header */}
      <div className={`p-4 border-b border-blue-900/40 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 ring-1 ring-amber-400/30 shrink-0">
              <Car className="w-5 h-5 text-amber-300" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <h2 className="font-extrabold text-white text-base tracking-tight leading-tight">
                  GULF TAXIS
                </h2>
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[9px] font-black px-1.5 py-0.2 rounded uppercase tracking-widest shadow-2xs">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-blue-300/80 font-medium truncate">
                Dispatch Cloud System
              </p>
            </div>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 ring-1 ring-amber-400/30 shrink-0">
            <Car className="w-5 h-5 text-amber-300" />
          </div>
        )}

        {/* Mobile close button */}
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 px-3 py-3.5 space-y-1.5 overflow-y-auto custom-scrollbar">
        {!isCollapsed && (
          <div className="px-3 pb-1.5 text-xs font-bold uppercase tracking-wider text-blue-300/70">
            Main Dispatch Modules
          </div>
        )}

        {visibleItems.map((item) => {
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-3.5 py-2.5'
              } rounded-xl text-[14px] font-semibold transition-all duration-150 cursor-pointer group relative ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30 font-bold ring-1 ring-blue-400/40 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-amber-400 before:rounded-r'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <span className="text-lg shrink-0 group-hover:scale-110 transition-transform">
                  {item.emoji}
                </span>
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </div>

              {!isCollapsed && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.badge && (
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full border shadow-xs font-bold ${
                        item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-4 h-4 text-amber-300" />}
                </div>
              )}

              {/* Collapsed Badge Pill Indicator */}
              {isCollapsed && item.badge && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-[#091124]"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop Collapse / Expand Toggle Button */}
      <div className="hidden lg:flex items-center justify-center p-2.5 border-t border-blue-950/60">
        <button
          onClick={onToggleCollapse}
          className="w-full py-2 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse Sidebar</span>
            </>
          )}
        </button>
      </div>

      {/* User Profile Footer Card */}
      <div className="p-3.5 border-t border-blue-900/40 bg-black/25">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-amber-300 font-bold flex items-center justify-center text-sm shadow-md ring-1 ring-amber-400/20 shrink-0">
            {user?.full_name?.charAt(0) || 'U'}
          </div>

          {!isCollapsed && (
            <div className="truncate flex-1">
              <div className="text-[14px] font-bold text-white truncate leading-tight">
                {user?.full_name || 'Staff User'}
              </div>
              <div className="text-xs text-blue-300 capitalize font-medium truncate mt-0.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>{user?.role?.replace('_', ' ') || 'Chauffeur Desk'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 h-[calc(100vh-4rem)] sticky top-16 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-72'
        }`}
      >
        {navContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full shadow-2xl z-10">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};
