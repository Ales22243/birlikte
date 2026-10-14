import { motion } from 'framer-motion'
import { HeartShape } from './icons'

export interface Particle {
  id: number
  x: number
  y: number
  dx: number
  dy: number
  size: number
  hue: number
  delay: number
}

let counter = 0

/** Verilen noktadan yukarı doğru saçılan kalpler. */
export function makeBurst(x: number, y: number, count = 14): Particle[] {
  return Array.from({ length: count }, () => ({
    id: ++counter,
    x,
    y,
    dx: (Math.random() - 0.5) * 240,
    dy: -(120 + Math.random() * 260),
    size: 14 + Math.random() * 20,
    hue: Math.random() < 0.5 ? 345 : Math.random() < 0.5 ? 320 : 270,
    delay: Math.random() * 0.15,
  }))
}

export function Burst({ particles, onDone }: { particles: Particle[]; onDone: (id: number) => void }) {
  return (
    <div className="burst" aria-hidden="true">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="burst-heart"
          style={{ left: p.x, top: p.y, color: `hsl(${p.hue} 90% 72%)` }}
          initial={{ opacity: 0, scale: 0.3, x: 0, y: 0 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1, 1, 0.8], x: p.dx, y: p.dy, rotate: p.dx / 8 }}
          transition={{ duration: 1.8, delay: p.delay, ease: 'easeOut' }}
          onAnimationComplete={() => onDone(p.id)}
        >
          <HeartShape size={p.size} />
        </motion.span>
      ))}
    </div>
  )
}
