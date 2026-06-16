'use client';
import { useState, useEffect, useRef } from 'react';
import { managerFetch } from '@/lib/managerFetch';
import { useT } from '@/lib/i18n';

interface Props {
  onLogoChange?: (url: string | null) => void;
}

export default function OrgLogoUpload({ onLogoChange }: Props) {
  const t = useT();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    managerFetch('/api/org/logo')
      .then((r: Response) => r.json())
      .then((d: { logoUrl: string | null }) => {
        setLogoUrl(d.logoUrl);
        onLogoChange?.(d.logoUrl);
      })
      .catch(() => {});
  }, [onLogoChange]);

  async function handleFile(file: File) {
    setUploading(true);
    setMsg(null);
    const form = new FormData();
    form.append('logo', file);
    try {
      const res = await managerFetch('/api/org/logo', { method: 'POST', body: form });
      const d = await res.json() as { logoUrl?: string; error?: string };
      if (!res.ok || d.error) throw new Error(d.error ?? t('Chyba uploadu', 'Upload error'));
      setLogoUrl(d.logoUrl ?? null);
      onLogoChange?.(d.logoUrl ?? null);
      setMsg({ text: t('Logo uloženo', 'Logo saved'), ok: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : t('Chyba', 'Error'), ok: false });
    } finally {
      setUploading(false);
    }
  }

  async function remove() {
    setUploading(true);
    await managerFetch('/api/org/logo', { method: 'DELETE' });
    setLogoUrl(null);
    onLogoChange?.(null);
    setUploading(false);
    setMsg({ text: t('Logo odstraněno', 'Logo removed'), ok: true });
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-slate-700 mb-1">{t('Logo organizace', 'Organization logo')}</h3>
        <p className="text-sm text-slate-500">{t('Zobrazí se v navigaci vedle loga TeamFlow. PNG, JPG, SVG, max 2 MB.', 'Displayed in the navigation next to the TeamFlow logo. PNG, JPG, SVG, max 2 MB.')}</p>
      </div>

      {msg && (
        <div className={`text-sm px-3 py-2 rounded-lg ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {msg.text}
        </div>
      )}

      <div className="flex items-center gap-4">
        {/* Preview */}
        <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden flex-shrink-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
          ) : (
            <span className="text-2xl">🏢</span>
          )}
        </div>

        <div className="space-y-2">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg disabled:opacity-40 transition"
          >
            {uploading ? t('Nahrávám…', 'Uploading…') : logoUrl ? t('Změnit logo', 'Change logo') : t('Nahrát logo', 'Upload logo')}
          </button>
          {logoUrl && (
            <button
              onClick={remove}
              disabled={uploading}
              className="ml-2 px-3 py-2 border border-slate-200 hover:border-red-300 hover:text-red-600 text-sm rounded-lg transition disabled:opacity-40"
            >
              {t('Odebrat', 'Remove')}
            </button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
