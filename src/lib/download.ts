export function downloadCalendar(text: string, name = 'birlikte-ozel-gunler.ics') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
