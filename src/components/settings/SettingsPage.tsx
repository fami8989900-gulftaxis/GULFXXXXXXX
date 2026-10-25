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
  Edit2
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user, hasRole } = useAuth();
  const { syncVersion } = useSync();

  const [activeTab, setActiveTab] = useState<'company' | 'users' | 'backup' | 'audit' | 'deployment'>('company');

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

  useEffect(() => {
    fetchSettings();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'backup') fetchBackups();
    if (activeTab === 'audit') fetchAuditLogs();
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
