'use client';

import { useState, useEffect, useCallback } from 'react';

type TabKey = 'pending' | 'approved' | 'rejected';

interface Employee {
  id: string;
  name: string;
  department?: string;
  position?: string;
}

interface Request {
  id: string;
  employee_id: string;
  type: string;
  date_from: string;
  date_to: string | null;
  note: string | null;
  status: TabKey;
  created_at: string;
  resolved_at: string | null;
  employees: Employee | null;
}

const typeLabels: Record<string, string> = {
  vacation: 'Dovolená',
  sick: 'Nemocenská',
  correction: 'Oprava docházky',
  other: 'Ostatní',
};

const typeBadgeClass: Record<string, string> = {
  vacation: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800',
  sick: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800',
  correction: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700',
  other: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700',
};

const tabs: { key: TabKey; label: string }[] = [
  { key: 'pending', label: 'Čekající' },
  { key: 'approved', label: 'Schválené' },
  { key: 'rejected', label: 'Zamítnuté' },
];

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ---------------------------------------------------------------------------
// New Request Modal
// ---------------------------------------------------------------------------
interface NewRequestModalProps {
  employees: Employee[];
  onClose: () => void;
  onCreated: () => void;
}

function NewRequestModal({ employees, onClose, onCreated }: NewRequestModalProps) {
  const [employeeId, setEmployeeId] = useState('');
  const [type, setType] = useState('vacation');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) { setError('Vyberte zaměstnance.'); return; }
    if (!dateFrom) { setError('Zadejte datum od.'); return; }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          type,
          date_from: dateFrom,
          date_to: dateTo || null,
          note: note || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Nepodařilo se vytvořit žádost.');
      }

      onCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při vytváření žádosti.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Nová žádost</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Employee */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Zaměstnanec <span className="text-red-500">*</span>
            </label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">— Vyberte zaměstnance —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}{emp.department ? ` (${emp.department})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Typ žádosti <span className="text-red-500">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Datum od <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Datum do
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                min={dateFrom}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Poznámka
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Volitelná poznámka..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            Zrušit
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading && (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            Vytvořit žádost
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function RequestsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [requests, setRequests] = useState<Request[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Pending count for badge — keep a separate count
  const [pendingCount, setPendingCount] = useState(0);

  const fetchRequests = useCallback(async (status: TabKey) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/requests?status=${status}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Nepodařilo se načíst žádosti.');
      }
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při načítání.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await fetch('/api/requests?status=pending');
      if (res.ok) {
        const data = await res.json();
        setPendingCount((data.requests ?? []).length);
      }
    } catch {
      // silently ignore
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees ?? []);
      }
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    fetchRequests(activeTab);
  }, [activeTab, fetchRequests]);

  useEffect(() => {
    fetchPendingCount();
    fetchEmployees();
  }, [fetchPendingCount, fetchEmployees]);

  async function handleAction(id: string, status: 'approved' | 'rejected') {
    setActionLoading(id + status);
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Akce selhala.');
      }
      // Optimistically remove from pending list
      setRequests((prev) => prev.filter((r) => r.id !== id));
      setPendingCount((c) => Math.max(0, c - 1));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Chyba při zpracování žádosti.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(id: string) {
    setActionLoading(id + 'delete');
    try {
      const res = await fetch(`/api/requests/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Smazání selhalo.');
      }
      setRequests((prev) => prev.filter((r) => r.id !== id));
      if (activeTab === 'pending') setPendingCount((c) => Math.max(0, c - 1));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Chyba při mazání žádosti.');
    } finally {
      setActionLoading(null);
      setDeleteConfirm(null);
    }
  }

  function handleCreated() {
    fetchPendingCount();
    if (activeTab === 'pending') fetchRequests('pending');
  }

  return (
    <>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Žádosti</h1>
            <p className="text-slate-500 text-sm mt-1">Správa žádostí zaměstnanců</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Nová žádost
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 bg-slate-100 p-1 rounded-lg w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all relative ${
                activeTab === tab.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              {tab.key === 'pending' && pendingCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-semibold">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <svg className="animate-spin w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span className="ml-3 text-slate-500 text-sm">Načítání...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" className="text-red-400">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-slate-700 text-sm font-medium">Chyba při načítání</p>
              <p className="text-slate-400 text-xs mt-1">{error}</p>
              <button
                onClick={() => fetchRequests(activeTab)}
                className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-blue-600 border border-blue-200 hover:bg-blue-50 transition-colors"
              >
                Zkusit znovu
              </button>
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" className="text-slate-400">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" />
                  <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
              <p className="text-slate-500 text-sm">Žádné žádosti v této kategorii</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Zaměstnanec</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Typ žádosti</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Od</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Do</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Poznámka</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Datum podání</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Akce</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map((req) => {
                    const employeeName = req.employees?.name ?? 'Neznámý zaměstnanec';
                    const isApproving = actionLoading === req.id + 'approved';
                    const isRejecting = actionLoading === req.id + 'rejected';
                    const isActing = isApproving || isRejecting;

                    return (
                      <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                        {/* Employee */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold flex-shrink-0">
                              {getInitials(employeeName)}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{employeeName}</p>
                              {req.employees?.department && (
                                <p className="text-xs text-slate-400">{req.employees.department}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Type */}
                        <td className="px-4 py-3">
                          <span className={typeBadgeClass[req.type] ?? typeBadgeClass.other}>
                            {typeLabels[req.type] ?? req.type}
                          </span>
                        </td>

                        {/* Date from */}
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {formatDate(req.date_from)}
                        </td>

                        {/* Date to */}
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {formatDate(req.date_to)}
                        </td>

                        {/* Note */}
                        <td className="px-4 py-3 text-slate-500 max-w-[200px]">
                          <span className="block truncate" title={req.note ?? undefined}>
                            {req.note ?? '—'}
                          </span>
                        </td>

                        {/* Created at */}
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {formatDate(req.created_at)}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {/* Status badge for non-pending */}
                            {activeTab === 'approved' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                Schváleno
                              </span>
                            )}
                            {activeTab === 'rejected' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                Zamítnuto
                              </span>
                            )}
                            {/* Approve / Reject for pending */}
                            {activeTab === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleAction(req.id, 'approved')}
                                  disabled={isActing}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-green-700 border-green-200 bg-green-50 hover:bg-green-100"
                                >
                                  {isApproving ? (
                                    <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                    </svg>
                                  ) : (
                                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
                                      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                  Schválit
                                </button>
                                <button
                                  onClick={() => handleAction(req.id, 'rejected')}
                                  disabled={isActing}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-red-700 border-red-200 bg-red-50 hover:bg-red-100"
                                >
                                  {isRejecting ? (
                                    <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                    </svg>
                                  ) : (
                                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
                                      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                  )}
                                  Zamítnout
                                </button>
                              </>
                            )}
                            {/* Delete — always visible for admin */}
                            {deleteConfirm === req.id ? (
                              <>
                                <span className="text-xs text-slate-500">Opravdu?</span>
                                <button
                                  onClick={() => handleDelete(req.id)}
                                  disabled={actionLoading === req.id + 'delete'}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 text-red-700 border-red-300 bg-red-50 hover:bg-red-100"
                                >
                                  {actionLoading === req.id + 'delete' ? (
                                    <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                    </svg>
                                  ) : 'Ano, smazat'}
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium border text-slate-600 border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                                >
                                  Zrušit
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(req.id)}
                                disabled={isActing}
                                title="Smazat žádost"
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors disabled:opacity-40"
                              >
                                <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <NewRequestModal
          employees={employees}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
