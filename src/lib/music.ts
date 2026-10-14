// Telif sorunu olmasın diye müziği tarayıcıda üretiyoruz: yumuşak bir müzik kutusu melodisi.
const SCALE = [440, 493.88, 554.37, 659.25, 739.99, 880, 987.77] // La majör pentatonik tadında
const PATTERN = [0, 2, 4, 3, 2, 4, 5, 4, 2, 3, 1, 2, 0, 2, 3, 1]
const CHORDS = [
  [220, 277.18, 329.63],
  [185, 220, 277.18],
  [164.81, 207.65, 246.94],
  [196, 246.94, 293.66],
]

export interface Player {
  stop: () => void
}

export function startMusicBox(volume = 0.5): Player {
  const ctx = new AudioContext()
  const master = ctx.createGain()
  master.gain.setValueAtTime(0, ctx.currentTime)
  master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 2)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 3200
  master.connect(lp).connect(ctx.destination)

  const pluck = (f: number, t: number) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'triangle'
    o.frequency.value = f
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.22, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 1.7)
  }
  const pad = (f: number, t: number) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = f
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.07, t + 0.8)
    g.gain.linearRampToValueAtTime(0, t + 3.6)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 3.7)
  }

  const beat = 0.5
  let step = 0
  let next = ctx.currentTime + 0.1
  const timer = setInterval(() => {
    while (next < ctx.currentTime + 1.2) {
      pluck(SCALE[PATTERN[step % PATTERN.length]], next)
      if (step % 4 === 0) CHORDS[(step / 4) % CHORDS.length | 0].forEach((f) => pad(f, next))
      step++
      next += beat
    }
  }, 250)

  return {
    stop() {
      clearInterval(timer)
      master.gain.cancelScheduledValues(ctx.currentTime)
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime)
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6)
      setTimeout(() => void ctx.close(), 800)
    },
  }
}

export function startFile(url: string, volume = 0.6): Player {
  const a = new Audio(url)
  a.loop = true
  a.volume = 0
  void a.play().catch(() => {})
  const t = setInterval(() => {
    a.volume = Math.min(volume, a.volume + 0.05)
    if (a.volume >= volume) clearInterval(t)
  }, 100)
  return {
    stop() {
      clearInterval(t)
      const o = setInterval(() => {
        a.volume = Math.max(0, a.volume - 0.1)
        if (a.volume <= 0) {
          clearInterval(o)
          a.pause()
        }
      }, 60)
    },
  }
}
