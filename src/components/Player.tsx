import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Icon } from '../icons'
import { sfx } from '../sfx'

const fmt = (t: number) => {
  if (!isFinite(t)) return '0:00'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// only one clip plays at a time
const PLAY_EVENT = 'sl-video-play'

export interface PlayerProps {
  src: string
  poster: string
  kind: string
  title: string
  titleJp: string
  artist: string
  artistJp: string
  color: string
}

/** A plain <video> with our own controls: play, scrub, time, mute, fullscreen. */
export function Player({ src, poster, kind, title, titleJp, artist, artistJp, color }: PlayerProps) {
  const frame = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(0)
  const [buf, setBuf] = useState(0)
  const [muted, setMuted] = useState(false)
  const scrubbing = useRef(false)

  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent).detail !== src) video.current?.pause()
    }
    window.addEventListener(PLAY_EVENT, onOther)
    return () => window.removeEventListener(PLAY_EVENT, onOther)
  }, [src])

  const toggle = () => {
    const v = video.current
    if (!v) return
    if (v.paused) {
      window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: src }))
      setStarted(true)
      v.play().catch(() => {})
    } else {
      v.pause()
    }
  }

  const seekTo = (clientX: number) => {
    const v = video.current
    const el = track.current
    if (!v || !el || !dur) return
    const r = el.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    v.currentTime = ratio * dur
    setT(v.currentTime)
  }

  const onTrackDown = (e: React.PointerEvent) => {
    scrubbing.current = true
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    seekTo(e.clientX)
    sfx.tick(1.1)
  }

  const fullscreen = () => {
    const el = frame.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen()
    else el.requestFullscreen?.().catch(() => {})
  }

  const pct = dur ? (t / dur) * 100 : 0

  return (
    <figure className={`player${playing ? ' is-playing' : ''}`} style={{ '--c': color } as CSSProperties}>
      <div className="pl-frame" ref={frame}>
        <video
          ref={video}
          src={src}
          poster={poster}
          preload="metadata"
          playsInline
          onClick={toggle}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
          onTimeUpdate={(e) => !scrubbing.current && setT(e.currentTarget.currentTime)}
          onProgress={(e) => {
            const v = e.currentTarget
            if (v.buffered.length && v.duration) setBuf((v.buffered.end(v.buffered.length - 1) / v.duration) * 100)
          }}
        />
        {!started && (
          <button className="pl-big" onClick={toggle} aria-label={`Play ${kind.toLowerCase()}`}>
            <Icon name="play" color="#fff" size={40} />
          </button>
        )}
        <div className="pl-bar">
          <button className="pl-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
            <Icon name={playing ? 'pause' : 'play'} color="#fff" size={20} />
          </button>
          <span className="pl-time">
            {fmt(t)} <i>/</i> {fmt(dur)}
          </span>
          <div
            className="pl-track"
            ref={track}
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(dur)}
            aria-valuenow={Math.round(t)}
            tabIndex={0}
            onPointerDown={onTrackDown}
            onPointerMove={(e) => scrubbing.current && seekTo(e.clientX)}
            onPointerUp={() => (scrubbing.current = false)}
            onPointerCancel={() => (scrubbing.current = false)}
            onKeyDown={(e) => {
              const v = video.current
              if (!v) return
              if (e.key === 'ArrowRight') v.currentTime = Math.min(dur, v.currentTime + 5)
              if (e.key === 'ArrowLeft') v.currentTime = Math.max(0, v.currentTime - 5)
            }}
          >
            <span className="pl-buf" style={{ width: `${buf}%` }} />
            <span className="pl-fill" style={{ width: `${pct}%` }} />
            <span className="pl-knob" style={{ left: `${pct}%` }} />
          </div>
          <button
            className="pl-btn"
            onClick={() => {
              const v = video.current
              if (!v) return
              v.muted = !v.muted
              setMuted(v.muted)
            }}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            <Icon name={muted ? 'mute' : 'sound'} color="#fff" size={20} />
          </button>
          <button className="pl-btn" onClick={fullscreen} aria-label="Fullscreen">
            <Icon name="expand" color="#fff" size={18} />
          </button>
        </div>
      </div>
      <figcaption className="pl-cap">
        <span className="pl-kind">{kind}</span>
        <span className="pl-song">
          <b lang="ja">{titleJp}</b>
          <span>{title}</span>
        </span>
        <span className="pl-artist">
          <span lang="ja">{artistJp}</span> · {artist}
        </span>
      </figcaption>
    </figure>
  )
}
