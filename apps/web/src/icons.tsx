import type { ReactNode } from "react";

/** Stroke-based icon paths (Quiet Ink set), ported from the seed prototype. */
export const I: Record<string, ReactNode> = {
  back: <path d="M15 18l-6-6 6-6" />,
  pause: (
    <>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </>
  ),
  play: <path d="M7 4l13 8-13 8z" />,
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-1" />
    </>
  ),
  erase: (
    <>
      <path d="M3 14l7-7 7 7-4 4H7z" />
      <path d="M9 20h11" />
    </>
  ),
  pencil: (
    <>
      <path d="M12 19l7-7-4-4-7 7v4z" />
      <path d="M16 8l1.5-1.5a2 2 0 0 0-3-3L13 5" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10c.7.7 1 1.4 1 2h6c0-.6.3-1.3 1-2a6 6 0 0 0-4-10z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
    </>
  ),
  moon: <path d="M21 12.8A8 8 0 1 1 11.2 3a6 6 0 0 0 9.8 9.8z" />,
  trophy: (
    <>
      <path d="M6 4h12v3a6 6 0 0 1-12 0z" />
      <path d="M6 5H3v2a4 4 0 0 0 4 4M18 5h3v2a4 4 0 0 1-4 4" />
      <path d="M9 14h6M8 20h8M12 14v6" />
    </>
  ),
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  bolt: <path d="M13 2L3 14h7l-1 8 10-12h-7z" />,
};

export function Svg({ d, w = 18 }: { d: ReactNode; w?: number }): ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      width={w}
      height={w}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {d}
    </svg>
  );
}
