/**
 * The running game's song, played live on the same synth voices as the rest of the site.
 *
 * It's a real song form rather than a loop: intro, verse, verse again, chorus, verse up an
 * octave, bridge, chorus, last verse. Then it lifts a key and goes round again. The verse is
 * built on the site's leitmotif (the D–G–A–B rise of the opening jingle) and comes back changed
 * each time: a different lead instrument, a harmony line, ornaments, a countermelody, another
 * drum feel. Every note gets a little human looseness and the eighths swing a touch.
 *
 * Tempo follows the game (setPace), and a "danger" flag makes the drums more urgent.
 */
import { voices as V } from './sfx'

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

/** [midi note (0 = rest), length in eighth notes] */
type Ev = [number, number]

// G major, for diatonic harmony lines
const SCALE = [7, 9, 11, 0, 2, 4, 6]
const inScale = (m: number) => SCALE.includes(((m % 12) + 12) % 12)
function diatonic(m: number, steps: number) {
  let n = m
  let k = 0
  const dir = Math.sign(steps)
  while (k < Math.abs(steps)) {
    n += dir
    if (inScale(n)) k++
  }
  return n
}

const CHORD: Record<string, { root: number; tones: number[] }> = {
  G: { root: 43, tones: [67, 71, 74] },
  Em: { root: 40, tones: [64, 67, 71] },
  C: { root: 48, tones: [64, 67, 72] },
  D: { root: 50, tones: [66, 69, 74] },
  Bm: { root: 47, tones: [66, 71, 74] },
  Am: { root: 45, tones: [64, 69, 72] },
}

// ── the tunes ─────────────────────────────────────────────────────────────

/** A hint of the motif on glockenspiel over the strum. */
const INTRO: Ev[] = [
  [0, 4], [74, 1], [79, 1], [81, 1], [83, 1],
  [0, 8],
  [0, 4], [76, 1], [79, 1], [81, 1], [84, 1],
  [81, 4], [0, 4],
]

/** Verse: the leitmotif, its answer, the motif again, reaching higher, and a half cadence. */
const VERSE: Ev[] = [
  [74, 1], [79, 1], [81, 1], [83, 2], [81, 1], [79, 1], [76, 1],
  [79, 1], [81, 1], [76, 2], [0, 1], [74, 1], [76, 1], [79, 1],
  [76, 1], [79, 1], [81, 1], [84, 2], [83, 1], [81, 1], [79, 1],
  [81, 3], [78, 1], [74, 2], [0, 2],
  [74, 1], [79, 1], [81, 1], [83, 2], [81, 1], [79, 1], [76, 1],
  [79, 1], [81, 1], [83, 2], [0, 1], [83, 1], [86, 1], [83, 1],
  [84, 2], [83, 1], [81, 1], [79, 2], [76, 1], [79, 1],
  [81, 4], [78, 2], [74, 2],
]

/** Chorus: the motif's first four notes, climbed up the chords. */
const CHORUS: Ev[] = [
  [72, 1], [76, 1], [79, 2], [81, 1], [79, 1], [76, 2],
  [74, 1], [78, 1], [81, 2], [83, 1], [81, 1], [78, 2],
  [71, 1], [74, 1], [78, 2], [79, 1], [78, 1], [74, 2],
  [76, 3], [74, 1], [71, 2], [0, 2],
  [72, 1], [76, 1], [79, 2], [84, 2], [83, 1], [81, 1],
  [81, 2], [78, 1], [81, 1], [86, 4],
  [83, 2], [81, 1], [79, 1], [81, 2], [83, 2],
  [81, 4], [0, 2], [74, 1], [78, 1],
]

/** Bridge: long notes, a breath before the last climb. */
const BRIDGE: Ev[] = [
  [81, 4], [79, 2], [76, 2],
  [78, 6], [74, 2],
  [79, 3], [81, 1], [83, 4],
  [84, 6], [0, 2],
  [84, 2], [83, 2], [81, 4],
  [78, 4], [81, 4],
  [83, 4], [86, 4],
  [86, 2], [84, 2], [83, 2], [81, 2],
]

type Lead = 'kalimba' | 'whistle' | 'glock'
type Drums = 'shaker' | 'light' | 'full' | 'half'
interface Part {
  mel: Ev[]
  chords: string[]
  lead: Lead
  drums: Drums
  strum: 'stab' | 'busy' | 'pad'
  counter?: boolean
  ornament?: boolean
  harmony?: boolean
  octave?: number
}

const V_CH = ['G', 'Em', 'C', 'D', 'G', 'Em', 'C', 'D']
const C_CH = ['C', 'D', 'Bm', 'Em', 'C', 'D', 'G', 'D']
const B_CH = ['Am', 'D', 'G', 'C', 'Am', 'D', 'G', 'D']

const SONG: Part[] = [
  { mel: INTRO, chords: ['G', 'Em', 'C', 'D'], lead: 'glock', drums: 'shaker', strum: 'stab' },
  { mel: VERSE, chords: V_CH, lead: 'kalimba', drums: 'light', strum: 'stab' },
  { mel: VERSE, chords: V_CH, lead: 'kalimba', drums: 'full', strum: 'stab', ornament: true, counter: true },
  { mel: CHORUS, chords: C_CH, lead: 'whistle', drums: 'full', strum: 'busy' },
  { mel: VERSE, chords: V_CH, lead: 'glock', drums: 'full', strum: 'busy', octave: 12, harmony: true },
  { mel: BRIDGE, chords: B_CH, lead: 'whistle', drums: 'half', strum: 'pad' },
  { mel: CHORUS, chords: C_CH, lead: 'kalimba', drums: 'full', strum: 'busy', counter: true, harmony: true },
  { mel: VERSE, chords: V_CH, lead: 'whistle', drums: 'full', strum: 'stab', ornament: true, harmony: true },
]
/** Each time round, the song lifts key a little before settling back. */
const LIFT = [0, 2, 3, 5]

/** melody events by sixteenth-note step, per part */
const EVENTS = SONG.map((p) => {
  const map = new Map<number, Ev>()
  let at = 0
  p.mel.forEach(([m, len]) => {
    if (m) map.set(at, [m, len * 2])
    at += len * 2
  })
  return map
})

// ── voices ───────────────────────────────────────────────────────────────

const VOL = 0.75
const human = (amt = 0.15) => 1 + (Math.random() * 2 - 1) * amt

function lead(kind: Lead, m: number, dur: number, delay: number, g = 1) {
  const f = hz(m)
  if (kind === 'kalimba') V.pluck({ f, dur: Math.max(0.3, dur * 1.5), g: 0.05 * g * VOL * human(), delay, wood: 0.3 })
  else if (kind === 'whistle') V.whistle({ f, dur: Math.max(0.12, dur * 0.94), g: 0.03 * g * VOL * human(0.1), delay })
  else V.pluck({ f, dur: 1.1, g: 0.032 * g * VOL * human(), delay, wood: 0.1 })
}

function strum(tones: number[], tr: number, delay: number, up: boolean, g = 1) {
  const order = up ? [...tones].reverse() : tones
  order.forEach((n, i) => V.pluck({ f: hz(n + tr), dur: 0.45, g: 0.017 * g * VOL * human(0.25), delay: delay + i * 0.013, wood: 0.4 }))
}

const kick = (delay: number, v = 1) => V.tone({ f: 105, f2: 44, dur: 0.22, g: 0.11 * v * VOL, a: 0.004, delay })
const brush = (delay: number, v = 1) => {
  V.noise({ dur: 0.14, f: 2300, q: 0.6, g: 0.035 * v * VOL, a: 0.008, delay })
  V.tone({ f: 185, f2: 150, dur: 0.07, g: 0.022 * v * VOL, delay })
}
const hat = (delay: number, v = 1) => V.noise({ dur: 0.035, f: 6800, q: 0.9, g: 0.011 * v * VOL, a: 0.002, delay, type: 'highpass' })
const shaker = (delay: number, v = 1) => V.noise({ dur: 0.07, f: 5200, q: 1.4, g: 0.0095 * v * VOL, a: 0.02, delay })
const tom = (delay: number, k: number) => V.tone({ f: 170 - k * 18, f2: 95 - k * 6, dur: 0.18, g: 0.06 * VOL, a: 0.004, delay })
const splash = (delay: number) => V.noise({ dur: 0.7, f: 6200, f2: 4200, q: 0.5, g: 0.016 * VOL, a: 0.004, delay })

// ── the scheduler ────────────────────────────────────────────────────────

const AHEAD = 0.14 // seconds scheduled in advance
let timer = 0
let running = false
let bpm = 112
let targetBpm = 112
let danger = false
let part = 0
let step = 0
let loop = 0
let next = 0

const sixteenth = () => 60 / bpm / 4

function play(t: number) {
  if (!V.live()) return
  const P = SONG[part]
  const bar = Math.floor(step / 16)
  const s = step % 16
  const ch = CHORD[P.chords[bar]]
  const tr = LIFT[loop % LIFT.length]
  const sx = sixteenth()
  const beat = sx * 4
  const lastBar = bar === P.chords.length - 1
  // light swing on the off-eighths, plus a few ms of looseness on everything
  const swing = s % 4 === 2 ? sx * 0.16 : 0
  const when = (extra = 0) => Math.max(0, t + swing + extra + (Math.random() - 0.5) * 0.012 - V.now())

  // melody
  const ev = EVENTS[part].get(step)
  if (ev) {
    const m = ev[0] + tr + (P.octave ?? 0)
    const dur = ev[1] * sx
    if (P.ornament && ev[1] >= 4 && Math.random() < 0.55) lead(P.lead === 'whistle' ? 'whistle' : 'kalimba', diatonic(m, 1), 0.07, when(-0.055), 0.55)
    lead(P.lead, m, dur, when())
    if (P.harmony) lead(P.lead === 'glock' ? 'kalimba' : P.lead, diatonic(m, -2) - (P.octave ?? 0), dur, when(0.006), 0.5)
  }

  // countermelody: glockenspiel arpeggio of the chord on the off-eighths
  if (P.counter && s % 4 === 2) {
    const tones = ch.tones
    const n = tones[(bar * 2 + Math.floor(s / 4)) % tones.length] + 12 + tr
    lead('glock', n, sx * 2, when(), 0.45)
  }

  // ukulele-ish strum, or a soft pad in the bridge
  if (P.strum === 'stab' && (s === 4 || s === 12)) strum(ch.tones, tr, when(), s === 12)
  if (P.strum === 'busy' && [0, 4, 6, 10, 12].includes(s)) strum(ch.tones, tr, when(), s === 6 || s === 10, s === 0 ? 0.8 : 1)
  if (P.strum === 'pad' && s === 0)
    ch.tones.forEach((n) => V.tone({ f: hz(n + tr), dur: beat * 4.1, g: 0.011 * VOL, a: beat * 0.8, delay: when() }))

  // bass: root, fifth, a little walk into the next bar
  const root = ch.root + tr
  if (P.drums !== 'shaker' || bar >= 2) {
    const bass = (m: number, len: number, v = 1) => {
      V.tone({ f: hz(m), dur: len, g: 0.075 * v * VOL * human(0.1), a: 0.012, delay: when() })
      V.tone({ f: hz(m) * 2, dur: len * 0.5, g: 0.014 * v * VOL, a: 0.01, delay: when() })
    }
    if (s === 0) bass(root, beat * 1.6)
    if (s === 8) bass(root + 7, beat * 1.2, 0.85)
    if (P.strum === 'busy' && s === 6) bass(root + 12, beat * 0.4, 0.6)
    if (s === 14 && !lastBar) bass(root + (bar % 2 ? 5 : 4), sx * 1.6, 0.6)
  }

  // drums
  const fill = lastBar && s >= 12 && P.drums !== 'shaker'
  if (step === 0 && part > 0) splash(when())
  if (fill) {
    tom(when(), s - 12)
    if (s === 15) brush(when(), 0.9)
    return
  }
  if (P.drums === 'shaker') {
    if (s % 2 === 0) shaker(when(), s % 4 === 2 ? 1 : 0.6)
  } else if (P.drums === 'light') {
    if (s === 0 || s === 8) kick(when(), 0.8)
    if (s === 4 || s === 12) brush(when(), 0.6)
    if (s % 2 === 0) shaker(when(), s % 4 === 2 ? 1 : 0.55)
  } else if (P.drums === 'full') {
    if (s === 0 || s === 8 || s === 10 || (bar % 2 === 1 && s === 6)) kick(when(), s === 0 ? 1 : 0.8)
    if (s === 4 || s === 12) brush(when())
    if (s % 2 === 0) hat(when(), s % 4 === 0 ? 0.7 : 1)
    if (s === 15 && Math.random() < 0.25) brush(when(), 0.3)
  } else if (P.drums === 'half') {
    if (s === 0) kick(when(), 0.9)
    if (s === 8) brush(when(), 0.8)
    if (s % 4 === 0) hat(when(), 0.6)
  }
  // last heart: a heartbeat kick on every beat and busier hats
  if (danger && P.drums !== 'half') {
    if (s % 4 === 0 && s !== 0 && s !== 8) kick(when(), 0.6)
    if (s % 2 === 1) hat(when(), 0.5)
  }
}

function advance() {
  next += sixteenth()
  step++
  if (step >= SONG[part].chords.length * 16) {
    step = 0
    part++
    if (part >= SONG.length) {
      part = 1 // the intro only plays once
      loop++
    }
  }
}

function tick() {
  // ease toward the game's pace so speed-ups feel like a band pushing, not a jump
  bpm += (targetBpm - bpm) * 0.08
  const now = V.now()
  if (next < now - 0.2) next = now + 0.05 // fell behind (tab was hidden): pick up from here
  while (next < now + AHEAD) {
    play(next)
    advance()
  }
}

export const music = {
  start(pace = 112) {
    this.stop()
    running = true
    bpm = targetBpm = pace
    danger = false
    part = 0
    step = 0
    loop = 0
    next = V.now() + 0.08
    timer = window.setInterval(tick, 25)
  },
  /** Stop; with `sad`, a little falling phrase, like being late for class. */
  stop(sad = false) {
    if (timer) clearInterval(timer)
    timer = 0
    const was = running
    running = false
    if (sad && was && V.live()) {
      const tr = LIFT[loop % LIFT.length]
      ;[79, 76, 74, 67].forEach((m, i) => V.whistle({ f: hz(m + tr), dur: i === 3 ? 0.9 : 0.26, g: 0.03, delay: 0.12 + i * 0.24 }))
      V.tone({ f: hz(43 + tr), dur: 1.2, g: 0.06, a: 0.02, delay: 0.84 })
    }
  },
  /** Beats per minute to drift toward. */
  setPace(target: number) {
    targetBpm = Math.max(90, Math.min(180, target))
  },
  setDanger(on: boolean) {
    danger = on
  },
}
