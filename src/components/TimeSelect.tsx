'use client'

import React from 'react'

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
  const [h, m] = (value || '00:00').split(':')
  const hour = HOURS.includes(h) ? h : '00'
  const minute = MINUTES.includes(m) ? m : MINUTES.reduce((prev, cur) =>
    Math.abs(Number(cur) - Number(m || 0)) < Math.abs(Number(prev) - Number(m || 0)) ? cur : prev
  )

  const set = (newH: string, newM: string) => onChange(`${newH}:${newM}`)

  const selCls = selectClassName ?? (dark
    ? 'bg-slate-700 text-white rounded-xl px-3 py-3 text-lg font-mono outline-none focus:ring-2 focus:ring-blue-500'
    : 'border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white')

  return (
    <div className={`flex items-center gap-1 ${className ?? ''}`}>
      <select value={hour} onChange={(e) => set(e.target.value, minute)} className={selCls}>
        {HOURS.map((hh) => (
          <option key={hh} value={hh}>{hh}</option>
        ))}
      </select>
      <span className={dark ? 'text-slate-400 font-medium' : 'text-gray-500 font-medium'}>:</span>
      <select value={minute} onChange={(e) => set(hour, e.target.value)} className={selCls}>
        {MINUTES.map((mm) => (
          <option key={mm} value={mm}>{mm}</option>
        ))}
      </select>
    </div>
  )
}
