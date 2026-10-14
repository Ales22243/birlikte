import { useMemo, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Note } from '../data/db'
import type { Settings } from '../data/settings'
import { addNote, deleteNote, updateNote, useNotes, type NoteInput } from '../data/notes'
import { downloadCalendar } from '../lib/download'
import { buildNoteCalendar, buildNotesCalendar } from '../lib/ics'
import { askPermission, canNotify } from '../lib/notify'
import { buildMilestones, daysBetween, formatWeekday, parseISO, toISO } from '../lib/time'
import { useNow } from '../lib/useNow'
import { HeartShape, IconBell, IconEdit, IconPlus, IconTrash } from '../ui/icons'

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const WEEK = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

const blank = (date: string): NoteInput => ({ title: '', text: '', date, time: '' })

function NoteForm({ initial, onSave, onCancel }: { initial: NoteInput; onSave: (n: NoteInput) => void; onCancel: () => void }) {
  const [n, setN] = useState(initial)
  const [err, setErr] = useState('')
  const set = (k: keyof NoteInput) => (e: { target: { value: string } }) => setN({ ...n, [k]: e.target.value })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!n.title.trim()) return setErr('Not için bir başlık yazın.')
    if (!n.date) return setErr('Bir tarih seçin.')
    onSave({ ...n, title: n.title.trim(), text: n.text.trim() })
  }

  return (
    <form className="card wide form" onSubmit={submit} noValidate>
      <label className="field">
        <span>Başlık</span>
        <input value={n.title} maxLength={80} onChange={set('title')} placeholder="Örn. Sena'nın doğum günü" autoFocus />
      </label>
      <label className="field">
        <span>Not</span>
        <textarea value={n.text} rows={3} maxLength={500} onChange={set('text')} placeholder="Unutmamak istediğin ayrıntı" />
      </label>
      <div className="two">
        <label className="field">
          <span>Tarih</span>
          <input type="date" value={n.date} onChange={set('date')} />
        </label>
        <label className="field">
          <span>Saat (isteğe bağlı)</span>
          <input type="time" value={n.time} onChange={set('time')} />
        </label>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row">
        <button type="submit" className="btn">
          Kaydet
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          Vazgeç
        </button>
      </div>
    </form>
  )
}

export function Notes({ settings }: { settings: Settings }) {
  const notes = useNotes()
  const now = useNow(60_000)
  const today = toISO(now)
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const [dir, setDir] = useState(0)
  const [selected, setSelected] = useState(today)
  const [editing, setEditing] = useState<Note | 'new' | null>(null)
  const [msg, setMsg] = useState('')
  const [perm, setPerm] = useState(canNotify() ? Notification.permission : 'denied')
  const [armed, setArmed] = useState<number | null>(null)

  const byDate = useMemo(() => {
    const m = new Map<string, Note[]>()
    for (const n of notes ?? []) m.set(n.date, [...(m.get(n.date) ?? []), n])
    m.forEach((list) => list.sort((a, b) => a.time.localeCompare(b.time)))
    return m
  }, [notes])

  const specials = useMemo(() => {
    const m = new Map<string, string[]>()
    const start = parseISO(settings.start)
    m.set(toISO(start), ['İlk gün'])
    for (const x of buildMilestones(start)) m.set(toISO(x.date), [...(m.get(toISO(x.date)) ?? []), x.label])
    return m
  }, [settings.start])

  const go = (delta: number) => {
    setDir(delta)
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  }
  const goToday = () => {
    const t = new Date()
    setDir(t > month ? 1 : -1)
    setMonth(new Date(t.getFullYear(), t.getMonth(), 1))
    setSelected(toISO(t))
  }

  const cells = useMemo(() => {
    const y = month.getFullYear()
    const m = month.getMonth()
    const lead = (new Date(y, m, 1).getDay() + 6) % 7
    const total = new Date(y, m + 1, 0).getDate()
    const out: (string | null)[] = Array(lead).fill(null)
    for (let d = 1; d <= total; d++) out.push(toISO(new Date(y, m, d)))
    while (out.length % 7) out.push(null)
    return out
  }, [month])

  const upcoming = (notes ?? []).filter((n) => n.date >= today)
  const dayNotes = byDate.get(selected) ?? []
  const daySpecials = specials.get(selected) ?? []
  const selDate = parseISO(selected)
  const diff = daysBetween(now, selDate)

  const save = async (v: NoteInput) => {
    if (editing && editing !== 'new') await updateNote(editing.id, v)
    else await addNote(v)
    setEditing(null)
    setSelected(v.date)
    const d = parseISO(v.date)
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1))
    setMsg('Not kaydedildi. Telefonda bildirim almak için notun yanındaki zil düğmesine dokunun.')
  }

  const remind = (n: Note) => {
    downloadCalendar(buildNoteCalendar(n), `birlikte-not-${n.id}.ics`)
    setMsg('Takvim dosyası indirildi. Açıp "Takvime ekle"ye dokunun; telefon o gün ve saatte bildirim gösterir.')
  }
  const remindAll = () => {
    downloadCalendar(buildNotesCalendar(upcoming), 'birlikte-notlar.ics')
    setMsg(`${upcoming.length} not takvim dosyasına yazıldı. Dosyayı açıp "Tümünü ekle"ye dokunun.`)
  }

  const when = diff === 0 ? 'Bugün' : diff === 1 ? 'Yarın' : diff === -1 ? 'Dün' : diff > 1 ? `${diff} gün sonra` : `${-diff} gün önce`

  return (
    <section className="page cal-page">
      <header className="cal-head">
        <button type="button" className="cal-year" onClick={() => go(-12)} aria-label={`${month.getFullYear() - 1} yılına git`}>
          <span aria-hidden="true">‹</span> {month.getFullYear()}
        </button>
        <div className="row">
          <button type="button" className="cal-today" onClick={goToday}>
            Bugün
          </button>
          <button type="button" className="cal-add" onClick={() => setEditing('new')} aria-label={`${selDate.getDate()} ${MONTHS[selDate.getMonth()]} için not ekle`}>
            <IconPlus />
          </button>
        </div>
      </header>

      <div className="cal-title">
        <button type="button" className="cal-nav" onClick={() => go(-1)} aria-label="Önceki ay">
          ‹
        </button>
        <h2>{MONTHS[month.getMonth()]}</h2>
        <button type="button" className="cal-nav" onClick={() => go(1)} aria-label="Sonraki ay">
          ›
        </button>
      </div>

      <div className="cal-week" aria-hidden="true">
        {WEEK.map((w, i) => (
          <span key={w} className={i > 4 ? 'weekend' : undefined}>
            {w}
          </span>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${month.getFullYear()}-${month.getMonth()}`}
          className="cal-grid"
          role="grid"
          aria-label={`${MONTHS[month.getMonth()]} ${month.getFullYear()}`}
          initial={{ opacity: 0, x: dir * 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -40 }}
          transition={{ duration: 0.18 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.25}
          onDragEnd={(_, i) => {
            if (i.offset.x < -70) go(1)
            else if (i.offset.x > 70) go(-1)
          }}
        >
          {cells.map((iso, i) => {
            if (!iso) return <span key={`b${i}`} className="cal-cell blank" />
            const list = byDate.get(iso)
            const sp = specials.get(iso)
            const d = parseISO(iso)
            const cls = ['cal-cell']
            if (iso === today) cls.push('is-today')
            if (iso === selected) cls.push('is-selected')
            if ((d.getDay() + 6) % 7 > 4) cls.push('weekend')
            const label = `${d.getDate()} ${MONTHS[d.getMonth()]}${list ? `, ${list.length} not` : ''}${sp ? `, ${sp.join(', ')}` : ''}`
            return (
              <button key={iso} type="button" role="gridcell" className={cls.join(' ')} aria-label={label} aria-pressed={iso === selected} onClick={() => setSelected(iso)}>
                <span className="num">{d.getDate()}</span>
                <span className="marks" aria-hidden="true">
                  {sp && <HeartShape size={9} />}
                  {list?.slice(0, 3).map((n) => <i key={n.id} />)}
                </span>
              </button>
            )
          })}
        </motion.div>
      </AnimatePresence>

      <div className="agenda">
        <div className="agenda-head">
          <h3>
            {formatWeekday(selDate)}, {selDate.getDate()} {MONTHS[selDate.getMonth()]}
          </h3>
          <span>{when}</span>
        </div>

        {editing ? (
          <NoteForm
            key={editing === 'new' ? `new-${selected}` : editing.id}
            initial={editing === 'new' ? blank(selected) : { title: editing.title, text: editing.text, date: editing.date, time: editing.time }}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <ul className="agenda-list">
            {daySpecials.map((s) => (
              <li key={s} className="ag special">
                <span className="ag-time">
                  <HeartShape size={16} />
                </span>
                <div className="ag-body">
                  <strong>{s}</strong>
                  <small>
                    {settings.a} &amp; {settings.b}
                  </small>
                </div>
              </li>
            ))}
            {dayNotes.map((n) => (
              <li key={n.id} className="ag">
                <span className="ag-time">{n.time || 'Tüm gün'}</span>
                <div className="ag-body">
                  <strong>{n.title}</strong>
                  {n.text && <p>{n.text}</p>}
                </div>
                <div className="ag-act">
                  {n.date >= today && (
                    <button type="button" className="icon-btn flat" aria-label={`${n.title} için hatırlatıcı ekle`} onClick={() => remind(n)}>
                      <IconBell />
                    </button>
                  )}
                  <button type="button" className="icon-btn flat" aria-label={`${n.title} notunu düzenle`} onClick={() => setEditing(n)}>
                    <IconEdit />
                  </button>
                  <button
                    type="button"
                    className={`icon-btn flat${armed === n.id ? ' danger' : ''}`}
                    aria-label={armed === n.id ? `${n.title} notunu silmek için tekrar dokun` : `${n.title} notunu sil`}
                    onClick={() => (armed === n.id ? deleteNote(n.id) : setArmed(n.id))}
                  >
                    <IconTrash />
                  </button>
                </div>
              </li>
            ))}
            {dayNotes.length === 0 && daySpecials.length === 0 && (
              <li className="ag-empty">
                <p className="muted">Bu gün için not yok.</p>
                <button type="button" className="btn ghost" onClick={() => setEditing('new')}>
                  <IconPlus />
                  Not ekle
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      {msg && <p className="note" role="status">{msg}</p>}

      {upcoming.length > 0 && (
        <button type="button" className="btn ghost wide" onClick={remindAll}>
          <IconBell />
          Tüm notları iPhone takvimine ekle
        </button>
      )}

      {canNotify() && perm === 'default' && (
        <div className="card">
          <h3>Uygulama bildirimi</h3>
          <p className="muted">İzin verirseniz, uygulamayı açtığınızda o günün notları telefon bildirimi olarak da gelir. Kapalıyken bildirim için notun yanındaki zil düğmesiyle takvime ekleyin.</p>
          <button type="button" className="btn ghost" onClick={async () => setPerm(await askPermission())}>
            Bildirimlere izin ver
          </button>
        </div>
      )}
    </section>
  )
}
