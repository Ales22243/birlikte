import { IconHeart, IconPhotos, IconSettings } from './icons'

export type Tab = 'home' | 'photos' | 'settings'

const ITEMS: { id: Tab; label: string; Icon: () => React.JSX.Element }[] = [
  { id: 'home', label: 'Biz', Icon: IconHeart },
  { id: 'photos', label: 'Anılar', Icon: IconPhotos },
  { id: 'settings', label: 'Ayarlar', Icon: IconSettings },
]

export function Nav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="nav" aria-label="Ana gezinme">
      {ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className="nav-item"
          aria-current={tab === id ? 'page' : undefined}
          onClick={() => onChange(id)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
