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
const START_SPEED = 300
const MAX_SPEED = 1100
const LIVES = 3
const POOL = 24

/**
 * Power-ups, each one of the site's stickers. Every pickup floats low enough to grab by running
 * through it or with a single hop (bottoms 15–95 units up; a hop reaches ~168).
 */
const POWERS: Record<string, { icon: IconName; color: string; label: string; secs: number }> = {
  clover: { icon: 'clover', color: C.green, label: 'lucky shield!', secs: 8 },
  note: { icon: 'note', color: C.violet, label: 'double points!', secs: 8 },
  sun: { icon: 'sun', color: C.amber, label: 'star magnet!', secs: 7 },
  bolt: { icon: 'bolt', color: C.orange, label: 'triple skip!', secs: 8 },
  sparkle: { icon: 'sparkle', color: C.pink, label: 'star shower!', secs: 0 },
  // a temporary 4th heart: soaks up the next hit, or fades when its time runs out
  goldheart: { icon: 'heart', color: '#FFB300', label: 'golden heart: +1 for a while!', secs: 12 },
}
type Power = 'clover' | 'note' | 'sun' | 'bolt' | 'sparkle' | 'goldheart'
const TIMED = ['clover', 'note', 'sun', 'bolt', 'goldheart'] as const
type Timed = (typeof TIMED)[number]
const isPower = (k: string): k is Power => k in POWERS

const FRIENDS = CHARACTERS.filter((c) => c.id !== 'mitsumi')
/** score at which each friend catches up; when the last one joins, you've won */
// a new friend roughly every 8–10 seconds of clean running; all six in about a minute
const JOIN_AT = [70, 170, 300, 460, 650, 870]
/** after the win, one more level every this many points */
const LEVEL_AFTER_WIN = 900
/** every so often, a breather: no hazards for a few seconds */
const BREAK_EVERY = 50
const BREAK_LEN = 7
/**
 * Twists, for the very long runs. From TWIST_AT points, every so often the camera does
 * something nasty for a few seconds (announced first). From TWIST_STACK_AT, two can stack.
 * They only change how the road looks, never the controls, and never during a break.
 */
const TWIST_AT = 5000
const TWIST_STACK_AT = 8000
const TWIST_LEN = 8
const TWIST_GAP = 11
const TWISTS = {
  tilt: 'the road tilts!',
  mirror: 'mirror world!',
  zoom: 'zoomed in!',
  dark: 'lights out!',
  sway: 'sea legs!',
} as const
type Twist = keyof typeof TWISTS
/** the paper warms a little with each friend, then glows once everyone's there */
const TINTS = ['#ffffff', '#fffcf2', '#fff8e8', '#fff3ee', '#fdf0f6', '#f5f1ff', '#eef5ff']
const WON_TINT = '#fff6d8'

/**
 * Difficulty tier: one per friend who has joined, then one more every 900 points after the win.
 * Each tier unlocks a meaner pattern on the road, and makes every boost a little stronger.
 */
const tierOf = (friends: number, score: number) =>
  friends + Math.floor(Math.max(0, score - JOIN_AT[JOIN_AT.length - 1]) / LEVEL_AFTER_WIN)
/** road patterns and the tier that unlocks them */
const COMBOS = [
  { name: 'single', from: 0 },
  { name: 'pair', from: 1 }, // two close together: a long hop or hop + skip
  { name: 'under', from: 2 }, // clutter with a paper plane right above: hop, don't skip
  { name: 'triple', from: 3 }, // three in a row
  { name: 'low', from: 4 }, // a plane at head height: stay on the ground
  { name: 'drop', from: 5 }, // a sticker falls out of the sky ahead
  // ── chaos, after the win ──
  { name: 'bounce', from: 6 }, // clutter that hops along the road
  { name: 'zigzag', from: 6 }, // a plane that swoops up and down through the hop zone
  { name: 'swarm', from: 7 }, // a few planes at mixed heights
  { name: 'rain', from: 7 }, // several stickers falling at once
  { name: 'roll', from: 8 }, // clutter rolling at you faster than the road
  { name: 'chaos', from: 9 }, // two patterns at the same time
] as const
type ComboName = (typeof COMBOS)[number]['name']
/** how things move besides scrolling with the road */
type Mode = 'normal' | 'bounce' | 'zigzag' | 'roll'

const NAME_KEY = 'sl-skip-name'
const API = '/api/leaderboard'

type Kind = 'ground' | 'drop' | 'plane' | 'star' | 'heart' | Power
interface Thing {
  on: boolean
  kind: Kind
  x: number
  y: number // bottom, units above the floor
  vy: number // only falling stickers use this
  base: number // resting height for bouncing / weaving things
  mode: Mode
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
  const [view, setView] = useState({ scale: 1, w: 600, h: WORLD_H })
  /** seconds left on each timed power-up, refreshed when a whole second ticks over */
  const [powers, setPowers] = useState<Record<Timed, number>>({ clover: 0, note: 0, sun: 0, bolt: 0, goldheart: 0 })
  /** seconds of break time left (0 = playing) */
  const [rest, setRest] = useState(0)
  /** camera twists running right now, and which way the road tilts */
  const [twists, setTwists] = useState<Twist[]>([])
  const [tiltDir, setTiltDir] = useState(1)

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
    pw: { clover: 0, note: 0, sun: 0, bolt: 0, goldheart: 0 } as Record<Timed, number>,
    shieldHits: 0,
    tier: 0,
    playT: 0, // seconds since the last break
    twistT: 0, // seconds left on the current twist(s)
    twistWait: TWIST_GAP, // seconds until the next one may start
    breakT: 0, // seconds of break left
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
      const phone = window.innerWidth < 760
      if (phone) {
        // phones: fill the width, and let the field grow tall (extra sky above the road)
        // so the whole lower half of the screen is one big tap target
        const scale = w / 360
        const h = Math.max(WORLD_H * scale, Math.min(window.innerHeight * 0.6, 620))
        setView({ scale, w: w / scale, h })
        return
      }
      const want = Math.min(window.innerHeight * 0.62, 620) / WORLD_H
      const scale = Math.max(0.6, Math.min(want, w / MIN_WORLD_W))
      setView({ scale, w: w / scale, h: WORLD_H * scale })
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
    s.pw = { clover: 0, note: 0, sun: 0, bolt: 0, goldheart: 0 }
    s.shieldHits = 0
    s.tier = 0
    s.playT = 0
    s.breakT = 0
    s.twistT = 0
    s.twistWait = TWIST_GAP
    setTwists([])
    music.setRest(false)
    setRest(0)
    setPowers({ ...s.pw })
    s.order = [...FRIENDS].sort(() => Math.random() - 0.5)
    s.things = Array.from({ length: POOL }, () => ({ on: false, kind: 'ground' as Kind, x: 0, y: 0, vy: 0, base: 0, mode: 'normal' as Mode, size: 40, look: 0, phase: 0 }))
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

    const spawn = (kind: Kind, x: number, yAt?: number, mode: Mode = 'normal') => {
      const i = s.things.findIndex((t) => !t.on)
      if (i < 0) return
      const look = kind === 'ground' || kind === 'drop' ? Math.floor(Math.random() * GROUND.length) : 0
      const size = kind === 'ground' || kind === 'drop' ? 36 + Math.random() * 16 : kind === 'plane' ? 44 : kind === 'star' ? 30 : 34
      // pickups stay within reach: low ones you run through, the rest a single hop
      const y =
        kind === 'ground'
          ? 0
          : kind === 'drop'
            ? 240
            : kind === 'plane'
              ? 186 + Math.random() * 16
              : kind === 'star'
                ? 15 + Math.random() * 80
                : 30 + Math.random() * 55
      const y0 = yAt ?? y
      s.things[i] = { on: true, kind, x, y: y0, vy: 0, base: y0, mode, size, look, phase: Math.random() * 6 }
      setLooks((L) => (L[i].kind === kind && L[i].look === look ? L : L.map((v, j) => (j === i ? { kind, look } : v))))
    }

    const frame = (now: number) => {
      const dt = Math.min(0.033, (now - s.last) / 1000)
      s.last = now
      const w = worldW.current
      // break time: every BREAK_EVERY seconds, a few seconds with no hazards and no speed-up
      if (s.breakT > 0) {
        s.breakT = Math.max(0, s.breakT - dt)
        if (s.breakT === 0) {
          s.playT = 0
          music.setRest(false)
          say('here we go!', 1300)
        }
      } else {
        s.playT += dt
        const clear = !s.things.some((t) => t.on && (t.kind === 'ground' || t.kind === 'drop' || t.kind === 'plane') && t.x > PX - 60)
        if (s.playT >= BREAK_EVERY && clear) {
          s.breakT = BREAK_LEN
          music.setRest(true)
          say('break time! catch your breath', 2200)
          // a heart is always waiting on a break if you're missing one
          if (s.lives < LIVES) spawn('heart', w + 30, 40)
        }
      }
      // the road keeps speeding up: briskly at first, still noticeably even when it is already fast
      // twists: a new one every so often past TWIST_AT points (not during breaks)
      if (s.twistT > 0) {
        s.twistT = Math.max(0, s.twistT - dt)
        if (s.twistT === 0 || s.breakT > 0) {
          s.twistT = 0
          setTwists([])
        }
      } else if (s.score >= TWIST_AT && s.breakT <= 0) {
        s.twistWait -= dt
        if (s.twistWait <= 0) {
          const names = (Object.keys(TWISTS) as Twist[]).sort(() => Math.random() - 0.5)
          const picked = names.slice(0, s.score >= TWIST_STACK_AT && Math.random() < 0.55 ? 2 : 1)
          s.twistT = TWIST_LEN
          s.twistWait = TWIST_GAP * (0.8 + Math.random() * 0.5)
          setTiltDir(Math.random() < 0.5 ? -1 : 1)
          setTwists(picked)
          say(picked.map((t) => TWISTS[t]).join(' + '), 1800)
          sfx.whoosh(0.5, true, 0.12)
        }
      }
      if (s.breakT <= 0) s.speed += 24 * dt * Math.max(0.3, 1 - (s.speed - START_SPEED) / 1100)
      // ...up to a ceiling a person can still react at (clutter crosses the screen in ~½s); past that,
      // the harder road patterns keep raising the difficulty instead
      s.speed = Math.min(MAX_SPEED, s.speed)
      s.dist += s.speed * dt
      // the band speeds up with the road: ~112 bpm at the start, up to ~172 when it's frantic
      music.setPace(116 + (s.speed - START_SPEED) * 0.09 - (s.breakT > 0 ? 10 : 0))
      const mult = s.pw.note > 0 ? 2 : 1
      // points come from distance, so the counter speeds up with the road: ~5.5/s at the start,
      // ~20/s at top speed (before the friend bonus and double points)
      s.score += ((dt * s.speed) / 55) * (1 + 0.1 * s.friends) * mult

      // power-up timers; the HUD only re-renders when a whole second ticks over
      TIMED.forEach((k) => (s.pw[k] = Math.max(0, s.pw[k] - dt)))
      const shown = TIMED.map((k) => Math.ceil(s.pw[k])).join() + '|' + Math.ceil(s.breakT)
      if (shown !== s.pwShown) {
        s.pwShown = shown
        setPowers({ ...s.pw })
        setRest(Math.ceil(s.breakT))
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
            if (!t.on || !(t.kind === 'ground' || (t.kind === 'drop' && t.y === 0))) return false
            const gap = t.x + t.size * 0.2 - (fx + 30)
            return gap > 0 && gap < s.speed * 0.17
          })
          if (ahead) s.fvy[k] = JUMP * (0.96 + Math.random() * 0.06)
        }
        el.style.transform = `translateY(${-s.fy[k]}px)`
      })
      const tier = tierOf(s.friends, s.score)
      if (tier > s.tier) {
        s.tier = tier
        // every milestone, the band re-arranges the song in a new style
        // (the win's fanfare does its own remix right after, so don't stack a second one)
        if (!(s.won && tier === JOIN_AT.length)) music.remix()
        // after the win, each extra level gets its own heads-up (not the one the last friend brought)
        if (s.won && tier > JOIN_AT.length) say(`the road gets busier · boosts get stronger (level ${tier})`, 2200)
      }
      const joined = JOIN_AT.filter((t) => s.score >= t).length
      if (joined > s.friends && s.friends < s.order.length) {
        s.friends = joined
        const who = s.order.slice(0, joined)
        setTeam(who)
        if (joined === JOIN_AT.length && !s.won) {
          s.won = true
          setWon(true)
          say('everyone made it to school! keep skipping…', 3200)
          // the band plays a fanfare on the next downbeat (falls back to the jingle if it's silent)
          if (!music.cue('win')) sfx.jingle(0.8)
        } else {
          say(`${who[joined - 1].name.toLowerCase()} joined! (${joined}/${JOIN_AT.length})`)
          if (!music.cue('join')) sfx.chime(1 + joined * 0.08, 0.7)
        }
        // each new friend brings a heart along if you're missing one
        if (s.lives < LIVES) spawn('heart', w + 60, 45)
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
        const T = s.tier
        const r = Math.random()
        if (s.breakT > 0) {
          // break: a gentle trickle of stars, the odd heart or power-up
          if (s.lives < LIVES && r < 0.2) spawn('heart', w + 20)
          else if (r < 0.3) {
            const choices = (Object.keys(POWERS) as Power[]).filter((k) => k === 'sparkle' || s.pw[k as Timed] <= 0)
            spawn(choices[Math.floor(Math.random() * choices.length)], w + 20)
          } else spawn('star', w + 20)
        } else if (s.score > 60 && r < 0.14 + lvl * 0.12) spawn('plane', w + 40)
        else if (s.score > 15 && r < Math.min(0.34, 0.26 + lvl * 0.06 + T * 0.012)) {
          // a power-up, never one that is already running
          const choices = (Object.keys(POWERS) as Power[]).filter((k) => k === 'sparkle' || s.pw[k as Timed] <= 0)
          // the wilder the road, the more often the golden heart is the one on offer
          if (T >= 6 && s.pw.goldheart <= 0 && Math.random() < Math.min(0.35, (T - 5) * 0.06)) spawn('goldheart', w + 20)
          else spawn(choices[Math.floor(Math.random() * choices.length)], w + 20)
        } else if (r < 0.42 + lvl * 0.08) spawn('star', w + 20)
        // hearts turn up more often with every level
        else if (s.lives < LIVES && r < 0.45 + lvl * 0.05 + T * 0.02 + Math.max(0, T - 5) * 0.015) spawn('heart', w + 20)
        else {
          // pick a road pattern; the plain single gets rarer as the tiers climb
          const open = COMBOS.filter((c) => c.from <= T || (c.name === 'pair' && lvl > 0.3))
          const weights = open.map((c) => (c.name === 'single' ? Math.max(1, 4 - T * 0.6) : 1))
          let pick = Math.random() * weights.reduce((a, b) => a + b, 0)
          let k = 0
          while (pick > weights[k]) pick -= weights[k++]
          const combo = open[k].name
          const x0 = w + 20
          const pattern = (c: ComboName, x: number) => {
            if (c === 'single') spawn('ground', x)
            else if (c === 'pair') {
              spawn('ground', x)
              spawn('ground', x + 52 + Math.random() * 30)
            } else if (c === 'under') {
              spawn('ground', x)
              // planes fly 1.3× faster; start it further out so both reach Mitsumi together
              spawn('plane', PX + (x - PX) * 1.3 + 10)
            } else if (c === 'triple') {
              for (let j = 0; j < 3; j++) spawn('ground', x + j * 46)
            } else if (c === 'low') {
              // head height when you hop, clear over you when you stay down
              spawn('plane', x + 20, 98 + Math.random() * 6)
            } else if (c === 'drop') {
              spawn('drop', x + 160)
            } else if (c === 'bounce') {
              spawn('ground', x, 0, 'bounce')
            } else if (c === 'zigzag') {
              spawn('plane', x + 40, 140, 'zigzag')
            } else if (c === 'swarm') {
              const n = 2 + Math.floor(Math.random() * 2)
              for (let j = 0; j < n; j++) spawn('plane', x + 40 + j * 70, j % 2 ? 100 + Math.random() * 6 : 188 + Math.random() * 12)
            } else if (c === 'rain') {
              const n = 2 + Math.floor(Math.random() * 2)
              for (let j = 0; j < n; j++) spawn('drop', x + 120 + j * (90 + Math.random() * 40))
            } else if (c === 'roll') {
              spawn('ground', x + 60, 0, 'roll')
            }
          }
          if (combo === 'chaos') {
            // two different patterns stacked: something on the road and something in the air
            const road: ComboName[] = ['pair', 'triple', 'bounce', 'roll', 'drop']
            const air: ComboName[] = ['zigzag', 'swarm', 'rain', 'under']
            pattern(road[Math.floor(Math.random() * road.length)], x0)
            pattern(air[Math.floor(Math.random() * air.length)], x0 + 140 + Math.random() * 80)
          } else pattern(combo, x0)
          // from the win on, the odd extra bit of clutter slips in between patterns
          if (T >= 6 && Math.random() < Math.min(0.45, (T - 5) * 0.07)) pattern(Math.random() < 0.5 ? 'single' : 'bounce', x0 + 260 + Math.random() * 120)
          // let the pattern clear before the next one
          if (combo === 'triple' || combo === 'under' || combo === 'chaos' || combo === 'swarm' || combo === 'rain') s.next += 0.3
        }
        s.next += (0.65 + Math.random() * 0.8) * (340 / s.speed) + 0.36 - Math.min(0.12, T * 0.015)
      }

      // move, draw and check every thing
      const pl = PX + 14
      const pr = PX + 34
      const pb = s.y + 4
      const pt = s.y + PLAYER_H * 0.78
      s.things.forEach((t, i) => {
        if (!t.on) return
        t.x -= s.speed * (t.kind === 'plane' ? 1.3 : t.mode === 'roll' ? 1.45 : 1) * dt
        if (t.mode === 'bounce') t.y = Math.abs(Math.sin(t.phase * 0.55)) * 58
        else if (t.mode === 'zigzag') t.y = t.base + Math.sin(t.phase * 0.4) * 52
        t.phase += dt * 4
        // a falling sticker drops to the road, then it's ordinary clutter
        if (t.kind === 'drop' && t.y > 0) {
          t.vy -= GRAVITY * 0.8 * dt
          t.y = Math.max(0, t.y + t.vy * dt)
        }
        // star magnet: stars within reach drift into Mitsumi's arms (reach grows with the tier)
        if (t.kind === 'star' && s.pw.sun > 0 && t.x < PX + 300 + s.tier * 40 && t.x > PX - 40) {
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
          const spin =
            t.mode === 'roll'
              ? -t.x * 1.6
              : t.kind === 'ground' || t.kind === 'drop'
                ? -t.x * 0.5
                : t.kind === 'plane'
                  ? t.mode === 'zigzag'
                    ? Math.cos(t.phase * 0.4) * -25
                    : -8
                  : 0
          el.style.transform = `translate(${t.x}px, ${-by}px) rotate(${spin}deg)`
        }
        const hazard = t.kind === 'ground' || t.kind === 'drop' || t.kind === 'plane'
        const l = t.x + t.size * (hazard ? 0.25 : 0.02)
        const r = t.x + t.size * (hazard ? 0.75 : 0.98)
        const b = by + t.size * (hazard ? 0.15 : 0)
        const top = by + t.size * (hazard ? 0.72 : 1)
        if (l > pr || r < pl || b > pt || top < pb) return
        if (t.kind === 'star') {
          t.on = false
          if (el) el.style.opacity = '0'
          // stars grow with the level, up to 22 each (so one shower can never skip a whole level)
          s.score += (10 + 2 * Math.min(6, s.tier)) * mult
          sfx.blip(1.5)
        } else if (isPower(t.kind)) {
          t.on = false
          if (el) el.style.opacity = '0'
          const k = t.kind
          if (k === 'sparkle') {
            // an arc of stars right ahead, all within a hop; longer with each tier
            const n = Math.min(8, 6 + s.tier)
            for (let j = 0; j < n; j++) spawn('star', w + 20 + j * 38, 20 + Math.sin((j / (n - 1)) * Math.PI) * 70)
          } else {
            // boosts last longer as the tiers climb
            s.pw[k] = POWERS[k].secs * (1 + 0.06 * Math.min(8, s.tier))
            // from tier 3 the clover holds off two hits
            if (k === 'clover') s.shieldHits = s.tier >= 3 ? 2 : 1
          }
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
          s.shieldHits--
          if (s.shieldHits <= 0) s.pw.clover = 0
          s.hurt = 0.7
          sfx.boing()
          say(s.shieldHits > 0 ? 'the clover held! one more block left' : 'phew, the clover saved you!')
        } else if (s.hurt <= 0 && s.pw.goldheart > 0) {
          // the golden heart breaks first
          s.pw.goldheart = 0
          s.hurt = 1.6
          sfx.thud()
          say('the golden heart took that one')
          const f = field.current
          f?.classList.remove('is-hit')
          void f?.offsetWidth
          f?.classList.add('is-hit')
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
          {powers.goldheart > 0 && <Icon name="heart" color={POWERS.goldheart.color} size={22} className="sg-goldheart" />}
        </span>
        <span className="sg-gang" aria-label={`${team.length} of ${JOIN_AT.length} friends`}>
          {FRIENDS.map((f, i) => (
            <i key={f.id} className={i < team.length ? 'is-in' : ''} style={{ '--c': (team[i] ?? f).color } as CSSProperties} />
          ))}
          {won && <b className="sg-made">made it!</b>}
        </span>
        <span className="sg-powers" aria-live="polite">
          {rest > 0 && <span className="sg-power sg-rest">break {rest}s</span>}
          {TIMED.filter((k) => powers[k] > 0).map((k) => (
            <span key={k} className="sg-power" style={{ '--c': POWERS[k].color } as CSSProperties} title={POWERS[k].label}>
              <Icon name={POWERS[k].icon} color={POWERS[k].color} size={16} />
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
        className={`sg-field is-${phase}${won ? ' is-won' : ''}${rest > 0 ? ' is-break' : ''}${twists.map((t) => ' tw-' + t).join('')}`}
        ref={field}
        onPointerDown={(e) => {
          e.preventDefault()
          hop()
        }}
        style={
          {
            height: view.h,
            '--tint': tint,
            '--tilt': `${tiltDir * 7}deg`,
            // Where Mitsumi is on screen. Tilt and zoom pivot on her; the mirror flips around the
            // middle (so the road ahead stays on screen) and the spotlight follows her across.
            ...(() => {
              const mx = (PX + 22) * view.scale
              const my = view.h - (FLOOR + 44) * view.scale
              const fieldW = view.w * view.scale
              const mirror = twists.includes('mirror')
              return {
                '--ox': mirror ? '50%' : `${mx}px`,
                '--oy': mirror ? '50%' : `${my}px`,
                '--sx': `${mirror ? fieldW - mx : mx}px`,
                '--sy': `${my}px`,
              }
            })(),
          } as CSSProperties
        }
      >
        <div className="sg-cam">
        <div
          className="sg-world"
          ref={world}
          style={{ width: view.w, height: view.h / view.scale, transform: `scale(${view.scale})`, '--floor': `${FLOOR}px` } as CSSProperties}
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
              L.kind === 'ground' || L.kind === 'drop'
                ? GROUND[L.look]
                : L.kind === 'plane'
                  ? { name: 'plane' as IconName, color: C.sky }
                  : L.kind === 'star'
                    ? { name: 'star' as IconName, color: C.yellow }
                    : isPower(L.kind)
                      ? { name: POWERS[L.kind].icon, color: POWERS[L.kind].color }
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
