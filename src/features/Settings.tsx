import { useState } from 'react'
import { inviteLink, type Settings } from '../data/settings'
import { IconShare } from '../ui/icons'
import { SettingsForm } from './Setup'

export function SettingsPage({ settings }: { settings: Settings }) {
  const [msg, setMsg] = useState('')

  const share = async () => {
    const url = inviteLink(settings)
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Birlikte', text: `${settings.a} ve ${settings.b}: günlerimizi birlikte sayalım`, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setMsg('Bağlantı kopyalandı.')
    } catch {
      setMsg('Bağlantı paylaşılamadı.')
    }
  }

  return (
    <section className="page">
      <header className="page-head">
        <h2>Ayarlar</h2>
      </header>
      <SettingsForm initial={settings} submit="Kaydet" onDone={() => setMsg('Kaydedildi.')} />
      {msg && <p className="note" role="status">{msg}</p>}

      <div className="card">
        <h3>Sevgiline gönder</h3>
        <p className="muted">Bağlantıyı açan kişide adlar ve tarih hazır gelir. Fotoğraflar kişiye özel kalır, paylaşılmaz.</p>
        <button type="button" className="btn ghost" onClick={share}>
          <IconShare />
          Bağlantıyı paylaş
        </button>
      </div>
    </section>
  )
}
