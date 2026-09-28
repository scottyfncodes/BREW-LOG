import type { JSX } from 'preact';

type P = JSX.SVGAttributes<SVGSVGElement>;
const S = (props: P, children: JSX.Element | JSX.Element[]) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" {...props}>
    {children}
  </svg>
);

export const IconHome = (p: P) => S(p, [<path d="M3 19l5.5-8 3.5 5 2.5-3.5L21 19z" />, <circle cx="17" cy="6" r="1.6" />]);
export const IconBeers = (p: P) => S(p, [<path d="M6 4h9l-1 16H7z" />, <path d="M15 8h2.5a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H14.6" />, <path d="M6.5 8.5h8" />]);
export const IconPlus = (p: P) => S({ 'stroke-width': 2.4, ...p }, [<path d="M12 5v14M5 12h14" />]);
export const IconBrewery = (p: P) => S(p, [<path d="M3 20V10l5-3v3l5-3v3l5-3v13z" />, <path d="M3 20h18" />, <path d="M8 16h2M13 16h2" />]);
export const IconInsights = (p: P) => S(p, [<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />]);
export const IconGear = (p: P) =>
  S(p, [
    <circle cx="12" cy="12" r="3" />,
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />,
  ]);
export const IconSearch = (p: P) => S(p, [<circle cx="11" cy="11" r="7" />, <path d="M20 20l-3.5-3.5" />]);
export const IconFilter = (p: P) => S(p, [<path d="M4 6h16M7 12h10M10 18h4" />]);
export const IconX = (p: P) => S(p, [<path d="M6 6l12 12M18 6L6 18" />]);
export const IconBack = (p: P) => S(p, [<path d="M15 5l-7 7 7 7" />]);
export const IconChevron = (p: P) => S(p, [<path d="M9 5l7 7-7 7" />]);
export const IconPin = (p: P) => S(p, [<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />, <circle cx="12" cy="9.5" r="2.5" />]);
export const IconCalendar = (p: P) => S(p, [<rect x="3.5" y="5" width="17" height="15" rx="2.5" />, <path d="M3.5 10h17M8 3v4M16 3v4" />]);
export const IconCamera = (p: P) => S(p, [<path d="M4 8h3l2-3h6l2 3h3v11H4z" />, <circle cx="12" cy="13" r="3.5" />]);
export const IconEdit = (p: P) => S(p, [<path d="M4 20h4L19 9l-4-4L4 16z" />, <path d="M13.5 6.5l4 4" />]);
export const IconTrash = (p: P) => S(p, [<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />]);
export const IconCheck = (p: P) => S({ 'stroke-width': 2.4, ...p }, [<path d="M5 12.5l4.5 4.5L19 7.5" />]);
export const IconDrop = (p: P) => S(p, [<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />]);
export const IconSpark = (p: P) => S(p, [<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />]);
export const IconPhoto = (p: P) => S(p, [<rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />, <path d="M3.5 16l5-5 4 4 3-3 5 5" />, <circle cx="15.5" cy="8.5" r="1.5" />]);
export const IconMap = (p: P) => S(p, [<path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5z" />, <path d="M9 4v13M15 6.5v13" />]);
export const IconDownload = (p: P) => S(p, [<path d="M12 4v11M7 10.5l5 5 5-5M4 20h16" />]);
export const IconUpload = (p: P) => S(p, [<path d="M12 16V5M7 9.5l5-5 5 5M4 20h16" />]);
export const IconNote = (p: P) => S(p, [<path d="M5 4h10l4 4v12H5z" />, <path d="M15 4v4h4M8 12h8M8 16h5" />]);

/** The BREW LOG mark: a summit with a single glowing beer on top. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="bm-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#2c2a4a" />
          <stop offset=".65" stop-color="#7b4c62" />
          <stop offset="1" stop-color="#f0a765" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#bm-sky)" />
      <path d="M4 52 L22 30 L30 38 L40 20 L60 52 Z" fill="#241b2b" />
      <path d="M40 20 L46 30 L42 29 L39 33 L35 29 Z" fill="#f3e6d6" opacity=".9" />
      <circle cx="40" cy="15" r="3.4" fill="#ffd98a" />
      <path d="M4 52h56v8H4z" fill="#171219" />
    </svg>
  );
}
