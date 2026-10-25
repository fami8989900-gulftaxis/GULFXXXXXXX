import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Booking, Driver, Vehicle, Supplier } from '../../types';
import {
  X,
  AlertCircle,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface BookingModalProps {
  booking?: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedBooking: Booking) => void;
  onViewVoucher?: (b: Booking, type: 'customer_voucher' | 'driver_voucher') => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  booking,
  isOpen,
  onClose,
  onSuccess,
  onViewVoucher,
}) => {
  const isEditing = Boolean(booking);

  const getCleanInitialState = () => ({
    // SECTION 1: Booking Information
    supplier_reference: '',
    pickup_date: new Date().toISOString().split('T')[0],
    pickup_time: '12:00',
    passenger_name: '',
    contact_number: '+966 ',
    pickup_location: '',
    dropoff_location: '',
    flight_number: '',
    passengers_count: 1,
    luggage_count: 1,

    // SECTION 2: Supplier Account & Pricing
    supplier_id: '',
    currency: 'SAR',
    supplier_cost: 0,
    driver_payout: 0,

    // SECTION 3: Dispatch Fleet & Driver Assignment
    driver_id: '',
    vehicle_id: '',

    // SECTION 4: Instructions & Dispatch Notes
    special_instructions: '',

    // Underlying preserved defaults (safe for database & reporting)
    booking_date: new Date().toISOString().split('T')[0],
    vehicle_type: 'Sedan (Camry / Lexus ES)',
    customer_name: '',
    customer_phone: '',
    customer_price: 0,
    payment_status: 'unpaid',
    paid_amount: 0,
    trip_status: 'Awaiting Assignment',
    dispatcher_notes: '',
  });

  const [formData, setFormData] = useState(getCleanInitialState());
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [vehicleLinkStatus, setVehicleLinkStatus] = useState<{
    linked: boolean;
    message: string;
  } | null>(null);

  // Load dropdown lists on open
  useEffect(() => {
    const loadDropdownData = async () => {
      try {
        const [dRes, vRes, sRes] = await Promise.all([
          api.getDrivers({ status: 'active' }),
          api.getVehicles(),
          api.getSuppliers({ status: 'active' }),
        ]);
        setDrivers(dRes.drivers || []);
        setVehicles(vRes.vehicles || []);
        setSuppliers(sRes.suppliers || []);
      } catch (e) {
        console.error('Failed to load dropdown options:', e);
      }
    };

    if (isOpen) {
      loadDropdownData();
      if (booking) {
        setFormData({
          supplier_reference: booking.supplier_reference || '',
          pickup_date: booking.pickup_date || new Date().toISOString().split('T')[0],
          pickup_time: booking.pickup_time || '12:00',
          passenger_name: booking.passenger_name || '',
          contact_number: booking.contact_number || '+966 ',
          pickup_location: booking.pickup_location || '',
          dropoff_location: booking.dropoff_location || '',
          flight_number: booking.flight_number || '',
          passengers_count: booking.passengers_count || 1,
          luggage_count: booking.luggage_count || 1,

          supplier_id: booking.supplier_id || '',
          currency: booking.currency || 'SAR',
          supplier_cost: booking.supplier_cost || 0,
          driver_payout: booking.driver_payout || 0,

          driver_id: booking.driver_id || '',
          vehicle_id: booking.vehicle_id || '',

          special_instructions:
            booking.special_instructions || booking.dispatcher_notes || '',

          booking_date: booking.booking_date || new Date().toISOString().split('T')[0],
          vehicle_type: booking.vehicle_type || 'Sedan (Camry / Lexus ES)',
          customer_name: booking.customer_name || '',
          customer_phone: booking.customer_phone || '',
          customer_price: booking.customer_price || 0,
          payment_status: booking.payment_status || 'unpaid',
          paid_amount: booking.paid_amount || 0,
          trip_status: booking.trip_status || 'Awaiting Assignment',
          dispatcher_notes: booking.dispatcher_notes || '',
        });

        // Check if existing driver has linked vehicle
        if (booking.driver_id) {
          api.getDrivers().then((res) => {
            const foundDrv = res.drivers?.find((d: Driver) => d.id === booking.driver_id);
            if (foundDrv?.assigned_vehicle_id) {
              setVehicleLinkStatus({
                linked: true,
                message: `✅ Vehicle linked to chauffeur ${foundDrv.full_name}`,
              });
            } else if (!booking.vehicle_id) {
              setVehicleLinkStatus({
                linked: false,
                message:
                  '⚠️ No dedicated vehicle linked to this driver. Please select an available vehicle below.',
              });
            }
          });
        }
      } else {
        setFormData(getCleanInitialState());
        setVehicleLinkStatus(null);
      }
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, booking]);

  if (!isOpen) return null;

  // Handle Supplier Selection -> Automatically set currency
  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = e.target.value;
    const selectedSupplier = suppliers.find((s) => s.id === sId);

    setFormData((prev) => ({
      ...prev,
      supplier_id: sId,
      currency: selectedSupplier?.default_currency || prev.currency || 'SAR',
      customer_name: selectedSupplier?.name || prev.customer_name || 'Partner Supplier',
    }));
  };

  // Handle Driver Selection -> Automatically select linked vehicle
  const handleDriverChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const dId = e.target.value;
    const selectedDriver = drivers.find((d) => d.id === dId);

    if (dId && selectedDriver) {
      if (selectedDriver.assigned_vehicle_id) {
        const linkedVeh = vehicles.find((v) => v.id === selectedDriver.assigned_vehicle_id);
        const vehName = linkedVeh
          ? `${linkedVeh.reg_number} (${linkedVeh.make_model})`
          : 'Dedicated Fleet Car';

        setFormData((prev) => ({
          ...prev,
          driver_id: dId,
          vehicle_id: selectedDriver.assigned_vehicle_id!,
          trip_status:
            prev.trip_status === 'Awaiting Assignment' ? 'Assigned' : prev.trip_status,
        }));
        setVehicleLinkStatus({
          linked: true,
          message: `✅ Auto-selected linked vehicle: ${vehName}`,
        });
      } else {
        // Driver has NO linked vehicle
        setFormData((prev) => ({
          ...prev,
          driver_id: dId,
          trip_status:
            prev.trip_status === 'Awaiting Assignment' ? 'Assigned' : prev.trip_status,
        }));
        setVehicleLinkStatus({
          linked: false,
          message:
            '⚠️ No dedicated vehicle linked to this driver. Please select an available vehicle below.',
        });
      }
    } else {
      // Driver unassigned
      setFormData((prev) => ({
        ...prev,
        driver_id: '',
      }));
      setVehicleLinkStatus(null);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Reset Form
  const handleReset = () => {
    if (window.confirm('🔄 Discard current inputs and reset the form to clean defaults?')) {
      setFormData(getCleanInitialState());
      setError(null);
      setSuccessMsg(null);
      setVehicleLinkStatus(null);
    }
  };

  // Cancel / Close Form
  const handleCancel = () => {
    if (
      formData.passenger_name.trim() &&
      !window.confirm('✖️ Discard unsaved changes and close the booking window?')
    ) {
      return;
    }
    onClose();
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const errors: string[] = [];
    if (!formData.pickup_date) errors.push('📅 Pickup Date');
    if (!formData.pickup_time) errors.push('⏰ Pickup Time');
    if (!formData.passenger_name.trim()) errors.push('👤 Passenger Name');
    if (!formData.contact_number.trim() || formData.contact_number === '+966 ') {
      errors.push('📞 Contact Number');
    }
    if (!formData.pickup_location.trim()) errors.push('📍 Pickup Location');
    if (!formData.dropoff_location.trim()) errors.push('🏨 Drop-off Location');

    if (errors.length > 0) {
      setError(`⚠️ Please Check Required Fields: ${errors.join(', ')}`);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    // Prepare payload preserving dependencies required by backend and reporting
    const payload = {
      ...formData,
      // Map single instruction field to both notes & instructions for maximum compatibility
      special_instructions: formData.special_instructions,
      dispatcher_notes: formData.special_instructions,
      // Ensure customer_name has a clean fallback
      customer_name:
        formData.customer_name ||
        (formData.supplier_id
          ? suppliers.find((s) => s.id === formData.supplier_id)?.name || 'Partner Supplier'
          : formData.passenger_name.trim()),
    };

    try {
      if (isEditing && booking) {
        const res = await api.updateBooking(booking.id, payload);
        setSuccessMsg(`✅ Booking Saved Successfully: Reference ${booking.booking_ref}`);
        setTimeout(() => {
          onSuccess(res.booking);
          onClose();
        }, 700);
      } else {
        const res = await api.createBooking(payload);
        setSuccessMsg(`✅ Booking Saved Successfully: Reference ${res.booking.booking_ref}`);
        setTimeout(() => {
          onSuccess(res.booking);
          // Open a clean new-booking form with fresh defaults
          setFormData(getCleanInitialState());
          setVehicleLinkStatus(null);
          setSuccessMsg(null);
          setSaving(false);
        }, 800);
      }
    } catch (err: any) {
      setError(err.message || '⚠️ Failed to save booking. Please review your entries.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* ===================== MODAL HEADER ===================== */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-blue-900/50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 text-xl font-bold">
              {isEditing ? '✏️' : '📅'}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                  {isEditing ? '✏️ Edit Transport Booking' : '📅 Create New Transport Booking'}
                </h2>
                {isEditing ? (
                  <span className="font-mono text-xs sm:text-[13px] bg-blue-500/20 text-blue-300 border border-blue-400/30 px-3 py-0.5 rounded-md font-bold">
                    🆔 {booking?.booking_ref}
                  </span>
                ) : (
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-md font-semibold hidden sm:inline-block">
                    ⚡ Real-Time Cloud Dispatch
                  </span>
                )}
              </div>
              <p className="text-[13px] text-blue-200/80 mt-1">
                {isEditing
                  ? `Editing reservation ${booking?.booking_ref} • All records update live`
                  : 'Unique booking reference will be automatically generated upon saving'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditing && booking && onViewVoucher && (
              <button
                type="button"
                onClick={() => onViewVoucher(booking, 'customer_voucher')}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors cursor-pointer min-h-[38px]"
                title="Print Passenger Voucher"
              >
                <span>🖨️</span>
                <span>Print Voucher</span>
              </button>
            )}

            <button
              onClick={handleCancel}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ===================== NOTIFICATIONS BAR ===================== */}
        {error && (
          <div className="p-3 bg-rose-50 border-b border-rose-200 flex items-center justify-between text-rose-800 text-sm px-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-rose-500 hover:text-rose-700 font-bold ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between text-emerald-800 text-sm px-6 animate-pulse">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold">{successMsg}</span>
            </div>
          </div>
        )}

        {/* ===================== FORM BODY ===================== */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-sm custom-scrollbar"
        >
          {/* ============================================================ */}
          {/* 1. 📅 Booking Information                                   */}
          {/* ============================================================ */}
          <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 uppercase tracking-wide text-sm flex items-center gap-1.5">
                <span className="text-blue-900 text-base">📅</span>
                <span className="text-slate-900">Booking Information</span>
              </h3>
              <span className="text-xs text-slate-500 font-semibold bg-white px-2.5 py-1 rounded-md border border-slate-200">
                Required Fields Marked <span className="text-rose-500 font-bold">*</span>
              </span>
            </div>

            {/* 4-Field Single Horizontal Row on Desktop: 🆔 Booking Number | 🔖 Supplier Ref | 📅 Pickup Date | ⏰ Pickup Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. 🆔 Booking Number */}
              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="text-sm">🆔</span>
                  <span>Booking Number</span>
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={
                    isEditing
                      ? (booking?.booking_ref || '')
                      : 'Auto-Generated'
                  }
                  title="Booking Number is automatically generated upon saving"
                  className="w-full min-h-[40px] px-3.5 bg-slate-100/90 border border-slate-300 rounded-xl font-mono font-bold text-blue-950 select-all cursor-not-allowed text-sm shadow-2xs tracking-wide"
                />
              </div>

              {/* 2. 🔖 Supplier Reference Number */}
              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="text-sm">🔖</span>
                  <span>Supplier Ref No.</span>
                </label>
                <input
                  type="text"
                  placeholder="SUP-8921"
                  name="supplier_reference"
                  value={formData.supplier_reference}
                  onChange={handleChange}
                  className="w-full min-h-[40px] px-3.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none shadow-2xs transition-colors"
                />
              </div>

              {/* 3. 📅 Pickup Date */}
              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="text-sm">📅</span>
                  <span>
                    Pickup Date <span className="text-rose-500 font-bold">*</span>
                  </span>
                </label>
                <input
                  type="date"
                  required
                  name="pickup_date"
                  value={formData.pickup_date}
                  onChange={handleChange}
                  onClick={(e) => {
                    try {
                      (e.currentTarget as HTMLInputElement).showPicker?.();
                    } catch {}
                  }}
                  className="w-full min-h-[40px] px-3.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none cursor-pointer shadow-2xs transition-colors"
                />
              </div>

              {/* 4. ⏰ Pickup Time */}
              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="text-sm">⏰</span>
                  <span>
                    Pickup Time (24h) <span className="text-rose-500 font-bold">*</span>
                  </span>
                </label>
                <input
                  type="time"
                  required
                  step="60"
                  name="pickup_time"
                  value={formData.pickup_time}
                  onChange={handleChange}
                  placeholder="12:00"
                  onClick={(e) => {
                    try {
                      (e.currentTarget as HTMLInputElement).showPicker?.();
                    } catch {}
                  }}
                  className="w-full min-h-[40px] px-3.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono font-bold text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none cursor-pointer shadow-2xs transition-colors"
                />
              </div>
            </div>

            {/* Field 5 & 6: 👤 Passenger Name + 📞 Contact Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="text-sm">👤</span>
                  <span>
                    Passenger Name <span className="text-rose-500 font-bold">*</span>
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mr. David Miller / Dr. Khalid Al-Mutairi"
                  name="passenger_name"
                  value={formData.passenger_name}
                  onChange={handleChange}
                  className="w-full min-h-[40px] px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="text-sm">📞</span>
                  <span>
                    Contact Number <span className="text-rose-500 font-bold">*</span>
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +966 50 123 4567"
                  name="contact_number"
                  value={formData.contact_number}
                  onChange={handleChange}
                  className="w-full min-h-[40px] px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono text-sm"
                />
              </div>
            </div>

            {/* Field 7 & 8: 📍 Pickup Location + 🏨 Drop-off Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="text-sm">📍</span>
                  <span>
                    Pickup Location <span className="text-rose-500 font-bold">*</span>
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. King Khalid Int Airport (RUH) Terminal 4"
                  name="pickup_location"
                  value={formData.pickup_location}
                  onChange={handleChange}
                  className="w-full min-h-[40px] px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="text-sm">🏨</span>
                  <span>
                    Drop-off Location <span className="text-rose-500 font-bold">*</span>
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Four Seasons Hotel Riyadh, Kingdom Centre"
                  name="dropoff_location"
                  value={formData.dropoff_location}
                  onChange={handleChange}
                  className="w-full min-h-[40px] px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                />
              </div>
            </div>

            {/* Field 9, 10, 11: ✈️ Flight Number + 👥 Passengers (Pax) + 🧳 Luggage Bags */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="text-sm">✈️</span>
                  <span>Flight Number</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. SV 1024 / EK 803"
                  name="flight_number"
                  value={formData.flight_number}
                  onChange={handleChange}
                  className="w-full min-h-[40px] px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono uppercase text-sm"
                />
              </div>

              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="text-sm">👥</span>
                  <span>Passengers (Pax)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  name="passengers_count"
                  value={formData.passengers_count}
                  onChange={handleChange}
                  className="w-full min-h-[40px] px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="text-sm">🧳</span>
                  <span>Luggage Bags</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  name="luggage_count"
                  value={formData.luggage_count}
                  onChange={handleChange}
                  className="w-full min-h-[40px] px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm font-semibold"
                />
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* ============================================================ */}
          {/* Row 1 — 💳 Supplier & Pricing                                */}
          {/* ============================================================ */}
          <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 uppercase tracking-wide text-sm flex items-center gap-1.5">
                <span className="text-blue-900 text-base">💳</span>
                <span className="text-slate-900">Supplier & Pricing</span>
              </h3>
            </div>

            {/* 4 Fields side-by-side on desktop in exact requested order */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. 🏢 Supplier */}
              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="text-sm">🏢</span>
                  <span>Supplier</span>
                </label>
                <select
                  name="supplier_id"
                  value={formData.supplier_id}
                  onChange={handleSupplierChange}
                  className="w-full min-h-[40px] px-3.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none shadow-2xs transition-colors"
                >
                  <option value="">🏢 In-House Fleet</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      🏢 {s.name} ({s.supplier_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. 💱 Supplier Currency */}
              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="text-sm">💱</span>
                  <span>Supplier Currency</span>
                </label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className="w-full min-h-[40px] px-3.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-semibold text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none shadow-2xs transition-colors"
                >
                  <option value="SAR">🇸🇦 SAR - Saudi Riyal</option>
                  <option value="USD">🇺🇸 USD - US Dollar</option>
                  <option value="AED">🇦🇪 AED - UAE Dirham</option>
                  <option value="EUR">🇪🇺 EUR - Euro</option>
                  <option value="GBP">🇬🇧 GBP - British Pound</option>
                  <option value="KWD">🇰🇼 KWD - Kuwaiti Dinar</option>
                </select>
              </div>

              {/* 3. 💰 Supplier Purchase Cost */}
              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="text-sm">💰</span>
                  <span>Supplier Purchase Cost</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    name="supplier_cost"
                    value={formData.supplier_cost}
                    onChange={handleChange}
                    className="w-full min-h-[40px] pl-3.5 pr-12 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono font-semibold text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none shadow-2xs transition-colors"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    {formData.currency}
                  </span>
                </div>
              </div>

              {/* 4. 🧑‍✈️ Driver Cost */}
              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="text-sm">🧑‍✈️</span>
                  <span>Driver Cost</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    name="driver_payout"
                    value={formData.driver_payout}
                    onChange={handleChange}
                    className="w-full min-h-[40px] pl-3.5 pr-12 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono font-semibold text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none shadow-2xs transition-colors"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    {formData.currency}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* Row 2 — 🚘 Dispatch Fleet & Driver Assignment + 📝 Instructions */}
          {/* ============================================================ */}
          <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 uppercase tracking-wide text-sm flex items-center gap-1.5">
                <span className="text-blue-900 text-base">🚘</span>
                <span className="text-slate-900">Dispatch Fleet & Driver Assignment</span>
              </h3>
            </div>

            {/* Top of row: Assign Driver and Assigned Vehicle side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Assign Driver */}
              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="text-sm">🧑‍✈️</span>
                  <span>Assign Driver</span>
                </label>
                <select
                  name="driver_id"
                  value={formData.driver_id}
                  onChange={handleDriverChange}
                  className="w-full min-h-[40px] px-3.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none shadow-2xs transition-colors"
                >
                  <option value="">👤 ⏳ Unassigned (Assign Later in Dispatch)</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      🧑‍✈️ {d.full_name} ({d.driver_code}){' '}
                      {d.assigned_vehicle_id ? '🚗 [Linked Car]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assigned Vehicle */}
              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="text-sm">🚗</span>
                  <span>Assigned Vehicle</span>
                </label>
                <select
                  name="vehicle_id"
                  value={formData.vehicle_id}
                  onChange={handleChange}
                  className={`w-full min-h-[40px] px-3.5 bg-white border rounded-xl text-slate-900 font-medium text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none shadow-2xs transition-colors ${
                    vehicleLinkStatus && !vehicleLinkStatus.linked && formData.driver_id
                      ? 'border-amber-400 bg-amber-50/40'
                      : 'border-slate-300'
                  }`}
                >
                  <option value="">🚗 ⏳ No Specific Vehicle Assigned</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      🚗 {v.reg_number} — {v.make_model} ({v.vehicle_type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Vehicle link status indicator */}
            {vehicleLinkStatus && (
              <div
                className={`px-3.5 py-2 rounded-xl border flex items-center gap-2 text-[13px] font-semibold ${
                  vehicleLinkStatus.linked
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-900 border-amber-300'
                }`}
              >
                {vehicleLinkStatus.linked ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span>{vehicleLinkStatus.message}</span>
              </div>
            )}

            {/* Special Instructions / Dispatch Notes immediately beneath them as a single-line, full-width input */}
            <div>
              <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <span className="text-sm">📝</span>
                <span>Special Instructions / Dispatch Notes</span>
              </label>
              <input
                type="text"
                name="special_instructions"
                value={formData.special_instructions}
                onChange={handleChange}
                placeholder="e.g. 🪧 Name board: 'Dr. Khalid Al-Mutairi'. 🛬 Meet at Arrival Gate 4. 🧳 Luggage assistance requested."
                className="w-full min-h-[40px] px-3.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none text-sm shadow-2xs transition-colors"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Internal dispatch notes & driver instructions. Synchronized with trip manifests and dispatch sheets.
              </p>
            </div>
          </div>

          {/* ===================== FOOTER ACTION BUTTONS ===================== */}
          <div className="pt-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 sticky bottom-0 bg-white/95 backdrop-blur-xs py-2.5">
            <div>
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl text-slate-700 font-semibold transition-colors cursor-pointer text-sm min-h-[40px]"
                title="Reset Form"
              >
                <span>🔄</span>
                <span>Reset Form</span>
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="flex items-center gap-2 px-4.5 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl text-slate-700 font-semibold transition-colors cursor-pointer text-sm min-h-[40px]"
              >
                <span>✖️</span>
                <span>Cancel</span>
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-600/25 transition-all cursor-pointer text-sm min-h-[40px] disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Saving Booking...</span>
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    <span>{isEditing ? 'Save Booking Changes' : 'Save Booking'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
