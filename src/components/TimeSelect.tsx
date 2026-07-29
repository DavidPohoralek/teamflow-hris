'use client'

import React, { useId } from 'react'

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
  const [h, m] = (value || '').split(':')
  const hour = h ?? ''
  const minute = m ?? ''

  const clamp = (v: string, max: number) => {
    const n = parseInt(v, 10)
    if (isNaN(n)) return ''
    return String(Math.max(0, Math.min(max, n))).padStart(2, '0')
  }

  const commit = (newH: string, newM: string) => {
    const ch = clamp(newH, 23)
    const cm = clamp(newM, 59)
    if (ch && cm) onChange(`${ch}:${cm}`)
    else if (ch) onChange(`${ch}:00`)
  }

  const inputCls = selectClassName ?? (dark
    ? 'bg-slate-700 text-white rounded-xl px-3 py-3 text-lg font-mono outline-none focus:ring-2 focus:ring-blue-500 w-16 text-center'
    : 'border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-14 text-center')

  return (
    <div className={`flex items-center gap-1 ${className ?? ''}`}>
      <input
        list={`${id}-h`}
        value={hour}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, '').slice(0, 2)
          commit(raw, minute)
        }}
        onBlur={() => { if (hour) commit(hour, minute || '00') }}
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
        value={minute}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, '').slice(0, 2)
          commit(hour, raw)
        }}
        onBlur={() => { if (minute) commit(hour || '00', minute) }}
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
