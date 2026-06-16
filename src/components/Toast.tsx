'use client'

import { useEffect, useState } from 'react'

export interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info'
  onDismiss: () => void
}

const TYPE_STYLES: Record<ToastProps['type'], string> = {
  success: 'bg-emerald-600 border-emerald-500',
  error: 'bg-red-600 border-red-500',
  info: 'bg-blue-600 border-blue-500',
}

const TYPE_ICONS: Record<ToastProps['type'], string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
}

export function Toast({ message, type, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-white shadow-2xl min-w-[260px] max-w-sm text-sm font-medium animate-in slide-in-from-bottom-4 fade-in ${TYPE_STYLES[type]}`}
    >
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
        {TYPE_ICONS[type]}
      </span>
      <span className="flex-1">{message}</span>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 text-white/70 hover:text-white transition-colors text-base leading-none"
        aria-label="Zavřít"
      >
        ×
      </button>
    </div>
  )
}

// ─── useToast hook ────────────────────────────────────────────────────────────

interface ToastItem {
  id: string
  message: string
  type: ToastProps['type']
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  function showToast(message: string, type: ToastProps['type'] = 'success') {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts((prev) => [...prev, { id, message, type }])
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  function ToastContainer() {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            message={t.message}
            type={t.type}
            onDismiss={() => dismissToast(t.id)}
          />
        ))}
      </div>
    )
  }

  return { toasts, showToast, ToastContainer }
}
