import { useRef, useState } from 'react'
import { inviteLink, saveSettings, type Settings } from '../data/settings'
import { exportBackup, importBackup } from '../data/photos'
import { IconShare } from '../ui/icons'
import { SettingsForm } from './Setup'

export function SettingsPage({ settings }: { settings: Settings }) {
  const [msg, setMsg] = useState('')
  const file = useRef<HTMLInputElement>(null)

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

  const backup = async () => {
    try {
      const n = await exportBackup(settings)
      setMsg(`Yedek indirildi (${n} fotoğraf). Dosyayı güvenli bir yere kaydedin.`)
    } catch {
      setMsg('Yedek alınamadı.')
    }
  }

  const restore = async (f: File | undefined) => {
    if (!f) return
    try {
      const { settings: s, count } = await importBackup(f)
      const x = s as Settings | undefined
      if (x?.a && x?.b && x?.start) saveSettings(x)
      setMsg(`${count} fotoğraf geri yüklendi.`)
    } catch {
      setMsg('Bu dosya bir Birlikte yedeği değil.')
    }
    if (file.current) file.current.value = ''
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

      <div className="card">
        <h3>Yedek</h3>
        <p className="muted">Fotoğraflar yalnızca bu telefonda durur. Telefon değiştirirseniz ya da tarayıcı verisini silerseniz kaybolmaması için yedek alın.</p>
        <div className="row">
          <button type="button" className="btn ghost" onClick={backup}>
            Yedek al
          </button>
          <button type="button" className="btn ghost" onClick={() => file.current?.click()}>
            Yedekten geri yükle
          </button>
        </div>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => restore(e.target.files?.[0])} />
      </div>
    </section>
  )
}
