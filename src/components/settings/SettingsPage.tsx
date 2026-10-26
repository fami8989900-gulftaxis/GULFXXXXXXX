import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { User, UserRole, AuditLog } from '../../types';
import {
  Settings,
  Building,
  Users,
  Database,
  ShieldCheck,
  Globe,
  Plus,
  RefreshCw,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Terminal,
  Lock,
  Edit2,
  Trash2,
  AlertTriangle,
  RotateCcw,
  KeyRound,
  ShieldAlert
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const { syncVersion } = useSync();

  const [activeTab, setActiveTab] = useState<'company' | 'users' | 'backup' | 'audit' | 'deployment' | 'fresh-start'>('company');

  // Company Profile state
  const [companyProfile, setCompanyProfile] = useState<any>({
    company_name: 'Gulf Taxis Dispatch Cloud System',
    short_name: 'Gulf Taxis',
    tagline: 'Premium Transport Booking & Fleet Dispatch Solutions',
    email: 'dispatch@gulftaxis.com',
    phone: '+966 11 234 5678',
    whatsapp: '+966 50 123 4567',
    address: 'King Fahd Road, Al Olaya District, Riyadh 12211, Kingdom of Saudi Arabia',
    cr_number: '1010892341',
    vat_number: '310293847500003',
    default_currency: 'SAR',
    timezone: 'Asia/Riyadh',
    booking_prefix: 'GT-2026-',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Users state
  const [usersList, setUsersList] = useState<User[]>([]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    role: 'booking_agent' as UserRole,
    phone: '',
    permissions: ['dashboard', 'bookings'] as string[],
  });

  // Backup state
  const [backups, setBackups] = useState<any[]>([]);
  const [backupSchedule, setBackupSchedule] = useState('Every 6 hours & midnight snapshot');
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backupSuccessMsg, setBackupSuccessMsg] = useState<string | null>(null);

  // Audit state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const fetchSettings = async () => {
    try {
      const res = await api.getSettings();
      if (res.settings?.company_profile) {
        setCompanyProfile(res.settings.company_profile);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.getUsers();
      setUsersList(res.users || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBackups = async () => {
    try {
      const res = await api.getBackups();
      setBackups(res.backups || []);
      if (res.schedule) setBackupSchedule(res.schedule);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await api.getAuditLogs({ limit: 150 });
      setAuditLogs(res.logs || []);
    } catch (e) {
      console.error(e);
    }
  };

  // Delete User State
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null);
  const [deleteUserSuccess, setDeleteUserSuccess] = useState<string | null>(null);

  const handleOpenDeleteUser = (u: User) => {
    setUserToDelete(u);
    setDeleteUserError(null);
    setDeleteUserSuccess(null);
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setDeleteUserLoading(true);
    setDeleteUserError(null);
    try {
      const res = await api.deleteUser(userToDelete.id);
      setDeleteUserSuccess(res.message || 'User deleted successfully.');
      setTimeout(() => {
        setUserToDelete(null);
        setDeleteUserSuccess(null);
        fetchUsers();
      }, 1000);
    } catch (err: any) {
      setDeleteUserError(err.message || 'Failed to delete user account.');
    } finally {
      setDeleteUserLoading(false);
    }
  };

  // Fresh Start State
  const [dataSummary, setDataSummary] = useState<any | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [freshStartMode, setFreshStartMode] = useState<'operational_reset' | 'selective_reset'>('operational_reset');
  const [resetCategories, setResetCategories] = useState({
    bookings: true,
    drivers: false,
    suppliers: false,
    vehicles: false,
    payments: true,
  });
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [safetyCheckConfirmed, setSafetyCheckConfirmed] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<any | null>(null);

  const fetchDataSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await api.getDataSummary();
      setDataSummary(res);
    } catch (err: any) {
      console.error('Failed to load data summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleExecuteFreshStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmationPhrase.trim() !== 'RESET GULF TAXIS') {
      setResetError('Security confirmation failed: You must type exactly "RESET GULF TAXIS".');
      return;
    }
    if (!adminPassword) {
      setResetError('Please enter your administrator password to authorize this action.');
      return;
    }
    if (!safetyCheckConfirmed) {
      setResetError('Please acknowledge the pre-reset safety backup confirmation.');
      return;
    }

    setResetLoading(true);
    setResetError(null);
    setResetSuccess(null);

    try {
      const res = await api.executeFreshStart({
        mode: freshStartMode,
        password: adminPassword,
        confirmationPhrase: confirmationPhrase.trim(),
        categories: resetCategories,
      });

      setResetSuccess(res);
      setAdminPassword('');
      setConfirmationPhrase('');
      setSafetyCheckConfirmed(false);
      fetchDataSummary();
      fetchUsers();
      fetchBackups();
    } catch (err: any) {
      setResetError(err.message || 'Fresh Start execution failed.');
    } finally {
      setResetLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'backup') fetchBackups();
    if (activeTab === 'audit') fetchAuditLogs();
    if (activeTab === 'fresh-start') fetchDataSummary();
  }, [syncVersion, activeTab]);

  const handleSaveCompanyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccess(false);
    try {
      await api.updateSettings('company_profile', companyProfile);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update company profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleCreateBackupNow = async () => {
    setBackingUp(true);
    setBackupSuccessMsg(null);
    try {
      const res = await api.createBackup();
      setBackupSuccessMsg(res.message);
      fetchBackups();
    } catch (err: any) {
      alert(err.message || 'Failed to trigger backup');
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    if (!window.confirm(`Restore database from snapshot '${filename}'? Current data will be replaced, and an automated pre-restore safety snapshot will be created.`)) {
      return;
    }
    setRestoring(true);
    try {
      const res = await api.restoreBackup(filename);
      alert(res.message);
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Restoration failed');
    } finally {
      setRestoring(false);
    }
  };

  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUserFormData({
      username: '',
      email: '',
      password: '',
      full_name: '',
      role: 'booking_agent',
      phone: '',
      permissions: ['dashboard', 'bookings'],
    });
    setUserModalOpen(true);
  };

  const handleOpenEditUser = (u: User) => {
    setEditingUser(u);
    setUserFormData({
      username: u.username,
      email: u.email,
      password: '',
      full_name: u.full_name,
      role: u.role,
      phone: u.phone || '',
      permissions: u.permissions || [],
    });
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, userFormData);
      } else {
        await api.createUser(userFormData);
      }
      setUserModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to save user account');
    }
  };

  const handleToggleUserStatus = async (u: User) => {
    try {
      await api.toggleUserStatus(u.id);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle status');
    }
  };

  const allModules = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'bookings', label: '📅 Bookings Management' },
    { id: 'dispatch', label: '🚘 Dispatch Control' },
    { id: 'drivers', label: '👨‍✈️ Driver Fleet' },
    { id: 'vehicles', label: '🚗 Fleet Vehicles' },
    { id: 'suppliers', label: '🏢 Suppliers' },
    { id: 'payments', label: '💳 Payments & Finance' },
    { id: 'reports', label: '📈 Reports Centre' },
    { id: 'settings', label: '⚙️ Settings & Administration' },
  ];

  return (
    <div className="space-y-4">
      {/* Settings Navigation Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 flex items-center gap-2">
            <span>⚙️ System Configuration & Cloud Administration</span>
          </h1>
          <p className="text-[13.5px] text-slate-500 mt-1">
            Branding, user access control, automatic backups, audit trails, and deployment guides
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1.5 rounded-2xl text-sm font-semibold">
          <button
            onClick={() => setActiveTab('company')}
            className={`px-3.5 py-2 min-h-[38px] rounded-xl transition-all cursor-pointer text-sm ${
              activeTab === 'company' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🏢 Company Profile
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3.5 py-2 min-h-[38px] rounded-xl transition-all cursor-pointer text-sm ${
              activeTab === 'users' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            👥 Users & Roles
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3.5 py-2 min-h-[38px] rounded-xl transition-all cursor-pointer text-sm ${
              activeTab === 'backup' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            💾 Backup & Restore
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-2 min-h-[38px] rounded-xl transition-all cursor-pointer text-sm ${
              activeTab === 'audit' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🛡️ Audit Logs
          </button>
          <button
            onClick={() => setActiveTab('deployment')}
            className={`px-3.5 py-2 min-h-[38px] rounded-xl transition-all cursor-pointer text-sm ${
              activeTab === 'deployment' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🌐 Cloud Hosting
          </button>
          {hasRole('super_admin', 'admin') && (
            <button
              onClick={() => setActiveTab('fresh-start')}
              className={`px-3.5 py-2 min-h-[38px] rounded-xl transition-all cursor-pointer text-sm ${
                activeTab === 'fresh-start'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-rose-700'
              }`}
            >
              🧹 Fresh Start
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: Company Profile */}
      {activeTab === 'company' && (
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs max-w-3xl space-y-6">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
            <div>
              <h2 className="text-lg sm:text-[19px] font-bold text-slate-900">Corporate Branding & Information</h2>
              <p className="text-[13px] text-slate-500 mt-0.5">Details printed on official passenger vouchers and statements</p>
            </div>
            {profileSuccess && (
              <span className="text-[12.5px] font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Saved Successfully
              </span>
            )}
          </div>

          <form onSubmit={handleSaveCompanyProfile} className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Company Legal Name</label>
                <input
                  type="text"
                  value={companyProfile.company_name}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, company_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Brand Tagline</label>
                <input
                  type="text"
                  value={companyProfile.tagline}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, tagline: e.target.value })}
                  className="w-full px-3.5 py-2.5 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Official Support Email</label>
                <input
                  type="email"
                  value={companyProfile.email}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Dispatch Phone Hotline</label>
                <input
                  type="text"
                  value={companyProfile.phone}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Commercial Reg (CR) #</label>
                <input
                  type="text"
                  value={companyProfile.cr_number}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, cr_number: e.target.value })}
                  className="w-full px-3.5 py-2.5 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">VAT Registration #</label>
                <input
                  type="text"
                  value={companyProfile.vat_number}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, vat_number: e.target.value })}
                  className="w-full px-3.5 py-2.5 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">System Timezone</label>
                <input
                  type="text"
                  value={companyProfile.timezone || 'Asia/Riyadh'}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, timezone: e.target.value })}
                  className="w-full px-3.5 py-2.5 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold text-sm"
                />
              </div>

              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Default Base Currency</label>
                <select
                  value={companyProfile.default_currency || 'SAR'}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, default_currency: e.target.value })}
                  className="w-full px-3.5 py-2.5 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-sm"
                >
                  <option value="SAR">SAR - Saudi Riyal</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="AED">AED - UAE Dirham</option>
                  <option value="EUR">EUR - Euro</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Head Office Address</label>
                <input
                  type="text"
                  value={companyProfile.address}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end">
              <button
                type="submit"
                disabled={profileSaving}
                className="px-6 py-2.5 min-h-[42px] bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow cursor-pointer transition-all disabled:opacity-50"
              >
                {profileSaving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: Users & Permissions */}
      {activeTab === 'users' && (
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
            <div>
              <h2 className="text-lg sm:text-[19px] font-bold text-slate-900">User Accounts & Role Permissions</h2>
              <p className="text-[13px] text-slate-500 mt-0.5">
                Grant or restrict module access per staff user across all offices
              </p>
            </div>
            <button
              onClick={handleOpenAddUser}
              className="px-4 py-2 min-h-[38px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Staff User</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-semibold text-[13.5px] tracking-wider">
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Module Permissions</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-[14.5px]">{u.full_name}</div>
                      <div className="text-[13px] text-slate-400 mt-0.5">@{u.username} • {u.email}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-800 capitalize bg-slate-100 px-2.5 py-1 rounded-lg text-[13px]">
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {u.permissions?.includes('all') ? (
                          <span className="text-xs bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-md">
                            FULL SYSTEM (ALL)
                          </span>
                        ) : (
                          u.permissions?.map((p) => (
                            <span key={p} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-mono">
                              {p}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 rounded-full text-[12.5px] font-bold ${
                          u.is_active === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {u.is_active === 1 ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEditUser(u)}
                          className="px-3 py-1.5 min-h-[34px] text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
                        >
                          Edit
                        </button>
                        {u.id !== user?.id && (
                          <>
                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              className={`px-3 py-1.5 min-h-[34px] rounded-lg text-sm font-semibold cursor-pointer transition-colors ${
                                u.is_active === 1
                                  ? 'text-rose-600 hover:bg-rose-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {u.is_active === 1 ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => handleOpenDeleteUser(u)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer hover:bg-rose-50 transition-colors"
                              title="Delete User Account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Automatic Backup & Recovery */}
      {activeTab === 'backup' && (
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg sm:text-[19px] font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                <span>Automated Backup & Disaster Recovery</span>
              </h2>
              <p className="text-[13.5px] text-slate-500 mt-1">
                Schedule: <span className="font-semibold text-slate-700">{backupSchedule}</span> • Stored in secure cloud volume
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href="/Gulf_Taxis_Dispatch_Cloud_Complete.zip"
                download="Gulf_Taxis_Dispatch_Cloud_Complete.zip"
                className="px-4 py-2.5 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow flex items-center gap-2 transition-colors cursor-pointer"
                title="Download full project archive with source code, database, and setup guides"
              >
                <Download className="w-4 h-4 text-white" />
                <span>Download Complete Project (.ZIP)</span>
              </a>

              <a
                href="/api/backups/export-sql"
                download="gulf_taxis_schema_export.sql"
                className="px-4 py-2.5 min-h-[40px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors"
              >
                <FileCode className="w-4 h-4 text-slate-600" />
                <span>Export PostgreSQL SQL</span>
              </a>

              <button
                onClick={handleCreateBackupNow}
                disabled={backingUp}
                className="px-4 py-2.5 min-h-[40px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${backingUp ? 'animate-spin' : ''}`} />
                <span>{backingUp ? 'Creating Snapshot...' : 'Create Backup Now'}</span>
              </button>
            </div>
          </div>

          {backupSuccessMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-sm flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{backupSuccessMsg}</span>
            </div>
          )}

          {/* Backup Snapshots Table */}
          <div className="space-y-2.5">
            <h3 className="font-bold text-slate-800 text-xs sm:text-[13px] uppercase tracking-wider">
              Saved Database Snapshots:
            </h3>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-semibold text-[13px] tracking-wider">
                    <th className="py-3 px-3.5">Snapshot Filename</th>
                    <th className="py-3 px-3.5">Size</th>
                    <th className="py-3 px-3.5">Timestamp</th>
                    <th className="py-3 px-3.5">Type</th>
                    <th className="py-3 px-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-sm">
                  {backups.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-sans text-sm">
                        No manual backup taken yet. (Automated periodic backups run in background).
                      </td>
                    </tr>
                  ) : (
                    backups.map((b) => (
                      <tr key={b.id || b.filename} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3.5 font-bold text-slate-900 text-[13.5px]">{b.filename}</td>
                        <td className="py-3 px-3.5 text-slate-600">
                          {((b.size_bytes || 0) / 1024).toFixed(1)} KB
                        </td>
                        <td className="py-3 px-3.5 text-slate-600 font-sans">{b.created_at}</td>
                        <td className="py-3 px-3.5 font-sans capitalize">{b.type || 'automated'}</td>
                        <td className="py-3 px-3.5 text-right font-sans">
                          <button
                            onClick={() => handleRestoreBackup(b.filename)}
                            disabled={restoring}
                            className="px-3.5 py-1.5 min-h-[34px] bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-lg text-xs sm:text-[13px] cursor-pointer transition-colors"
                          >
                            Restore Snapshot
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
            <div>
              <h2 className="text-lg sm:text-[19px] font-bold text-slate-900">System Activity Audit Trail</h2>
              <p className="text-[13px] text-slate-500 mt-0.5">
                Immutable records of who created, edited, cancelled, or settled transactions
              </p>
            </div>
            <button
              onClick={fetchAuditLogs}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 cursor-pointer text-sm flex items-center gap-1.5 font-semibold transition-colors min-h-[36px]"
            >
              <RefreshCw className="w-4 h-4 text-blue-600" />
              <span>Refresh Log</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase font-semibold text-[13px] tracking-wider whitespace-nowrap">
                  <th className="py-3 px-3.5">Timestamp</th>
                  <th className="py-3 px-3.5">User</th>
                  <th className="py-3 px-3.5">Action</th>
                  <th className="py-3 px-3.5">Entity</th>
                  <th className="py-3 px-3.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3.5 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3.5 font-bold text-slate-900 whitespace-nowrap text-sm">
                      {log.user_name || 'System'}
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 uppercase text-xs text-blue-700 font-bold whitespace-nowrap">
                      {log.entity}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-700 text-sm">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: Cloud Deployment Guide */}
      {activeTab === 'deployment' && (
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs space-y-6 max-w-4xl text-sm text-slate-700 leading-relaxed">
          <div className="border-b border-slate-100 pb-3.5 flex items-center gap-2.5">
            <Terminal className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg sm:text-[19px] font-bold text-slate-900">
              Hostinger, VPS, and Cloud Deployment Procedures
            </h2>
          </div>

          {/* Quick ZIP Package Download Banner */}
          <div className="p-5 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-blue-800">
            <div>
              <div className="flex items-center gap-2 font-bold text-base text-white">
                <span className="text-lg">📦</span>
                <span>Download Complete Production Deployment Package (.ZIP)</span>
              </div>
              <p className="text-[13px] text-blue-200 mt-1 leading-relaxed">
                Complete archive containing frontend, backend, SQLite database, migrations, Dockerfile, PM2 configuration, and step-by-step installation manual.
              </p>
            </div>
            <a
              href="/Gulf_Taxis_Dispatch_Cloud_Complete.zip"
              download="Gulf_Taxis_Dispatch_Cloud_Complete.zip"
              className="px-5 py-2.5 min-h-[42px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl shadow-lg flex items-center gap-2 transition-transform hover:scale-102 active:scale-98 shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download ZIP Package</span>
            </a>
          </div>

          <div className="space-y-4">
            <div className="p-4 sm:p-5 bg-slate-900 text-slate-200 rounded-xl space-y-2.5">
              <div className="font-bold text-white text-base">Option 1: Deploying on Hostinger VPS or Linux Server</div>
              <p className="text-slate-400 text-sm">
                Run the following commands via SSH on Ubuntu 22.04 / 24.04:
              </p>
              <pre className="p-3.5 bg-slate-950 rounded-xl font-mono text-xs text-emerald-400 overflow-x-auto">
{`# 1. Update system & install Node.js 20 LTS + PM2
sudo apt update && sudo apt install -y nodejs npm git nginx
sudo npm install -g pm2

# 2. Upload / Clone the Gulf Taxis project
cd /var/www && git clone <repo-url> gulf-taxis && cd gulf-taxis

# 3. Setup environment & install packages
cp .env.example .env
npm install
npm run build

# 4. Start production process with PM2
pm2 start server.ts --interpreter ./node_modules/.bin/tsx --name "gulf-taxis"
pm2 save && pm2 startup`}
              </pre>
            </div>

            <div className="p-4 sm:p-5 bg-blue-50 border border-blue-200 rounded-xl space-y-2 text-blue-900">
              <div className="font-bold text-base">Option 2: Deploying to Railway / Cloud Container Hosting</div>
              <p className="text-sm">
                In Railway, set Build Command to <code className="font-mono font-bold bg-white px-2 py-0.5 rounded text-xs">npm run build</code> and Start Command to <code className="font-mono font-bold bg-white px-2 py-0.5 rounded text-xs">npm start</code>. Attach a persistent volume to <code className="font-mono font-bold bg-white px-2 py-0.5 rounded text-xs">/var/www/data</code> to retain data across deployments.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: Data Management & Fresh Start */}
      {activeTab === 'fresh-start' && hasRole('super_admin', 'admin') && (
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-rose-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rose-100">
            <div>
              <h2 className="text-lg sm:text-[20px] font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-600" />
                <span>Data Management & Fresh Start Reset</span>
              </h2>
              <p className="text-[13.5px] text-slate-500 mt-1">
                Safely clear operational records to start production fresh, while strictly protecting user accounts, settings, and backups.
              </p>
            </div>
            <button
              onClick={fetchDataSummary}
              disabled={summaryLoading}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${summaryLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Record Counts</span>
            </button>
          </div>

          {/* Protected Data Guarantee Banner */}
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Zero-Data-Loss Protection Policy for System Infrastructure</span>
            </div>
            <p className="text-xs text-emerald-700 leading-relaxed">
              The Fresh Start tool <strong>never</strong> touches user credentials, administrator logins, role permissions, pricing policies, company profile, database schema, or past backup snapshots.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs">
              <div className="bg-white/80 px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-900 flex justify-between">
                <span>Staff Logins:</span>
                <span className="font-bold">{dataSummary?.protected?.users || 0} (Preserved)</span>
              </div>
              <div className="bg-white/80 px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-900 flex justify-between">
                <span>Settings:</span>
                <span className="font-bold">{dataSummary?.protected?.settings || 0} (Preserved)</span>
              </div>
              <div className="bg-white/80 px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-900 flex justify-between">
                <span>Audit Logs:</span>
                <span className="font-bold">{dataSummary?.protected?.audit_logs || 0} (Preserved)</span>
              </div>
              <div className="bg-white/80 px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-900 flex justify-between">
                <span>Snapshots:</span>
                <span className="font-bold">{dataSummary?.protected?.backups || 0} (Preserved)</span>
              </div>
            </div>
          </div>

          {/* Reset Mode Selection */}
          <div className="space-y-4">
            <label className="block text-sm font-bold text-slate-800">1. Select Reset Strategy</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setFreshStartMode('operational_reset')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  freshStartMode === 'operational_reset'
                    ? 'border-rose-500 bg-rose-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-900 text-sm">Mode A: Operational Reset (Recommended)</span>
                  <input
                    type="radio"
                    name="reset_mode"
                    checked={freshStartMode === 'operational_reset'}
                    onChange={() => setFreshStartMode('operational_reset')}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                </div>
                <p className="text-xs text-slate-600">
                  Clears all test bookings, active trips, and booking payment vouchers. Driver and supplier registries remain preserved unless explicitly checked.
                </p>
              </div>

              <div
                onClick={() => setFreshStartMode('selective_reset')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  freshStartMode === 'selective_reset'
                    ? 'border-rose-500 bg-rose-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-900 text-sm">Mode B: Granular Selective Reset</span>
                  <input
                    type="radio"
                    name="reset_mode"
                    checked={freshStartMode === 'selective_reset'}
                    onChange={() => setFreshStartMode('selective_reset')}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                </div>
                <p className="text-xs text-slate-600">
                  Manually select exactly which business data categories to purge with full dependency warnings.
                </p>
              </div>
            </div>
          </div>

          {/* Category Selection Checklist */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-800">
              2. Target Operational Categories & Live Record Counts
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Bookings */}
              <label
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer text-xs font-semibold ${
                  resetCategories.bookings ? 'bg-rose-50 border-rose-300 text-rose-950' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={resetCategories.bookings}
                    onChange={(e) => setResetCategories({ ...resetCategories, bookings: e.target.checked })}
                    className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                  />
                  <span>🚖 Bookings & Trip History Logs</span>
                </div>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-bold">
                  {dataSummary?.operational?.bookings || 0} bookings
                </span>
              </label>

              {/* Payments */}
              <label
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer text-xs font-semibold ${
                  resetCategories.payments ? 'bg-rose-50 border-rose-300 text-rose-950' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={resetCategories.payments}
                    onChange={(e) => setResetCategories({ ...resetCategories, payments: e.target.checked })}
                    className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                  />
                  <span>💳 Customer Payments & Receipts</span>
                </div>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-bold">
                  {dataSummary?.operational?.payments || 0} payments
                </span>
              </label>

              {/* Drivers */}
              <label
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer text-xs font-semibold ${
                  resetCategories.drivers ? 'bg-rose-50 border-rose-300 text-rose-950' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={resetCategories.drivers}
                    onChange={(e) => setResetCategories({ ...resetCategories, drivers: e.target.checked })}
                    className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                  />
                  <span>🧑‍✈️ Fleet Drivers & Payout Records</span>
                </div>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-bold">
                  {dataSummary?.operational?.drivers || 0} drivers
                </span>
              </label>

              {/* Suppliers */}
              <label
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer text-xs font-semibold ${
                  resetCategories.suppliers ? 'bg-rose-50 border-rose-300 text-rose-950' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={resetCategories.suppliers}
                    onChange={(e) => setResetCategories({ ...resetCategories, suppliers: e.target.checked })}
                    className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                  />
                  <span>🏢 Fleet Partner Suppliers & Balances</span>
                </div>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-bold">
                  {dataSummary?.operational?.suppliers || 0} suppliers
                </span>
              </label>

              {/* Vehicles */}
              <label
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer text-xs font-semibold ${
                  resetCategories.vehicles ? 'bg-rose-50 border-rose-300 text-rose-950' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={resetCategories.vehicles}
                    onChange={(e) => setResetCategories({ ...resetCategories, vehicles: e.target.checked })}
                    className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                  />
                  <span>🚗 Fleet Vehicles List</span>
                </div>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-bold">
                  {dataSummary?.operational?.vehicles || 0} vehicles
                </span>
              </label>
            </div>
          </div>

          {/* Safety Controls Form */}
          <form onSubmit={handleExecuteFreshStart} className="p-5 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
              <span>3. Mandatory Dual-Verification Security Authorization</span>
            </div>

            <p className="text-xs text-rose-800">
              Before clearing any records, the server will automatically create and verify a standalone snapshot in <code className="font-mono bg-white px-1.5 py-0.5 rounded">data/backups/</code>. If the snapshot fails, the reset cancels automatically.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Administrator Password Re-Authentication *
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    placeholder="Enter current admin password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 min-h-[40px] bg-white border border-rose-300 rounded-xl text-slate-900 text-sm focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Type <span className="font-mono text-rose-700 bg-white px-1 rounded">RESET GULF TAXIS</span> to Confirm *
                </label>
                <input
                  type="text"
                  required
                  placeholder="RESET GULF TAXIS"
                  value={confirmationPhrase}
                  onChange={(e) => setConfirmationPhrase(e.target.value)}
                  className="w-full px-3.5 py-2 min-h-[40px] bg-white border border-rose-300 rounded-xl text-slate-900 text-sm font-mono tracking-wide focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer pt-2">
              <input
                type="checkbox"
                required
                checked={safetyCheckConfirmed}
                onChange={(e) => setSafetyCheckConfirmed(e.target.checked)}
                className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4 mt-0.5"
              />
              <span className="text-xs text-slate-700 font-semibold leading-relaxed">
                I understand that selected business records will be purged, that an automated pre-reset SQLite snapshot will be created in data/backups, and that all user accounts and audit logs will remain safe.
              </span>
            </label>

            {resetError && (
              <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-rose-900 text-xs flex items-start gap-2 font-medium">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{resetError}</span>
              </div>
            )}

            {resetSuccess && (
              <div className="p-4 bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-950 text-xs space-y-1.5 font-sans">
                <div className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Fresh Start Successful! Operational Data Cleared.</span>
                </div>
                <p>
                  Safety snapshot stored: <strong className="font-mono">{resetSuccess.backupFilename}</strong>
                </p>
                <div className="font-mono text-[11px] bg-white/70 p-2 rounded border border-emerald-200">
                  Cleared: {JSON.stringify(resetSuccess.deletedCounts || {})}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={resetLoading || confirmationPhrase.trim() !== 'RESET GULF TAXIS' || !adminPassword || !safetyCheckConfirmed}
                className="px-6 py-2.5 min-h-[42px] bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow cursor-pointer transition-all flex items-center gap-2"
              >
                <RotateCcw className={`w-4 h-4 ${resetLoading ? 'animate-spin' : ''}`} />
                <span>{resetLoading ? 'Creating Backup & Clearing Data...' : 'Execute Fresh Start Reset'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete User Account Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete Staff User Account</h3>
                <p className="text-xs text-slate-500 font-mono">@{userToDelete.username}</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1 mb-4 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Full Name:</span>
                <span className="font-bold text-slate-900">{userToDelete.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Username:</span>
                <span className="font-mono text-slate-800">@{userToDelete.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">System Role:</span>
                <span className="font-bold capitalize bg-slate-200 px-2 py-0.5 rounded text-slate-800">
                  {userToDelete.role.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="text-slate-800">{userToDelete.email}</span>
              </div>
            </div>

            {userToDelete.id === user?.id ? (
              <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl mb-4 text-xs text-rose-900">
                <p className="font-bold">Self-Deletion Prohibited</p>
                <p>You cannot delete your own active administrator account.</p>
              </div>
            ) : userToDelete.role === 'super_admin' ? (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl mb-4 text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Super Administrator Account</span>
                </div>
                <p>
                  Deleting a Super Administrator requires at least one other active Super Admin account to manage the system.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Are you sure you want to delete staff account <strong>@{userToDelete.username} ({userToDelete.full_name})</strong>? Their access will be immediately revoked. All past bookings, dispatch history, and audit trails logged by this user will be preserved.
              </p>
            )}

            {deleteUserError && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{deleteUserError}</span>
              </div>
            )}

            {deleteUserSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{deleteUserSuccess}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={deleteUserLoading}
                className="px-4 py-2 min-h-[38px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {userToDelete.id !== user?.id && (
                <button
                  type="button"
                  onClick={handleConfirmDeleteUser}
                  disabled={deleteUserLoading}
                  className="px-4 py-2 min-h-[38px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deleteUserLoading ? 'Deleting User...' : 'Confirm Delete User'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Create/Edit Modal */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg sm:text-[19px] font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>{editingUser ? `Edit User: ${editingUser.username}` : 'Create New User Account'}</span>
            </h3>

            <form onSubmit={handleSaveUser} className="space-y-4 text-sm">
              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  value={userFormData.full_name}
                  onChange={(e) => setUserFormData({ ...userFormData, full_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white text-sm"
                />
              </div>

              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Username *</label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingUser)}
                  value={userFormData.username}
                  onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                  className="w-full px-3.5 py-2.5 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white disabled:opacity-60 text-sm"
                />
              </div>

              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">Email Address *</label>
                <input
                  type="email"
                  required
                  disabled={Boolean(editingUser)}
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white disabled:opacity-60 text-sm"
                />
              </div>

              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">
                  {editingUser ? 'New Password (Leave blank to keep current)' : 'Initial Password *'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  placeholder={editingUser ? '••••••••' : 'Min 6 characters'}
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white text-sm"
                />
              </div>

              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">System Role *</label>
                <select
                  value={userFormData.role}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white font-bold text-sm"
                >
                  <option value="super_admin">Super Administrator (Full System)</option>
                  <option value="admin">Administrator (Operations & Fleet)</option>
                  <option value="dispatcher">Dispatcher (Driver & Trip Assignment)</option>
                  <option value="booking_agent">Booking Agent (Reservation Desk)</option>
                  <option value="finance_executive">Finance Executive (Accounts & Payables)</option>
                  <option value="report_viewer">Report Viewer (Read-only)</option>
                </select>
              </div>

              {/* Module Permissions Checkboxes */}
              <div>
                <label className="block text-[13.5px] font-semibold text-slate-700 mb-1.5">
                  Authorized Module Permissions
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  {allModules.map((m) => {
                    const checked = userFormData.permissions.includes(m.id) || userFormData.role === 'super_admin';
                    return (
                      <label key={m.id} className="flex items-center gap-2 cursor-pointer text-xs sm:text-[13px] text-slate-700 font-medium">
                        <input
                          type="checkbox"
                          disabled={userFormData.role === 'super_admin'}
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setUserFormData({ ...userFormData, permissions: [...userFormData.permissions, m.id] });
                            } else {
                              setUserFormData({ ...userFormData, permissions: userFormData.permissions.filter((p) => p !== m.id) });
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span>{m.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-2 min-h-[40px] text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 min-h-[40px] bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow cursor-pointer text-sm transition-colors"
                >
                  Save User Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
