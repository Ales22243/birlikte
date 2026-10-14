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
