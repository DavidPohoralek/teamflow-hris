'use client';
import { useState, useEffect } from 'react';
import { managerFetch } from '@/lib/managerFetch';

interface IntegrationState {
  slack_webhook_url: string;
  resend_api_key: string;
  email_from: string;
  slack_configured: boolean;
  email_configured: boolean;
}

export default function IntegrationSettings() {
  const [state, setState] = useState<IntegrationState | null>(null);
  const [slackInput, setSlackInput] = useState('');
  const [resendInput, setResendInput] = useState('');
  const [emailFromInput, setEmailFromInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    managerFetch('/api/integrations')
      .then((r: Response) => r.json())
      .then((d: IntegrationState) => {
        setState(d);
        setEmailFromInput(d.email_from ?? '');
      });
  }, []);

  async function save(fields: Record<string, string>) {
    setSaving(true);
    setMsg(null);
    try {
      const r = await managerFetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg({ text: 'Uloženo', ok: true });
      // Refresh state
      const fresh = await managerFetch('/api/integrations').then((x: Response) => x.json() as Promise<IntegrationState>);
      setState(fresh);
      setSlackInput('');
      setResendInput('');
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Chyba', ok: false });
    } finally {
      setSaving(false);
    }
  }

  async function remove(key: string) {
    setSaving(true);
    setMsg(null);
    await managerFetch(`/api/integrations?key=${key}`, { method: 'DELETE' });
    const fresh = await managerFetch('/api/integrations').then((x: Response) => x.json() as Promise<IntegrationState>);
    setState(fresh);
    setSaving(false);
    setMsg({ text: 'Integrace odstraněna', ok: true });
  }

  if (!state) return <div className="text-slate-400 text-sm p-4">Načítám…</div>;

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h3 className="font-semibold text-slate-700 mb-1">Integrace a oznámení</h3>
        <p className="text-sm text-slate-500">
          Nakonfigurujte externí kanály pro oslovování zaměstnanců ze Směnového asistenta.
        </p>
      </div>

      {msg && (
        <div className={`text-sm px-3 py-2 rounded-lg ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {msg.text}
        </div>
      )}

      {/* Slack */}
      <div className="border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">💬</span>
          <div>
            <div className="font-medium text-slate-800 text-sm">Slack – Incoming Webhook</div>
            <div className="text-xs text-slate-400">Posílá zprávu do kanálu (#smeny apod.)</div>
          </div>
          {state.slack_configured && (
            <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Aktivní</span>
          )}
        </div>
        {state.slack_configured ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 font-mono">{state.slack_webhook_url}</span>
            <button
              onClick={() => remove('slack_webhook_url')}
              disabled={saving}
              className="text-xs text-red-500 hover:text-red-700 ml-auto"
            >
              Odebrat
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://hooks.slack.com/services/..."
              value={slackInput}
              onChange={e => setSlackInput(e.target.value)}
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              onClick={() => save({ slack_webhook_url: slackInput })}
              disabled={saving || !slackInput}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg disabled:opacity-40"
            >
              Uložit
            </button>
          </div>
        )}
        <a
          href="https://api.slack.com/messaging/webhooks"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-indigo-500 hover:underline"
        >
          Jak vytvořit Slack webhook →
        </a>
      </div>

      {/* Email via Resend */}
      <div className="border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">📧</span>
          <div>
            <div className="font-medium text-slate-800 text-sm">Email – Resend</div>
            <div className="text-xs text-slate-400">Pošle email přímo zaměstnanci na jeho adresu v systému</div>
          </div>
          {state.email_configured && (
            <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Aktivní</span>
          )}
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">API klíč</label>
          {state.email_configured ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 font-mono">{state.resend_api_key}</span>
              <button
                onClick={() => remove('resend_api_key')}
                disabled={saving}
                className="text-xs text-red-500 hover:text-red-700 ml-auto"
              >
                Odebrat
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="re_xxxxxxxxxx"
                value={resendInput}
                onChange={e => setResendInput(e.target.value)}
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <button
                onClick={() => save({ resend_api_key: resendInput, email_from: emailFromInput || 'asistent@helvetiplanovac.cz' })}
                disabled={saving || !resendInput}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg disabled:opacity-40"
              >
                Uložit
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Odesílatelská adresa</label>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="asistent@vasedomena.cz"
              value={emailFromInput}
              onChange={e => setEmailFromInput(e.target.value)}
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              onClick={() => save({ email_from: emailFromInput })}
              disabled={saving || !emailFromInput}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm rounded-lg disabled:opacity-40"
            >
              Uložit
            </button>
          </div>
        </div>

        <a
          href="https://resend.com/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-indigo-500 hover:underline"
        >
          Vytvořit Resend API klíč →
        </a>
      </div>

      <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
        API klíče jsou uloženy šifrovaně na serveru a nikdy se neposílají do prohlížeče.
      </div>
    </div>
  );
}
