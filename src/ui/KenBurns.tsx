import { motion, useReducedMotion } from 'framer-motion'

interface Move {
  from: { scale: number; x: string; y: string }
  to: { scale: number; x: string; y: string }
}

const MOVES: Move[] = [
  { from: { scale: 1, x: '0%', y: '0%' }, to: { scale: 1.16, x: '-2%', y: '-2%' } },
  { from: { scale: 1.16, x: '2%', y: '1%' }, to: { scale: 1, x: '0%', y: '0%' } },
  { from: { scale: 1.12, x: '-4%', y: '0%' }, to: { scale: 1.12, x: '4%', y: '0%' } },
  { from: { scale: 1.12, x: '4%', y: '1%' }, to: { scale: 1.12, x: '-4%', y: '-1%' } },
  { from: { scale: 1.1, x: '0%', y: '3%' }, to: { scale: 1.14, x: '0%', y: '-3%' } },
]

/** Fotoğrafı yavaşça kaydırıp yakınlaştıran tam kaplayan katman. */
export function KenBurns({ src, index, seconds }: { src: string; index: number; seconds: number }) {
  const reduce = useReducedMotion()
  const move = MOVES[index % MOVES.length]
  return (
    <motion.div
      className="kb"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.1, ease: 'easeInOut' }}
    >
      <motion.img
        src={src}
        alt=""
        draggable={false}
        initial={reduce ? false : move.from}
        animate={reduce ? undefined : move.to}
        transition={{ duration: seconds + 1.5, ease: 'linear' }}
      />
    </motion.div>
  )
}

/** Bulanık fotoğraf zemini üzerinde hafif dönerek yerine oturan polaroid kartı. */
export function Polaroid({ src, index, seconds }: { src: string; index: number; seconds: number }) {
  const reduce = useReducedMotion()
  const tilt = index % 2 ? 4 : -4
  return (
    <motion.div className="kb polaroid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.9 }}>
      <img className="polaroid-bg" src={src} alt="" draggable={false} />
      <motion.figure
        className="polaroid-card"
        initial={reduce ? false : { y: '60%', rotate: tilt * 3, scale: 0.8, opacity: 0 }}
        animate={reduce ? undefined : { y: 0, rotate: tilt * 0.6, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 60, damping: 14, mass: 1.2 }}
      >
        <img src={src} alt="" draggable={false} />
        <motion.div
          className="polaroid-sway"
          animate={reduce ? undefined : { rotate: [0, tilt * 0.3, 0] }}
          transition={{ duration: seconds, ease: 'easeInOut' }}
        />
      </motion.figure>
    </motion.div>
  )
}
