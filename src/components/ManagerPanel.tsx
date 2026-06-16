'use client';

import { useState, useEffect, useCallback } from 'react';
import { managerFetch } from '@/lib/managerFetch';
import IntegrationSettings from './IntegrationSettings';
import OrgLogoUpload from './OrgLogoUpload';
import ThemeSelector from './ThemeSelector';
import NotificationsPanel from './NotificationsPanel';
import { useT } from '@/lib/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

const EMPLOYMENT_TYPES = [
  { value: 'hpp', label: 'HPP – Hlavní pracovní poměr' },
  { value: 'dpp', label: 'DPP – Dohoda o provedení práce' },
  { value: 'dpc', label: 'DPČ – Dohoda o pracovní činnosti' },
  { value: 'ico', label: 'IČO – Živnostník / OSVČ' },
] as const;

type EmploymentType = typeof EMPLOYMENT_TYPES[number]['value'];

function employmentLabel(value?: string | null) {
  return EMPLOYMENT_TYPES.find((t) => t.value === value)?.label.split(' – ')[0] ?? '—';
}

interface Employee {
  id: string;
  name: string;
  pin?: string;
  pin_code?: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  labels?: string[];
  target_hours?: number;
  vacation_days_per_year?: number;
  employment_type?: EmploymentType | null;
  can_saturday?: boolean;
  max_saturdays?: number;
  active: boolean;
}

interface WorkType {
  id: string;
  name: string;
  color: string;
  category: 'shift' | 'presence' | 'absence';
  sort_order?: number;
}

interface Request {
  id: string;
  employee_id: string;
  type: 'vacation' | 'sick' | 'correction' | 'other';
  date_from: string;
  date_to?: string;
  note?: string;
  hours?: number | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  employees?: { id: string; name: string; department?: string; position?: string };
}

interface ManagerPanelProps {
  orgId: string;
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// TYPE_LABELS and CATEGORY_LABELS are built inside components via useT() for i18n

const CATEGORY_COLORS: Record<string, string> = {
  shift: 'bg-blue-100 text-blue-800',
  presence: 'bg-green-100 text-green-800',
  absence: 'bg-red-100 text-red-800',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ManagerPanel({ onClose, initialTab }: ManagerPanelProps & { initialTab?: 'notifications' }) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<'employees' | 'work-types' | 'requests' | 'settings' | 'notifications'>(initialTab ?? 'employees');
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    managerFetch('/api/requests?status=pending')
      .then((r) => r.json())
      .then((d) => setPendingCount((d.requests ?? []).length))
      .catch(() => {});
    managerFetch('/api/notifications')
      .then((r) => r.json())
      .then((d) => setUnreadCount((d.notifications ?? []).filter((n: { read: boolean }) => !n.read).length))
      .catch(() => {});
  }, []);

  const tabs = [
    { id: 'employees' as const, label: t('Zaměstnanci', 'Employees'), icon: '👥' },
    { id: 'work-types' as const, label: t('Typy práce', 'Work Types'), icon: '🏷️' },
    { id: 'requests' as const, label: t('Žádosti', 'Requests'), icon: '📋' },
    { id: 'notifications' as const, label: t('Notifikace', 'Notifications'), icon: '🔔' },
    { id: 'settings' as const, label: t('Nastavení', 'Settings'), icon: '⚙️' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex bg-white">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 bg-gray-900 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-700">
          <h1 className="text-white font-semibold text-base leading-tight">{t('Správa systému', 'System Management')}</h1>
          <p className="text-gray-400 text-xs mt-0.5">Manager Panel</p>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              <span className="flex-1 text-left">{tab.label}</span>
              {tab.id === 'requests' && pendingCount > 0 && (
                <span className="flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold">
                  {pendingCount}
                </span>
              )}
              {tab.id === 'notifications' && unreadCount > 0 && (
                <span className="flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-amber-500 text-white text-xs font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="px-2 py-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <span className="text-base">✕</span>
            {t('Zavřít panel', 'Close panel')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
          <h2 className="text-xl font-semibold text-gray-900">
            {tabs.find((t) => t.id === activeTab)?.label}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title={t('Zavřít', 'Close')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'employees' && <EmployeesTab />}
          {activeTab === 'work-types' && <WorkTypesTab />}
          {activeTab === 'requests' && <RequestsTab />}
          {activeTab === 'notifications' && <NotificationsTab onRead={() => setUnreadCount(0)} />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>
      </div>
    </div>
  );
}

// ─── Employees Tab ────────────────────────────────────────────────────────────

function EmployeesTab() {
  const t = useT();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await managerFetch('/api/employees');
      if (!res.ok) throw new Error('Nepodařilo se načíst zaměstnance.');
      const data = await res.json();
      setEmployees(data.employees ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleDelete = async (id: string) => {
    try {
      const res = await managerFetch(`/api/employees/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Nepodařilo se smazat zaměstnance.');
      setDeleteConfirm(null);
      fetchEmployees();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Chyba při mazání');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{employees.length} zaměstnanců</p>
        <button
          onClick={() => { setEditingEmployee(null); setShowForm(true); }}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          {t('+ Přidat zaměstnance', '+ Add employee')}
        </button>
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} onRetry={fetchEmployees} />}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[t('Jméno', 'Name'), 'PIN', t('Poměr', 'Contract'), t('Oddělení', 'Department'), t('Pozice', 'Position'), t('Štítky', 'Tags'), t('Cíl. hodiny', 'Target hours'), t('Aktivní', 'Active'), t('Akce', 'Actions')].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">
                    {t('Žádní zaměstnanci', 'No employees')}
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{emp.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">{emp.pin_code ?? emp.pin ?? '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                        {employmentLabel(emp.employment_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{emp.department ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{emp.position ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      <div className="flex flex-wrap gap-1">
                        {(emp.labels ?? []).map((l) => (
                          <span key={l} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{l}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{emp.target_hours ?? 160}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${emp.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {emp.active ? t('Ano', 'Yes') : t('Ne', 'No')}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => { setEditingEmployee(emp); setShowForm(true); }}
                        className="text-blue-600 hover:text-blue-800 text-sm mr-3"
                      >
                        {t('Upravit', 'Edit')}
                      </button>
                      {deleteConfirm === emp.id ? (
                        <span className="text-sm">
                          <button onClick={() => handleDelete(emp.id)} className="text-red-600 hover:text-red-800 mr-1">{t('Smazat?', 'Delete?')}</button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-gray-400 hover:text-gray-600">{t('Zrušit', 'Cancel')}</button>
                        </span>
                      ) : (
                        <button onClick={() => setDeleteConfirm(emp.id)} className="text-red-500 hover:text-red-700 text-sm">
                          {t('Smazat', 'Delete')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <EmployeeForm
          employee={editingEmployee}
          existingPins={employees.filter((e) => e.id !== editingEmployee?.id).map((e) => e.pin_code ?? e.pin ?? '')}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchEmployees(); }}
        />
      )}
    </div>
  );
}

// ─── Employee Form ────────────────────────────────────────────────────────────

interface EmployeeFormProps {
  employee: Employee | null;
  existingPins: string[];
  onClose: () => void;
  onSaved: () => void;
}

function EmployeeForm({ employee, existingPins, onClose, onSaved }: EmployeeFormProps) {
  const t = useT();
  const [form, setForm] = useState({
    name: employee?.name ?? '',
    pin: employee?.pin_code ?? employee?.pin ?? '',
    email: employee?.email ?? '',
    phone: employee?.phone ?? '',
    department: employee?.department ?? '',
    position: employee?.position ?? '',
    labels: (employee?.labels ?? []).join(','),
    target_hours: employee?.target_hours ?? 160,
    vacation_days_per_year: employee?.vacation_days_per_year ?? 20,
    employment_type: (employee?.employment_type ?? 'hpp') as EmploymentType,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = t('Jméno je povinné', 'Name is required');
    if (!form.pin) {
      e.pin = t('PIN je povinný', 'PIN is required');
    } else if (!/^\d{4,8}$/.test(form.pin)) {
      e.pin = t('PIN musí mít 4–8 číslic', 'PIN must be 4–8 digits');
    } else if (existingPins.includes(form.pin)) {
      e.pin = t('Tento PIN je již obsazen', 'This PIN is already taken');
    }
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        labels: form.labels.split(',').map((l) => l.trim()).filter(Boolean),
      };

      const url = employee ? `/api/employees/${employee.id}` : '/api/employees';
      const method = employee ? 'PUT' : 'POST';
      const res = await managerFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Chyba při ukládání');
      }
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba');
    } finally {
      setSaving(false);
    }
  };

  const set = (field: string, value: unknown) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-semibold text-gray-900">{employee ? t('Upravit zaměstnance', 'Edit employee') : t('Přidat zaměstnance', 'Add employee')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <FormField label={`${t('Jméno', 'Name')} *`} error={errors.name}>
            <input className={inputCls(errors.name)} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Jan Novák" />
          </FormField>
          <FormField label={`PIN * (4–8 ${t('číslic', 'digits')})`} error={errors.pin}>
            <input className={inputCls(errors.pin)} value={form.pin} onChange={(e) => set('pin', e.target.value)} placeholder="1234" maxLength={8} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Email">
              <input className={inputCls()} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="jan@firma.cz" type="email" />
            </FormField>
            <FormField label={t('Telefon', 'Phone')}>
              <input className={inputCls()} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+420..." />
            </FormField>
          </div>
          <FormField label={t('Pracovní poměr', 'Employment type')}>
            <select
              className={inputCls()}
              value={form.employment_type}
              onChange={(e) => set('employment_type', e.target.value as EmploymentType)}
            >
              <option value="hpp">{t('HPP – Hlavní pracovní poměr', 'Full-time employment')}</option>
              <option value="dpp">{t('DPP – Dohoda o provedení práce', 'Agreement to complete work')}</option>
              <option value="dpc">{t('DPČ – Dohoda o pracovní činnosti', 'Agreement on work activity')}</option>
              <option value="ico">{t('IČO – Živnostník / OSVČ', 'Self-employed / Contractor')}</option>
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('Oddělení', 'Department')}>
              <input className={inputCls()} value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="Prodejna" />
            </FormField>
            <FormField label={t('Pozice', 'Position')}>
              <input className={inputCls()} value={form.position} onChange={(e) => set('position', e.target.value)} placeholder="Prodavač" />
            </FormField>
          </div>
          <FormField label={t('Štítky (oddělené čárkou)', 'Tags (comma-separated)')}>
            <input className={inputCls()} value={form.labels} onChange={(e) => set('labels', e.target.value)} placeholder="Prodejna,Kancelář" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('Cílové hodiny / měsíc', 'Target hours / month')}>
              <input className={inputCls()} type="number" min={0} value={form.target_hours} onChange={(e) => set('target_hours', Number(e.target.value))} />
            </FormField>
            <FormField label={t('Dovolená / rok (dní)', 'Vacation / year (days)')}>
              <input className={inputCls()} type="number" min={0} max={365} value={form.vacation_days_per_year} onChange={(e) => set('vacation_days_per_year', Number(e.target.value))} />
            </FormField>
          </div>
          <div className="flex gap-3 pt-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">{t('Zrušit', 'Cancel')}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? t('Ukládám…', 'Saving…') : employee ? t('Uložit', 'Save') : t('Přidat', 'Add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Work Types Tab ───────────────────────────────────────────────────────────

function WorkTypesTab() {
  const t = useT();
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingWT, setEditingWT] = useState<WorkType | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await managerFetch('/api/work-types');
      if (!res.ok) throw new Error('Nepodařilo se načíst typy práce.');
      const data = await res.json();
      setWorkTypes(data.workTypes ?? data.work_types ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const handleDelete = async (id: string) => {
    try {
      const res = await managerFetch(`/api/work-types/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Nepodařilo se smazat typ práce.');
      setDeleteConfirm(null);
      fetch_();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Chyba');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{workTypes.length} typů</p>
        <button
          onClick={() => { setEditingWT(null); setShowForm(true); }}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
        >
          {t('+ Přidat typ', '+ Add type')}
        </button>
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} onRetry={fetch_} />}

      {!loading && !error && (
        <div className="space-y-2">
          {workTypes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{t('Žádné typy práce', 'No work types')}</p>
          ) : (
            workTypes.map((wt) => (
              <div key={wt.id} className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                <div className="w-7 h-7 rounded-full flex-shrink-0 border-2 border-white shadow-sm" style={{ backgroundColor: wt.color }} />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-900 text-sm">{wt.name}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[wt.category]}`}>
                  {wt.category === 'shift' ? t('Směna', 'Shift') : wt.category === 'presence' ? t('Docházka', 'Attendance') : t('Absence', 'Absence')}
                </span>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => { setEditingWT(wt); setShowForm(true); }} className="text-blue-600 hover:text-blue-800 text-sm">{t('Upravit', 'Edit')}</button>
                  {deleteConfirm === wt.id ? (
                    <>
                      <button onClick={() => handleDelete(wt.id)} className="text-red-600 hover:text-red-800 text-sm">{t('Smazat?', 'Delete?')}</button>
                      <button onClick={() => setDeleteConfirm(null)} className="text-gray-400 hover:text-gray-600 text-sm">{t('Zrušit', 'Cancel')}</button>
                    </>
                  ) : (
                    <button onClick={() => setDeleteConfirm(wt.id)} className="text-red-500 hover:text-red-700 text-sm">{t('Smazat', 'Delete')}</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showForm && (
        <WorkTypeForm
          workType={editingWT}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetch_(); }}
        />
      )}
    </div>
  );
}

interface WorkTypeFormProps {
  workType: WorkType | null;
  onClose: () => void;
  onSaved: () => void;
}

function WorkTypeForm({ workType, onClose, onSaved }: WorkTypeFormProps) {
  const t = useT();
  const [form, setForm] = useState({
    name: workType?.name ?? '',
    color: workType?.color ?? '#3B82F6',
    category: workType?.category ?? 'shift' as const,
    sort_order: workType?.sort_order ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  const set = (field: string, value: unknown) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setNameError('Název je povinný'); return; }
    setSaving(true);
    try {
      const url = workType ? `/api/work-types/${workType.id}` : '/api/work-types';
      const method = workType ? 'PUT' : 'POST';
      const res = await managerFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Chyba při ukládání');
      }
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-semibold text-gray-900">{workType ? t('Upravit typ práce', 'Edit work type') : t('Přidat typ práce', 'Add work type')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <FormField label={`${t('Název', 'Name')} *`} error={nameError}>
            <input className={inputCls(nameError)} value={form.name} onChange={(e) => { setNameError(''); set('name', e.target.value); }} placeholder="Ranní směna" />
          </FormField>
          <FormField label={t('Barva', 'Color')}>
            <div className="flex items-center gap-3">
              <input type="color" value={form.color} onChange={(e) => set('color', e.target.value)} className="h-9 w-16 rounded border border-gray-300 cursor-pointer p-0.5" />
              <span className="text-sm text-gray-500 font-mono">{form.color}</span>
            </div>
          </FormField>
          <FormField label={t('Kategorie', 'Category')}>
            <select className={inputCls()} value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="shift">{t('Směna', 'Shift')}</option>
              <option value="presence">{t('Docházka', 'Attendance')}</option>
              <option value="absence">{t('Absence', 'Absence')}</option>
            </select>
          </FormField>
          <FormField label={t('Pořadí', 'Order')}>
            <input className={inputCls()} type="number" min={0} value={form.sort_order} onChange={(e) => set('sort_order', Number(e.target.value))} />
          </FormField>
          <div className="flex gap-3 pt-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">{t('Zrušit', 'Cancel')}</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? t('Ukládám…', 'Saving…') : workType ? t('Uložit', 'Save') : t('Přidat', 'Add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Vacation Overview Panel ──────────────────────────────────────────────────

function VacationOverviewPanel() {
  const t = useT();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [requests, setRequests] = useState<Request[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      managerFetch('/api/requests?status=approved').then((r) => r.json()),
      managerFetch('/api/requests?status=pending').then((r) => r.json()),
      managerFetch('/api/employees').then((r) => r.json()),
    ]).then(([approved, pending, emps]) => {
      setRequests([...(approved.requests ?? []), ...(pending.requests ?? [])].filter((r: Request) => r.type === 'vacation'));
      setEmployees(emps.employees ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const [year, mo] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mo, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  const DAY_NAMES = [t('Po','Mon'),t('Út','Tue'),t('St','Wed'),t('Čt','Thu'),t('Pá','Fri'),t('So','Sat'),t('Ne','Sun')];

  function mondayWD(d: string) { return (new Date(d + 'T00:00:00').getDay() + 6) % 7; }
  function dateInRange(day: string, from: string, to: string | null) {
    return day >= from && (to ? day <= to : day === from);
  }

  const empDays = new Map<string, Map<string, string>>();
  for (const req of requests) {
    for (const day of days) {
      if (dateInRange(day, req.date_from, req.date_to ?? null)) {
        if (!empDays.has(req.employee_id)) empDays.set(req.employee_id, new Map());
        empDays.get(req.employee_id)!.set(day, req.status);
      }
    }
  }

  const CZ_MONTHS = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];
  const firstOffset = days.length > 0 ? mondayWD(days[0]) : 0;

  return (
    <div className="mb-6 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-700">{t('Přehled dovolených — kdo kdy chybí', 'Vacation overview — who is absent when')}</h3>
        <div className="flex items-center gap-1">
          <button onClick={() => { const [y,m] = month.split('-').map(Number); const d = new Date(y, m-2, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); }} className="p-1.5 rounded hover:bg-slate-200 text-slate-500 text-sm">‹</button>
          <span className="text-sm font-medium text-slate-700 px-2">{CZ_MONTHS[mo-1]} {year}</span>
          <button onClick={() => { const [y,m] = month.split('-').map(Number); const d = new Date(y, m, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); }} className="p-1.5 rounded hover:bg-slate-200 text-slate-500 text-sm">›</button>
        </div>
      </div>
      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">{t('Načítám…', 'Loading…')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-800 text-slate-300">
                <th className="sticky left-0 bg-slate-800 px-3 py-2 text-left font-medium w-28 whitespace-nowrap">{t('Zaměstnanec', 'Employee')}</th>
                {Array.from({ length: firstOffset }).map((_, i) => <th key={`e${i}`} />)}
                {days.map((d) => {
                  const wd = mondayWD(d);
                  const dayN = new Date(d + 'T00:00:00').getDate();
                  return (
                    <th key={d} className={`px-0.5 py-2 text-center font-medium min-w-[28px] ${wd >= 5 ? 'text-blue-300' : ''}`}>
                      <div>{dayN}</div>
                      <div className="text-slate-500 text-[9px]">{DAY_NAMES[wd]}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => {
                const dayMap = empDays.get(emp.id);
                return (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="sticky left-0 bg-white px-3 py-1.5 font-medium text-slate-800 whitespace-nowrap">{emp.name}</td>
                    {Array.from({ length: firstOffset }).map((_, i) => <td key={`e${i}`} />)}
                    {days.map((d) => {
                      const wd = mondayWD(d);
                      const st = dayMap?.get(d);
                      return (
                        <td key={d} className={`px-0.5 py-1 text-center ${wd >= 5 ? 'bg-blue-50/40' : ''}`}>
                          {st === 'approved' && <span className="block w-5 h-5 rounded bg-emerald-400 mx-auto" title={t('Schválena', 'Approved')} />}
                          {st === 'pending' && <span className="block w-5 h-5 rounded bg-amber-300 mx-auto" title={t('Čeká', 'Pending')} />}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex gap-4 px-4 py-2 border-t border-slate-100 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-400" />{t('Schválena', 'Approved')}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-300" />{t('Čeká na schválení', 'Pending approval')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Requests Tab ─────────────────────────────────────────────────────────────

function RequestsTab() {
  const t = useT();
  const [subTab, setSubTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVacationOverview, setShowVacationOverview] = useState(false);

  const fetchRequests = useCallback(async (status: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await managerFetch(`/api/requests?status=${status}`);
      if (!res.ok) throw new Error('Nepodařilo se načíst žádosti.');
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(subTab); }, [subTab, fetchRequests]);

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await managerFetch(`/api/requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Nepodařilo se zpracovat žádost.');
      fetchRequests(subTab);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Chyba');
    }
  };

  const TYPE_LABELS: Record<string, string> = {
    vacation: t('Dovolená', 'Vacation'),
    sick: t('Nemoc', 'Sick leave'),
    correction: t('Oprava docházky', 'Attendance correction'),
    other: t('Ostatní', 'Other'),
  };

  const subTabs: { id: 'pending' | 'approved' | 'rejected'; label: string }[] = [
    { id: 'pending', label: t('Čekající', 'Pending') },
    { id: 'approved', label: t('Schválené', 'Approved') },
    { id: 'rejected', label: t('Zamítnuté', 'Rejected') },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {subTabs.map((st) => (
          <button
            key={st.id}
            onClick={() => setSubTab(st.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              subTab === st.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {st.label}
          </button>
        ))}
        </div>
        <button
          onClick={() => setShowVacationOverview((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${showVacationOverview ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400 hover:text-emerald-600'}`}
        >
          🏖️ {showVacationOverview ? t('Skrýt přehled dovolených', 'Hide vacation overview') : t('Přehled dovolených', 'Vacation overview')}
        </button>
      </div>

      {showVacationOverview && <VacationOverviewPanel />}

      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} onRetry={() => fetchRequests(subTab)} />}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[t('Zaměstnanec', 'Employee'), t('Typ', 'Type'), t('Od', 'From'), t('Do', 'To'), t('Hodiny', 'Hours'), t('Poznámka', 'Note'), t('Datum podání', 'Submitted'), ...(subTab === 'pending' ? [t('Akce', 'Actions')] : [])].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={subTab === 'pending' ? 8 : 7} className="px-4 py-8 text-center text-sm text-gray-400">
                    {t('Žádné žádosti', 'No requests')}
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                      {req.employees?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {TYPE_LABELS[req.type] ?? req.type}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{req.date_from}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{req.date_to ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{req.hours ? `${req.hours}h` : '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{req.note ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(req.created_at).toLocaleDateString('cs-CZ')}
                    </td>
                    {subTab === 'pending' && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => handleAction(req.id, 'approved')}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 hover:bg-green-200 mr-2 text-base"
                          title={t('Schválit', 'Approve')}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => handleAction(req.id, 'rejected')}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 hover:bg-red-200 text-base"
                          title={t('Zamítnout', 'Reject')}
                        >
                          ✗
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const t = useT();
  const [passwords, setPasswords] = useState({ current: '', newPwd: '', confirm: '' });
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [kioskEnabled, setKioskEnabled] = useState(false);

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    if (!passwords.current) { setPwdMsg({ type: 'error', text: 'Zadejte aktuální heslo.' }); return; }
    if (!passwords.newPwd) { setPwdMsg({ type: 'error', text: 'Zadejte nové heslo.' }); return; }
    if (passwords.newPwd !== passwords.confirm) { setPwdMsg({ type: 'error', text: 'Hesla se neshodují.' }); return; }

    setSavingPwd(true);
    try {
      const res = await managerFetch('/api/manager/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: passwords.current, new_password: passwords.newPwd }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Nepodařilo se změnit heslo.');
      }
      setPwdMsg({ type: 'success', text: t('Heslo bylo úspěšně změněno.', 'Password changed successfully.') });
      setPasswords({ current: '', newPwd: '', confirm: '' });
    } catch (err) {
      setPwdMsg({ type: 'error', text: err instanceof Error ? err.message : 'Chyba' });
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      {/* Manager Password */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{t('Manažerské heslo', 'Manager password')}</h3>
        <form onSubmit={handlePasswordSave} className="space-y-4">
          <FormField label={t('Aktuální heslo', 'Current password')}>
            <input
              type="password"
              className={inputCls()}
              value={passwords.current}
              onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
              autoComplete="current-password"
            />
          </FormField>
          <FormField label={t('Nové heslo', 'New password')}>
            <input
              type="password"
              className={inputCls()}
              value={passwords.newPwd}
              onChange={(e) => setPasswords((p) => ({ ...p, newPwd: e.target.value }))}
              autoComplete="new-password"
            />
          </FormField>
          <FormField label={t('Potvrdit nové heslo', 'Confirm new password')}>
            <input
              type="password"
              className={inputCls()}
              value={passwords.confirm}
              onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
              autoComplete="new-password"
            />
          </FormField>
          {pwdMsg && (
            <p className={`text-sm ${pwdMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {pwdMsg.text}
            </p>
          )}
          <div className="pt-1">
            <button type="submit" disabled={savingPwd} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
              {savingPwd ? t('Ukládám…', 'Saving…') : t('Uložit heslo', 'Save password')}
            </button>
          </div>
        </form>
      </section>

      {/* Company Info */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{t('Informace o firmě', 'Company info')}</h3>
        <FormField label={t('Název firmy', 'Company name')}>
          <input className={inputCls() + ' bg-gray-50'} disabled value="" placeholder={t('(načítá se…)', '(loading…)')} />
        </FormField>
        <p className="text-xs text-gray-400 mt-2">{t('Název firmy je nyní jen pro čtení.', 'Company name is read-only.')}</p>
      </section>

      {/* Attendance */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{t('Docházka', 'Attendance')}</h3>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <button
            type="button"
            role="switch"
            aria-checked={kioskEnabled}
            onClick={() => setKioskEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${kioskEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${kioskEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className="text-sm text-gray-700">{t('Kiosk povolen', 'Kiosk enabled')}</span>
        </label>
      </section>

      {/* Planning features */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-1">{t('Plánování směn', 'Shift planning')}</h3>
        <p className="text-xs text-gray-400 mb-4">{t('Volitelné funkce pro firmy s víkendovým provozem', 'Optional features for businesses with weekend operations')}</p>
        <ToggleSetting
          label={t('Logika sobot', 'Saturday logic')}
          description={t('Sledovat, zda zaměstnanci mohou pracovat v sobotu a kolik sobot za měsíc. Vhodné pro maloobchod a provoz o víkendech.', 'Track whether employees can work on Saturdays and how many Saturdays per month. Suitable for retail and weekend operations.')}
          settingKey="saturday_logic_enabled"
        />
        <div className="mt-4">
          <ToggleSetting
            label={t('Víkendový provoz', 'Weekend operation')}
            description={t('Firma má otevřeno i o víkendech. Víkendové buňky v gridu budou zvýrazněny jako pracovní dny. Směny lze přidávat o víkendech vždy bez ohledu na toto nastavení.', 'The business is open on weekends. Weekend cells in the grid will be highlighted as working days. Shifts can always be added on weekends regardless of this setting.')}
            settingKey="weekend_open"
          />
        </div>
      </section>

      {/* Bonus settings */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-1">{t('Bonusy — nastavení', 'Bonus settings')}</h3>
        <p className="text-xs text-gray-400 mb-4">{t('Příplatky pro výpočet bonusových hodin v exportu CSV', 'Bonuses for calculating bonus hours in CSV export')}</p>
        <div className="space-y-4">
          <NumberSetting label={t('Příplatek za sobotu (%)', 'Saturday bonus (%)')} description={t('% navíc za hodiny v sobotu. Např. 10 = za 8h soboty → 0,8h bonus.', '% extra for Saturday hours. E.g. 10 = for 8h Saturday → 0.8h bonus.')} settingKey="bonus_saturday_pct" defaultValue={10} />
          <NumberSetting label={t('Přesčas — práh (h/měsíc)', 'Overtime threshold (h/month)')} description={t('Od kolika hodin měsíčně se počítá přesčas. 0 = přesčas se nepočítá.', 'Monthly hours threshold for overtime. 0 = overtime not counted.')} settingKey="bonus_overtime_threshold" defaultValue={0} />
          <NumberSetting label={t('Příplatek za přesčas (%)', 'Overtime bonus (%)')} description={t('% navíc za přesčasové hodiny.', '% extra for overtime hours.')} settingKey="bonus_overtime_pct" defaultValue={25} />
        </div>
      </section>

      {/* Provozní doba */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-1">{t('Provozní doba', 'Business hours')}</h3>
        <p className="text-xs text-gray-400 mb-4">{t('Nastavte otevírací hodiny pro každý den v týdnu', 'Set opening hours for each day of the week')}</p>
        <OperatingHoursSetting />
      </section>

      {/* Zavřené dny */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-1">{t('Státní svátky / Zavřené dny', 'Holidays / Closed days')}</h3>
        <p className="text-xs text-gray-400 mb-4">{t('Konkrétní dny, kdy je firma zavřená (formát: RRRR-MM-DD)', 'Specific days when the business is closed (format: YYYY-MM-DD)')}</p>
        <ClosedDatesSetting />
      </section>

      {/* Absence a benefity */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-1">{t('Absence a benefity', 'Absences and benefits')}</h3>
        <p className="text-xs text-gray-400 mb-4">{t('Konfigurace nemocenské a benefitů', 'Sick leave and benefits configuration')}</p>
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">{t('Nemocenská', 'Sick leave')}</p>
            <NumberSetting label={t('% z denního fondu hodin', '% of daily hour fund')} description={t('Např. 60 = nemocenská = 60 % z 8h = 4,8h', 'E.g. 60 = sick leave = 60% of 8h = 4.8h')} settingKey="sick_leave_pct" defaultValue={60} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">{t('Benefity — konfigurace', 'Benefits — configuration')}</p>
            <BenefitsSetting />
          </div>
        </div>
      </section>

      {/* Logo */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <OrgLogoUpload />
      </section>

      {/* Theme */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <ThemeSelector onThemeChange={key => window.dispatchEvent(new CustomEvent('tf:theme-change', { detail: key }))} />
      </section>

      {/* Integrations */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <IntegrationSettings />
      </section>
    </div>
  );
}

interface ToggleSettingProps {
  label: string;
  description: string;
  settingKey: string;
}

function ToggleSetting({ label, description, settingKey }: ToggleSettingProps) {
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    managerFetch(`/api/manager/settings`)
      .then((r) => r.json())
      .then((d) => { if (settingKey in d) setEnabled(d[settingKey]); })
      .catch(() => {});
  }, [settingKey]);

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    try {
      await managerFetch('/api/manager/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [settingKey]: next }),
      });
    } catch { setEnabled(!next); }
    finally { setSaving(false); }
  };

  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <button type="button" role="switch" aria-checked={enabled} onClick={toggle} disabled={saving}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-300'} disabled:opacity-60`}>
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
      <div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
    </label>
  );
}

function NumberSetting({ label, description, settingKey, defaultValue }: { label: string; description: string; settingKey: string; defaultValue: number }) {
  const [value, setValue] = useState<string>(String(defaultValue));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    managerFetch('/api/manager/settings')
      .then((r) => r.json())
      .then((d) => { if (settingKey in d) setValue(String(d[settingKey])); })
      .catch(() => {});
  }, [settingKey]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await managerFetch('/api/manager/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [settingKey]: parseFloat(value) || 0 }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div className="flex items-start gap-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
          min={0}
          step={1}
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${saved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} disabled:opacity-50`}
        >
          {saved ? '✓' : saving ? '…' : 'Uložit'}
        </button>
      </div>
    </div>
  );
}

// ─── OperatingHoursSetting ────────────────────────────────────────────────────

const WEEKDAY_KEYS_BASE: { key: string; czLabel: string; enLabel: string }[] = [
  { key: 'hours_mon', czLabel: 'Po', enLabel: 'Mon' },
  { key: 'hours_tue', czLabel: 'Út', enLabel: 'Tue' },
  { key: 'hours_wed', czLabel: 'St', enLabel: 'Wed' },
  { key: 'hours_thu', czLabel: 'Čt', enLabel: 'Thu' },
  { key: 'hours_fri', czLabel: 'Pá', enLabel: 'Fri' },
  { key: 'hours_sat', czLabel: 'So', enLabel: 'Sat' },
  { key: 'hours_sun', czLabel: 'Ne', enLabel: 'Sun' },
];

function OperatingHoursSetting() {
  const t = useT();
  const WEEKDAY_KEYS = WEEKDAY_KEYS_BASE.map(({ key, czLabel, enLabel }) => ({ key, label: t(czLabel, enLabel) }));
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    managerFetch('/api/manager/settings')
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        const v: Record<string, string> = {};
        for (const { key } of WEEKDAY_KEYS_BASE) {
          v[key] = typeof d[key] === 'string' ? (d[key] as string) : '';
        }
        setValues(v);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await managerFetch('/api/manager/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const setOpen = (key: string, open: boolean) => {
    setValues((v) => ({ ...v, [key]: open ? '09:00-18:00' : '' }));
  };

  const setTime = (key: string, part: 'from' | 'to', time: string) => {
    setValues((v) => {
      const cur = v[key] ?? '09:00-18:00';
      const [f, t] = cur.split('-');
      return { ...v, [key]: part === 'from' ? `${time}-${t ?? '18:00'}` : `${f ?? '09:00'}-${time}` };
    });
  };

  return (
    <div className="space-y-2">
      {WEEKDAY_KEYS.map(({ key, label }) => {
        const val = values[key] ?? '';
        const isOpen = val !== '';
        const [fromTime, toTime] = isOpen ? val.split('-') : ['09:00', '18:00'];
        return (
          <div key={key} className="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0">
            <span className="w-7 text-sm font-medium text-gray-600">{label}</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={isOpen} onChange={(e) => setOpen(key, e.target.checked)} className="accent-blue-600" />
              <span className="text-sm text-gray-600">{t('Otevřeno', 'Open')}</span>
            </label>
            {isOpen && (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-xs text-gray-400">{t('Od', 'From')}</span>
                <input type="time" value={fromTime ?? '09:00'} onChange={(e) => setTime(key, 'from', e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <span className="text-xs text-gray-400">{t('Do', 'To')}</span>
                <input type="time" value={toTime ?? '18:00'} onChange={(e) => setTime(key, 'to', e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            )}
          </div>
        );
      })}
      <div className="pt-2">
        <button onClick={handleSave} disabled={saving}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${saved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} disabled:opacity-50`}>
          {saved ? `✓ ${t('Uloženo', 'Saved')}` : saving ? '…' : t('Uložit provozní dobu', 'Save business hours')}
        </button>
      </div>
    </div>
  );
}

// ─── ClosedDatesSetting ───────────────────────────────────────────────────────

function ClosedDatesSetting() {
  const t = useT();
  const [dates, setDates] = useState<string[]>([]);
  const [newDate, setNewDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    managerFetch('/api/manager/settings')
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        const raw = typeof d['closed_dates'] === 'string' ? (d['closed_dates'] as string) : '';
        setDates(raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []);
      })
      .catch(() => {});
  }, []);

  const saveDates = async (newDates: string[]) => {
    setSaving(true);
    try {
      await managerFetch('/api/manager/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closed_dates: newDates.join(',') }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const addDate = () => {
    if (!newDate || dates.includes(newDate)) { setNewDate(''); return; }
    const next = [...dates, newDate].sort();
    setDates(next);
    setNewDate('');
    saveDates(next);
  };

  const removeDate = (d: string) => {
    const next = dates.filter((x) => x !== d);
    setDates(next);
    saveDates(next);
  };

  return (
    <div className="space-y-3">
      {dates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {dates.map((d) => (
            <span key={d} className="flex items-center gap-1 bg-slate-100 text-slate-700 text-sm px-2.5 py-1 rounded-full">
              {d}
              <button onClick={() => removeDate(d)} className="text-slate-400 hover:text-red-500 ml-1 leading-none">&times;</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        <button onClick={addDate} disabled={!newDate || saving}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {t('+ Přidat datum', '+ Add date')}
        </button>
        {saved && <span className="text-emerald-600 text-sm">✓ {t('Uloženo', 'Saved')}</span>}
      </div>
    </div>
  );
}

// ─── BenefitsSetting ─────────────────────────────────────────────────────────

interface BenefitRow {
  label: string;
  hoursKey: string;
  maxKey: string;
  defaultHours: number;
  defaultMax: number;
}

const BENEFIT_ROWS_BASE = [
  { czLabel: 'Darování krve', enLabel: 'Blood donation', hoursKey: 'benefit_blood_hours', maxKey: 'benefit_blood_max', defaultHours: 8, defaultMax: 1 },
  { czLabel: 'Angličtina', enLabel: 'English lessons', hoursKey: 'benefit_english_hours', maxKey: 'benefit_english_max', defaultHours: -1, defaultMax: 4 },
  { czLabel: 'Cvičení', enLabel: 'Gym', hoursKey: 'benefit_gym_hours', maxKey: 'benefit_gym_max', defaultHours: -1, defaultMax: 4 },
];

function BenefitsSetting() {
  const t = useT();
  const BENEFIT_ROWS = BENEFIT_ROWS_BASE.map(({ czLabel, enLabel, ...rest }) => ({ label: t(czLabel, enLabel), ...rest }));
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    managerFetch('/api/manager/settings')
      .then((r) => r.json())
      .then((d: Record<string, unknown>) => {
        const v: Record<string, string> = {};
        for (const row of BENEFIT_ROWS_BASE) {
          v[row.hoursKey] = typeof d[row.hoursKey] === 'number' ? String(d[row.hoursKey]) : String(row.defaultHours);
          v[row.maxKey] = typeof d[row.maxKey] === 'number' ? String(d[row.maxKey]) : String(row.defaultMax);
        }
        setValues(v);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const payload: Record<string, number> = {};
    for (const key of Object.keys(values)) {
      payload[key] = parseFloat(values[key]) || 0;
    }
    try {
      await managerFetch('/api/manager/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider pb-1 border-b border-gray-100">
        <span>{t('Benefit', 'Benefit')}</span>
        <span>{t('Efekt hodin', 'Hours effect')}</span>
        <span>{t('Max. za měsíc', 'Max per month')}</span>
      </div>
      {BENEFIT_ROWS.map((row) => (
        <div key={row.hoursKey} className="grid grid-cols-3 gap-2 items-center">
          <span className="text-sm text-gray-700">{row.label}</span>
          <input
            type="number"
            step={0.5}
            value={values[row.hoursKey] ?? String(row.defaultHours)}
            onChange={(e) => setValues((v) => ({ ...v, [row.hoursKey]: e.target.value }))}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="number"
            step={1}
            min={0}
            value={values[row.maxKey] ?? String(row.defaultMax)}
            onChange={(e) => setValues((v) => ({ ...v, [row.maxKey]: e.target.value }))}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      ))}
      <div className="pt-2">
        <button onClick={handleSave} disabled={saving}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${saved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} disabled:opacity-50`}>
          {saved ? `✓ ${t('Uloženo', 'Saved')}` : saving ? '…' : t('Uložit benefity', 'Save benefits')}
        </button>
      </div>
    </div>
  );
}

// ─── Shared Helpers ───────────────────────────────────────────────────────────

function FormField({ label, error, children, className }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-center py-8">
      <p className="text-sm text-red-600 mb-3">{message}</p>
      <button onClick={onRetry} className="text-sm text-blue-600 hover:text-blue-800 underline">Zkusit znovu</button>
    </div>
  );
}

function inputCls(error?: string) {
  return `block w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
    error ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'
  }`;
}

// ─── Notifications Tab ────────────────────────────────────────────────────────

function NotificationsTab({ onRead }: { onRead: () => void }) {
  return <NotificationsPanel onUnreadChange={(count) => { if (count === 0) onRead(); }} />;
}
