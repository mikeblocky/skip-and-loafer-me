import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CHARACTERS, C } from '../../data'
import { sfx } from '../../sfx'
import { secrets } from '../../secrets'

const RARITY = [
  { name: 'N', weight: 60, color: '#A9A3C9' },
  { name: 'R', weight: 28, color: C.blue },
  { name: 'SR', weight: 10, color: C.violet },
  { name: 'SSR', weight: 2, color: C.amber },
] as const

/** Our own little titles for each card (not quotes from the series). */
const TITLES: Record<string, string> = {
  mitsumi: 'countryside valedictorian',
  makoto: 'bookworm with a big heart',
  mika: 'honest to a fault',
  ujie: 'student council ace',
  shima: 'effortlessly charming',
  yuzuki: 'straight-talking beauty',
  yasaka: 'easygoing friend',
}

/**
 * How often each character turns up. Mitsumi and Shima are the rare ones (about 2.5% each per
 * pull), and when they do appear they're never below SR.
 */
const CHAR_WEIGHT: Record<string, number> = { mitsumi: 1, shima: 1 }
const RARE_FLOOR: Record<string, number> = { mitsumi: 2, shima: 2 }
const weightOf = (id: string) => CHAR_WEIGHT[id] ?? 8

function pickChar() {
  let n = Math.random() * CHARACTERS.reduce((a, c) => a + weightOf(c.id), 0)
  for (const c of CHARACTERS) {
    n -= weightOf(c.id)
    if (n <= 0) return c
  }
  return CHARACTERS[CHARACTERS.length - 1]
}

interface Pull {
  char: (typeof CHARACTERS)[number]
  r: number
}

function rollOne(atLeast = 0): Pull {
  const char = pickChar()
  const floor = Math.max(atLeast, RARE_FLOOR[char.id] ?? 0)
  const pool: number[] = RARITY.map((x, i) => (i < floor ? 0 : x.weight))
  let n = Math.random() * pool.reduce((a, b) => a + b, 0)
  let r = 0
  while (n > pool[r]) n -= pool[r++]
  return { char, r }
}

const Stars = ({ r }: { r: number }) => <span className="gc-stars">{'★'.repeat(r + 1)}</span>

function Card({ p, delay = 0, big = false }: { p: Pull; delay?: number; big?: boolean }) {
  return (
    <div
      className={`gc-card r${p.r}${big ? ' is-big' : ''}`}
      style={{ '--c': p.char.color, '--rc': RARITY[p.r].color, '--d': `${delay}s` } as CSSProperties}
    >
      <div className="gc-art">
        <img src={p.char.src} alt="" draggable={false} />
      </div>
      <div className="gc-meta">
        <span className="gc-rar">{RARITY[p.r].name}</span>
        <b>{p.char.name}</b>
        {big && <small>{TITLES[p.char.id]}</small>}
        <Stars r={p.r} />
      </div>
    </div>
  )
}

export function Gacha() {
  const [phase, setPhase] = useState<'idle' | 'rolling' | 'reveal'>('idle')
  const [results, setResults] = useState<Pull[]>([])
  const [s, setS] = useState(secrets.get())
  const timers = useRef<number[]>([])
  useEffect(() => secrets.subscribe(() => setS({ ...secrets.get() })), [])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const roll = (n: 1 | 10) => {
    if (phase === 'rolling') return
    // a ten-pull always holds at least one SR or better
    const pulls = Array.from({ length: n }, () => rollOne())
    if (n === 10 && !pulls.some((p) => p.r >= 2)) pulls[Math.floor(Math.random() * 10)] = rollOne(2)
    setResults(pulls)
    setPhase('rolling')
    sfx.whoosh(0.6, true, 0.12)
    // the capsule rattles in the machine before it drops
    for (let i = 0; i < 6; i++) timers.current.push(window.setTimeout(() => sfx.clack(0.9 + i * 0.05), 120 + i * 170))
    timers.current.push(
      window.setTimeout(() => {
        setPhase('reveal')
        const top = Math.max(...pulls.map((p) => p.r))
        if (top === 3) sfx.jingle(0.8)
        else sfx.chime(1 + top * 0.12, 0.8)
        secrets.update((st) => {
          const dex = { ...st.dex }
          pulls.forEach((p) => {
            const was = dex[p.char.id]
            dex[p.char.id] = { best: Math.max(was?.best ?? -1, p.r), count: (was?.count ?? 0) + 1 }
          })
          return { ...st, dex, pulls: st.pulls + n }
        })
      }, 1250),
    )
  }

  const best = results.length ? Math.max(...results.map((r) => r.r)) : 0

  return (
    <div className="gacha">
      <div className={`gc-stage is-${phase}`}>
        {phase !== 'reveal' && (
          <div className="gc-machine" aria-hidden="true">
            <div className="gc-capsule" style={{ '--rc': phase === 'rolling' ? RARITY[best].color : C.pink } as CSSProperties}>
              <span className="gc-top" />
              <span className="gc-bottom" />
            </div>
            <p className="gc-say">{phase === 'rolling' ? 'rattle, rattle…' : 'who will you meet today?'}</p>
          </div>
        )}
        {phase === 'reveal' &&
          (results.length === 1 ? (
            <Card p={results[0]} big />
          ) : (
            <div className="gc-grid">
              {results.map((p, i) => (
                <Card key={i} p={p} delay={i * 0.07} />
              ))}
            </div>
          ))}
      </div>

      <div className="gc-actions">
        <button className="sx-btn" onClick={() => roll(1)} disabled={phase === 'rolling'}>
          pull ×1
        </button>
        <button className="sx-btn is-strong" onClick={() => roll(10)} disabled={phase === 'rolling'}>
          pull ×10
        </button>
      </div>

      <div className="gc-dex" aria-label="Your collection">
        {CHARACTERS.map((c) => {
          const got = s.dex[c.id]
          return (
            <div key={c.id} className={`gc-dex-item${got ? ' is-got' : ''}`} style={{ '--c': c.color } as CSSProperties} title={got ? `${c.name} · best ${RARITY[got.best].name} · ×${got.count}` : CHAR_WEIGHT[c.id] ? 'rare…' : '???'}>
              <img src={c.src} alt={got ? c.name : 'not met yet'} draggable={false} />
              {got && <span className="gc-dex-r" style={{ background: RARITY[got.best].color }}>{RARITY[got.best].name}</span>}
            </div>
          )
        })}
      </div>
      <p className="sx-note">
        {Object.keys(s.dex).length}/{CHARACTERS.length} met · {s.pulls} pulls · saved on this device
      </p>
    </div>
  )
}
