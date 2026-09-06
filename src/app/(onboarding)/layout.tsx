import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TeamFlowMark, TeamFlowWordmark } from '@/components/TeamFlowLogo';

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: { user } } = await (supabase as any).auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="tf-sans min-h-screen" style={{ background: '#f4f2ee' }}>
      <header
        className="bg-white h-[57px] flex items-center px-6"
        style={{ borderBottom: '1px solid #e6e2db' }}
      >
        <div className="flex items-center gap-2.5">
          <TeamFlowMark className="w-[30px] h-[30px]" />
          <TeamFlowWordmark className="text-[17px] font-bold tracking-tight" />
          <span className="text-[13px] ml-1" style={{ color: '#9aa1aa' }}>
            — Průvodce nastavením
          </span>
        </div>
      </header>

      <main className="py-8 px-4">{children}</main>
    </div>
  );
}
