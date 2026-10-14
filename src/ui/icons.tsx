import type { ReactNode } from 'react'

const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const make = (children: ReactNode) => () => <svg {...base}>{children}</svg>

export const IconHeart = make(<path d="M12 20.5C5 15.3 3.5 11.8 3.5 9a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 8.5 2c0 2.8-1.5 6.3-8.5 11.5z" />)
export const IconPhotos = make(
  <>
    <rect x="3.5" y="5" width="17" height="14" rx="3" />
    <circle cx="9" cy="10.5" r="1.6" />
    <path d="m4 17 5-4.5 4 3.5 3-2.5 4 3" />
  </>,
)
export const IconStar = make(<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z" />)
export const IconSettings = make(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
  </>,
)
export const IconPlus = make(<path d="M12 5v14M5 12h14" />)
export const IconClose = make(<path d="M6 6l12 12M18 6 6 18" />)
export const IconPlay = make(<path d="M8 5.5v13l11-6.5z" />)
export const IconTrash = make(
  <>
    <path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l.8 12.5h9.4L17.5 7" />
    <path d="M10 11v5M14 11v5" />
  </>,
)
export const IconShare = make(
  <>
    <path d="M12 15V4M8 8l4-4 4 4" />
    <path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" />
  </>,
)
export const IconCheck = make(<path d="m5 12.5 4.5 4.5L19 7.5" />)

export function HeartShape({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 21C4.5 15.6 3 11.9 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 2.900-1.500 6.600-9 12z"
      />
    </svg>
  )
}
