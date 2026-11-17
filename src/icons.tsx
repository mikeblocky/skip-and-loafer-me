import type { CSSProperties } from 'react'
import { C } from './data'

type P = { c: string }

const PETAL = 'M24 25C17 20 15 10 19.5 4L24 8L28.5 4C33 10 31 20 24 25Z'

const SHAPES = {
  star: ({ c }: P) => (
    <path
      d="M24 5l5.6 11.6 12.8 1.7-9.4 8.9 2.4 12.7L24 33.7l-11.4 6.2L15 27.2l-9.4-8.9 12.8-1.7z"
      fill={c}
      stroke={c}
      strokeWidth={5}
      strokeLinejoin="round"
    />
  ),
  heart: ({ c }: P) => (
    <path
      d="M24 42S5 30.5 5 17.5C5 11 10 6.5 15.5 6.5c4 0 6.8 2.2 8.5 5 1.7-2.8 4.5-5 8.5-5C38 6.5 43 11 43 17.5 43 30.5 24 42 24 42z"
      fill={c}
    />
  ),
  sparkle: ({ c }: P) => (
    <path d="M24 2C26 18 30 22 46 24 30 26 26 30 24 46 22 30 18 26 2 24 18 22 22 18 24 2Z" fill={c} />
  ),
  sakura: ({ c }: P) => (
    <g>
      {[0, 72, 144, 216, 288].map((r) => (
        <path key={r} d={PETAL} fill={c} transform={`rotate(${r} 24 24)`} />
      ))}
      <circle cx="24" cy="24" r="4" fill="#fff" opacity=".85" />
    </g>
  ),
  bolt: ({ c }: P) => (
    <path d="M27 4L10 27h12l-3 17 19-25H26z" fill={c} stroke={c} strokeWidth={4} strokeLinejoin="round" />
  ),
  note: ({ c }: P) => (
    <g fill={c}>
      <circle cx="15" cy="36" r="7.5" />
      <rect x="18.5" y="7" width="5" height="30" rx="2.5" />
      <path d="M21 7c7 0 15 3 17 11-4-3-10-3.5-17-2z" />
    </g>
  ),
  sun: ({ c }: P) => (
    <g fill={c}>
      <circle cx="24" cy="24" r="10" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((r) => (
        <rect key={r} x="21.5" y="1.5" width="5" height="9" rx="2.5" transform={`rotate(${r} 24 24)`} />
      ))}
    </g>
  ),
  cloud: ({ c }: P) => (
    <path d="M14 38h21a8.5 8.5 0 0 0 1.5-16.9A11.5 11.5 0 0 0 15 18.6 9.7 9.7 0 0 0 14 38z" fill={c} />
  ),
  smile: ({ c }: P) => (
    <g>
      <circle cx="24" cy="24" r="20" fill={c} />
      <circle cx="17" cy="20" r="2.8" fill="#fff" />
      <circle cx="31" cy="20" r="2.8" fill="#fff" />
      <path d="M15.5 28c4.5 6 12.5 6 17 0" stroke="#fff" strokeWidth={3.6} strokeLinecap="round" fill="none" />
    </g>
  ),
  onigiri: ({ c }: P) => (
    <g>
      <path d="M24 5c3.5 0 19 27.5 19 32 0 4-3 6-6 6H11c-3 0-6-2-6-6C5 32.5 20.5 5 24 5z" fill={c} />
      <rect x="16" y="30" width="16" height="13" rx="2" fill={C.ink} />
    </g>
  ),
  plane: ({ c }: P) => (
    <g>
      <path d="M4 22L44 6 34 42 24 30z" fill={c} stroke={c} strokeWidth={3} strokeLinejoin="round" />
      <path d="M24 30L44 6 20 27z" fill="#000" opacity=".18" />
    </g>
  ),
  bow: ({ c }: P) => (
    <g fill={c}>
      <path d="M24 24L7 12.5C4 10.5 2.5 14 2.5 24S4 37.5 7 35.5z" />
      <path d="M24 24l17-11.5c3-2 4.5 1.5 4.5 11.5S44 37.5 41 35.5z" />
      <circle cx="24" cy="24" r="5.5" />
      <circle cx="24" cy="24" r="2.4" fill="#fff" opacity=".6" />
    </g>
  ),
  squiggle: ({ c }: P) => (
    <path
      d="M4 30c4-12 8-12 11 0s7 12 11 0 7-12 11 0 4 6 7 4"
      fill="none"
      stroke={c}
      strokeWidth={6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  ring: ({ c }: P) => <circle cx="24" cy="24" r="14" fill="none" stroke={c} strokeWidth={9} />,
  clover: ({ c }: P) => (
    <g fill={c}>
      <circle cx="24" cy="14.5" r="9.5" />
      <circle cx="33.5" cy="24" r="9.5" />
      <circle cx="24" cy="33.5" r="9.5" />
      <circle cx="14.5" cy="24" r="9.5" />
      <circle cx="24" cy="24" r="4.5" fill="#fff" opacity=".85" />
    </g>
  ),
  pencil: ({ c }: P) => (
    <g transform="rotate(45 24 24)">
      <rect x="18.5" y="4" width="11" height="8" rx="3" fill={C.pink} />
      <rect x="18.5" y="10" width="11" height="22" fill={c} />
      <path d="M18.5 32h11L24 44z" fill="#FFD9A8" />
      <path d="M22.2 40h3.6L24 44z" fill={C.ink} />
    </g>
  ),
  envelope: ({ c }: P) => (
    <g>
      <rect x="5" y="11" width="38" height="27" rx="6" fill={c} />
      <path d="M9 16l15 11 15-11" stroke="#fff" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </g>
  ),
  moon: ({ c }: P) => <path d="M30 5a19 19 0 1 0 13 28A15.5 15.5 0 0 1 30 5z" fill={c} />,
  bubble: ({ c }: P) => (
    <g>
      <path d="M8 8h32a5 5 0 0 1 5 5v18a5 5 0 0 1-5 5H22l-9 8v-8H8a5 5 0 0 1-5-5V13a5 5 0 0 1 5-5z" fill={c} />
      <circle cx="15" cy="22" r="2.8" fill="#fff" />
      <circle cx="24" cy="22" r="2.8" fill="#fff" />
      <circle cx="33" cy="22" r="2.8" fill="#fff" />
    </g>
  ),
  arrow: ({ c }: P) => (
    <path
      d="M6 34c6-16 22-22 34-14m0 0l-9 1m9-1l-2 9"
      fill="none"
      stroke={c}
      strokeWidth={5.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  close: ({ c }: P) => (
    <path d="M13 13l22 22M35 13L13 35" stroke={c} strokeWidth={6} strokeLinecap="round" />
  ),
  chev: ({ c }: P) => (
    <path d="M18 9l15 15-15 15" fill="none" stroke={c} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
  ),
  replay: ({ c }: P) => (
    <g fill="none" stroke={c} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M38 24a14 14 0 1 1-4.1-9.9" />
      <path d="M35 6v9h-9" />
    </g>
  ),
  book: ({ c }: P) => (
    <g>
      <path d="M6 10c7-2 13-1 18 3v27c-5-4-11-5-18-3z" fill={c} />
      <path d="M42 10c-7-2-13-1-18 3v27c5-4 11-5 18-3z" fill={c} opacity=".75" />
    </g>
  ),
  sound: ({ c }: P) => (
    <g>
      <path d="M7 19h7l10-8v26l-10-8H7z" fill={c} stroke={c} strokeWidth={3} strokeLinejoin="round" />
      <path d="M31 17c3 2 4.5 4.5 4.5 7S34 29 31 31M36 12c5 3.5 7.5 7.5 7.5 12S41 32.5 36 36" fill="none" stroke={c} strokeWidth={4} strokeLinecap="round" />
    </g>
  ),
  mute: ({ c }: P) => (
    <g>
      <path d="M7 19h7l10-8v26l-10-8H7z" fill={c} stroke={c} strokeWidth={3} strokeLinejoin="round" />
      <path d="M32 18l12 12M44 18L32 30" stroke={c} strokeWidth={4.5} strokeLinecap="round" />
    </g>
  ),
  bag: ({ c }: P) => (
    <g>
      <path d="M16 17v-3a8 8 0 0 1 16 0v3" fill="none" stroke={c} strokeWidth={3.6} strokeLinecap="round" />
      <path d="M8 16h32l-2.5 24a3 3 0 0 1-3 2.6H13.5a3 3 0 0 1-3-2.6z" fill={c} />
      <circle cx="17" cy="23" r="2" fill="#fff" opacity=".8" />
      <circle cx="31" cy="23" r="2" fill="#fff" opacity=".8" />
    </g>
  ),
  play: ({ c }: P) => (
    <path d="M15 9.5c0-2.3 2.5-3.7 4.5-2.5l20 12.5c1.9 1.2 1.9 3.9 0 5L19.5 37c-2 1.2-4.5-.2-4.5-2.5z" fill={c} stroke={c} strokeWidth={2} strokeLinejoin="round" />
  ),
  pause: ({ c }: P) => (
    <g fill={c}>
      <rect x="11" y="8" width="9.5" height="32" rx="3.5" />
      <rect x="27.5" y="8" width="9.5" height="32" rx="3.5" />
    </g>
  ),
  expand: ({ c }: P) => (
    <path d="M8 18V8h10M30 8h10v10M40 30v10H30M18 40H8V30" fill="none" stroke={c} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
  ),
  film: ({ c }: P) => (
    <g>
      <rect x="6" y="9" width="36" height="30" rx="5" fill={c} />
      <path d="M12 9v30M36 9v30" stroke="#fff" strokeWidth={2} opacity=".45" />
      {[14, 22, 30].map((y) => (
        <g key={y} fill="#fff" opacity=".85">
          <rect x="7.6" y={y - 1.5} width="2.8" height="3.4" rx=".8" />
          <rect x="37.6" y={y - 1.5} width="2.8" height="3.4" rx=".8" />
        </g>
      ))}
      <path d="M20 18.5v11l9-5.5z" fill="#fff" />
    </g>
  ),
  // ── storyline marks, one per volume ──
  school: ({ c }: P) => (
    <g>
      <path d="M5 22L24 9l19 13z" fill={c} stroke={c} strokeWidth={3} strokeLinejoin="round" />
      <rect x="9" y="21" width="30" height="21" rx="2.5" fill={c} />
      <circle cx="24" cy="19" r="3.4" fill="#fff" opacity=".9" />
      <rect x="20" y="31" width="8" height="11" rx="2" fill="#fff" opacity=".85" />
      <rect x="12.5" y="26" width="5" height="5" rx="1.2" fill="#fff" opacity=".7" />
      <rect x="30.5" y="26" width="5" height="5" rx="1.2" fill="#fff" opacity=".7" />
    </g>
  ),
  umbrella: ({ c }: P) => (
    <g>
      <path d="M5 24C5 13.5 13.5 6 24 6s19 7.5 19 18c-3.2-2.6-6.3-2.6-9.5 0-3.2-2.6-6.3-2.6-9.5 0-3.2-2.6-6.3-2.6-9.5 0-3.2-2.6-6.3-2.6-9.5 0z" fill={c} />
      <path d="M24 24v13a4 4 0 0 1-8 0" fill="none" stroke={c} strokeWidth={4} strokeLinecap="round" />
    </g>
  ),
  watermelon: ({ c }: P) => (
    <g>
      <path d="M4 17h40a20 20 0 0 1-40 0z" fill={c} />
      {[
        [15, 23],
        [24, 27],
        [33, 23],
        [20, 32],
        [28, 32],
      ].map(([x, y]) => (
        <ellipse key={x + '-' + y} cx={x} cy={y} rx="1.6" ry="2.4" fill="#fff" opacity=".85" />
      ))}
    </g>
  ),
  bunting: ({ c }: P) => (
    <g>
      <path d="M3 10q21 12 42 0" fill="none" stroke={c} strokeWidth={3} strokeLinecap="round" />
      <path d="M7 12.5l5 15 5-12z" fill={c} />
      <path d="M19 16.5l5 16 5-16z" fill={c} opacity=".8" />
      <path d="M31 15.5l5 12 5-15z" fill={c} />
    </g>
  ),
  heartbreak: ({ c }: P) => (
    <g>
      <path d="M24 42S5 30.5 5 17.5C5 11 10 6.5 15.5 6.5c4 0 6.8 2.2 8.5 5 1.7-2.8 4.5-5 8.5-5C38 6.5 43 11 43 17.5 43 30.5 24 42 24 42z" fill={c} />
      <path d="M24 12l-4.5 8.5 6.5 5-5 10" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  valentine: ({ c }: P) => (
    <g>
      <path d="M24 42S5 30.5 5 17.5C5 11 10 6.5 15.5 6.5c4 0 6.8 2.2 8.5 5 1.7-2.8 4.5-5 8.5-5C38 6.5 43 11 43 17.5 43 30.5 24 42 24 42z" fill={c} />
      <path d="M24 11v30M6 20h36" stroke="#fff" strokeWidth={3.2} opacity=".85" />
      <circle cx="24" cy="20" r="4" fill="#fff" />
    </g>
  ),
  mountain: ({ c }: P) => (
    <g>
      <path d="M3 40L18 13l8 12 5-7 14 22z" fill={c} stroke={c} strokeWidth={2} strokeLinejoin="round" />
      <path d="M18 13l-5 9 3.2-1.4 1.8 2.6 2.6-2.6 2.4 1.2z" fill="#fff" />
      <path d="M31 18l-3 4.6 2-.6 1.4 1.6 1.6-1.4 1.6.6z" fill="#fff" opacity=".85" />
    </g>
  ),
  basket: ({ c }: P) => (
    <g>
      <path d="M14 22a10 10 0 0 1 20 0" fill="none" stroke={c} strokeWidth={4} strokeLinecap="round" />
      <path d="M6 21h36l-4.5 19.5H10.5z" fill={c} stroke={c} strokeWidth={2} strokeLinejoin="round" />
      <path d="M8.5 28h31M10 34h28M17 22l1.6 18M24 22v18M31 22l-1.6 18" stroke="#fff" strokeWidth={1.8} opacity=".55" />
    </g>
  ),
  wave: ({ c }: P) => (
    <g>
      <path d="M3 28c5 0 6-9 13-9 6 0 6.5 7 11 7 3 0 4.5-3 3-6 6 1 8 6 8 6 2.5 2 4 2 7 2v12H3z" fill={c} />
      <path d="M3 35c4 0 5-3 8-3s4 3 8 3 5-3 8-3 4 3 8 3 5-3 8-3" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" opacity=".75" />
    </g>
  ),
  flame: ({ c }: P) => (
    <g>
      <path d="M24 4c4 8 14 12 14 24a14 14 0 0 1-28 0c0-6 3-9.5 5.5-12.5 1 4 3 6.2 5 6.5-2-8 .8-13 3.5-18z" fill={c} />
      <path d="M24 26c2 3 6 5 6 9.5a6 6 0 0 1-12 0c0-3 2-4.5 3-6 .6 1.6 1.4 2.2 2.4 2.4-.4-2.4.2-4.4.6-5.9z" fill="#fff" opacity=".85" />
    </g>
  ),
  suitcase: ({ c }: P) => (
    <g>
      <path d="M18 14v-4a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v4" fill="none" stroke={c} strokeWidth={3.6} />
      <rect x="5" y="14" width="38" height="27" rx="5.5" fill={c} />
      <rect x="13" y="14" width="3" height="27" fill="#fff" opacity=".7" />
      <rect x="32" y="14" width="3" height="27" fill="#fff" opacity=".7" />
    </g>
  ),
  masks: ({ c }: P) => (
    <g>
      <g transform="rotate(14 32 22)" opacity=".75">
        <path d="M22 8h20v13c0 8-4.5 13-10 13s-10-5-10-13z" fill={c} />
        <circle cx="27.5" cy="16" r="2.2" fill="#fff" />
        <circle cx="36.5" cy="16" r="2.2" fill="#fff" />
        <path d="M27 27c2.5-3 7.5-3 10 0" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
      </g>
      <path d="M5 13h20v13c0 8-4.5 13-10 13S5 34 5 26z" fill={c} stroke="#fff" strokeWidth={2} />
      <circle cx="10.5" cy="21" r="2.2" fill="#fff" />
      <circle cx="19.5" cy="21" r="2.2" fill="#fff" />
      <path d="M10 28c2.5 3 7.5 3 10 0" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
    </g>
  ),
  torii: ({ c }: P) => (
    <g fill={c}>
      <path d="M3 9c9 2.5 33 2.5 42 0v6.5c-9 2-33 2-42 0z" />
      <rect x="8" y="20" width="32" height="4.2" rx="1" />
      <rect x="11.5" y="14" width="5" height="29" rx="1.2" />
      <rect x="31.5" y="14" width="5" height="29" rx="1.2" />
      <rect x="22" y="15" width="4" height="6" />
    </g>
  ),
  gradcap: ({ c }: P) => (
    <g>
      <path d="M12 23v9c0 4 5.5 7 12 7s12-3 12-7v-9l-12 5.5z" fill={c} opacity=".85" />
      <path d="M24 8l22 10-22 10L2 18z" fill={c} stroke={c} strokeWidth={2} strokeLinejoin="round" />
      <path d="M40 20.5v11" stroke={c} strokeWidth={2.6} strokeLinecap="round" />
      <circle cx="40" cy="33" r="2.6" fill={c} />
    </g>
  ),
  clock: ({ c }: P) => (
    <g>
      <circle cx="24" cy="24" r="17.5" fill="none" stroke={c} strokeWidth={5} />
      <path d="M24 14v10.5l6.5 4.5" stroke={c} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </g>
  ),
}

export type IconName = keyof typeof SHAPES
export const SCATTER_ICONS: IconName[] = [
  'star', 'heart', 'sparkle', 'sakura', 'bolt', 'note', 'sun', 'cloud', 'smile',
  'onigiri', 'plane', 'bow', 'squiggle', 'ring', 'clover', 'pencil', 'envelope', 'moon', 'bubble', 'arrow',
]

export function Icon({
  name,
  color = C.ink,
  size = 32,
  className,
  style,
}: {
  name: IconName
  color?: string
  size?: number | string
  className?: string
  style?: CSSProperties
}) {
  const S = SHAPES[name]
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      style={{ overflow: 'visible', ...style }}
      aria-hidden="true"
    >
      <S c={color} />
    </svg>
  )
}
