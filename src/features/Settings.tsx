import { useRef, useState } from 'react'
import { inviteLink, saveSettings, type Settings } from '../data/settings'
import { exportBackup, importBackup } from '../data/photos'
import { THEMES, savePrefs, usePrefs, type HomeStyle } from '../data/prefs'
import { buildMilestones, daysBetween, parseISO } from '../lib/time'
import { buildCalendar, downloadCalendar } from '../lib/ics'
import { addSongs, deleteSong, useSongs } from '../data/songs'
import { IconShare, IconTrash } from '../ui/icons'
import { SettingsForm } from './Setup'

export function SettingsPage({ settings }: { settings: Settings }) {
  const [msg, setMsg] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const prefs = usePrefs()
  const songs = useSongs()
  const songInput = useRef<HTMLInputElement>(null)

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

  const calendar = () => {
    const now = new Date()
    const list = buildMilestones(parseISO(settings.start)).filter((m) => daysBetween(now, m.date) >= 0 && daysBetween(now, m.date) < 365 * 6)
    downloadCalendar(buildCalendar(settings.a, settings.b, list))
    setMsg(`${list.length} özel gün takvim dosyasına yazıldı. Dosyayı açıp "Takvime ekle"ye dokunun.`)
  }

  return (
    <section className="page">
      <header className="page-head">
        <h2>Ayarlar</h2>
      </header>
      <div className="card wide">
        <h3>Görünüm</h3>
        <div className="swatches" role="radiogroup" aria-label="Tema">
          {THEMES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={prefs.theme === t.id} className="swatch" onClick={() => savePrefs({ theme: t.id })}>
              <i style={{ background: t.bar }} />
              {t.label}
            </button>
          ))}
        </div>
        <div className="seg" role="radiogroup" aria-label="Ana ekran stili">
          {(['kalp', 'klasik'] as HomeStyle[]).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={prefs.style === v} onClick={() => savePrefs({ style: v })}>
              {v === 'kalp' ? 'Kalp sayaç' : 'Büyük sayı'}
            </button>
          ))}
        </div>
      </div>

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

      <div className="card wide">
        <h3>Anı filmi şarkıları</h3>
        <p className="muted">Telefonunuzdaki sevdiğiniz şarkıları seçin; anı filminde sırayla çalar. Şarkılar yalnızca bu telefonda kalır. Hiç şarkı seçmezseniz hazır müzik kutusu melodisi çalar.</p>
        {songs && songs.length > 0 && (
          <ul className="songs">
            {songs.map((x) => (
              <li key={x.id}>
                <span>{x.name}</span>
                <button type="button" className="icon-btn" aria-label={`${x.name} şarkısını kaldır`} onClick={() => deleteSong(x.id)}>
                  <IconTrash />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="row">
          <button type="button" className="btn ghost" onClick={() => songInput.current?.click()}>
            Şarkı ekle
          </button>
        </div>
        <input
          ref={songInput}
          type="file"
          accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg"
          multiple
          hidden
          onChange={async (e) => {
            const n = await addSongs(e.target.files ?? [])
            setMsg(n ? `${n} şarkı eklendi.` : 'Ses dosyası seçilmedi.')
            e.target.value = ''
          }}
        />
      </div>

      <div className="card">
        <h3>Özel gün hatırlatıcıları</h3>
        <p className="muted">100. gün, 4. ay dönümü, yıl dönümü gibi günler telefonunun takvimine eklenir ve o sabah 9'da bildirim gelir. Bir önceki akşam da hatırlatır.</p>
        <button type="button" className="btn ghost" onClick={calendar}>
          Takvim dosyasını indir
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
