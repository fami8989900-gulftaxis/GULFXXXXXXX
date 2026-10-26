export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'booking_agent'
  | 'dispatcher'
  | 'finance_executive'
  | 'report_viewer';

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  permissions: string[];
  is_active: number;
  last_login?: string;
  created_at?: string;
}

export type TripStatus =
  | 'New Booking'
  | 'Awaiting Assignment'
  | 'Assigned'
  | 'Driver Notified'
  | 'Driver on the Way'
  | 'Arrived at Pickup'
  | 'Passenger Picked Up'
  | 'Trip Completed'
  | 'Cancelled'
  | 'No Show';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';

export interface Booking {
  id: string;
  booking_ref: string;
  booking_date: string;
  pickup_date: string;
  pickup_time: string;
  passenger_name: string;
  contact_number: string;
  passengers_count: number;
  luggage_count: number;
  pickup_location: string;
  dropoff_location: string;
  flight_number?: string;
  airline?: string;
  vehicle_type: string;
  vehicle_id?: string;
  vehicle_reg?: string;
  vehicle_model?: string;
  driver_id?: string;
  driver_name?: string;
  driver_phone?: string;
  driver_code?: string;
  supplier_id?: string;
  supplier_name?: string;
  supplier_reference?: string;
  customer_name: string;
  customer_phone?: string;
  customer_price: number;
  supplier_cost: number;
  driver_payout: number;
  currency: string;
  payment_status: PaymentStatus;
  paid_amount: number;
  trip_status: TripStatus;
  cancellation_reason?: string;
  special_instructions?: string;
  dispatcher_notes?: string;
  created_by_id?: string;
  created_by_name?: string;
  updated_by_id?: string;
  updated_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface Driver {
  id: string;
  driver_code: string;
  full_name: string;
  mobile: string;
  email?: string;
  license_number: string;
  license_expiry: string;
  assigned_vehicle_id?: string;
  vehicle_reg?: string;
  vehicle_model?: string;
  payment_arrangement: 'per_trip' | 'monthly' | 'commission' | 'fixed_plus_trip';
  rate_or_salary: number;
  currency: string;
  is_active: number;
  current_balance: number;
  calculated_balance?: number;
  notes?: string;
  completed_trips_count?: number;
  active_trips_count?: number;
  total_bookings_count?: number;
  payments_count?: number;
}

export interface Vehicle {
  id: string;
  reg_number: string;
  vehicle_type: string;
  make_model: string;
  passenger_capacity: number;
  luggage_capacity: number;
  supplier_id?: string;
  supplier_name?: string;
  assigned_driver_id?: string;
  driver_name?: string;
  driver_phone?: string;
  status: 'available' | 'on_trip' | 'maintenance' | 'inactive';
  color?: string;
  model_year?: number;
  notes?: string;
  total_trips_count?: number;
}

export interface Supplier {
  id: string;
  supplier_code: string;
  name: string;
  contact_person?: string;
  mobile: string;
  email?: string;
  address?: string;
  default_currency: string;
  opening_balance: number;
  current_balance: number;
  calculated_balance?: number;
  payment_terms: string;
  is_active: number;
  notes?: string;
  total_bookings_count?: number;
  fleet_vehicles_count?: number;
  payments_count?: number;
}

export type EntityType =
  | 'customer_receipt'
  | 'driver_payment'
  | 'supplier_payment'
  | 'general_expense'
  | 'refund_adjustment';

export interface Payment {
  id: string;
  payment_ref: string;
  entity_type: EntityType;
  entity_id?: string;
  entity_name?: string;
  booking_id?: string;
  booking_ref?: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_date: string;
  reference_no?: string;
  notes?: string;
  created_by_name?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user_name?: string;
  action: string;
  entity: string;
  entity_id?: string;
  details: string;
  ip_address?: string;
  timestamp: string;
}

export interface TripStatusLog {
  id: string;
  booking_id: string;
  booking_ref: string;
  old_status?: string;
  new_status: string;
  changed_by_id?: string;
  changed_by_name?: string;
  notes?: string;
  timestamp: string;
}

export interface CompanyProfile {
  company_name: string;
  short_name: string;
  tagline: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  cr_number: string;
  vat_number: string;
  default_currency: string;
  supported_currencies: string[];
  timezone: string;
  booking_prefix: string;
}
