import { useMemo, useState } from 'react'
import type { Settings } from '../data/settings'
import { buildMilestones, daysBetween, formatLong, formatWeekday, parseISO } from '../lib/time'
import { useNow } from '../lib/useNow'
import { IconCheck } from '../ui/icons'

const fmt = (n: number) => n.toLocaleString('tr-TR')

export function Days({ settings }: { settings: Settings }) {
  const now = useNow(60_000)
  const [more, setMore] = useState(false)
  const [past, setPast] = useState(false)
  const all = useMemo(() => buildMilestones(parseISO(settings.start)), [settings.start])

  const upcoming = all.filter((m) => daysBetween(now, m.date) >= 0)
  const done = all.filter((m) => daysBetween(now, m.date) < 0).reverse()
  const visible = more ? upcoming : upcoming.slice(0, 6)

  return (
    <section className="page">
      <header className="page-head">
        <h2>Özel günlerimiz</h2>
      </header>

      <ol className="days">
        {visible.map((m, i) => {
          const left = daysBetween(now, m.date)
          return (
            <li key={m.key} className={`day ${m.kind}${i === 0 ? ' first' : ''}`}>
              <div className="day-main">
                <strong>{m.label}</strong>
                <span>
                  {formatLong(m.date)}, {formatWeekday(m.date)}
                </span>
              </div>
              <div className="day-left">
                {left === 0 ? <b>Bugün</b> : left === 1 ? <b>Yarın</b> : <><b>{fmt(left)}</b> gün</>}
              </div>
            </li>
          )
        })}
      </ol>
      {upcoming.length > 6 && (
        <button type="button" className="btn ghost wide" onClick={() => setMore((v) => !v)}>
          {more ? 'Daha az göster' : 'Daha fazla göster'}
        </button>
      )}

      {done.length > 0 && (
        <>
          <button type="button" className="btn ghost wide" aria-expanded={past} onClick={() => setPast((v) => !v)}>
            {past ? 'Geçenleri gizle' : `Geçen ${done.length} özel gün`}
          </button>
          {past && (
            <ol className="days passed">
              {done.map((m) => (
                <li key={m.key} className="day">
                  <div className="day-main">
                    <strong>{m.label}</strong>
                    <span>{formatLong(m.date)}</span>
                  </div>
                  <IconCheck />
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  )
}
