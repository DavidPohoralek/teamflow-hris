'use client';
import { useState, useEffect, useCallback } from 'react';
import { managerFetch } from '@/lib/managerFetch';
import { useT } from '@/lib/i18n';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface Props {
  onUnreadChange?: (count: number) => void;
}

export default function NotificationsPanel({ onUnreadChange }: Props) {
  const t = useT();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await managerFetch('/api/notifications');
      const d = await r.json();
      const list: Notification[] = d.notifications ?? [];
      setNotifications(list);
      onUnreadChange?.(list.filter(n => !n.read).length);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [onUnreadChange]);

  useEffect(() => { load(); }, [load]);

  async function markRead(id: string) {
    await managerFetch(`/api/notifications/${id}`, { method: 'PATCH' });
    setNotifications(prev => {
      const next = prev.map(n => n.id === id ? { ...n, read: true } : n);
      onUnreadChange?.(next.filter(n => !n.read).length);
      return next;
    });
  }

  async function markAllRead() {
    await managerFetch('/api/notifications', { method: 'PATCH' });
    setNotifications(prev => {
      const next = prev.map(n => ({ ...n, read: true }));
      onUnreadChange?.(0);
      return next;
    });
  }

  async function remove(id: string) {
    await managerFetch(`/api/notifications/${id}`, { method: 'DELETE' });
    setNotifications(prev => {
      const next = prev.filter(n => n.id !== id);
      onUnreadChange?.(next.filter(n => !n.read).length);
      return next;
    });
  }

  if (loading) {
    return <div className="p-6 text-slate-500 text-sm">{t('Načítám…', 'Loading…')}</div>;
  }

  const unread = notifications.filter(n => !n.read).length;

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          {t('Notifikace o přijatých a odmítnutých směnách.', 'Notifications about accepted and declined shifts.')}
        </p>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium shrink-0 ml-4"
          >
            {t('Označit vše jako přečtené', 'Mark all as read')}
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-4xl mb-3">🔔</div>
          <p className="font-medium">{t('Žádné notifikace', 'No notifications')}</p>
          <p className="text-sm mt-1">
            {t(
              'Notifikace se zobrazí, když zaměstnanec přijme nebo odmítne nabídku směny.',
              'Notifications appear when an employee accepts or declines a shift offer.'
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
                n.read ? 'bg-white border-slate-100' : 'bg-amber-50 border-amber-200'
              }`}
            >
              <div className="text-xl mt-0.5">{(n.title ?? '').match(new RegExp('^\\p{Extended_Pictographic}', 'u'))?.[0] ?? '🔔'}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 text-sm">
                  {(n.title ?? '').replace(new RegExp('^\\p{Extended_Pictographic}️?\\s*', 'u'), '')}
                </p>
                <p className="text-slate-600 text-sm mt-0.5">{n.message}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(n.created_at).toLocaleString('cs-CZ', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!n.read && (
                  <button
                    onClick={() => markRead(n.id)}
                    title={t('Označit jako přečtené', 'Mark as read')}
                    className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors text-xs"
                  >
                    ✓
                  </button>
                )}
                <button
                  onClick={() => remove(n.id)}
                  title={t('Smazat', 'Delete')}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
