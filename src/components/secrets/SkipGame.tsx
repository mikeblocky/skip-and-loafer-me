import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { C, CHARACTERS } from '../../data'
import { Icon, type IconName } from '../../icons'
import { sfx } from '../../sfx'
import { secrets } from '../../secrets'
import { music } from '../../music'

/** Things on the road: the site's own stickers. */
const GROUND: { name: IconName; color: string }[] = [
  { name: 'onigiri', color: C.ink },
  { name: 'umbrella', color: C.blue },
  { name: 'watermelon', color: C.green },
  { name: 'basket', color: C.orange },
  { name: 'suitcase', color: C.violet },
]
/** Paper doodles drifting in the background. */
const DOODLES: IconName[] = ['cloud', 'star', 'note', 'heart', 'sakura', 'moon', 'sun', 'clover']

// The game is laid out in a fixed 300-unit-tall world, then scaled to fit the field, so every
// size and distance stays in proportion however big the screen is.
const WORLD_H = 300
const MIN_WORLD_W = 420 // never show less road ahead than this
const FLOOR = 46 // the ink line, units from the bottom
const PLAYER_H = 96
const FRIEND_H = 86
const FRIEND_GAP = 30
const PX = 210 // Mitsumi's left edge: room behind her for the whole gang
const GRAVITY = 1900
// A single hop peaks ~88 units with plenty of hang time: clears the clutter (36–52 tall) while
// Mitsumi's head (top ~164) stays under the paper planes (lowest ~184). Skipping mid-air lifts
// her to ~168, into their lane.
const JUMP = 580
const SKIP = 550
/** a tap this soon before landing still hops, the moment she touches down */
const BUFFER = 0.14
const START_SPEED = 270
const LIVES = 3
const POOL = 18

/**
 * Power-ups, each one of the site's stickers. Every pickup floats low enough to grab by running
 * through it or with a single hop (bottoms 15–95 units up; a hop reaches ~168).
 */
const POWERS = {
  clover: { color: C.green, label: 'lucky shield!', secs: 8 },
  note: { color: C.violet, label: 'double points!', secs: 8 },
  sun: { color: C.amber, label: 'star magnet!', secs: 7 },
  bolt: { color: C.orange, label: 'triple skip!', secs: 8 },
  sparkle: { color: C.pink, label: 'star shower!', secs: 0 },
} as const
type Power = keyof typeof POWERS
const TIMED = ['clover', 'note', 'sun', 'bolt'] as const
type Timed = (typeof TIMED)[number]
const isPower = (k: string): k is Power => k in POWERS

const FRIENDS = CHARACTERS.filter((c) => c.id !== 'mitsumi')
/** score at which each friend catches up; when the last one joins, you've won */
const JOIN_AT = [30, 80, 150, 240, 350, 480]
/** the paper warms a little with each friend, then glows once everyone's there */
const TINTS = ['#ffffff', '#fffcf2', '#fff8e8', '#fff3ee', '#fdf0f6', '#f5f1ff', '#eef5ff']
const WON_TINT = '#fff6d8'

const NAME_KEY = 'sl-skip-name'
const API = '/api/leaderboard'

type Kind = 'ground' | 'plane' | 'star' | 'heart' | Power
interface Thing {
  on: boolean
  kind: Kind
  x: number
  y: number // bottom, units above the floor
  size: number
  look: number
  phase: number
}
interface Entry {
  name: string
  score: number
  won: boolean
}

function useLeaderboard() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'offline'>('loading')
  useEffect(() => {
    let alive = true
    fetch(API)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { entries: Entry[] }) => alive && (setEntries(d.entries), setState('ok')))
      .catch(() => alive && setState('offline'))
    return () => {
      alive = false
    }
  }, [])
  return { entries, setEntries, state, setState }
}

/**
 * Skip to School. Tap (or Space) to hop, again mid-air to skip. Road clutter has to be hopped,
 * paper planes cruise at skip height so a careless double-hop runs into them, stars are points
 * and hearts heal. A friend catches up at each milestone and copies your hops a beat later;
 * when all six are running with you, you've won, and you can keep going for the leaderboard.
 */
export function SkipGame() {
  const field = useRef<HTMLDivElement>(null)
  const world = useRef<HTMLDivElement>(null)
  const player = useRef<HTMLDivElement>(null)
  const ground = useRef<HTMLDivElement>(null)
  const thingEls = useRef<HTMLDivElement[]>([])
  const friendEls = useRef<HTMLDivElement[]>([])
  const doodleEls = useRef<HTMLDivElement[]>([])
  const scoreEl = useRef<HTMLElement>(null)
  const [phase, setPhase] = useState<'ready' | 'run' | 'over'>('ready')
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(secrets.get().skipBest)
  const [lives, setLives] = useState(LIVES)
  const [team, setTeam] = useState<typeof FRIENDS>([])
  const [won, setWon] = useState(false)
  const [shout, setShout] = useState<string | null>(null)
  const [looks, setLooks] = useState<{ kind: Kind; look: number }[]>(() => Array.from({ length: POOL }, () => ({ kind: 'ground', look: 0 })))
  const [view, setView] = useState({ scale: 1, w: 600 })
  /** seconds left on each timed power-up, refreshed when a whole second ticks over */
  const [powers, setPowers] = useState<Record<Timed, number>>({ clover: 0, note: 0, sun: 0, bolt: 0 })

  const board = useLeaderboard()
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(NAME_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [save, setSave] = useState<{ state: 'idle' | 'saving' | 'saved' | 'error'; rank?: number | null; msg?: string }>({ state: 'idle' })

  const g = useRef({
    y: 0,
    vy: 0,
    hops: 0,
    speed: START_SPEED,
    dist: 0,
    score: 0,
    lives: LIVES,
    hurt: 0,
    next: 1,
    friends: 0,
    won: false,
    overAt: 0,
    pw: { clover: 0, note: 0, sun: 0, bolt: 0 } as Record<Timed, number>,
    buffer: 0,
    fy: [0, 0, 0, 0, 0, 0],
    fvy: [0, 0, 0, 0, 0, 0],
    pwShown: '',
    order: [] as typeof FRIENDS,
    things: [] as Thing[],
    doodles: [] as { x: number; y: number; s: number }[],
    last: 0,
    raf: 0,
  })

  // fit the 300-unit world to the field: as tall as the screen comfortably allows, while always
  // showing at least MIN_WORLD_W units of road ahead
  useLayoutEffect(() => {
    const el = field.current
    if (!el) return
    const fit = () => {
      const w = el.clientWidth
      const want = Math.min(window.innerHeight * 0.62, 620) / WORLD_H
      const scale = Math.max(0.6, Math.min(want, w / MIN_WORLD_W))
      setView({ scale, w: w / scale })
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const worldW = useRef(600)
  worldW.current = view.w

  const reset = () => {
    const s = g.current
    Object.assign(s, { y: 0, vy: 0, hops: 0, speed: START_SPEED, dist: 0, score: 0, lives: LIVES, hurt: 0, next: 1.2, friends: 0, won: false, pwShown: '', buffer: 0 })
    s.fy = [0, 0, 0, 0, 0, 0]
    s.fvy = [0, 0, 0, 0, 0, 0]
    s.pw = { clover: 0, note: 0, sun: 0, bolt: 0 }
    setPowers({ ...s.pw })
    s.order = [...FRIENDS].sort(() => Math.random() - 0.5)
    s.things = Array.from({ length: POOL }, () => ({ on: false, kind: 'ground' as Kind, x: 0, y: 0, size: 40, look: 0, phase: 0 }))
    s.doodles = DOODLES.map((_, i) => ({ x: 60 + i * 120, y: 30 + ((i * 53) % 130), s: 0.2 + (i % 3) * 0.12 }))
    thingEls.current.forEach((el) => el && (el.style.opacity = '0'))
    setLives(LIVES)
    setTeam([])
    setWon(false)
    setSave({ state: 'idle' })
  }

  const start = () => {
    reset()
    setScore(0)
    setPhase('run')
    sfx.click(1.2)
    music.start(112)
  }

  const hop = () => {
    const s = g.current
    if (phase === 'over' && performance.now() - s.overAt < 700) return // don't restart by accident
    if (phase !== 'run') return start()
    if (s.hops >= (s.pw.bolt > 0 ? 3 : 2)) {
      // out of hops but about to land: remember the tap and hop on touchdown
      if (s.vy < 0 && s.y < 30) s.buffer = BUFFER
      return
    }
    s.buffer = 0
    s.vy = s.hops === 0 ? JUMP : s.hops === 1 ? SKIP : SKIP * 0.85
    s.hops++
    if (s.hops === 1) sfx.pop(1.25)
    else sfx.boing()
    const el = player.current
    el?.classList.remove('is-hop')
    void el?.offsetWidth
    el?.classList.add('is-hop')
  }

  const end = (final: number) => {
    music.stop(true)
    g.current.overAt = performance.now()
    setPhase('over')
    setScore(final)
    if (final > secrets.get().skipBest) {
      secrets.update((st) => ({ ...st, skipBest: final }))
      setBest(final)
      window.setTimeout(() => sfx.chime(1.2, 0.8), 300)
    }
  }

  const say = (text: string, ms = 1700) => {
    setShout(text)
    window.setTimeout(() => setShout((t) => (t === text ? null : t)), ms)
  }

  const submit = async () => {
    const n = name.trim()
    if (!n || save.state === 'saving') return
    try {
      localStorage.setItem(NAME_KEY, n)
    } catch {
      /* private mode */
    }
    setSave({ state: 'saving' })
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n, score, won: g.current.won }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'could not save')
      board.setEntries(d.entries)
      board.setState('ok')
      setSave({ state: 'saved', rank: d.rank })
      sfx.chime(1.1, 0.7)
    } catch (e) {
      setSave({ state: 'error', msg: e instanceof Error ? e.message : 'could not save' })
    }
  }

  useEffect(() => {
    if (phase !== 'run') return
    const s = g.current
    s.last = performance.now()

    const spawn = (kind: Kind, x: number, yAt?: number) => {
      const i = s.things.findIndex((t) => !t.on)
      if (i < 0) return
      const look = kind === 'ground' ? Math.floor(Math.random() * GROUND.length) : 0
      const size = kind === 'ground' ? 36 + Math.random() * 16 : kind === 'plane' ? 44 : kind === 'star' ? 30 : 34
      // pickups stay within reach: low ones you run through, the rest a single hop
      const y =
        kind === 'ground' ? 0 : kind === 'plane' ? 186 + Math.random() * 16 : kind === 'star' ? 15 + Math.random() * 80 : 30 + Math.random() * 55
      s.things[i] = { on: true, kind, x, y: yAt ?? y, size, look, phase: Math.random() * 6 }
      setLooks((L) => (L[i].kind === kind && L[i].look === look ? L : L.map((v, j) => (j === i ? { kind, look } : v))))
    }

    const frame = (now: number) => {
      const dt = Math.min(0.033, (now - s.last) / 1000)
      s.last = now
      const w = worldW.current
      s.speed += 13 * dt
      s.dist += s.speed * dt
      // the band speeds up with the road: ~112 bpm at the start, up to ~172 when it's frantic
      music.setPace(112 + (s.speed - START_SPEED) * 0.11)
      const mult = s.pw.note > 0 ? 2 : 1
      s.score += ((s.speed * dt) / 40) * (1 + 0.2 * s.friends) * mult

      // power-up timers; the HUD only re-renders when a whole second ticks over
      TIMED.forEach((k) => (s.pw[k] = Math.max(0, s.pw[k] - dt)))
      const shown = TIMED.map((k) => Math.ceil(s.pw[k])).join()
      if (shown !== s.pwShown) {
        s.pwShown = shown
        setPowers({ ...s.pw })
      }
      if (player.current) player.current.classList.toggle('is-shield', s.pw.clover > 0)

      // Mitsumi
      s.vy -= GRAVITY * dt
      s.y = Math.max(0, s.y + s.vy * dt)
      if (s.y === 0) {
        s.vy = 0
        s.hops = 0
        if (s.buffer > 0) {
          s.buffer = 0
          hop()
        }
      }
      s.buffer = Math.max(0, s.buffer - dt)
      s.hurt = Math.max(0, s.hurt - dt)
      if (player.current) {
        player.current.style.transform = `translateY(${-s.y}px)`
        player.current.classList.toggle('is-blink', s.hurt > 0)
      }

      // friends hop over the clutter coming at them on their own (just for show; they can't get hurt)
      friendEls.current.forEach((el, k) => {
        if (!el) return
        const fx = PX - FRIEND_GAP * (k + 1)
        s.fvy[k] -= GRAVITY * dt
        s.fy[k] = Math.max(0, s.fy[k] + s.fvy[k] * dt)
        if (s.fy[k] === 0) {
          s.fvy[k] = 0
          const ahead = s.things.some((t) => {
            if (!t.on || t.kind !== 'ground') return false
            const gap = t.x + t.size * 0.2 - (fx + 30)
            return gap > 0 && gap < s.speed * 0.17
          })
          if (ahead) s.fvy[k] = JUMP * (0.96 + Math.random() * 0.06)
        }
        el.style.transform = `translateY(${-s.fy[k]}px)`
      })
      const joined = JOIN_AT.filter((t) => s.score >= t).length
      if (joined > s.friends && s.friends < s.order.length) {
        s.friends = joined
        const who = s.order.slice(0, joined)
        setTeam(who)
        if (joined === JOIN_AT.length && !s.won) {
          s.won = true
          setWon(true)
          say('everyone made it to school! keep skipping…', 3200)
          sfx.jingle(0.8)
        } else {
          say(`${who[joined - 1].name.toLowerCase()} joined! (${joined}/${JOIN_AT.length})`)
          sfx.chime(1 + joined * 0.08, 0.7)
        }
      }

      // doodles drift slowly behind everything
      doodleEls.current.forEach((el, i) => {
        const d = s.doodles[i]
        if (!el || !d) return
        d.x -= s.speed * d.s * dt
        if (d.x < -60) d.x = w + 40 + Math.random() * 80
        el.style.transform = `translate(${d.x}px, ${d.y}px)`
      })
      if (ground.current) ground.current.style.backgroundPositionX = `${-s.dist % 120}px`

      // spawning gets denser and meaner with speed
      s.next -= dt
      if (s.next <= 0) {
        const lvl = Math.min(1, (s.speed - START_SPEED) / 520)
        const r = Math.random()
        if (s.score > 60 && r < 0.14 + lvl * 0.14) spawn('plane', w + 40)
        else if (s.score > 15 && r < 0.26 + lvl * 0.12) {
          // a power-up, never one that is already running
          const choices = (Object.keys(POWERS) as Power[]).filter((k) => k === 'sparkle' || s.pw[k as Timed] <= 0)
          spawn(choices[Math.floor(Math.random() * choices.length)], w + 20)
        } else if (r < 0.4 + lvl * 0.1) spawn('star', w + 20)
        else if (s.lives < LIVES && r < 0.44 + lvl * 0.1) spawn('heart', w + 20)
        else {
          spawn('ground', w + 20)
          // a pair close together: one long hop, or a hop and a skip
          if (lvl > 0.3 && Math.random() < 0.2 + lvl * 0.3) spawn('ground', w + 20 + 52 + Math.random() * 30)
        }
        s.next = (0.65 + Math.random() * 0.8) * (340 / s.speed) + 0.36
      }

      // move, draw and check every thing
      const pl = PX + 14
      const pr = PX + 34
      const pb = s.y + 4
      const pt = s.y + PLAYER_H * 0.78
      s.things.forEach((t, i) => {
        if (!t.on) return
        t.x -= s.speed * (t.kind === 'plane' ? 1.3 : 1) * dt
        t.phase += dt * 4
        // star magnet: stars within reach drift into Mitsumi's arms
        if (t.kind === 'star' && s.pw.sun > 0 && t.x < PX + 300 && t.x > PX - 40) {
          t.x += (PX + 14 - t.x) * Math.min(1, dt * 6)
          t.y += (s.y + 30 - t.y) * Math.min(1, dt * 6)
        }
        const wobble = t.kind === 'plane' ? Math.sin(t.phase) * 8 : t.kind !== 'ground' ? Math.sin(t.phase) * 5 : 0
        const el = thingEls.current[i]
        if (t.x < -80) {
          t.on = false
          if (el) el.style.opacity = '0'
          return
        }
        const by = t.y + wobble
        if (el) {
          el.style.opacity = '1'
          el.style.width = el.style.height = `${t.size}px`
          const spin = t.kind === 'ground' ? -t.x * 0.5 : t.kind === 'plane' ? -8 : 0
          el.style.transform = `translate(${t.x}px, ${-by}px) rotate(${spin}deg)`
        }
        const hazard = t.kind === 'ground' || t.kind === 'plane'
        const l = t.x + t.size * (hazard ? 0.25 : 0.02)
        const r = t.x + t.size * (hazard ? 0.75 : 0.98)
        const b = by + t.size * (hazard ? 0.15 : 0)
        const top = by + t.size * (hazard ? 0.72 : 1)
        if (l > pr || r < pl || b > pt || top < pb) return
        if (t.kind === 'star') {
          t.on = false
          if (el) el.style.opacity = '0'
          s.score += 15 * mult
          sfx.blip(1.5)
        } else if (isPower(t.kind)) {
          t.on = false
          if (el) el.style.opacity = '0'
          const k = t.kind
          if (k === 'sparkle') {
            // an arc of stars right ahead, all within a hop
            for (let j = 0; j < 6; j++) spawn('star', w + 20 + j * 38, 20 + Math.sin((j / 5) * Math.PI) * 70)
          } else s.pw[k] = POWERS[k].secs
          say(POWERS[k].label)
          sfx.chime(1.4, 0.7)
        } else if (t.kind === 'heart') {
          t.on = false
          if (el) el.style.opacity = '0'
          s.lives = Math.min(LIVES, s.lives + 1)
          setLives(s.lives)
          music.setDanger(s.lives === 1)
          sfx.chime(1.3, 0.6)
        } else if (s.hurt <= 0 && s.pw.clover > 0) {
          // the lucky clover takes the hit instead
          s.pw.clover = 0
          s.hurt = 0.7
          sfx.boing()
          say('phew, the clover saved you!')
        } else if (s.hurt <= 0) {
          s.lives--
          s.hurt = 1.6
          setLives(s.lives)
          music.setDanger(s.lives === 1)
          sfx.thud()
          const f = field.current
          f?.classList.remove('is-hit')
          void f?.offsetWidth
          f?.classList.add('is-hit')
        }
      })

      const pts = Math.floor(s.score)
      if (scoreEl.current) scoreEl.current.textContent = String(pts)
      if (s.lives <= 0) {
        end(pts)
        return
      }
      s.raf = requestAnimationFrame(frame)
    }
    s.raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(g.current.raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // closing the game mid-run stops the band
  useEffect(() => () => music.stop(), [])

  // Space / ↑ to hop while the game is open (but not while typing a name)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'ArrowUp') return
      if ((e.target as Element | null)?.closest?.('button, input, textarea')) return
      e.preventDefault()
      hop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const tint = won ? WON_TINT : TINTS[Math.min(team.length, TINTS.length - 1)]

  return (
    <div className="skipgame">
      <div className="sg-hud">
        <span className="sg-lives" aria-label={`${lives} hearts left`}>
          {Array.from({ length: LIVES }, (_, i) => (
            <Icon key={i} name="heart" color={i < lives ? C.red : '#e3ddd2'} size={22} />
          ))}
        </span>
        <span className="sg-gang" aria-label={`${team.length} of ${JOIN_AT.length} friends`}>
          {FRIENDS.map((f, i) => (
            <i key={f.id} className={i < team.length ? 'is-in' : ''} style={{ '--c': (team[i] ?? f).color } as CSSProperties} />
          ))}
          {won && <b className="sg-made">made it!</b>}
        </span>
        <span className="sg-powers" aria-live="polite">
          {TIMED.filter((k) => powers[k] > 0).map((k) => (
            <span key={k} className="sg-power" style={{ '--c': POWERS[k].color } as CSSProperties} title={POWERS[k].label}>
              <Icon name={k} color={POWERS[k].color} size={16} />
              {Math.ceil(powers[k])}s
            </span>
          ))}
        </span>
        <span>
          score <b ref={scoreEl}>{score}</b>
        </span>
        <span>
          best <b>{best}</b>
        </span>
      </div>

      <div
        className={`sg-field is-${phase}${won ? ' is-won' : ''}`}
        ref={field}
        onPointerDown={(e) => {
          e.preventDefault()
          hop()
        }}
        style={{ height: WORLD_H * view.scale, '--tint': tint } as CSSProperties}
      >
        <div
          className="sg-world"
          ref={world}
          style={{ width: view.w, height: WORLD_H, transform: `scale(${view.scale})`, '--floor': `${FLOOR}px` } as CSSProperties}
        >
          <div className="sg-doodles" aria-hidden="true">
            {DOODLES.map((n, i) => (
              <div
                key={n}
                className="sg-doodle"
                ref={(el) => {
                  if (el) doodleEls.current[i] = el
                }}
              >
                <Icon name={n} color={C.ink} size={i % 2 ? 30 : 44} />
              </div>
            ))}
          </div>
          <div className="sg-floor" ref={ground} aria-hidden="true" />

          {team.map((f, k) => (
            <div
              key={f.id}
              className="sg-friend"
              ref={(el) => {
                if (el) friendEls.current[k] = el
              }}
              style={{ left: PX - FRIEND_GAP * (k + 1), height: FRIEND_H, zIndex: 3 - k } as CSSProperties}
            >
              <img src={f.src} alt={f.name} draggable={false} />
            </div>
          ))}
          <div className="sg-player" ref={player} style={{ left: PX, height: PLAYER_H }}>
            <img src="/characters/mitsumi.png" alt="Mitsumi" draggable={false} />
          </div>

          {Array.from({ length: POOL }, (_, i) => {
            const L = looks[i]
            const icon =
              L.kind === 'ground'
                ? GROUND[L.look]
                : L.kind === 'plane'
                  ? { name: 'plane' as IconName, color: C.sky }
                  : L.kind === 'star'
                    ? { name: 'star' as IconName, color: C.yellow }
                    : isPower(L.kind)
                      ? { name: L.kind as IconName, color: POWERS[L.kind].color }
                      : { name: 'heart' as IconName, color: C.red }
            return (
              <div
                key={i}
                className={`sg-thing is-${L.kind}${isPower(L.kind) ? ' is-power' : ''}`}
                ref={(el) => {
                  if (el) thingEls.current[i] = el
                }}
              >
                <Icon name={icon.name} color={icon.color} size="100%" />
              </div>
            )
          })}
        </div>

        {shout && phase === 'run' && <div className="sg-shout">{shout}</div>}

        {phase !== 'run' && (
          <div className="sg-overlay">
            {phase === 'over' ? (
              <>
                <b>{won ? 'everyone made it!' : 'late for class!'}</b>
                <span>
                  {score} points{team.length ? ` · ran with ${team.map((f) => f.name).join(', ')}` : ''}
                  {score >= best && score > 0 ? ' · new best!' : ''}
                </span>
                {score > 0 && board.state !== 'offline' && (
                  <form
                    className="sg-save"
                    onPointerDown={(e) => e.stopPropagation()}
                    onSubmit={(e) => {
                      e.preventDefault()
                      submit()
                    }}
                  >
                    {save.state === 'saved' ? (
                      <span className="sg-saved">saved{save.rank ? ` · you're #${save.rank}` : ''}</span>
                    ) : (
                      <>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          maxLength={16}
                          placeholder="your name"
                          aria-label="Your name for the leaderboard"
                          autoComplete="nickname"
                          enterKeyHint="done"
                        />
                        <button className="sx-btn is-strong" disabled={!name.trim() || save.state === 'saving'}>
                          {save.state === 'saving' ? 'saving…' : 'save score'}
                        </button>
                      </>
                    )}
                    {save.state === 'error' && <span className="sg-err">{save.msg}</span>}
                  </form>
                )}
                <span className="sg-how">tap the road to try again</span>
              </>
            ) : (
              <>
                <b>skip to school!</b>
                <span className="sg-how">tap or press space to hop · again mid-air to skip</span>
                <span className="sg-how">hop the clutter, mind the paper planes, grab stars, hearts and power-ups</span>
                <span className="sg-how">pick up all six friends on the way to win</span>
              </>
            )}
          </div>
        )}
      </div>

      <section className="sg-board" aria-label="Leaderboard">
        <h3>leaderboard</h3>
        {board.state === 'loading' && <p className="sx-note">loading…</p>}
        {board.state === 'offline' && <p className="sx-note">the leaderboard is offline right now. your best still saves on this device.</p>}
        {board.state === 'ok' && board.entries.length === 0 && <p className="sx-note">no scores yet. be the first!</p>}
        {board.state === 'ok' && board.entries.length > 0 && (
          <ol>
            {board.entries.map((e, i) => (
              <li key={e.name + i} className={e.name.toLowerCase() === name.trim().toLowerCase() ? 'is-you' : ''}>
                <span className="sg-rank">{i + 1}</span>
                <span className="sg-name">{e.name}</span>
                {e.won && <Icon name="star" color={C.yellow} size={14} />}
                <b>{e.score}</b>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
