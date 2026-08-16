'use client'

// Fades content in as it scrolls into view. Uses IntersectionObserver so
// nothing animates off-screen, and unobserves after the first reveal.
import { useEffect, useRef, useState } from 'react'

export default function Reveal({
  children,
  delay = 0,
  className = '',
  draw = false,
}: {
  children: React.ReactNode
  /** Stagger in seconds, for grids of cards. */
  delay?: number
  className?: string
  /** Also run the self-drawing stroke animation on any pathLength shapes inside. */
  draw?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // No IntersectionObserver (or a very old browser) — just show it.
    if (typeof IntersectionObserver === 'undefined') { setShown(true); return }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) { setShown(true); io.unobserve(el) }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`tf-reveal ${draw ? 'tf-draw' : ''} ${shown ? 'is-visible' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  )
}
