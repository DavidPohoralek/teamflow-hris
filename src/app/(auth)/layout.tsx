import Link from 'next/link';
import { TeamFlowMark } from '@/components/TeamFlowLogo';

// Shared shell for /login, /register and the password flows — the warm kiosk
// surface with a white card in the brand-mark shape (clipped top-right corner
// + orange fold), matching the PIN kiosk and the marketing site.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="tf-sans min-h-screen bg-[#f2f0ec] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-7">
          <TeamFlowMark variant="light" className="w-[34px] h-[34px] shrink-0" />
          <span className="text-[25px] font-semibold tracking-tight text-[#111820]">
            Team<span style={{ color: '#C97C2A' }}>Flow</span>
          </span>
        </div>

        {/* Card */}
        <div
          className="bg-white border border-[#e5e3df] rounded-[14px] px-6 sm:px-8 pt-8 pb-7"
          style={{ boxShadow: '0 1px 2px rgba(17,24,32,.04), 0 14px 32px rgba(17,24,32,.08)' }}
        >
          {children}
        </div>

        <p className="text-center text-[#8a929c] text-xs mt-6">
          © {new Date().getFullYear()} SelbickyLabs ·{' '}
          <Link href="/" className="hover:text-[#111820] transition-colors">tmflw.com</Link>
        </p>
      </div>
    </div>
  );
}
