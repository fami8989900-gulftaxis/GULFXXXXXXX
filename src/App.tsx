import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import { LoginPage } from './components/auth/LoginPage';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { NotificationsDrawer } from './components/layout/NotificationsDrawer';
import { DashboardPage } from './components/dashboard/DashboardPage';
import { BookingsPage } from './components/bookings/BookingsPage';
import { BookingModal } from './components/bookings/BookingModal';
import { DispatchPage } from './components/dispatch/DispatchPage';
import { DriversPage } from './components/drivers/DriversPage';
import { VehiclesPage } from './components/vehicles/VehiclesPage';
import { SuppliersPage } from './components/suppliers/SuppliersPage';
import { FinancePage } from './components/finance/FinancePage';
import { ReportsPage } from './components/reports/ReportsPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { VoucherModal } from './components/vouchers/VoucherModal';
import { Booking, Payment } from './types';
import { Car } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeModule, setActiveModule] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);

  // Global Booking Modal state
  const [bookingModalOpen, setBookingModalOpen] = useState<boolean>(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  // Global Voucher Modal state
  const [voucherModalOpen, setVoucherModalOpen] = useState<boolean>(false);
  const [voucherType, setVoucherType] = useState<'customer_voucher' | 'driver_voucher' | 'dispatch_sheet' | 'payment_receipt'>('customer_voucher');
  const [voucherBooking, setVoucherBooking] = useState<Booking | null>(null);
  const [voucherPayment, setVoucherPayment] = useState<Payment | null>(null);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mb-4 shadow-xl shadow-blue-500/30 animate-pulse">
          <Car className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">GULF TAXIS</h2>
        <p className="text-xs text-blue-300 font-medium mt-1">Starting Cloud Dispatch Workstation...</p>
        <div className="mt-4 w-36 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className="w-full h-full bg-blue-500 animate-[indeterminate_1.5s_infinite_linear]"></div>
        </div>
      </div>
    );
  }

  // Not authenticated: always show login page
  if (!user) {
    return <LoginPage />;
  }

  const handleOpenNewBooking = () => {
    setEditingBooking(null);
    setBookingModalOpen(true);
  };

  const handleEditBooking = (b: Booking) => {
    setEditingBooking(b);
    setBookingModalOpen(true);
  };

  const handleViewVoucher = (b: Booking, type: 'customer_voucher' | 'driver_voucher') => {
    setVoucherBooking(b);
    setVoucherPayment(null);
    setVoucherType(type);
    setVoucherModalOpen(true);
  };

  const handleViewReceipt = (p: Payment) => {
    setVoucherPayment(p);
    setVoucherBooking(null);
    setVoucherType('payment_receipt');
    setVoucherModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        activeModule={activeModule}
        onNavigate={(mod) => setActiveModule(mod)}
        onOpenNotifications={() => setNotificationsOpen(true)}
        unreadCount={3}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          activeModule={activeModule}
          onNavigate={(mod) => setActiveModule(mod)}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onOpenNotifications={() => setNotificationsOpen(true)}
          unreadNotificationsCount={3}
        />

        {/* Main Content Area: Responsive Full-Width Layout */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 custom-scrollbar min-w-0">
          <div className="w-full min-w-0 max-w-full">
            {activeModule === 'dashboard' && (
              <DashboardPage
                onNavigate={(mod) => setActiveModule(mod)}
                onOpenNewBooking={handleOpenNewBooking}
                onViewBooking={(b) => handleViewVoucher(b, 'customer_voucher')}
                onEditBooking={handleEditBooking}
              />
            )}

            {activeModule === 'bookings' && (
              <BookingsPage
                onOpenNewBooking={handleOpenNewBooking}
                onEditBooking={handleEditBooking}
                onViewVoucher={handleViewVoucher}
              />
            )}

            {activeModule === 'dispatch' && (
              <DispatchPage onViewVoucher={handleViewVoucher} />
            )}

            {activeModule === 'drivers' && <DriversPage />}

            {activeModule === 'vehicles' && <VehiclesPage />}

            {activeModule === 'suppliers' && <SuppliersPage />}

            {activeModule === 'finance' && (
              <FinancePage onViewReceipt={handleViewReceipt} />
            )}

            {activeModule === 'reports' && <ReportsPage />}

            {activeModule === 'settings' && <SettingsPage />}
          </div>
        </main>
      </div>

      {/* Global Booking Modal */}
      <BookingModal
        isOpen={bookingModalOpen}
        booking={editingBooking}
        onClose={() => setBookingModalOpen(false)}
        onViewVoucher={handleViewVoucher}
        onSuccess={() => {
          setBookingModalOpen(false);
        }}
      />

      {/* Global Voucher & Document Modal */}
      <VoucherModal
        isOpen={voucherModalOpen}
        type={voucherType}
        booking={voucherBooking}
        payment={voucherPayment}
        onClose={() => setVoucherModalOpen(false)}
      />

      {/* Slide-out Notifications Drawer */}
      <NotificationsDrawer
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onNavigate={(mod) => setActiveModule(mod)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <SyncProvider>
        <MainAppContent />
      </SyncProvider>
    </AuthProvider>
  );
}
