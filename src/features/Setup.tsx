import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { readInvite, saveSettings, type Settings } from '../data/settings'
import { toISO } from '../lib/time'

const today = () => toISO(new Date())

/** Adlar ve başlangıç tarihi; hem ilk kurulum hem Ayarlar için ortak form. */
export function SettingsForm({ initial, submit, onDone }: { initial?: Settings | null; submit: string; onDone?: () => void }) {
  const invite = initial ? {} : readInvite()
  const [a, setA] = useState(initial?.a ?? invite.a ?? '')
  const [b, setB] = useState(initial?.b ?? invite.b ?? '')
  const [start, setStart] = useState(initial?.start ?? invite.start ?? '')
  const [err, setErr] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!a.trim() || !b.trim()) return setErr('İki ismi de yazın.')
    if (!start) return setErr('Başlangıç tarihini seçin.')
    if (start > today()) return setErr('Başlangıç tarihi bugünden sonra olamaz.')
    saveSettings({ a: a.trim(), b: b.trim(), start })
    onDone?.()
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <label className="field">
        <span>Senin adın</span>
        <input value={a} onChange={(e) => setA(e.target.value)} maxLength={24} autoComplete="given-name" />
      </label>
      <label className="field">
        <span>Sevgilinin adı</span>
        <input value={b} onChange={(e) => setB(e.target.value)} maxLength={24} />
      </label>
      <label className="field">
        <span>Sevgili olduğunuz gün</span>
        <input type="date" value={start} max={today()} onChange={(e) => setStart(e.target.value)} />
      </label>
      {err && <p className="err" role="alert">{err}</p>}
      <button type="submit" className="btn big">
        {submit}
      </button>
    </form>
  )
}

export function Setup() {
  return (
    <main className="setup">
      <div className="aurora" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <motion.div className="setup-body" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}>
        <h1 className="setup-title">Hikâyemiz ne zaman başladı?</h1>
        <p className="muted">Günleri bu tarihten başlayarak sayacağız. Sonradan Ayarlar'dan değiştirebilirsiniz.</p>
        <SettingsForm submit="Saymaya başla" />
      </motion.div>
    </main>
  )
}
