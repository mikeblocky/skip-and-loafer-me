import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { gsap, Draggable, velocityTracker } from '../gsap'
import { CHARACTERS, RAINBOW } from '../data'
import { Icon, SCATTER_ICONS, type IconName } from '../icons'
import { sfx } from '../sfx'

export type Mode = 'countdown' | 'volumes' | 'birthdays' | 'anime'

export interface StageHandle {
  prepare(): void
  intro(): gsap.core.Timeline
  enable(): void
  setMode(mode: Mode): void
}

interface Pose {
  x: number
  y: number
  scale: number
  rotation: number
}

interface Rect {
  left: number
  right: number
  top: number
  bottom: number
}

const rand = gsap.utils.random
const clamp = gsap.utils.clamp

function metrics() {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const mobile = vw < 760
  // element box height; the visible size comes from each pose's scale
  const H = mobile ? 300 : 640
  return { vw, vh, mobile, H }
}

/**
 * Resting boxes of the page's protected content. By default everything marked data-safe;
 * pass a narrower selector (e.g. just the headings) to measure only those.
 */
function measureSafeRects(selector = '.view [data-safe]'): Rect[] {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).map((el) => {
    // undo any in-flight intro transform so the box is where the element will rest
    const b = el.getBoundingClientRect()
    const ty = gsap.getProperty(el, 'y') as number
    const sc = (gsap.getProperty(el, 'scale') as number) || 1
    const w = b.width / sc
    const h = b.height / sc
    const cx = b.left + b.width / 2
    const cy = b.top + b.height / 2 - ty
    return { left: cx - w / 2, right: cx + w / 2, top: cy - h / 2, bottom: cy + h / 2 }
  })
}

/** Bounding box of the page's central content. Nothing lands inside it. */
function measureSafe(): Rect {
  const { vw, vh } = metrics()
  const rects = measureSafeRects()
  if (!rects.length) return { left: vw * 0.3, right: vw * 0.7, top: vh * 0.25, bottom: vh * 0.7 }
  return rects.reduce((r, b) => ({
    left: Math.min(r.left, b.left),
    right: Math.max(r.right, b.right),
    top: Math.min(r.top, b.top),
    bottom: Math.max(r.bottom, b.bottom),
  }))
}

const overlaps = (a: Rect, b: Rect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

export const Stage = forwardRef<StageHandle, { aspects: Record<string, number> }>(function Stage(
  { aspects },
  ref,
) {
  const charEls = useRef<HTMLDivElement[]>([])
  const charInner = useRef<HTMLDivElement[]>([])
  const iconEls = useRef<HTMLDivElement[]>([])
  const iconBob = useRef<HTMLDivElement[]>([])
  const rings = useRef<HTMLDivElement[]>([])
  const drags = useRef<Draggable[]>([])
  const idle = useRef<gsap.core.Tween[]>([])
  const charHomes = useRef<Pose[]>([])
  const iconHomes = useRef<Pose[]>([])
  // where each thing belongs: its scattered spot, or wherever you last dropped it.
  // Pages only nudge things away from home temporarily; they go back once it's clear again.
  const home = useRef(new Map<HTMLElement, { x: number; y: number }>())
  const setHome = (el: HTMLElement) => home.current.set(el, { x: gsap.getProperty(el, 'x') as number, y: gsap.getProperty(el, 'y') as number })

  const icons = useMemo(() => {
    const small = window.innerWidth < 760
    const count = small ? 16 : 30
    return Array.from({ length: count }, (_, i) => ({
      name: SCATTER_ICONS[i % SCATTER_ICONS.length] as IconName,
      color: RAINBOW[(i * 5) % RAINBOW.length],
      size: small ? 40 : 56,
      front: Math.random() > 0.5,
    }))
  }, [])

  const size = (i: number) => {
    const { H } = metrics()
    return { w: H * (aspects[CHARACTERS[i].id] ?? 0.47), h: H }
  }

  /**
   * Even scatter by best-candidate sampling: for each object try many random spots outside
   * the content and keep the one farthest from everything already placed. Each object also
   * gets its own depth, so near ones end up bigger than far ones.
   */
  const layout = () => {
    const { vw, vh, mobile } = metrics()
    const S = measureSafe()
    const safe: Rect = { left: S.left - 22, right: S.right + 22, top: S.top - 18, bottom: S.bottom + 18 }
    const nav: Rect = { left: vw / 2 - 310, right: vw / 2 + 310, top: 0, bottom: 84 }
    const placed: { x: number; y: number; r: number }[] = []
    const timer: Rect = { left: vw - 340, right: vw, top: 0, bottom: 76 }
    const blocked = (b: Rect) => overlaps(b, safe) || overlaps(b, nav) || (!mobile && overlaps(b, timer))
    const score = (x: number, y: number, r: number) => {
      let best = Infinity
      for (const p of placed) best = Math.min(best, Math.hypot(x - p.x, y - p.y) - p.r - r)
      // keep some distance from the screen edges too, so the spread reads as even
      const edge = Math.min(x, vw - x, y, vh - y) * 0.6
      return Math.min(best, edge + r)
    }

    const baseH = mobile ? clamp(110, 170, (vh - S.bottom) * 0.82) : clamp(220, 380, vh * 0.42)
    // big things first so the small ones fill around them
    const order = CHARACTERS.map((_, i) => i).sort(() => Math.random() - 0.5)
    const chars: Pose[] = []
    order.forEach((i) => {
      const { w, h } = size(i)
      const depth = rand(0.82, 1.18)
      const s = (baseH * depth) / h
      const vwid = w * s
      const vhgt = h * s
      const r = vhgt * 0.3
      let best: { x: number; y: number } | null = null
      let bestScore = -Infinity
      for (let t = 0; t < 120; t++) {
        const x = rand(vwid * 0.2, vw - vwid * 0.2)
        const y = rand(vhgt * 0.32, vh - vhgt * 0.22)
        const box = { left: x - vwid * 0.3, right: x + vwid * 0.3, top: y - vhgt / 2, bottom: y + vhgt / 2 }
        if (blocked(box)) continue
        const sc = score(x, y, r)
        if (sc > bestScore) {
          bestScore = sc
          best = { x, y }
        }
      }
      if (!best) {
        // no room around the content: peek up from the bottom edge
        const left = CHARACTERS[i].side === 'left'
        best = { x: left ? rand(vwid * 0.4, vw * 0.4) : rand(vw * 0.6, vw - vwid * 0.4), y: vh - vhgt * 0.15 }
      }
      placed.push({ ...best, r })
      // transform origin is the centre, so the box centre is the visible centre
      chars[i] = { x: best.x - w / 2, y: best.y - h / 2, scale: s, rotation: rand(-12, 12) }
    })

    const ics: Pose[] = icons.map((ic) => {
      const s = rand(0.65, 1.4)
      const d = ic.size * s
      const r = d * 0.6
      let best: { x: number; y: number } | null = null
      let bestScore = -Infinity
      for (let t = 0; t < 60; t++) {
        const x = rand(d / 2 + 6, vw - d / 2 - 6)
        const y = rand(d / 2 + 6, vh - d / 2 - 6)
        if (blocked({ left: x - d / 2, right: x + d / 2, top: y - d / 2, bottom: y + d / 2 })) continue
        const sc = score(x, y, r)
        if (sc > bestScore) {
          bestScore = sc
          best = { x, y }
        }
      }
      best ??= { x: rand(10, vw - 10), y: rand(vh * 0.8, vh - 10) }
      placed.push({ ...best, r })
      return { x: best.x - ic.size / 2, y: best.y - ic.size / 2, scale: s, rotation: rand(-35, 35) }
    })

    charHomes.current = chars
    iconHomes.current = ics
  }

  const stopIdle = () => {
    idle.current.forEach((t) => t.kill())
    idle.current = []
  }

  const startIdle = () => {
    stopIdle()
    iconBob.current.forEach((el) => {
      idle.current.push(
        gsap.to(el, {
          y: rand(-12, 12),
          rotation: rand(-14, 14),
          duration: rand(1.6, 2.8),
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          delay: rand(0, 1),
        }),
      )
    })
    charInner.current.forEach((inner, i) => {
      const el = inner.firstElementChild as HTMLElement
      gsap.set(el, { transformOrigin: '50% 100%' })
      idle.current.push(
        gsap.to(el, {
          scaleY: 1.014,
          scaleX: 0.994,
          duration: rand(1.8, 2.4),
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          delay: i * 0.17,
        }),
      )
    })
  }

  const applySizes = () => {
    charEls.current.forEach((el, i) => {
      const { w, h } = size(i)
      gsap.set(el, { width: w, height: h })
    })
  }

  useImperativeHandle(ref, () => ({
    prepare() {
      stopIdle()
      drags.current.forEach((d) => d.disable())
      applySizes()
      layout()
      home.current.clear()
      charEls.current.forEach((el, i) => home.current.set(el, { x: charHomes.current[i].x, y: charHomes.current[i].y }))
      iconEls.current.forEach((el, i) => home.current.set(el, { x: iconHomes.current[i].x, y: iconHomes.current[i].y }))
      gsap.killTweensOf([...charEls.current, ...iconEls.current, ...charInner.current])
      gsap.set(charEls.current, { autoAlpha: 1, transformOrigin: '50% 50%' })
      gsap.set(iconEls.current, { autoAlpha: 1, transformOrigin: '50% 50%' })
      gsap.set(charInner.current, { scale: 1, transformOrigin: '50% 100%' })
    },

    /**
     * Looking straight down a funnel. Every object starts deep inside at the hole in the
     * middle and rises toward the viewer. One depth value z drives everything through a real
     * perspective divide (k = near / z): size, distance from the centre and the swirl angle.
     * Far away things are tiny and bunched up; they grow and fan out faster as they get close.
     */
    intro() {
      const { vw, vh } = metrics()
      const tl = gsap.timeline()
      const cx = vw / 2
      const cy = vh / 2
      const reach = Math.hypot(vw, vh) / 2
      const FAR = 14

      rings.current.forEach((el, i) => {
        const z = { v: FAR }
        const draw = () => {
          const k = 1 / z.v
          gsap.set(el, { scale: (reach * 2.3 * k) / 100, opacity: Math.min(1, (1 - k) * 2.2) })
        }
        draw()
        tl.to(z, { v: 1, duration: 1.8, ease: 'none', onUpdate: draw }, i * 0.2)
      })

      const fly = (
        el: HTMLElement,
        pose: Pose,
        center: { x: number; y: number },
        place: (px: number, py: number, s: number) => void,
        at: number,
        dur: number,
      ) => {
        const dx = center.x - cx
        const dy = center.y - cy
        const r1 = Math.hypot(dx, dy)
        const a1 = Math.atan2(dy, dx)
        const swirl = (Math.random() > 0.5 ? 1 : -1) * rand(1.1, 1.8)
        const spin = rand(-260, 260)
        const z = { v: FAR }
        const draw = () => {
          const k = 1 / z.v
          const a = a1 - swirl * (1 - k)
          place(cx + Math.cos(a) * r1 * k, cy + Math.sin(a) * r1 * k, pose.scale * k)
          gsap.set(el, { rotation: pose.rotation + spin * (1 - k), opacity: Math.min(1, k * 6) })
        }
        draw()
        // z closes in fast and eases at the end; the 1/z divide makes the approach accelerate
        tl.to(z, { v: 1, duration: dur, ease: 'power2.out', onUpdate: draw }, at)
      }

      const total = icons.length + CHARACTERS.length
      const order = gsap.utils.shuffle(Array.from({ length: total }, (_, i) => i))
      const at = (i: number) => 0.15 + order[i] * (1.1 / total)

      iconEls.current.forEach((el, i) => {
        const p = iconHomes.current[i]
        const s = icons[i].size
        gsap.set(el, { zIndex: icons[i].front ? 40 : 5 })
        fly(el, p, { x: p.x + s / 2, y: p.y + s / 2 }, (px, py, sc) => gsap.set(el, { x: px - s / 2, y: py - s / 2, scale: sc }), at(i), 1.5)
        tl.call(() => sfx.pop(clamp(0.7, 1.7, 1.25 / p.scale), sfx.panOf(p.x + s / 2)), [], at(i) + 1.05)
      })

      CHARACTERS.forEach((_, i) => {
        const el = charEls.current[i]
        const inner = charInner.current[i]
        const { w, h } = size(i)
        const p = charHomes.current[i]
        const t = at(icons.length + i)
        gsap.set(el, { zIndex: Math.round(p.scale * 40) })
        fly(el, p, { x: p.x + w / 2, y: p.y + h / 2 }, (px, py, sc) => gsap.set(el, { x: px - w / 2, y: py - h / 2, scale: sc }), t, 1.7)
        tl.call(() => (sfx.thud(sfx.panOf(p.x + w / 2)), sfx.pop(0.55, sfx.panOf(p.x + w / 2))), [], t + 1.5)
        tl.to(inner, { scaleY: 0.92, scaleX: 1.05, duration: 0.1, ease: 'power2.out' }, t + 1.55)
        tl.to(inner, { scaleY: 1, scaleX: 1, duration: 0.7, ease: 'elastic.out(1, 0.75)' }, t + 1.65)
      })
      return tl
    },

    enable() {
      if (!drags.current.length) createDraggables()
      drags.current.forEach((d) => d.enable())
      updateBounds()
      startIdle()
    },

    // Everything keeps its spot (including where you dragged it) when the page changes, except
    // what would cover the new page's header, which steps out into an even ring around it.
    setMode(_m: Mode) {
      arrange()
      updateBounds()
    },
  }))

  interface Item {
    el: HTMLElement
    /** resting top-left (gsap x/y) before this page's adjustments */
    x: number
    y: number
    w: number
    h: number
    /** visible size: characters are mostly transparent at the sides */
    vw: number
    vh: number
  }

  /**
   * Same rule on every page: everything goes to its home spot, except things whose home would
   * cover this page's header, which step to the nearest free spot around it. Nothing else moves.
   */
  function arrange() {
    const { vw, vh, mobile } = metrics()
    const items: Item[] = [
      ...charEls.current.map((el) => ({ el, char: true })),
      ...iconEls.current.map((el) => ({ el, char: false })),
    ].map(({ el, char }) => {
      const s = (gsap.getProperty(el, 'scale') as number) || 1
      const w = el.offsetWidth
      const h = el.offsetHeight
      const at = home.current.get(el) ?? { x: gsap.getProperty(el, 'x') as number, y: gsap.getProperty(el, 'y') as number }
      return { el, x: at.x, y: at.y, w, h, vw: w * s * (char ? 0.6 : 1), vh: h * s }
    })
    const nudged = ringAroundHeaders(items, vw, vh, mobile)
    items.forEach((it) => {
      const t = nudged.get(it.el) ?? { x: it.x, y: it.y }
      const cx = gsap.getProperty(it.el, 'x') as number
      const cy = gsap.getProperty(it.el, 'y') as number
      if (Math.abs(t.x - cx) < 1 && Math.abs(t.y - cy) < 1) return
      gsap.to(it.el, { x: t.x, y: t.y, duration: 0.9, ease: 'back.inOut(1.3)', delay: rand(0, 0.15) })
    })
  }

  /**
   * Anything covering a header (or other protected content) steps to the nearest free spot
   * around where it was, keeping a little room from its neighbours, so things spread out
   * locally on every side instead of all gathering in one place.
   */
  function ringAroundHeaders(items: Item[], vw: number, vh: number, mobile: boolean) {
    const out = new Map<HTMLElement, { x: number; y: number }>()
    // clearance is wider than the idle bob (±12px plus a little tilt), so floating never drifts onto text
    const PAD = 22
    // only text (titles and hints) pushes things away; cards, the clock and the TVs are drawn
    // above the stage, so something standing behind them is fine and shouldn't be shuffled
    const safes = measureSafeRects('.view :is(h1, h2, p)[data-safe]').map((r) => ({
      left: r.left - PAD,
      right: r.right + PAD,
      top: r.top - PAD,
      bottom: r.bottom + PAD,
    }))
    if (!safes.length) return out
    // small icons also shouldn't land hidden behind the page's other content
    const solid = measureSafeRects('.view [data-safe]:not(:is(h1, h2, p))')
    const hidden = (r: Rect) => solid.some((s) => overlaps(r, s))
    const nav: Rect = { left: vw / 2 - 310, right: vw / 2 + 310, top: 0, bottom: 84 }
    const timer: Rect = { left: vw - 340, right: vw, top: 0, bottom: 76 }
    const box = (cx: number, cy: number, it: Item): Rect => ({
      left: cx - it.vw / 2,
      right: cx + it.vw / 2,
      top: cy - it.vh / 2,
      bottom: cy + it.vh / 2,
    })
    const centre = (it: Item) => ({ x: it.x + it.w / 2, y: it.y + it.h / 2 })
    const radius = (it: Item) => Math.max(it.vw, it.vh) * 0.5
    const covering = (r: Rect) => safes.find((s) => overlaps(r, s))

    const moving = items.filter((it) => {
      const c = centre(it)
      return covering(box(c.x, c.y, it))
    })
    const placed = items.filter((it) => !moving.includes(it)).map((it) => ({ ...centre(it), r: radius(it) }))

    // big things first so the small ones fill in around them
    moving.sort((a, b) => b.vw * b.vh - a.vw * a.vh)
    moving.forEach((it) => {
      const from = centre(it)
      const r = radius(it)
      const big = it.vh > 200
      const free = (x: number, y: number) => {
        const b = box(x, y, it)
        const inView = big ? x > 0 && x < vw && y > 0 && y < vh : b.left > 4 && b.right < vw - 4 && b.top > 4 && b.bottom < vh - 4
        return inView && !covering(b) && !(!big && hidden(b)) && !overlaps(b, nav) && !(!mobile && overlaps(b, timer))
      }
      const room = (x: number, y: number) => {
        let sc = Infinity
        for (const p of placed) sc = Math.min(sc, Math.hypot(x - p.x, y - p.y) - p.r - r)
        return sc
      }
      // Step out from where it already is: search rings of growing radius around its own spot
      // and take the closest free place that also leaves breathing room from its neighbours.
      // Things over the left of a header go left or up/down there, things on the right go right.
      const GAP = big ? 0 : 14
      let best: { x: number; y: number } | null = null
      let fallback: { x: number; y: number; room: number } | null = null
      for (let dist = 24; dist < Math.max(vw, vh) && !best; dist += 18) {
        const tries = Math.ceil((2 * Math.PI * dist) / 22)
        const offset = rand(0, Math.PI * 2)
        let ringBest: { x: number; y: number; room: number } | null = null
        for (let t = 0; t < tries; t++) {
          const a = offset + (t / tries) * Math.PI * 2
          const x = from.x + Math.cos(a) * dist
          const y = from.y + Math.sin(a) * dist
          if (!free(x, y)) continue
          const rm = room(x, y)
          if (!fallback || rm > fallback.room) fallback = { x, y, room: rm }
          if (rm >= GAP && (!ringBest || rm > ringBest.room)) ringBest = { x, y, room: rm }
        }
        if (ringBest) best = ringBest
      }
      best ??= fallback
      if (!best) return // nowhere free at all: leave it be
      placed.push({ x: best.x, y: best.y, r })
      out.set(it.el, { x: best.x - it.w / 2, y: best.y - it.h / 2 })
    })
    return out
  }

  function updateBounds() {
    const { vw, vh } = metrics()
    drags.current.forEach((d) => {
      const el = d.target as HTMLElement
      const w = el.offsetWidth
      const h = el.offsetHeight
      d.applyBounds({ minX: -w * 0.7, maxX: vw - w * 0.3, minY: -h * 0.7, maxY: vh - h * 0.3 })
    })
  }

  function createDraggables() {
    charEls.current.forEach((el, i) => {
      const inner = charInner.current[i]
      const vt = velocityTracker()
      const rot = gsap.quickTo(el, 'rotation', { duration: 0.45, ease: 'power3.out' })
      const settle = () =>
        gsap.to(el, { rotation: charHomes.current[i]?.rotation ?? 0, duration: 1.4, ease: 'elastic.out(1, 0.75)', overwrite: 'auto' })
      const lean = function (this: Draggable) {
        const { vx } = vt.sample(this.x, this.y)
        rot(clamp(-32, 32, vx / 45))
      }
      const [d] = Draggable.create(el, {
        type: 'x,y',
        inertia: true,
        zIndexBoost: true,
        edgeResistance: 0.65,
        cursor: 'grab',
        activeCursor: 'grabbing',
        onPress(this: Draggable) {
          vt.reset(this.x, this.y)
          el.classList.add('held')
          sfx.grab(sfx.panOf(this.pointerX))
          gsap.to(inner, { scale: 1.07, duration: 0.35, ease: 'back.out(1.4)', overwrite: 'auto' })
        },
        onDrag: lean,
        onThrowUpdate: lean,
        onRelease(this: Draggable) {
          el.classList.remove('held')
          sfx.boing(sfx.panOf(this.pointerX))
          if (this.isThrowing) sfx.whoosh(0.35, true, 0.12, sfx.panOf(this.pointerX))
          gsap.to(inner, { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.75)', overwrite: 'auto' })
          if (!this.isThrowing) {
            settle()
            setHome(el)
          }
        },
        onThrowComplete() {
          settle()
          setHome(el)
        },
      })
      drags.current.push(d)
    })
    iconEls.current.forEach((el, i) => {
      const vt = velocityTracker()
      const spin = function (this: Draggable) {
        const { vx } = vt.sample(this.x, this.y)
        gsap.set(el, { rotation: `+=${clamp(-18, 18, vx / 120)}` })
      }
      const base = () => iconHomes.current[i]?.scale ?? 1
      const [d] = Draggable.create(el, {
        type: 'x,y',
        inertia: true,
        zIndexBoost: true,
        edgeResistance: 0.7,
        onPress(this: Draggable) {
          vt.reset(this.x, this.y)
          gsap.to(el, { scale: base() * 1.35, duration: 0.3, ease: 'back.out(1.4)', overwrite: 'auto' })
          sfx.pop(1.3, sfx.panOf(this.pointerX))
        },
        onDrag: spin,
        onThrowUpdate: spin,
        onRelease(this: Draggable) {
          sfx.pop(0.9, sfx.panOf(this.pointerX))
          gsap.to(el, { scale: base(), duration: 0.8, ease: 'elastic.out(1, 0.75)', overwrite: 'auto' })
          if (!this.isThrowing) setHome(el)
        },
        onThrowComplete() {
          setHome(el)
        },
      })
      drags.current.push(d)
    })
  }

  useEffect(() => {
    let timer = 0
    let lastW = window.innerWidth
    let lastH = window.innerHeight
    const onResize = () => {
      clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (!drags.current.length || !drags.current[0].enabled()) return
        // keep spots on small changes; re-scatter only when the window really changes shape
        const big = Math.abs(window.innerWidth - lastW) > 120 || Math.abs(window.innerHeight - lastH) > 120
        lastW = window.innerWidth
        lastH = window.innerHeight
        updateBounds()
        if (!big) return
        layout()
        charEls.current.forEach((el, i) => {
          const p = charHomes.current[i]
          home.current.set(el, { x: p.x, y: p.y })
          gsap.to(el, { x: p.x, y: p.y, scale: p.scale, rotation: p.rotation, duration: 0.8, ease: 'power3.inOut' })
        })
        iconEls.current.forEach((el, i) => {
          const p = iconHomes.current[i]
          home.current.set(el, { x: p.x, y: p.y })
          gsap.to(el, { x: p.x, y: p.y, scale: p.scale, duration: 0.8, ease: 'power3.inOut' })
        })
      }, 180)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      clearTimeout(timer)
      stopIdle()
      drags.current.forEach((d) => d.kill())
      drags.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="stage" aria-hidden="true">
      {RAINBOW.slice(0, 5).map((c, i) => (
        <div
          key={`r${i}`}
          className="ring"
          style={{ borderColor: c }}
          ref={(el) => {
            if (el) rings.current[i] = el
          }}
        />
      ))}
      {icons.map((ic, i) => (
        <div
          key={i}
          className="floaty"
          ref={(el) => {
            if (el) iconEls.current[i] = el
          }}
          style={{ width: ic.size, height: ic.size }}
        >
          <div
            className="bob"
            ref={(el) => {
              if (el) iconBob.current[i] = el
            }}
          >
            <Icon name={ic.name} color={ic.color} size="100%" />
          </div>
        </div>
      ))}
      {CHARACTERS.map((c, i) => (
        <div
          key={c.id}
          className="char"
          ref={(el) => {
            if (el) charEls.current[i] = el
          }}
        >
          <div
            className="char-inner"
            ref={(el) => {
              if (el) charInner.current[i] = el
            }}
          >
            <img src={c.src} alt="" draggable={false} />
          </div>
          <span className="char-tag" style={{ background: c.color }}>
            {c.name}
          </span>
        </div>
      ))}
    </div>
  )
})
