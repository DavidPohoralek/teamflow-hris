'use client'

import React, { useEffect, useId, useState } from 'react'

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '15', '30', '45']

interface TimeSelectProps {
  value: string
  onChange: (val: string) => void
  className?: string
  dark?: boolean
  selectClassName?: string
}

export default function TimeSelect({ value, onChange, className, dark, selectClassName }: TimeSelectProps) {
  const id = useId()
  const [h, m] = (value || '00:00').split(':')

  const [hourDraft, setHourDraft] = useState(h || '00')
  const [minDraft, setMinDraft] = useState(m || '00')

  useEffect(() => {
    const [vh, vm] = (value || '00:00').split(':')
    setHourDraft(vh || '00')
    setMinDraft(vm || '00')
  }, [value])

  const clamp = (v: string, max: number) => {
    const n = parseInt(v, 10)
    if (isNaN(n)) return '00'
    return String(Math.max(0, Math.min(max, n))).padStart(2, '0')
  }

  const commitHour = (raw: string) => {
    const ch = clamp(raw, 23)
    setHourDraft(ch)
    onChange(`${ch}:${clamp(minDraft, 59)}`)
  }

  const commitMin = (raw: string) => {
    const cm = clamp(raw, 59)
    setMinDraft(cm)
    onChange(`${clamp(hourDraft, 23)}:${cm}`)
  }

  const inputCls = selectClassName ?? (dark
    ? 'bg-slate-700 text-white rounded-xl px-3 py-3 text-lg font-mono outline-none focus:ring-2 focus:ring-blue-500 w-16 text-center'
    : 'border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-14 text-center')

  return (
    <div className={`flex items-center gap-1 ${className ?? ''}`}>
      <input
        list={`${id}-h`}
        value={hourDraft}
        onChange={(e) => setHourDraft(e.target.value.replace(/\D/g, '').slice(0, 2))}
        onBlur={(e) => commitHour(e.target.value)}
        placeholder="HH"
        inputMode="numeric"
        maxLength={2}
        className={inputCls}
      />
      <datalist id={`${id}-h`}>
        {HOURS.map((hh) => <option key={hh} value={hh} />)}
      </datalist>
      <span className={dark ? 'text-slate-400 font-medium' : 'text-gray-500 font-medium'}>:</span>
      <input
        list={`${id}-m`}
        value={minDraft}
        onChange={(e) => setMinDraft(e.target.value.replace(/\D/g, '').slice(0, 2))}
        onBlur={(e) => commitMin(e.target.value)}
        placeholder="MM"
        inputMode="numeric"
        maxLength={2}
        className={inputCls}
      />
      <datalist id={`${id}-m`}>
        {MINUTES.map((mm) => <option key={mm} value={mm} />)}
      </datalist>
    </div>
  )
}
