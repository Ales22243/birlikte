import type { Milestone } from './time'
import type { Note } from '../data/db'
import { toISO } from './time'

const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`)
const ymd8 = (d: Date) => toISO(d).replaceAll('-', '')

/** Önümüzdeki özel günleri, o gün sabah 09:00 ve bir gün önce akşam 18:00 hatırlatmalı takvim dosyası. */
export function buildCalendar(a: string, b: string, list: Milestone[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Birlikte//TR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Birlikte']
  for (const m of list) {
    const next = new Date(m.date.getFullYear(), m.date.getMonth(), m.date.getDate() + 1)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${m.key}-${ymd8(m.date)}@birlikte`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd8(m.date)}`,
      `DTEND;VALUE=DATE:${ymd8(next)}`,
      `SUMMARY:${esc(`${m.label} - ${a} & ${b}`)}`,
      `DESCRIPTION:${esc(`Bugün ${m.label}! Birlikte ${m.day}. günümüz.`)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(`Bugün ${m.label}`)}`,
      'TRIGGER;RELATED=START:PT9H',
      'END:VALARM',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(`Yarın ${m.label}`)}`,
      'TRIGGER;RELATED=START:-PT6H',
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadCalendar(text: string, name = 'birlikte-ozel-gunler.ics') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

/** Tek bir not için takvim dosyası: saat varsa tam saatinde ve 1 saat önce, yoksa o sabah 9'da ve önceki akşam 18:00'de hatırlatır. */
export function buildNoteCalendar(n: Pick<Note, 'id' | 'title' | 'text' | 'date' | 'time'>): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const day = n.date.replaceAll('-', '')
  const timed = /^\d{2}:\d{2}$/.test(n.time)
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Birlikte//TR', 'BEGIN:VEVENT', `UID:not${n.id}-${day}@birlikte`, `DTSTAMP:${stamp}`]
  if (timed) {
    lines.push(`DTSTART:${day}T${n.time.replace(':', '')}00`, 'DURATION:PT30M')
  } else {
    const d = new Date(Number(n.date.slice(0, 4)), Number(n.date.slice(5, 7)) - 1, Number(n.date.slice(8, 10)) + 1)
    lines.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${ymd8(d)}`, 'TRANSP:TRANSPARENT')
  }
  lines.push(`SUMMARY:${esc(n.title)}`)
  if (n.text) lines.push(`DESCRIPTION:${esc(n.text.replace(/\s+/g, ' '))}`)
  const alarm = (trigger: string, text: string) =>
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(text)}`, `TRIGGER;RELATED=START:${trigger}`, 'END:VALARM')
  if (timed) {
    alarm('PT0S', n.title)
    alarm('-PT1H', `1 saat sonra: ${n.title}`)
  } else {
    alarm('PT9H', n.title)
    alarm('-PT6H', `Yarın: ${n.title}`)
  }
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}
