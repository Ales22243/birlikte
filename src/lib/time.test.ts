import { describe, expect, it } from 'vitest'
import { addMonths, buildMilestones, daysBetween, parseISO, ymd, ymdText } from './time'

describe('time', () => {
  it('takvim günü farkını hesaplar', () => {
    expect(daysBetween(parseISO('2024-01-01'), parseISO('2024-01-01'))).toBe(0)
    expect(daysBetween(parseISO('2024-01-01'), parseISO('2024-03-31'))).toBe(90)
    expect(daysBetween(parseISO('2023-03-20'), parseISO('2023-11-05'))).toBe(230)
  })

  it('yıl-ay-gün dökümü', () => {
    expect(ymd(parseISO('2023-01-31'), parseISO('2023-03-01'))).toEqual({ years: 0, months: 1, days: 1 })
    expect(ymd(parseISO('2022-05-10'), parseISO('2024-06-25'))).toEqual({ years: 2, months: 1, days: 15 })
    expect(ymdText({ years: 0, months: 0, days: 0 })).toBe('0 gün')
  })

  it('ay sonuna taşan tarihleri kırpar', () => {
    expect(addMonths(parseISO('2024-01-31'), 1)).toEqual(parseISO('2024-02-29'))
  })

  it('100. gün başlangıç + 99 gündür', () => {
    const m = buildMilestones(parseISO('2024-01-01')).find((x) => x.key === 'd100')!
    expect(m.date).toEqual(parseISO('2024-04-09'))
  })
})
