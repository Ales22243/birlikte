import type { Note } from '../data/db'

const KEY = 'birlikte:notified'

export const canNotify = () => typeof Notification !== 'undefined'

export async function askPermission(): Promise<NotificationPermission> {
  return canNotify() ? Notification.requestPermission() : 'denied'
}

/** Bugüne ait notlar için (günde bir kez) telefon bildirimi gösterir. İzin verilmemişse hiçbir şey yapmaz. */
export async function notifyDue(todays: Note[]) {
  if (!canNotify() || Notification.permission !== 'granted' || !todays.length) return
  let seen: string[] = []
  try {
    seen = JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    // bozuk kayıt: sıfırdan başla
  }
  const fresh = todays.filter((n) => !seen.includes(`${n.id}-${n.date}`))
  if (!fresh.length) return
  const reg = await navigator.serviceWorker?.ready.catch(() => undefined)
  for (const n of fresh) {
    const opts: NotificationOptions = {
      body: n.text || (n.time ? `Bugün saat ${n.time}` : 'Bugün'),
      icon: `${import.meta.env.BASE_URL}icon-192.png`,
      tag: `not-${n.id}`,
    }
    if (reg) await reg.showNotification(n.title, opts)
    else new Notification(n.title, opts)
  }
  try {
    localStorage.setItem(KEY, JSON.stringify([...seen, ...fresh.map((n) => `${n.id}-${n.date}`)].slice(-200)))
  } catch {
    // depolama kapalıysa her açılışta tekrar gösterebilir
  }
}
