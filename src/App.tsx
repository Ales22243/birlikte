import { useEffect, useState } from 'react'
import { THEMES, usePrefs } from './data/prefs'
import { useSettings } from './data/settings'
import { PhotosProvider } from './data/photos'
import { Home } from './features/Home'
import { Notes } from './features/Notes'
import { useNotes } from './data/notes'
import { notifyDue } from './lib/notify'
import { toISO } from './lib/time'
import { Photos } from './features/Photos'
import { SettingsPage } from './features/Settings'
import { Setup } from './features/Setup'
import { Nav, type Tab } from './ui/Nav'

export default function App() {
  const settings = useSettings()
  const [tab, setTab] = useState<Tab>('home')
  const { theme } = usePrefs()
  const notes = useNotes()

  useEffect(() => {
    if (notes) void notifyDue(notes.filter((n) => n.date === toISO(new Date())))
  }, [notes])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES.find((t) => t.id === theme)!.bar)
  }, [theme])

  if (!settings) return <Setup />

  return (
    <PhotosProvider>
      <div className="app" data-tab={tab}>
        <main className="view">
          {tab === 'home' && <Home settings={settings} onOpenNotes={() => setTab('notes')} />}
          {tab === 'notes' && <Notes settings={settings} />}
          {tab === 'photos' && <Photos settings={settings} />}
          {tab === 'settings' && <SettingsPage settings={settings} />}
        </main>
        <Nav tab={tab} onChange={setTab} />
      </div>
    </PhotosProvider>
  )
}
