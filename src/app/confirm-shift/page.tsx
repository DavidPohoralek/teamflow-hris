'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface OfferData {
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  date: string;
  draftLabel: string;
  workType: string;
  notes?: string;
  expiresAt?: string;
  employeeName: string;
  orgName: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function ConfirmShiftContent() {
  const params = useSearchParams();
  const token = params.get('token');

  const [offer, setOffer] = useState<OfferData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [action, setAction] = useState<'accept' | 'decline' | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!token) { setLoadError('Chybí potvrzovací odkaz.'); return; }
    fetch(`/api/shift-offers/${token}`)
      .then(r => r.json())
      .then((d: OfferData & { error?: string }) => {
        if (d.error) setLoadError(d.error);
        else setOffer(d);
      })
      .catch(() => setLoadError('Nepodařilo se načíst nabídku.'));
  }, [token]);

  async function respond(a: 'accept' | 'decline') {
    if (!token || sending) return;
    setAction(a);
    setSending(true);
    try {
      const r = await fetch(`/api/shift-offers/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: a }),
      });
      const d = await r.json();
      if (!r.ok) setResult({ ok: false, text: d.error ?? 'Chyba.' });
      else if (a === 'accept') setResult({ ok: true, text: 'Směna přijata! Manažer byl informován.' });
      else setResult({ ok: false, text: 'Směna odmítnuta. Manažer byl informován.' });
    } catch {
      setResult({ ok: false, text: 'Chyba sítě. Zkuste to znovu.' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">📅</div>
          <h1 className="text-xl font-bold text-slate-800">Nabídka směny</h1>
          <p className="text-sm text-slate-500 mt-1">TeamFlow – HelvetiPlánovač</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">

          {/* Loading */}
          {!offer && !loadError && (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <div className="animate-spin w-5 h-5 border-2 border-slate-300 border-t-indigo-500 rounded-full mr-3" />
              Načítám nabídku…
            </div>
          )}

          {/* Error */}
          {loadError && (
            <div className="text-center py-6 space-y-2">
              <div className="text-4xl">⚠️</div>
              <p className="font-semibold text-slate-700">{loadError}</p>
              <p className="text-sm text-slate-400">Odkaz mohl vypršet nebo byl již použit.</p>
            </div>
          )}

          {/* Already acted on */}
          {offer && offer.status !== 'pending' && (
            <div className="text-center py-6 space-y-3">
              <div className="text-4xl">
                {offer.status === 'accepted' ? '✅' : offer.status === 'declined' ? '❌' : '⏰'}
              </div>
              <p className="font-semibold text-slate-700">
                {offer.status === 'accepted' && 'Tato směna již byla přijata.'}
                {offer.status === 'declined' && 'Tato směna již byla odmítnuta.'}
                {offer.status === 'expired' && 'Platnost nabídky vypršela.'}
              </p>
            </div>
          )}

          {/* Offer details + actions */}
          {offer && offer.status === 'pending' && !result && (
            <>
              <div>
                <p className="text-sm text-slate-500">Zaměstnanec</p>
                <p className="font-bold text-slate-800 text-lg">{offer.employeeName}</p>
              </div>

              <div className="bg-indigo-50 rounded-xl px-4 py-4 space-y-2">
                <div>
                  <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">Datum</p>
                  <p className="font-semibold text-indigo-900">{formatDate(offer.date)}</p>
                </div>
                <div>
                  <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">Typ směny</p>
                  <p className="text-indigo-800">{offer.workType}</p>
                </div>
                {offer.notes && (
                  <div>
                    <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">Poznámka</p>
                    <p className="text-indigo-700 text-sm">{offer.notes}</p>
                  </div>
                )}
              </div>

              {offer.expiresAt && (
                <p className="text-xs text-slate-400 text-center">
                  Nabídka platí do {new Date(offer.expiresAt).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => respond('decline')}
                  disabled={sending}
                  className="flex-1 py-3 border-2 border-slate-200 hover:border-red-300 hover:text-red-600 rounded-xl text-sm font-medium text-slate-600 transition disabled:opacity-40"
                >
                  {sending && action === 'decline' ? '…' : '❌ Odmítnout'}
                </button>
                <button
                  onClick={() => respond('accept')}
                  disabled={sending}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-40"
                >
                  {sending && action === 'accept' ? '…' : '✅ Přijmout směnu'}
                </button>
              </div>
            </>
          )}

          {/* Result after action */}
          {result && (
            <div className="text-center py-6 space-y-3">
              <div className="text-4xl">{result.ok ? '✅' : '❌'}</div>
              <p className={`font-semibold ${result.ok ? 'text-emerald-700' : 'text-slate-700'}`}>
                {result.text}
              </p>
              {result.ok && (
                <p className="text-sm text-slate-400">
                  Tuto stránku můžete zavřít.
                </p>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Powered by TeamFlow · SelbickyLabs
        </p>
      </div>
    </div>
  );
}

export default function ConfirmShiftPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-indigo-500 rounded-full" />
      </div>
    }>
      <ConfirmShiftContent />
    </Suspense>
  );
}
