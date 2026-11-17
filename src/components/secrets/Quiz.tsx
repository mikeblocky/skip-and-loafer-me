import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { BIRTHDAYS } from '../../data'
import { sfx } from '../../sfx'
import { secrets } from '../../secrets'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const ROUNDS = 5

const shuffle = <T,>(a: T[]) => {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

/** Five rounds: a date from the birthday dial, four names, pick whose birthday it is. */
function makeRounds() {
  return shuffle(BIRTHDAYS)
    .slice(0, ROUNDS)
    .map((answer) => ({ answer, options: shuffle([answer, ...shuffle(BIRTHDAYS.filter((b) => b !== answer)).slice(0, 3)]) }))
}

export function Quiz() {
  const [rounds, setRounds] = useState(makeRounds)
  const [n, setN] = useState(0)
  const [right, setRight] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [best, setBest] = useState(secrets.get().quizBest)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  const done = n >= ROUNDS
  const r = rounds[Math.min(n, ROUNDS - 1)]

  const answer = (name: string) => {
    if (picked) return
    setPicked(name)
    const ok = name === r.answer.name
    if (ok) {
      sfx.chime(1 + n * 0.06, 0.7)
      setRight((x) => x + 1)
    } else sfx.thud()
    timer.current = window.setTimeout(() => {
      setPicked(null)
      const next = n + 1
      setN(next)
      if (next >= ROUNDS) {
        const final = right + (ok ? 1 : 0)
        if (final > secrets.get().quizBest) {
          secrets.update((st) => ({ ...st, quizBest: final }))
          setBest(final)
        }
        if (final === ROUNDS) sfx.jingle(0.7)
      }
    }, 950)
  }

  const again = () => {
    setRounds(makeRounds())
    setN(0)
    setRight(0)
    setPicked(null)
    sfx.click(1.1)
  }

  if (done)
    return (
      <div className="quiz">
        <p className="quiz-score">
          <b>
            {right}/{ROUNDS}
          </b>
          {right === ROUNDS ? 'perfect! you never miss a birthday.' : right >= 3 ? 'nice! almost a walking calendar.' : 'the dial on the birthdays page can help…'}
        </p>
        <button className="sx-btn is-strong" onClick={again}>
          play again
        </button>
        <p className="sx-note">best: {Math.max(best, right)}/{ROUNDS}</p>
      </div>
    )

  return (
    <div className="quiz">
      <div className="quiz-progress" aria-label={`Question ${n + 1} of ${ROUNDS}`}>
        {Array.from({ length: ROUNDS }, (_, i) => (
          <i key={i} className={i < n ? 'is-done' : i === n ? 'is-now' : ''} />
        ))}
      </div>
      <p className="quiz-q">
        whose birthday is <b>{`${MONTHS[r.answer.m - 1]} ${r.answer.d}`}</b>?
      </p>
      <div className="quiz-opts">
        {r.options.map((o) => {
          const state = picked ? (o.name === r.answer.name ? ' is-right' : o.name === picked ? ' is-wrong' : ' is-dim') : ''
          return (
            <button key={o.name} className={`quiz-opt${state}`} onClick={() => answer(o.name)} disabled={!!picked} style={{ '--c': o.color } as CSSProperties}>
              {o.name}
            </button>
          )
        })}
      </div>
      <p className="sx-note">
        {right} right so far · best {best}/{ROUNDS}
      </p>
    </div>
  )
}
