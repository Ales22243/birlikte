export interface Ymd {
  years: number
  months: number
  days: number
}

export interface Milestone {
  key: string
  label: string
  kind: 'day' | 'month' | 'year'
  date: Date
  day: number
}

const pad = (n: number) => String(n).padStart(2, '0')

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const utcDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())

/** Takvim günü farkı (saat dilimi/yaz saati kaymasından etkilenmez). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((utcDay(to) - utcDay(from)) / 86_400_000)
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()

/** n ay sonrası; ay sonuna taşarsa ayın son gününe oturur. */
export function addMonths(d: Date, n: number): Date {
  const total = d.getMonth() + n
  const y = d.getFullYear() + Math.floor(total / 12)
  const m = ((total % 12) + 12) % 12
  return new Date(y, m, Math.min(d.getDate(), daysInMonth(y, m)))
}

export function ymd(start: Date, now: Date): Ymd {
  let total = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth()
  if (total < 0) return { years: 0, months: 0, days: 0 }
  if (addMonths(start, total) > now) total -= 1
  return {
    years: Math.floor(total / 12),
    months: total % 12,
    days: daysBetween(addMonths(start, total), now),
  }
}

const DAY_MARKS = [
  50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 5000,
  6000, 7000, 8000, 9000, 10000,
]

export function buildMilestones(start: Date): Milestone[] {
  const list: Milestone[] = []
  for (const n of DAY_MARKS) {
    list.push({ key: `d${n}`, label: `${n}. gün`, kind: 'day', date: addDays(start, n - 1), day: n })
  }
  for (let n = 1; n <= 24; n++) {
    if (n % 12 === 0) continue
    const date = addMonths(start, n)
    list.push({ key: `m${n}`, label: `${n}. ay dönümü`, kind: 'month', date, day: daysBetween(start, date) + 1 })
  }
  for (let n = 1; n <= 25; n++) {
    const date = addMonths(start, n * 12)
    list.push({ key: `y${n}`, label: `${n}. yıl dönümü`, kind: 'year', date, day: daysBetween(start, date) + 1 })
  }
  return list.sort((a, b) => a.date.getTime() - b.date.getTime())
}

export function formatLong(d: Date): string {
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatWeekday(d: Date): string {
  return d.toLocaleDateString('tr-TR', { weekday: 'long' })
}

export function ymdText({ years, months, days }: Ymd): string {
  const parts: string[] = []
  if (years) parts.push(`${years} yıl`)
  if (months) parts.push(`${months} ay`)
  if (days || parts.length === 0) parts.push(`${days} gün`)
  return parts.join(' ')
}
