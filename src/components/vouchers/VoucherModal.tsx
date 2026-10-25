import React, { useRef } from 'react';
import { Booking, Driver, Supplier, Payment } from '../../types';
import {
  X,
  Printer,
  Download,
  Car,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Plane,
  ShieldCheck,
  CheckCircle2,
  FileText,
  User
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface VoucherModalProps {
  type: 'customer_voucher' | 'driver_voucher' | 'dispatch_sheet' | 'payment_receipt';
  booking?: Booking | null;
  payment?: Payment | null;
  isOpen: boolean;
  onClose: () => void;
}

export const VoucherModal: React.FC<VoucherModalProps> = ({
  type,
  booking,
  payment,
  isOpen,
  onClose,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF();

    if (type === 'payment_receipt' && payment) {
      doc.setFontSize(20);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('GULF TAXIS — PAYMENT RECEIPT', 14, 22);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('Gulf Taxis Dispatch Cloud System • Official Transaction Voucher', 14, 28);
      doc.text(`Receipt Reference: ${payment.payment_ref}`, 14, 34);
      doc.text(`Transaction Date: ${payment.payment_date}`, 14, 40);

      autoTable(doc, {
        startY: 48,
        head: [['Field', 'Transaction Information']],
        body: [
          ['Payment Ref', payment.payment_ref],
          ['Entity Type', payment.entity_type.replace('_', ' ').toUpperCase()],
          ['Entity / Name', payment.entity_name || 'N/A'],
          ['Related Booking Ref', payment.booking_ref || 'N/A'],
          ['Payment Method', payment.payment_method],
          ['Transaction Reference #', payment.reference_no || 'N/A'],
          ['Amount Paid', `${payment.amount.toLocaleString()} ${payment.currency}`],
          ['Notes / Remarks', payment.notes || 'None'],
          ['Authorized By', payment.created_by_name || 'Accounts Dept'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] },
      });

      doc.save(`${payment.payment_ref}_receipt.pdf`);
      return;
    }

    if (booking) {
      const isCustomer = type === 'customer_voucher';
      const title = isCustomer
        ? 'GULF TAXIS — PASSENGER BOOKING VOUCHER'
        : 'GULF TAXIS — DRIVER TRIP SHEET';

      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);
      doc.text(title, 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Booking Reference: ${booking.booking_ref}`, 14, 27);
      doc.text(`Pickup Date: ${booking.pickup_date} at ${booking.pickup_time} (24h)`, 14, 33);
      doc.text(`Trip Status: ${booking.trip_status}`, 14, 39);

      const tableRows: any[] = [
        ['Booking Reference', booking.booking_ref],
        ['Passenger Name', booking.passenger_name],
        ['Passenger Contact', booking.contact_number],
        ['Pickup Date & Time', `${booking.pickup_date} @ ${booking.pickup_time}`],
        ['Pickup Location', booking.pickup_location],
        ['Drop-off Location', booking.dropoff_location],
        ['Flight Details', booking.flight_number ? `${booking.airline || ''} ${booking.flight_number}` : 'N/A'],
        ['Vehicle Category', booking.vehicle_type],
        ['Assigned Driver', booking.driver_name ? `${booking.driver_name} (${booking.driver_phone || ''})` : 'To Be Assigned'],
        ['Vehicle Plate / Reg', booking.vehicle_reg || 'Assigned prior to pickup'],
        ['Passengers / Bags', `${booking.passengers_count} Pax, ${booking.luggage_count} Luggage`],
        ['Special Instructions', booking.special_instructions || 'Standard VIP meet and greet'],
      ];

      if (!isCustomer) {
        // Driver voucher displays driver payout and internal dispatch notes
        tableRows.push(['Driver Payout', `${booking.driver_payout} ${booking.currency}`]);
        tableRows.push(['Dispatcher Notes', booking.dispatcher_notes || 'None']);
      }

      autoTable(doc, {
        startY: 46,
        head: [['Specification', 'Details']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138] },
      });

      doc.save(`${booking.booking_ref}_voucher.pdf`);
    }
  };

  const isCustomer = type === 'customer_voucher';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none">
        {/* Header toolbar (hidden in print) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-base">
              {type === 'customer_voucher' && 'Customer Booking Voucher (Confidential Rates Masked)'}
              {type === 'driver_voucher' && 'Driver Trip Sheet & Dispatch Voucher'}
              {type === 'payment_receipt' && 'Official Payment Transaction Receipt'}
            </h3>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 min-h-[38px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Paper */}
        <div ref={printRef} className="p-6 sm:p-8 flex-1 overflow-y-auto text-slate-800 space-y-6">
          {/* Top Brand Banner */}
          <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-2xl shadow-md">
                GT
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">GULF TAXIS</h1>
                <p className="text-[13.5px] text-slate-500 font-semibold">Premium Transport & Chauffeur Services</p>
                <p className="text-xs text-slate-400 mt-0.5">King Fahd Road, Riyadh, Saudi Arabia • CR: 1010892341</p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <div className="text-xs sm:text-[13px] font-bold text-blue-600 uppercase tracking-wider">
                {type === 'customer_voucher' && 'Passenger Travel Voucher'}
                {type === 'driver_voucher' && 'Driver Dispatch Sheet'}
                {type === 'payment_receipt' && 'Official Payment Receipt'}
              </div>
              <div className="text-xl sm:text-2xl font-mono font-black text-slate-900 mt-0.5">
                {booking ? booking.booking_ref : payment?.payment_ref}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Issued: {new Date().toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Payment Receipt View */}
          {type === 'payment_receipt' && payment && (
            <div className="space-y-4 text-sm">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Total Amount Received</div>
                  <div className="text-3xl font-black text-emerald-950 font-mono mt-1">
                    {payment.amount.toLocaleString()} {payment.currency}
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 text-white rounded-full text-sm font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmed Settled</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 text-sm">
                <div>
                  <span className="text-slate-500 text-xs block mb-0.5">Payment Type</span>
                  <span className="font-bold text-slate-900 capitalize text-sm">{payment.entity_type.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs block mb-0.5">Entity Name / Account</span>
                  <span className="font-bold text-slate-900 text-sm">{payment.entity_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs block mb-0.5">Payment Method</span>
                  <span className="font-bold text-slate-900 text-sm">{payment.payment_method}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-xs block mb-0.5">Reference Number / Cheque #</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">{payment.reference_no || 'None'}</span>
                </div>
                {payment.booking_ref && (
                  <div className="col-span-2">
                    <span className="text-slate-500 text-xs block mb-0.5">Applied to Booking Reference</span>
                    <span className="font-mono font-bold text-blue-600 text-sm">{payment.booking_ref}</span>
                  </div>
                )}
                {payment.notes && (
                  <div className="col-span-2">
                    <span className="text-slate-500 text-xs block mb-0.5">Remarks / Notes</span>
                    <span className="text-slate-700 italic text-sm">{payment.notes}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Booking Voucher View */}
          {booking && (
            <div className="space-y-5 text-sm">
              {/* Pickup & Timing Highlight Card */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-blue-600 text-white rounded-xl">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs text-blue-700 font-bold uppercase tracking-wider">Pickup Date & Time</div>
                    <div className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
                      {booking.pickup_date} at <span className="font-mono text-blue-600">{booking.pickup_time} (24h)</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold px-3.5 py-1.5 bg-white border border-blue-200 text-blue-900 rounded-xl shadow-2xs">
                    {booking.trip_status}
                  </span>
                </div>
              </div>

              {/* Passenger & Routing Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-2xl p-4 sm:p-5 bg-slate-50/50">
                  <h4 className="font-bold text-slate-900 uppercase text-xs mb-3 flex items-center gap-2 text-blue-700">
                    <User className="w-4 h-4" />
                    <span>Passenger Information</span>
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-slate-500 text-xs">Name: </span>
                      <span className="font-bold text-slate-900 text-[14.5px] block sm:inline">{booking.passenger_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs">Mobile Phone: </span>
                      <span className="font-mono font-bold text-slate-900 block sm:inline">{booking.contact_number}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs">Passengers: </span>
                      <span className="font-semibold text-slate-800">{booking.passengers_count} Pax</span>
                      <span className="text-slate-400 mx-2">|</span>
                      <span className="text-slate-500 text-xs">Luggage: </span>
                      <span className="font-semibold text-slate-800">{booking.luggage_count} Bags</span>
                    </div>
                    {booking.flight_number && (
                      <div className="pt-1 text-slate-700">
                        <span className="text-slate-500 text-xs">Flight: </span>
                        <span className="font-mono font-bold text-blue-800">{booking.airline || ''} {booking.flight_number}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl p-4 sm:p-5 bg-slate-50/50">
                  <h4 className="font-bold text-slate-900 uppercase text-xs mb-3 flex items-center gap-2 text-blue-700">
                    <Car className="w-4 h-4" />
                    <span>Vehicle & Chauffeur</span>
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-slate-500 text-xs">Category: </span>
                      <span className="font-bold text-slate-900 block sm:inline">{booking.vehicle_type}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs">Assigned Driver: </span>
                      <span className="font-bold text-slate-900 block sm:inline">
                        {booking.driver_name || 'Dispatched on arrival'}
                      </span>
                    </div>
                    {booking.driver_phone && (
                      <div>
                        <span className="text-slate-500 text-xs">Driver Contact: </span>
                        <span className="font-mono font-bold text-slate-900 block sm:inline">{booking.driver_phone}</span>
                      </div>
                    )}
                    {booking.vehicle_reg && (
                      <div>
                        <span className="text-slate-500 text-xs">Vehicle Reg #: </span>
                        <span className="font-mono font-bold text-slate-900 block sm:inline">{booking.vehicle_reg}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Route details */}
              <div className="border border-slate-200 rounded-2xl p-4 sm:p-5 bg-white space-y-3">
                <h4 className="font-bold text-slate-900 uppercase text-xs flex items-center gap-2 text-blue-700">
                  <MapPin className="w-4 h-4" />
                  <span>Transfer Route</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                    <span className="text-xs font-bold uppercase text-emerald-800 block mb-1">Pickup Location</span>
                    <span className="font-semibold text-slate-900 text-sm">{booking.pickup_location}</span>
                  </div>
                  <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl">
                    <span className="text-xs font-bold uppercase text-blue-800 block mb-1">Drop-off Destination</span>
                    <span className="font-semibold text-slate-900 text-sm">{booking.dropoff_location}</span>
                  </div>
                </div>
              </div>

              {/* Special instructions */}
              {booking.special_instructions && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900">
                  <span className="font-bold uppercase text-xs block text-amber-800 mb-1">Special Instructions / Meet & Greet</span>
                  <p className="font-medium text-sm leading-relaxed">{booking.special_instructions}</p>
                </div>
              )}

              {/* Confidential driver notes & pricing (hidden on customer voucher) */}
              {!isCustomer && (
                <div className="p-4 sm:p-5 bg-slate-100 border border-slate-300 rounded-2xl space-y-2.5">
                  <div className="font-bold uppercase text-xs text-slate-700">Internal Dispatch & Settlement Data</div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-slate-500 text-xs block">Customer Price:</span>
                      <span className="font-bold font-mono text-sm">{booking.customer_price} {booking.currency}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs block">Supplier Cost:</span>
                      <span className="font-bold font-mono text-sm">{booking.supplier_cost} {booking.currency}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs block">Driver Payout:</span>
                      <span className="font-bold font-mono text-emerald-700 text-sm">{booking.driver_payout} {booking.currency}</span>
                    </div>
                  </div>
                  {booking.dispatcher_notes && (
                    <div className="pt-1.5 text-slate-600 italic text-sm">
                      Notes: {booking.dispatcher_notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Footer Terms */}
          <div className="pt-6 border-t border-slate-200 text-xs text-slate-500 space-y-1">
            <p>• Emergency Dispatch 24/7 Helpline: +966 50 123 4567 | dispatch@gulftaxis.com</p>
            <p>• Flight delays: Driver monitors real-time flight tracking. Free waiting time applies for airport pickups.</p>
            <p>• Gulf Taxis Dispatch Cloud System • Certified Transport Management</p>
          </div>
        </div>
      </div>
    </div>
  );
};
