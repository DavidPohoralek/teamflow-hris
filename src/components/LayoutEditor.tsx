'use client'

import { useState, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TabId =
  | 'attendance' | 'overview' | 'schedule' | 'vacation'
  | 'my-hours' | 'analytics' | 'assistant' | 'management'

export type HideableElement =
  | 'schedule_activity_btn'
  | 'schedule_evening_btn'
  | 'schedule_bulk_btn'
  | 'schedule_add_btn'

export interface LayoutTabConfig {
  id: TabId
  visible: boolean
}

export interface LayoutConfig {
  tabs: LayoutTabConfig[]
  hiddenElements: HideableElement[]
}

export const DEFAULT_LAYOUT: LayoutConfig = {
  tabs: [
    { id: 'attendance', visible: true },
    { id: 'overview',   visible: true },
    { id: 'schedule',   visible: true },
    { id: 'vacation',   visible: true },
    { id: 'my-hours',  visible: true },
    { id: 'analytics',  visible: true },
    { id: 'assistant',  visible: true },
    { id: 'management', visible: true },
  ],
  hiddenElements: [],
}

const TAB_META: Record<TabId, { cs: string; icon: string; manager?: true }> = {
  attendance:  { cs: 'Příchod/Odchod',  icon: '⏰' },
  overview:    { cs: 'Přehled',          icon: '📊' },
  schedule:    { cs: 'Směny',            icon: '📅' },
  vacation:    { cs: 'Dovolená',         icon: '🏖️' },
  'my-hours':  { cs: 'Zaměstnanec',      icon: '👤' },
  analytics:   { cs: 'Analytika',        icon: '📈', manager: true },
  assistant:   { cs: 'Asistent',         icon: '🤖', manager: true },
  management:  { cs: 'Správa',           icon: '⚙️', manager: true },
}

const ELEMENT_META: Array<{ id: HideableElement; cs: string; icon: string; desc: string }> = [
  { id: 'schedule_activity_btn', cs: 'Aktivity filtr',  icon: '🎯', desc: 'Filtr aktivit v zobrazení Směny' },
  { id: 'schedule_evening_btn',  cs: 'Večerní filtr',   icon: '🌙', desc: 'Filtr večerních směn' },
  { id: 'schedule_bulk_btn',     cs: 'Plošné zadání',   icon: '⚡', desc: 'Hromadné přidání směn na celý měsíc' },
  { id: 'schedule_add_btn',      cs: 'Přidat směnu',    icon: '＋', desc: 'Tlačítko pro přidání jedné směny' },
]

// ─── Merge saved config with defaults ─────────────────────────────────────────
// Ensures all tabs are present even if new ones were added after config was saved.
export function mergeLayout(saved: Partial<LayoutConfig> | null | undefined): LayoutConfig {
  if (!saved) return DEFAULT_LAYOUT
  const savedIds = new Set((saved.tabs ?? []).map(t => t.id))
  const base = DEFAULT_LAYOUT.tabs.filter(t => !savedIds.has(t.id))
  return {
    tabs: [...(saved.tabs ?? DEFAULT_LAYOUT.tabs), ...base],
    hiddenElements: saved.hiddenElements ?? [],
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  layout: LayoutConfig
  onSave: (layout: LayoutConfig) => void
  onClose: () => void
}

export default function LayoutEditor({ layout, onSave, onClose }: Props) {
  const [tabs, setTabs] = useState<LayoutTabConfig[]>(layout.tabs)
  const [hidden, setHidden] = useState<Set<HideableElement>>(new Set(layout.hiddenElements))

  // Drag state
  const dragIdx = useRef<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleDragStart(i: number) {
    dragIdx.current = i
    setIsDragging(true)
  }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault()
    setOverIdx(i)
  }

  function handleDrop(targetIdx: number) {
    const from = dragIdx.current
    if (from === null || from === targetIdx) {
      dragIdx.current = null
      setOverIdx(null)
      setIsDragging(false)
      return
    }
    const next = [...tabs]
    const [moved] = next.splice(from, 1)
    next.splice(targetIdx, 0, moved)
    setTabs(next)
    dragIdx.current = null
    setOverIdx(null)
    setIsDragging(false)
  }

  function handleDragEnd() {
    dragIdx.current = null
    setOverIdx(null)
    setIsDragging(false)
  }

  function toggleTab(id: TabId) {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, visible: !t.visible } : t))
  }

  function toggleElement(id: HideableElement) {
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSave() {
    onSave({ tabs, hiddenElements: Array.from(hidden) as HideableElement[] })
  }

  function handleReset() {
    setTabs(DEFAULT_LAYOUT.tabs)
    setHidden(new Set())
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="w-[420px] max-w-full bg-white shadow-2xl flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">Upravit rozhraní</h2>
            <p className="text-xs text-slate-400 mt-0.5">Změny se uloží pro celou organizaci</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

          {/* ── Tabs section ── */}
          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Navigační taby</h3>
            <p className="text-xs text-slate-400 mb-3">Přetáhněte pro změnu pořadí · oko pro skrytí</p>

            <div className="flex flex-col gap-1.5">
              {tabs.map((tab, i) => {
                const meta = TAB_META[tab.id]
                const isOver = overIdx === i && isDragging && dragIdx.current !== i
                const isBeingDragged = isDragging && dragIdx.current === i

                return (
                  <div
                    key={tab.id}
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDrop={() => handleDrop(i)}
                    onDragEnd={handleDragEnd}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all select-none
                      ${isBeingDragged ? 'opacity-40 scale-95 bg-slate-50 border-slate-300' : ''}
                      ${isOver ? 'border-blue-400 bg-blue-50 scale-[1.01] shadow-sm' : ''}
                      ${!isBeingDragged && !isOver ? 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50' : ''}
                      ${!tab.visible ? 'opacity-50' : ''}
                      cursor-grab active:cursor-grabbing
                    `}
                  >
                    {/* Drag handle */}
                    <div className="text-slate-300 shrink-0 text-xs leading-none">
                      ⠿
                    </div>

                    {/* Icon */}
                    <span className="text-base shrink-0">{meta.icon}</span>

                    {/* Label */}
                    <span className={`flex-1 text-sm font-medium ${tab.visible ? 'text-slate-700' : 'text-slate-400'}`}>
                      {meta.cs}
                    </span>

                    {/* Manager badge */}
                    {meta.manager && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">
                        Admin
                      </span>
                    )}

                    {/* Visibility toggle */}
                    <button
                      onClick={() => toggleTab(tab.id)}
                      title={tab.visible ? 'Skrýt tab' : 'Zobrazit tab'}
                      className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                        tab.visible
                          ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'
                          : 'text-slate-300 hover:text-blue-500 hover:bg-blue-50'
                      }`}
                    >
                      {tab.visible ? (
                        // Eye open
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        // Eye off
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── Elements section ── */}
          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Prvky v zobrazení Směny</h3>
            <p className="text-xs text-slate-400 mb-3">Skryj tlačítka která nepotřebuješ</p>

            <div className="flex flex-col gap-1.5">
              {ELEMENT_META.map(el => {
                const isHidden = hidden.has(el.id)
                return (
                  <div
                    key={el.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <span className="text-base shrink-0">{el.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${isHidden ? 'text-slate-400' : 'text-slate-700'}`}>{el.cs}</div>
                      <div className="text-xs text-slate-400 leading-tight">{el.desc}</div>
                    </div>
                    {/* Toggle switch */}
                    <button
                      onClick={() => toggleElement(el.id)}
                      className={`relative shrink-0 w-10 h-5.5 rounded-full transition-colors focus:outline-none ${
                        !isHidden ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                      style={{ height: '22px' }}
                      title={isHidden ? 'Zobrazit' : 'Skrýt'}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          !isHidden ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── Reset ── */}
          <div className="pb-2">
            <button
              onClick={handleReset}
              className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
            >
              Obnovit výchozí rozložení
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-4 flex items-center gap-3">
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            Uložit změny
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-100 transition-colors"
          >
            Zrušit
          </button>
        </div>
      </div>
    </div>
  )
}
