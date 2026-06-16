'use client';
import { useState, useEffect } from 'react';
import { managerFetch } from '@/lib/managerFetch';
import { THEMES } from '@/lib/themes';
import { useT } from '@/lib/i18n';

interface Props {
  onThemeChange?: (key: string) => void;
}

export default function ThemeSelector({ onThemeChange }: Props) {
  const t = useT();
  const [selected, setSelected] = useState('slate');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    managerFetch('/api/manager/settings')
      .then((r: Response) => r.json())
      .then((d: Record<string, string>) => {
        if (d.ui_theme) setSelected(d.ui_theme);
      })
      .catch(() => {});
  }, []);

  async function save(key: string) {
    setSelected(key);
    setSaving(true);
    setMsg(null);
    try {
      const res = await managerFetch('/api/manager/settings', {
        method: 'PUT',
        body: JSON.stringify({ ui_theme: key }),
      });
      if (!res.ok) throw new Error(t('Chyba uložení', 'Save error'));
      onThemeChange?.(key);
      setMsg({ text: t('Motiv uložen', 'Theme saved'), ok: true });
    } catch {
      setMsg({ text: t('Chyba uložení', 'Save error'), ok: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-slate-700 mb-1">{t('Barevný motiv aplikace', 'App color theme')}</h3>
        <p className="text-sm text-slate-500">{t('Změní barvu navigační lišty a akcentů.', 'Changes the color of the navigation bar and accents.')}</p>
      </div>

      {msg && (
        <div className={`text-sm px-3 py-2 rounded-lg ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-5 gap-3">
        {THEMES.map(theme => (
          <button
            key={theme.key}
            onClick={() => save(theme.key)}
            disabled={saving}
            className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition
              ${selected === theme.key
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-slate-200 hover:border-slate-300 bg-white'}
            `}
          >
            {/* Color swatch */}
            <div className="w-full h-10 rounded-lg overflow-hidden flex">
              <div className="flex-1" style={{ background: theme.preview[0] }} />
              <div className="flex-1" style={{ background: theme.preview[1] }} />
            </div>
            <span className="text-xs text-slate-600 text-center leading-tight font-medium">
              {theme.label}
            </span>
            {selected === theme.key && (
              <span className="text-xs text-indigo-600 font-semibold">{t('✓ Aktivní', '✓ Active')}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
