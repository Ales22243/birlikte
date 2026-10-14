import { useState, type FormEvent } from 'react'
import type { Note } from '../data/db'
import { addNote, deleteNote, updateNote, useNotes, type NoteInput } from '../data/notes'
import { buildNoteCalendar, downloadCalendar } from '../lib/ics'
import { askPermission, canNotify } from '../lib/notify'
import { daysBetween, formatLong, formatWeekday, parseISO, toISO } from '../lib/time'
import { useNow } from '../lib/useNow'
import { IconBell, IconEdit, IconPlus, IconTrash } from '../ui/icons'

const EMPTY = (): NoteInput => ({ title: '', text: '', date: toISO(new Date()), time: '' })

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
        <input value={n.title} maxLength={80} onChange={set('title')} placeholder="Örn. Sena'nın doğum günü" />
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

function when(left: number) {
  if (left === 0) return 'Bugün'
  if (left === 1) return 'Yarın'
  if (left > 1) return `${left} gün kaldı`
  return `${-left} gün önce`
}

export function Notes() {
  const notes = useNotes()
  const now = useNow(60_000)
  const [editing, setEditing] = useState<Note | 'new' | null>(null)
  const [msg, setMsg] = useState('')
  const [perm, setPerm] = useState(canNotify() ? Notification.permission : 'denied')
  const [armed, setArmed] = useState<number | null>(null)

  const left = (n: Note) => daysBetween(now, parseISO(n.date))
  const upcoming = notes?.filter((n) => left(n) >= 0).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)) ?? []
  const past = notes?.filter((n) => left(n) < 0).reverse() ?? []

  const save = async (v: NoteInput) => {
    if (editing && editing !== 'new') await updateNote(editing.id, v)
    else await addNote(v)
    setEditing(null)
    setMsg('Not kaydedildi. Telefonda bildirim almak için notun yanındaki zil düğmesine dokunun.')
  }

  const remind = (n: Note) => {
    downloadCalendar(buildNoteCalendar(n), `birlikte-not-${n.id}.ics`)
    setMsg('Takvim dosyası indirildi. Açıp "Takvime ekle"ye dokunun; telefon o gün ve saatte bildirim gösterir.')
  }

  const row = (n: Note, isPast = false) => (
    <li key={n.id} className={`note-row${left(n) === 0 ? ' today' : ''}`}>
      <div className="note-main">
        <strong>{n.title}</strong>
        {n.text && <p>{n.text}</p>}
        <small>
          {formatLong(parseISO(n.date))}, {formatWeekday(parseISO(n.date))}
          {n.time && ` · ${n.time}`}
        </small>
      </div>
      <div className="note-side">
        <b>{when(left(n))}</b>
        <div className="row">
          {!isPast && (
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
      </div>
    </li>
  )

  return (
    <section className="page">
      <header className="page-head">
        <h2>Notlarımız</h2>
        {!editing && (
          <button type="button" className="btn" onClick={() => setEditing('new')}>
            <IconPlus />
            Not ekle
          </button>
        )}
      </header>

      {editing && (
        <NoteForm
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? EMPTY() : { title: editing.title, text: editing.text, date: editing.date, time: editing.time }}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}

      {msg && <p className="note" role="status">{msg}</p>}

      {canNotify() && perm === 'default' && (
        <div className="card">
          <h3>Uygulama bildirimi</h3>
          <p className="muted">İzin verirseniz, uygulamayı açtığınızda o günün notları telefon bildirimi olarak da gelir. Kapalıyken bildirim için notun yanındaki zil düğmesiyle takvime ekleyin.</p>
          <button type="button" className="btn ghost" onClick={async () => setPerm(await askPermission())}>
            Bildirimlere izin ver
          </button>
        </div>
      )}

      {notes && notes.length === 0 && !editing && (
        <div className="empty">
          <IconBell />
          <p>Henüz not yok.</p>
          <p className="muted">Doğum günü, buluşma ya da bir sürpriz: tarihini yazın, zamanı gelince hatırlatalım.</p>
        </div>
      )}

      {upcoming.length > 0 && <ul className="notes">{upcoming.map((n) => row(n))}</ul>}

      {past.length > 0 && (
        <>
          <h3 className="sub">Geçen notlar</h3>
          <ul className="notes past">{past.map((n) => row(n, true))}</ul>
        </>
      )}
    </section>
  )
}
