const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('gt_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.error || `Request failed with status ${response.status}`;
    // If unauthorized, clear token and emit custom event
    if (response.status === 401) {
      localStorage.removeItem('gt_token');
      localStorage.removeItem('gt_user');
      window.dispatchEvent(new CustomEvent('auth_unauthorized'));
    }
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  // Auth
  login: (credentials: any) =>
    apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getMe: () => apiRequest('/auth/me'),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  forgotPassword: (email: string) =>
    apiRequest('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  changePassword: (passwords: any) =>
    apiRequest('/auth/change-password', { method: 'POST', body: JSON.stringify(passwords) }),

  // Bookings
  getBookings: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
    });
    return apiRequest(`/bookings?${query.toString()}`);
  },
  getBooking: (id: string) => apiRequest(`/bookings/${id}`),
  createBooking: (booking: any) =>
    apiRequest('/bookings', { method: 'POST', body: JSON.stringify(booking) }),
  updateBooking: (id: string, booking: any) =>
    apiRequest(`/bookings/${id}`, { method: 'PUT', body: JSON.stringify(booking) }),
  duplicateBooking: (id: string) =>
    apiRequest(`/bookings/${id}/duplicate`, { method: 'POST' }),
  cancelBooking: (id: string, reason?: string) =>
    apiRequest(`/bookings/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  deleteBooking: (id: string) =>
    apiRequest(`/bookings/${id}`, { method: 'DELETE' }),

  // Dispatch
  getDispatch: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
    });
    return apiRequest(`/dispatch?${query.toString()}`);
  },
  checkConflicts: (data: any) =>
    apiRequest('/dispatch/check-conflicts', { method: 'POST', body: JSON.stringify(data) }),
  assignTrip: (data: any) =>
    apiRequest('/dispatch/assign', { method: 'POST', body: JSON.stringify(data) }),
  updateTripStatus: (data: any) =>
    apiRequest('/dispatch/update-status', { method: 'POST', body: JSON.stringify(data) }),

  // Drivers
  getDrivers: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
    });
    return apiRequest(`/drivers?${query.toString()}`);
  },
  getDriver: (id: string) => apiRequest(`/drivers/${id}`),
  createDriver: (data: any) =>
    apiRequest('/drivers', { method: 'POST', body: JSON.stringify(data) }),
  updateDriver: (id: string, data: any) =>
    apiRequest(`/drivers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDriver: (id: string) =>
    apiRequest(`/drivers/${id}`, { method: 'DELETE' }),
  reactivateDriver: (id: string) =>
    apiRequest(`/drivers/${id}/reactivate`, { method: 'POST' }),
  getDriverStatement: (id: string, params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) query.append(k, String(v));
    });
    return apiRequest(`/drivers/${id}/statement?${query.toString()}`);
  },

  // Vehicles
  getVehicles: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) query.append(k, String(v));
    });
    return apiRequest(`/vehicles?${query.toString()}`);
  },
  createVehicle: (data: any) =>
    apiRequest('/vehicles', { method: 'POST', body: JSON.stringify(data) }),
  updateVehicle: (id: string, data: any) =>
    apiRequest(`/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteVehicle: (id: string) =>
    apiRequest(`/vehicles/${id}`, { method: 'DELETE' }),

  // Suppliers
  getSuppliers: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) query.append(k, String(v));
    });
    return apiRequest(`/suppliers?${query.toString()}`);
  },
  getSupplier: (id: string) => apiRequest(`/suppliers/${id}`),
  createSupplier: (data: any) =>
    apiRequest('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: string, data: any) =>
    apiRequest(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplier: (id: string) =>
    apiRequest(`/suppliers/${id}`, { method: 'DELETE' }),
  reactivateSupplier: (id: string) =>
    apiRequest(`/suppliers/${id}/reactivate`, { method: 'POST' }),
  getSupplierStatement: (id: string, params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) query.append(k, String(v));
    });
    return apiRequest(`/suppliers/${id}/statement?${query.toString()}`);
  },

  // Finance
  getFinanceOverview: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) query.append(k, String(v));
    });
    return apiRequest(`/finance/overview?${query.toString()}`);
  },
  getPayments: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) query.append(k, String(v));
    });
    return apiRequest(`/finance/payments?${query.toString()}`);
  },
  createPayment: (data: any) =>
    apiRequest('/finance/payments', { method: 'POST', body: JSON.stringify(data) }),
  updatePayment: (id: string, data: any) =>
    apiRequest(`/finance/payments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePayment: (id: string) =>
    apiRequest(`/finance/payments/${id}`, { method: 'DELETE' }),
  updateExpense: (id: string, data: any) =>
    apiRequest(`/finance/payments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpense: (id: string) =>
    apiRequest(`/finance/payments/${id}`, { method: 'DELETE' }),
  getPaymentReceipt: (id: string) => apiRequest(`/finance/receipt/${id}`),

  // Reports
  getReport: (reportType: string, params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) query.append(k, String(v));
    });
    return apiRequest(`/reports/${reportType}?${query.toString()}`);
  },

  // Users
  getUsers: () => apiRequest('/users'),
  createUser: (data: any) =>
    apiRequest('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) =>
    apiRequest(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleUserStatus: (id: string) =>
    apiRequest(`/users/${id}/toggle-status`, { method: 'POST' }),
  deleteUser: (id: string) =>
    apiRequest(`/users/${id}`, { method: 'DELETE' }),

  // Settings & Backups
  getSettings: () => apiRequest('/settings'),
  updateSettings: (key: string, value: any) =>
    apiRequest('/settings', { method: 'PUT', body: JSON.stringify({ key, value }) }),
  getAuditLogs: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) query.append(k, String(v));
    });
    return apiRequest(`/settings/audit-logs?${query.toString()}`);
  },
  getBackups: () => apiRequest('/backups'),
  createBackup: () => apiRequest('/backups/create', { method: 'POST' }),
  restoreBackup: (filename: string) =>
    apiRequest('/backups/restore', { method: 'POST', body: JSON.stringify({ filename }) }),

  // Data Management / Fresh Start
  getDataSummary: () => apiRequest('/data-management/summary'),
  executeFreshStart: (payload: any) =>
    apiRequest('/data-management/fresh-start', { method: 'POST', body: JSON.stringify(payload) }),

  // Sync Pulse
  getPulse: () => apiRequest('/sync/pulse'),
};
