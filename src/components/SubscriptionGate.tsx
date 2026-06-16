'use client';

const PRICING_URL = 'https://selbickylabs.com/#teamflow';

interface Props {
  status: 'pending' | 'expired';
  orgName?: string;
}

export default function SubscriptionGate({ status, orgName }: Props) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-lg text-center">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <svg width="40" height="40" viewBox="0 0 250 260" xmlns="http://www.w3.org/2000/svg">
            <polygon points="125,130 225,72 225,187 125,244" fill="#C87C1A"/>
            <polygon points="25,72 125,130 125,244 25,187" fill="#E09828"/>
            <polygon points="125,15 225,72 213,72 125,22" fill="#EDB84A"/>
            <polygon points="25,72 125,15 125,22 37,72" fill="#E09828"/>
            <polygon points="225,72 125,130 125,122 213,72" fill="#96560A"/>
            <polygon points="125,130 25,72 37,72 125,122" fill="#AE6A10"/>
            <polygon points="37,72 125,22 125,122" fill="#2A4878"/>
            <polygon points="213,72 125,22 125,122" fill="#05080F"/>
            <line x1="125" y1="22" x2="125" y2="122" stroke="#1A2E58" strokeWidth="1.5"/>
            <polyline points="125,22 213,72 125,122 37,72 125,22" fill="none" stroke="#182840" strokeWidth="1.8"/>
            <polygon points="35,98 115,145 115,163 35,117" fill="#7A4808"/>
            <polygon points="61,139 89,155 89,210 61,194" fill="#7A4808"/>
            <polygon points="135,145 215,98 215,117 135,163" fill="#6A3806"/>
            <polygon points="135,170 153,159 153,211 135,221" fill="#6A3806"/>
            <polygon points="157,171 200,146 200,163 157,188" fill="#6A3806"/>
            <polyline points="25,72 125,15 225,72" fill="none" stroke="#C07010" strokeWidth="2.5" strokeLinejoin="round"/>
            <line x1="25" y1="72" x2="25" y2="187" stroke="#C07010" strokeWidth="2"/>
            <line x1="225" y1="72" x2="225" y2="187" stroke="#8A4A08" strokeWidth="2"/>
            <line x1="25" y1="187" x2="125" y2="244" stroke="#B07010" strokeWidth="2"/>
            <line x1="225" y1="187" x2="125" y2="244" stroke="#8A4A08" strokeWidth="2"/>
            <line x1="125" y1="130" x2="125" y2="244" stroke="#9A5C10" strokeWidth="2.5"/>
          </svg>
          <span className="text-white font-bold text-2xl tracking-tight">TeamFlow</span>
        </div>

        {/* Message */}
        <div className="mb-8">
          {status === 'expired' ? (
            <>
              <div className="text-4xl mb-4">⏰</div>
              <h1 className="text-2xl font-bold text-white mb-3">Předplatné vypršelo</h1>
              <p className="text-slate-400 leading-relaxed">
                {orgName ? <><strong className="text-slate-200">{orgName}</strong> — vaše</> : 'Vaše'} předplatné TeamFlow skončilo.
                Obnovte jej pro opětovný přístup ke všem funkcím.
              </p>
            </>
          ) : (
            <>
              <div className="text-4xl mb-4">🚀</div>
              <h1 className="text-2xl font-bold text-white mb-3">Vyberte si předplatné</h1>
              <p className="text-slate-400 leading-relaxed">
                Prošli jste průvodcem. Pro plný přístup k TeamFlow si vyberte plán,
                který nejlépe odpovídá potřebám {orgName ? <><strong className="text-slate-200">{orgName}</strong></> : 'vaší firmy'}.
              </p>
            </>
          )}
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 text-left">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Standard</p>
            <ul className="space-y-2 text-sm text-slate-300 mb-4">
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Plánování směn</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Docházka & kiosek</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Portál zaměstnance</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Analytika</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Dovolené</li>
            </ul>
          </div>

          <div className="bg-gradient-to-b from-blue-900 to-indigo-900 border border-blue-600/50 rounded-2xl p-5 text-left relative overflow-hidden">
            <div className="absolute top-3 right-3 bg-amber-400 text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Doporučeno
            </div>
            <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider mb-3">Pro + AI ✦</p>
            <ul className="space-y-2 text-sm text-slate-200 mb-4">
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Vše ze Standard</li>
              <li className="flex items-center gap-2"><span className="text-amber-400">✦</span> AI asistent směn</li>
              <li className="flex items-center gap-2"><span className="text-amber-400">✦</span> Automatické plánování</li>
              <li className="flex items-center gap-2"><span className="text-amber-400">✦</span> Optimalizace rozvrhu</li>
            </ul>
          </div>
        </div>

        {/* CTA */}
        <a
          href={PRICING_URL}
          className="block w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all text-base shadow-lg shadow-blue-900/50 mb-4"
        >
          {status === 'expired' ? 'Obnovit předplatné →' : 'Vybrat předplatné →'}
        </a>

        <p className="text-xs text-slate-600">
          Platba probíhá bezpečně přes Lemon Squeezy · Zrušení kdykoli
        </p>
      </div>
    </div>
  );
}
