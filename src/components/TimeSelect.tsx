'use client'

import React, { useId } from 'react'

const QUARTER_HOURS: string[] = []
for (let h = 0; h < 24; h++) {
  for (const m of [0, 15, 30, 45]) {
    QUARTER_HOURS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
}

interface TimeSelectProps {
  value: string
  onChange: (val: string) => void
  className?: string
  dark?: boolean
  selectClassName?: string
}

export default function TimeSelect({ value, onChange, className, dark, selectClassName }: TimeSelectProps) {
  const id = useId()

  const inputCls = selectClassName ?? (dark
    ? 'bg-slate-700 text-white rounded-xl px-3 py-3 text-lg font-mono outline-none focus:ring-2 focus:ring-blue-500'
    : 'border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white')

  return (
    <div className={className}>
      <input
        type="time"
        step={900}
        list={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
      <datalist id={id}>
        {QUARTER_HOURS.map((t) => <option key={t} value={t} />)}
      </datalist>
    </div>
  )
}
