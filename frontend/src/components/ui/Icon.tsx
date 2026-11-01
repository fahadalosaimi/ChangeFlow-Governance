import type { SVGProps } from 'react'

const paths = {
  workspace: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  changes: 'M4 6h12m-3-3 3 3-3 3 M20 18H8m3-3-3 3 3 3 M4 6v9a3 3 0 0 0 3 3 M20 18V9a3 3 0 0 0-3-3',
  catalog: 'M3 3h6v6H3z M15 15h6v6h-6z M15 3h6v6h-6z M6 9v9h9 M9 6h6',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
  plus: 'M12 5v14 M5 12h14', menu: 'M4 6h16 M4 12h16 M4 18h16', close: 'm6 6 12 12 M18 6 6 18',
  arrow: 'M4 12h16m-6-6 6 6-6 6', chevron: 'm9 5 7 7-7 7',
  sun: 'M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  moon: 'M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10',
  check: 'm5 12 4 4L19 6', alert: 'm12 3 10 18H2L12 3 M12 9v4 M12 17h.01',
  lock: 'M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3',
  info: 'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  logout: 'M9 21H3V3h6 M9 12h12m-4-4 4 4-4 4',
  refresh: 'M20 7a9 9 0 1 0 1 9 M20 2v6h-6',
  eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  eyeOff: 'm3 3 18 18 M10 5a11 11 0 0 1 12 7 18 18 0 0 1-3 4 M6 6a18 18 0 0 0-4 6s3 7 10 7a13 13 0 0 0 5-1 M10 10a3 3 0 0 0 4 4',
  language: 'M3 5h12 M9 3v2 M5 5c1 6 5 8 8 10 M13 5c-1 6-5 8-9 10 M14 21l4-11 4 11 M16 17h4',
  shield: 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4 M8 12l3 3 5-6',
} as const

export type IconName = keyof typeof paths
export function Icon({ name, className = '', ...props }: Omit<SVGProps<SVGSVGElement>, 'name'> & { name: IconName }) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65"
    strokeLinecap="round" strokeLinejoin="round" className={`icon ${className}`} aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>
}
