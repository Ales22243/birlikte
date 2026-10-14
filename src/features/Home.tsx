import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, animate, motion, useReducedMotion } from 'framer-motion'
import type { Settings } from '../data/settings'
import { usePrefs } from '../data/prefs'
import { useNotes } from '../data/notes'
import { usePhotos } from '../data/photos'
import { addDays, buildMilestones, daysBetween, parseISO, ymd, ymdText } from '../lib/time'
import { useNow } from '../lib/useNow'
import { Burst, makeBurst, type Particle } from '../ui/Burst'
import { KenBurns } from '../ui/KenBurns'
import { HeartShape, IconBell } from '../ui/icons'

const SLIDE_SECONDS = 7

const fmt = (n: number) => n.toLocaleString('tr-TR')

function useCountUp(target: number): number {
  const reduce = useReducedMotion()
  const [v, setV] = useState(reduce ? target : 0)
  useEffect(() => {
    if (reduce) {
      setV(target)
      return
    }
    const c = animate(0, target, { duration: 2.2, ease: [0.16, 1, 0.3, 1], onUpdate: (x) => setV(Math.round(x)) })
    return () => c.stop()
  }, [target, reduce])
  return v
}

function Elapsed({ start }: { start: Date }) {
  const now = useNow(1000)
  const sec = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 1000))
  return (
    <dl className="elapsed">
      <div>
        <dd>{fmt(Math.floor(sec / 3600))}</dd>
        <dt>saat</dt>
      </div>
      <div>
        <dd>{fmt(Math.floor(sec / 60))}</dd>
        <dt>dakika</dt>
      </div>
      <div>
        <dd>{fmt(sec)}</dd>
        <dt>saniye</dt>
      </div>
    </dl>
  )
}

export function Home({ settings, onOpenNotes }: { settings: Settings; onOpenNotes: () => void }) {
  const photos = usePhotos()
  const { style } = usePrefs()
  const notes = useNotes()
  const now = useNow(60_000)
  const start = useMemo(() => parseISO(settings.start), [settings.start])
  const passed = Math.max(0, daysBetween(start, now))
  const shown = useCountUp(passed)

  const next = useMemo(() => {
    const list = buildMilestones(start)
    const upcoming = list.find((m) => daysBetween(now, m.date) >= 0)
    const prev = [...list].reverse().find((m) => daysBetween(now, m.date) < 0)
    return { upcoming, prev }
  }, [start, now])

  const todayMilestone = next.upcoming && daysBetween(now, next.upcoming.date) === 0 ? next.upcoming : undefined
  const target = todayMilestone ? buildMilestones(start).find((m) => m.date > todayMilestone.date) : next.upcoming
  const left = target ? daysBetween(now, target.date) : 0
  const fromDate = todayMilestone?.date ?? next.prev?.date ?? start
  const span = target ? Math.max(1, daysBetween(fromDate, target.date)) : 1
  const progress = target ? Math.min(1, Math.max(0, 1 - left / span)) : 1

  // Fotoğraf döngüsü
  const order = useMemo(() => {
    if (!photos?.length) return []
    const idx = photos.map((_, i) => i)
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
    return idx
  }, [photos?.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const [cursor, setCursor] = useState(0)
  useEffect(() => {
    if (order.length < 2) return
    const t = setInterval(() => setCursor((c) => c + 1), SLIDE_SECONDS * 1000)
    return () => clearInterval(t)
  }, [order.length])
  const slide = order.length && photos ? photos[order[cursor % order.length]] : undefined

  // Kalp patlaması
  const [parts, setParts] = useState<Particle[]>([])
  const burst = (x: number, y: number, n = 14) => setParts((p) => [...p, ...makeBurst(x, y, n)])
  useEffect(() => {
    if (!todayMilestone) return
    const t = setTimeout(() => {
      for (let i = 0; i < 4; i++) setTimeout(() => burst(innerWidth * (0.2 + i * 0.2), innerHeight * 0.75, 12), i * 350)
    }, 1200)
    return () => clearTimeout(t)
  }, [todayMilestone?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const soon = (notes ?? [])
    .filter((n) => daysBetween(now, parseISO(n.date)) >= 0 && daysBetween(now, parseISO(n.date)) <= 1)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const count = ymd(start, now)
  const dayNo = passed + 1

  return (
    <section className="home">
      <div className="stage" aria-hidden="true">
        {slide ? (
          <AnimatePresence mode="sync">
            <KenBurns key={slide.id} src={slide.url} index={cursor} seconds={SLIDE_SECONDS} />
          </AnimatePresence>
        ) : (
          <div className="aurora">
            <i />
            <i />
            <i />
          </div>
        )}
        <div className="scrim" />
      </div>

      <div className="home-body">
        <header className="pair">
          <span>{settings.a}</span>
          <button
            type="button"
            className="pulse"
            aria-label="Kalp gönder"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              burst(r.left + r.width / 2, r.top + r.height / 2)
            }}
          >
            <HeartShape size={22} />
          </button>
          <span>{settings.b}</span>
        </header>

        <div className={`hero ${style}`}>
          <p className="hero-over">{todayMilestone ? `Bugün ${todayMilestone.label}!` : 'Birlikte'}</p>
          {style === 'kalp' ? (
            <div className="heart-count">
              <svg className="heart-bg" viewBox="-4 -4 108 98" aria-hidden="true">
                <defs>
                  <linearGradient id="hg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="var(--rose)" stopOpacity="0.5" />
                    <stop offset="1" stopColor="var(--lilac)" stopOpacity="0.3" />
                  </linearGradient>
                </defs>
                <path
                  d="M50 86C12 58 0 40 0 24A23 23 0 0 1 50 17 23 23 0 0 1 100 24C100 40 88 58 50 86Z"
                  fill="url(#hg)"
                  stroke="var(--rose)"
                  strokeWidth="1.4"
                />
              </svg>
              <h1 className="hero-num" aria-label={`${passed} gün`}>
                {fmt(shown)}
              </h1>
              <span className="heart-unit">gün</span>
            </div>
          ) : (
            <h1 className="hero-num" aria-label={`${passed} gün`}>
              {fmt(shown)}
            </h1>
          )}
          <p className="hero-under">gündür birlikteyiz</p>
          <p className="hero-sub">
            Bugün {fmt(dayNo)}. günümüz
            {passed >= 28 && <> &middot; {ymdText(count)}</>}
          </p>
        </div>

        <div className="foot">
          {soon.length > 0 && (
            <button type="button" className="reminder" onClick={onOpenNotes}>
              <IconBell />
              <span>
                {soon.slice(0, 2).map((n) => (
                  <span key={n.id} className="reminder-line">
                    <b>{daysBetween(now, parseISO(n.date)) === 0 ? 'Bugün' : 'Yarın'}{n.time && ` ${n.time}`}:</b> {n.title}
                  </span>
                ))}
                {soon.length > 2 && <span className="reminder-line">ve {soon.length - 2} not daha</span>}
              </span>
            </button>
          )}
          <Elapsed start={start} />
          {target && (
            <div className="next">
              <div className="next-row">
                <strong>{target.label}</strong>
                <span>{left === 1 ? 'yarın' : `${fmt(left)} gün kaldı`}</span>
              </div>
              <div className="bar" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${target.label} ilerlemesi`}>
                <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: progress }} transition={{ duration: 1.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }} />
              </div>
              <small>{addDays(target.date, 0).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}</small>
            </div>
          )}
        </div>
      </div>

      <Burst particles={parts} onDone={(id) => setParts((p) => p.filter((x) => x.id !== id))} />
    </section>
  )
}
