import type { Milestone } from './time.ts'
import { toISO } from './time.ts'

const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`)
const ymd8 = (d: Date) => toISO(d).replaceAll('-', '')

/** Önümüzdeki özel günleri, o gün sabah 09:00 ve bir gün önce akşam 18:00 hatırlatmalı takvim dosyası. */
export function buildCalendar(a: string, b: string, list: Milestone[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const lines: string[] = []
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
  return wrapCalendar(lines, 'Birlikte özel günler')
}

interface NoteLike {
  id: number
  title: string
  text: string
  date: string
  time: string
}

function noteEvent(n: NoteLike): string[] {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const day = n.date.replaceAll('-', '')
  const timed = /^\d{2}:\d{2}$/.test(n.time)
  const lines = ['BEGIN:VEVENT', `UID:not${n.id}-${day}@birlikte`, `DTSTAMP:${stamp}`]
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
  lines.push('END:VEVENT')
  return lines
}

const wrap = (events: string[]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Birlikte//TR', 'X-WR-CALNAME:Birlikte notları', ...events, 'END:VCALENDAR'].join('\r\n')

/** Tek not: saat varsa tam saatinde ve 1 saat önce, yoksa o sabah 9'da ve önceki akşam 18:00'de hatırlatır. */
export const buildNoteCalendar = (n: NoteLike) => wrap(noteEvent(n))
export const buildNotesCalendar = (list: NoteLike[]) => wrap(list.flatMap(noteEvent))

/** Özel günler için sabit takvim; yayına derleme sırasında yazılır, iPhone'a abonelik olarak eklenir. */
export const wrapCalendar = (events: string[], name: string) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Birlikte//TR', `X-WR-CALNAME:${name}`, ...events, 'END:VCALENDAR'].join('\r\n')
