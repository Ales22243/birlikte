import type { Milestone } from './time'
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

export function downloadCalendar(text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }))
  a.download = 'birlikte-ozel-gunler.ics'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
