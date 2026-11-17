import { useEffect, useState } from 'react'
import { RAINBOW } from './data'
import { VOLUMES, VOL_COLORS } from './volumes'

let cache: string[] | null = null
let pending: Promise<string[]> | null = null

function rgbToHsv(r: number, g: number, b: number) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max ? d / max : 0, v: max / 255 }
}

function hsl(h: number, s: number, l: number) {
  return `hsl(${h.toFixed(0)} ${(s * 100).toFixed(0)}% ${(l * 100).toFixed(0)}%)`
}

/** Picks the boldest recurring hue on a cover and pushes it toward a punchy spine color. */
function dominant(img: HTMLImageElement): string | null {
  const w = 40
  const h = 58
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  const buckets = Array.from({ length: 18 }, () => ({ wt: 0, h: 0, s: 0 }))
  for (let i = 0; i < data.length; i += 4) {
    const p = rgbToHsv(data[i], data[i + 1], data[i + 2])
    if (p.s < 0.32 || p.v < 0.42) continue
    // skin tones are everywhere on these covers; let them count less
    const skin = p.h > 10 && p.h < 40 && p.s < 0.55 ? 0.25 : 1
    const b = buckets[Math.floor(p.h / 20) % 18]
    const wt = p.s * p.s * skin
    b.wt += wt
    b.h += p.h * wt
    b.s += p.s * wt
  }
  const best = buckets.reduce((a, b) => (b.wt > a.wt ? b : a))
  if (best.wt < 0.5) return null
  let hue = best.h / best.wt
  if (hue > 40 && hue < 80) hue = 36
  const sat = Math.max(0.86, Math.min(0.98, (best.s / best.wt) * 1.3))
  const light = hue > 30 && hue < 45 ? 0.5 : hue > 150 && hue < 210 ? 0.4 : 0.52
  return hsl(hue, sat, light)
}

const fallback = (i: number) => VOL_COLORS[VOLUMES[i].n] ?? RAINBOW[i % RAINBOW.length]

function load(): Promise<string[]> {
  if (pending) return pending
  pending = Promise.all(
    VOLUMES.map(
      (v, i) =>
        new Promise<string>((res) => {
          if (VOL_COLORS[v.n] || !v.src) return res(fallback(i))
          const img = new Image()
          img.onload = () => res(dominant(img) ?? fallback(i))
          img.onerror = () => res(fallback(i))
          img.src = v.src
        }),
    ),
  ).then((c) => (cache = c))
  return pending
}

export function useCoverColors() {
  const [colors, set] = useState<string[]>(() => cache ?? VOLUMES.map((_, i) => fallback(i)))
  useEffect(() => {
    if (cache) return
    let live = true
    load().then((c) => live && set(c))
    return () => {
      live = false
    }
  }, [])
  return colors
}

export function preloadCovers() {
  return load()
}
