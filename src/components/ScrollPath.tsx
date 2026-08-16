'use client'

// The page thread: a single line that "unfolds" from the hero's orange corner,
// runs down the page margin as you scroll (drawn by scroll progress, with a
// small ink diamond travelling at its tip) and folds itself back into the
// closing CTA's orange corner. Ink base line + orange progress — the same
// pairing as the brand mark. Wide screens only; it lives in the empty margins.
import { useEffect, useRef, useState } from 'react'

export default function ScrollPath() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const orangeRef = useRef<SVGPathElement>(null)
  const dotRef = useRef<SVGRectElement>(null)
  const [geo, setGeo] = useState<{ w: number; h: number; d: string } | null>(null)

  // Build the route from real layout measurements.
  useEffect(() => {
    const parent = wrapRef.current?.parentElement
    if (!parent) return

    const build = () => {
      const w = parent.clientWidth
      const h = parent.clientHeight
      if (w < 1180 || h < 800) { setGeo(null); return }

      const margin = Math.max(0, (w - 1152) / 2)
      const lane = Math.max(20, margin * 0.42)
      const xL = lane
      const xR = w - lane

      // The thread rides along the top edge of the closing CTA block until it
      // touches the block's cut corner — and only there it folds, following
      // the orange fold's own hypotenuse to its tip.
      const pr = parent.getBoundingClientRect()
      const ctaBlock = parent.querySelector('#cta > div')
      let ctaTop = h - 160
      let ctaRight = w - lane - 60
      if (ctaBlock) {
        const cr = ctaBlock.getBoundingClientRect()
        ctaTop = cr.top - pr.top
        ctaRight = cr.right - pr.left
      }
      const fold = Math.min(92, Math.max(44, w * 0.07)) // mirrors clamp(44px, 7vw, 92px)

      // 45° turns only — the geometry of the mark's cut corner.
      const d = [
        `M ${xR} 0`,
        `L ${xR - 34} 34`,
        `H ${xL + 34}`,
        `L ${xL} 68`,
        `V ${ctaTop - 44}`,
        `L ${xL + 44} ${ctaTop}`,
        `H ${ctaRight - fold}`,
        `L ${ctaRight} ${ctaTop + fold}`,
      ].join(' ')
      setGeo({ w, h, d })
    }

    build()
    const ro = new ResizeObserver(build)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [])

  // Scroll drives how much of the thread is drawn.
  useEffect(() => {
    if (!geo) return
    const parent = wrapRef.current?.parentElement
    const orange = orangeRef.current
    const dot = dotRef.current
    if (!parent || !orange || !dot) return

    const len = orange.getTotalLength()
    orange.style.strokeDasharray = String(len)
    const apply = () => {
      const r = parent.getBoundingClientRect()
      // Tip rides just above the viewport's bottom edge; the footer below the
      // container guarantees p hits exactly 1 at full scroll, so the diamond
      // finishes its journey on the fold's tip.
      const p = Math.min(1, Math.max(0, (-r.top + window.innerHeight * 0.92) / r.height))
      orange.style.strokeDashoffset = String(len * (1 - p))
      const pt = orange.getPointAtLength(len * p)
      dot.setAttribute('transform', `translate(${pt.x} ${pt.y}) rotate(45)`)
    }
    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(apply)
    }
    apply() // sync first paint — never blocked by a throttled rAF
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      cancelAnimationFrame(raf)
    }
  }, [geo])

  if (!geo) return <div ref={wrapRef} aria-hidden className="absolute inset-0 pointer-events-none" />
  return (
    <div ref={wrapRef} aria-hidden className="hidden xl:block absolute inset-0 pointer-events-none overflow-hidden">
      <svg width={geo.w} height={geo.h} fill="none" className="absolute inset-0">
        {/* faint ink base — the whole route is always hinted */}
        <path d={geo.d} stroke="#111820" strokeOpacity=".13" strokeWidth="1.5" strokeLinejoin="round" />
        {/* orange thread drawn by scroll */}
        <path ref={orangeRef} d={geo.d} stroke="#E8963C" strokeWidth="1.5" strokeLinejoin="round" />
        {/* ink diamond travelling at the tip — the mark's cut corner, rotated */}
        <rect ref={dotRef} x="-3.5" y="-3.5" width="7" height="7" fill="#111820" />
      </svg>
    </div>
  )
}
