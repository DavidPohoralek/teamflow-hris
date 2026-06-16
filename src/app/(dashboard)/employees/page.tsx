'use client';

import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  labels: string[];
  can_saturday: boolean;
  max_saturdays: number;
  target_hours: number;
  active: boolean;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  labels: string;
  target_hours: number;
  can_saturday: boolean;
  max_saturdays: number;
}

const DEFAULT_FORM: FormData = {
  name: '',
  email: '',
  phone: '',
  department: '',
  position: '',
  labels: '',
  target_hours: 160,
  can_saturday: false,
  max_saturdays: 0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function avatarColor(name: string) {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-violet-100 text-violet-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-cyan-100 text-cyan-700',
  ];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return colors[hash % colors.length];
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Zavřít"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
              <path
                d="M18 6 6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// ─── Employee Form ─────────────────────────────────────────────────────────────

function EmployeeForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
  error,
}: {
  initial: FormData;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState<FormData>(initial);

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <div className="px-6 py-5 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Jméno */}
        <div>
          <label className="form-label">
            Jméno <span className="text-red-500">*</span>
          </label>
          <input
            className="form-input"
            type="text"
            placeholder="Jana Nováková"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            required
            autoFocus
          />
        </div>

        {/* Email + Telefon */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="jana@firma.cz"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">Telefon</label>
            <input
              className="form-input"
              type="tel"
              placeholder="+420 …"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </div>
        </div>

        {/* Oddělení + Pozice */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Oddělení</label>
            <input
              className="form-input"
              type="text"
              placeholder="Provoz"
              value={form.department}
              onChange={(e) => set('department', e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">Pozice</label>
            <input
              className="form-input"
              type="text"
              placeholder="Vedoucí směny"
              value={form.position}
              onChange={(e) => set('position', e.target.value)}
            />
          </div>
        </div>

        {/* Štítky */}
        <div>
          <label className="form-label">Štítky</label>
          <input
            className="form-input"
            type="text"
            placeholder="sklad, noční, senior (oddělte čárkou)"
            value={form.labels}
            onChange={(e) => set('labels', e.target.value)}
          />
          <p className="text-xs text-slate-400 mt-1">Zadejte štítky oddělené čárkou.</p>
        </div>

        {/* Cílové hodiny */}
        <div>
          <label className="form-label">Cílové hodiny / měsíc</label>
          <input
            className="form-input"
            type="number"
            min={0}
            max={744}
            value={form.target_hours}
            onChange={(e) => set('target_hours', Number(e.target.value))}
          />
        </div>

        {/* Soboty */}
        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              checked={form.can_saturday}
              onChange={(e) => set('can_saturday', e.target.checked)}
            />
            <span className="text-sm font-medium text-slate-700">Může pracovat v sobotu</span>
          </label>

          {form.can_saturday && (
            <div>
              <label className="form-label">Max sobot / měsíc</label>
              <input
                className="form-input"
                type="number"
                min={0}
                max={5}
                value={form.max_saturdays}
                onChange={(e) => set('max_saturdays', Number(e.target.value))}
              />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
          Zrušit
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              Ukládám…
            </>
          ) : (
            'Uložit'
          )}
        </button>
      </div>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [search, setSearch] = useState('');

  // Modal state: null = closed, 'add' = new employee, string = editing id
  const [modal, setModal] = useState<null | 'add' | string>(null);
  const [formInitial, setFormInitial] = useState<FormData>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deactivating, setDeactivating] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/employees');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Chyba ${res.status}`);
      }
      const { employees: data } = await res.json();
      setEmployees(data ?? []);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Nepodařilo se načíst zaměstnance.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = employees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── Open modal ─────────────────────────────────────────────────────────────
  function openAdd() {
    setFormInitial(DEFAULT_FORM);
    setFormError(null);
    setModal('add');
  }

  function openEdit(emp: Employee) {
    setFormInitial({
      name: emp.name,
      email: emp.email ?? '',
      phone: emp.phone ?? '',
      department: emp.department ?? '',
      position: emp.position ?? '',
      labels: (emp.labels ?? []).join(', '),
      target_hours: emp.target_hours,
      can_saturday: emp.can_saturday,
      max_saturdays: emp.max_saturdays,
    });
    setFormError(null);
    setModal(emp.id);
  }

  function closeModal() {
    if (submitting) return;
    setModal(null);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(data: FormData) {
    setSubmitting(true);
    setFormError(null);

    const isEdit = modal !== null && modal !== 'add';
    const url = isEdit ? `/api/employees/${modal}` : '/api/employees';
    const method = isEdit ? 'PUT' : 'POST';

    const labelsArr = data.labels
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const body = {
      name: data.name.trim(),
      email: data.email.trim() || null,
      phone: data.phone.trim() || null,
      department: data.department.trim() || null,
      position: data.position.trim() || null,
      labels: labelsArr,
      target_hours: data.target_hours,
      can_saturday: data.can_saturday,
      max_saturdays: data.max_saturdays,
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? `Chyba ${res.status}`);
      }

      setModal(null);
      await fetchEmployees();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Nepodařilo se uložit zaměstnance.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Deactivate ─────────────────────────────────────────────────────────────
  async function handleDeactivate(id: string, name: string) {
    if (!window.confirm(`Opravdu chcete deaktivovat zaměstnance ${name}?`)) return;
    setDeactivating(id);
    try {
      const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        alert(b.error ?? 'Nepodařilo se deaktivovat zaměstnance.');
        return;
      }
      await fetchEmployees();
    } finally {
      setDeactivating(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Zaměstnanci</h1>
          <p className="text-slate-500 text-sm mt-1">
            Správa zaměstnanců vaší organizace
          </p>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Přidat zaměstnance
        </button>
      </div>

      {/* ─── Search ─────────────────────────────────────────────────────── */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            width="16"
            height="16"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
            <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Hledat zaměstnance…"
            className="form-input pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ─── Content ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <svg className="animate-spin h-8 w-8 mb-4 text-blue-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <p className="text-sm">Načítám zaměstnance…</p>
        </div>
      ) : fetchError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 flex flex-col items-center gap-3 text-center">
          <svg width="36" height="36" fill="none" viewBox="0 0 24 24" className="text-red-400">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="text-red-700 font-medium">{fetchError}</p>
          <button className="btn-secondary text-sm" onClick={fetchEmployees}>
            Zkusit znovu
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <svg width="40" height="40" fill="none" viewBox="0 0 24 24" className="mb-3 text-slate-300">
                <path
                  d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              {search ? (
                <p className="text-sm">Žádný zaměstnanec neodpovídá vyhledávání.</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-500">Zatím žádní zaměstnanci</p>
                  <p className="text-xs mt-1">Klikněte na &ldquo;Přidat zaměstnance&rdquo; a začněte.</p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Jméno</th>
                      <th>Email</th>
                      <th>Oddělení</th>
                      <th>Pozice</th>
                      <th>Štítky</th>
                      <th>Stav</th>
                      <th className="text-right">Akce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((emp) => (
                      <tr key={emp.id}>
                        {/* Jméno */}
                        <td>
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${avatarColor(emp.name)}`}
                            >
                              {initials(emp.name)}
                            </div>
                            <span className="font-medium text-slate-900">{emp.name}</span>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="text-slate-500 text-xs">{emp.email ?? '—'}</td>

                        {/* Oddělení */}
                        <td>{emp.department ?? <span className="text-slate-300">—</span>}</td>

                        {/* Pozice */}
                        <td>{emp.position ?? <span className="text-slate-300">—</span>}</td>

                        {/* Štítky */}
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {emp.labels && emp.labels.length > 0 ? (
                              emp.labels.map((label) => (
                                <span
                                  key={label}
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100"
                                >
                                  {label}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </div>
                        </td>

                        {/* Stav */}
                        <td>
                          {emp.active ? (
                            <span className="badge-green">Aktivní</span>
                          ) : (
                            <span className="badge-gray">Neaktivní</span>
                          )}
                        </td>

                        {/* Akce */}
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Upravit */}
                            <button
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Upravit"
                              onClick={() => openEdit(emp)}
                            >
                              <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                                <path
                                  d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </button>

                            {/* Deaktivovat */}
                            <button
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                              title="Deaktivovat"
                              disabled={deactivating === emp.id}
                              onClick={() => handleDeactivate(emp.id, emp.name)}
                            >
                              {deactivating === emp.id ? (
                                <svg className="animate-spin h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                </svg>
                              ) : (
                                <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                                  <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table footer */}
              <div className="px-4 py-3 border-t border-slate-100">
                <p className="text-sm text-slate-400">
                  Zobrazeno {filtered.length} z {employees.length} zaměstnanců
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Modal ──────────────────────────────────────────────────────── */}
      {modal !== null && (
        <Modal
          title={modal === 'add' ? 'Přidat zaměstnance' : 'Upravit zaměstnance'}
          onClose={closeModal}
        >
          <EmployeeForm
            initial={formInitial}
            onSubmit={handleSubmit}
            onCancel={closeModal}
            submitting={submitting}
            error={formError}
          />
        </Modal>
      )}
    </>
  );
}
