import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { sfx } from '../sfx'

/**
 * Hand-marked story text, in the style of the Japanese key-visual copy:
 * highlighter swipes, brush ticks, circled words, wavy underlines and emphasis dots.
 * Each mark draws itself in once its line scrolls into view.
 */

const SKY = '#7FD3F7'
const YELLOW = '#FFD84A'
const PINK = '#FF9EC4'

type Tone = 'sky' | 'yellow' | 'pink'
const tone = (t: Tone) => (t === 'sky' ? SKY : t === 'yellow' ? YELLOW : PINK)

/** A marker swipe behind the lower part of the words. */
export function Hl({ children, c = 'sky' }: { children: ReactNode; c?: Tone }) {
  return (
    <span className="fx fx-hl" style={{ '--fx': tone(c) } as CSSProperties}>
      {children}
    </span>
  )
}

/** A short, thick brush stroke under the words, like a quick pen accent. */
export function Brush({ children, c = 'yellow' }: { children: ReactNode; c?: Tone }) {
  return (
    <span className="fx fx-brush" style={{ '--fx': tone(c) } as CSSProperties}>
      {children}
    </span>
  )
}

/** A loose hand-drawn loop around the word. */
export function Circ({ children, c = 'sky' }: { children: ReactNode; c?: Tone }) {
  return (
    <span className="fx fx-circ" style={{ '--fx': tone(c) } as CSSProperties}>
      <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
        <path
          pathLength={1}
          d="M58 7C84 6 98 18 96 31C94 45 72 55 47 54C21 53 3 43 4 29C5 15 25 6 50 6C62 6 70 8 76 11"
        />
      </svg>
      {children}
    </span>
  )
}

/** A wavy pink underline. */
export function Wavy({ children, c = 'pink' }: { children: ReactNode; c?: Tone }) {
  return (
    <span className="fx fx-wavy" style={{ '--fx': tone(c) } as CSSProperties}>
      {children}
      <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
        <path pathLength={1} d="M1 6Q7 0 13 5T25 5T37 5T49 5T61 5T73 5T85 5T99 4" />
      </svg>
    </span>
  )
}

/** Japanese-style emphasis dots (傍点) above the words. */
export function Dots({ children, c = 'pink' }: { children: ReactNode; c?: Tone }) {
  return (
    <span className="fx fx-dots" style={{ '--fx': tone(c) } as CSSProperties}>
      {children}
    </span>
  )
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="fx-strong">{children}</strong>
}

export function Green({ children }: { children: ReactNode }) {
  return <span className="fx-green">{children}</span>
}

/** Lines of marked-up copy that reveal (and draw their marks) as they enter the viewport. */
export function Story({ lines }: { lines: ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const els = Array.from(ref.current?.querySelectorAll<HTMLElement>('.st-line') ?? [])
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          const el = e.target as HTMLElement
          el.classList.add('is-in')
          if (el.querySelector('.fx')) window.setTimeout(() => sfx.rustle(), 380)
          io.unobserve(el)
        })
      },
      { threshold: 0.6, rootMargin: '0px 0px -8% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
  return (
    <div className="story" ref={ref}>
      {lines.map((l, i) => (
        <p key={i} className="st-line">
          {l}
        </p>
      ))}
    </div>
  )
}
