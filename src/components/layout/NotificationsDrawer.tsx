import React from 'react';
import {
  Bell,
  X,
  AlertTriangle,
  CheckCircle2,
  Car,
  CreditCard,
  Clock,
  ArrowRight
} from 'lucide-react';

interface NotificationItem {
  id: string;
  type: 'warning' | 'success' | 'info' | 'payment';
  title: string;
  message: string;
  time: string;
  read: boolean;
  linkModule?: string;
}

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (module: string) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([
    {
      id: 'notif_1',
      type: 'warning',
      title: '⚠️ Unassigned Airport Pickup Alert',
      message: 'Booking GT-2026-0004 (Terminal 2 -> Fairmont Riyadh) has no driver assigned.',
      time: '10 mins ago',
      read: false,
      linkModule: 'dispatch',
    },
    {
      id: 'notif_2',
      type: 'success',
      title: '✅ Trip Completed by Chauffeur',
      message: 'Driver Muhammad Tariq completed GT-2026-0001 (RUH Terminal 4 -> Four Seasons).',
      time: '1 hour ago',
      read: false,
      linkModule: 'bookings',
    },
    {
      id: 'notif_3',
      type: 'payment',
      title: '💵 Customer Payment Settled',
      message: 'Received 900 SAR via Bank Transfer from Saudi Tech Summit for GT-2026-0005.',
      time: '2 hours ago',
      read: false,
      linkModule: 'finance',
    },
    {
      id: 'notif_4',
      type: 'info',
      title: '🔄 Automatic Cloud Backup Verified',
      message: 'Routine 6-hour SQLite database snapshot completed and stored safely.',
      time: '4 hours ago',
      read: true,
      linkModule: 'settings',
    },
  ]);

  if (!isOpen) return null;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleItemClick = (n: NotificationItem) => {
    if (n.linkModule) {
      onNavigate(n.linkModule);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative max-w-md w-full bg-white shadow-2xl flex flex-col z-10">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 rounded-xl text-white">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-[17px] text-white">Operational Notifications</h3>
              <p className="text-xs text-blue-300">Live fleet and booking alerts</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={markAllRead}
              className="text-xs sm:text-[13px] text-blue-300 hover:text-white font-semibold cursor-pointer transition-colors"
            >
              Mark all read
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-slate-100">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleItemClick(n)}
              className={`p-3.5 rounded-xl transition-all cursor-pointer group pt-3.5 ${
                n.read ? 'bg-slate-50/50 hover:bg-slate-100/70' : 'bg-blue-50/60 border border-blue-200/60 hover:bg-blue-50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-[13.5px] text-slate-900 group-hover:text-blue-600 transition-colors">
                  {n.title}
                </span>
                <span className="text-xs text-slate-400 font-mono shrink-0">{n.time}</span>
              </div>
              <p className="text-[13px] text-slate-600 mt-1 leading-relaxed">{n.message}</p>
              {n.linkModule && (
                <div className="mt-2 text-xs font-bold text-blue-600 flex items-center gap-1">
                  <span>View in {n.linkModule}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
