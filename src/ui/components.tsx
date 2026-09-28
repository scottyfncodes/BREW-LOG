import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { BeerView, Person } from '../data/types';
import { formatDate, formatScore, hash01 } from '../data/util';
import { styleFamily } from '../data/styles';
import { href } from '../router';
import { usePhoto } from '../store';
import { IconCheck, IconX } from './icons';

/** Photo-less placeholder: a tiny ridge whose tones come from the style family. */
export function StyleGlyph({ style, score }: { style: string; score?: number }) {
  const fam = styleFamily(style);
  const h = hash01(fam);
  const hue = 18 + h * 40; // warm, earthy range
  const peak = 22 - ((score ?? 5) / 10) * 14;
  return (
    <svg class="style-glyph" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" fill={`hsl(${hue} 30% 26%)`} />
      <path d={`M0 64 L0 46 L16 34 L26 40 L38 ${peak} L64 44 L64 64Z`} fill={`hsl(${hue} 25% 16%)`} />
      <path d={`M0 52 Q20 44 32 50 T64 50`} stroke={`hsl(${hue} 60% 70% / .25)`} fill="none" />
      <circle cx="38" cy={peak - 7} r="3" fill={score !== undefined && score >= 9 ? '#ffd98a' : `hsl(${hue} 70% 65%)`} />
    </svg>
  );
}

export function ScoreBadge({ v, people }: { v: BeerView; people: Person[] }) {
  const rated = people.filter((p) => v.scores[p.id] !== undefined);
  return (
    <div class="score-badge">
      <div class={`big ${v.score === 10 ? 'summit' : ''}`}>{formatScore(v.score)}</div>
      {v.shared !== undefined ? (
        <div class="shared-tag">SHARED</div>
      ) : rated.length === 1 ? (
        <div class="who">
          <span class={`p${people.indexOf(rated[0])}`}>{rated[0].name}</span>
        </div>
      ) : v.score !== undefined ? (
        <div class="shared-tag">IMPORTED</div>
      ) : null}
      {rated.length >= 2 && (
        <div class="who">
          {rated.map((p) => (
            <b key={p.id} class={`p${people.indexOf(p)}`} title={p.name}>
              {p.name.charAt(0)} {formatScore(v.scores[p.id])}
            </b>
          ))}
        </div>
      )}
    </div>
  );
}

export function BeerCard({ v, people, showDate = true }: { v: BeerView; people: Person[]; showDate?: boolean }) {
  const photo = usePhoto(v.beer.photoId);
  const b = v.beer;
  const meta2 = [showDate && b.date ? formatDate(b.date, 'short') : '', v.placeLabel].filter(Boolean).join(' · ');
  return (
    <a class="card beer-card" href={href(`beer/${b.id}`)}>
      <div class="thumb">{photo ? <img src={photo} alt="" loading="lazy" decoding="async" /> : <StyleGlyph style={b.style} score={v.score} />}</div>
      <div class="body">
        <div class="title">{b.name}</div>
        <div class="meta">
          {v.breweryName}
          {b.style ? ` · ${b.style}` : ''}
        </div>
        {meta2 && <div class="meta2">{meta2}</div>}
      </div>
      <ScoreBadge v={v} people={people} />
    </a>
  );
}

let toastSetter: ((m: string | undefined) => void) | undefined;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function toast(message: string, ms = 2200) {
  toastSetter?.(message);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastSetter?.(undefined), ms);
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | undefined>();
  useEffect(() => {
    toastSetter = setMsg;
    return () => {
      toastSetter = undefined;
    };
  }, []);
  if (!msg) return null;
  return (
    <div class="toast" role="status" aria-live="polite">
      <IconCheck />
      {msg}
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ComponentChildren }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <>
      <div class="sheet-backdrop" onClick={onClose} />
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div class="grabber" />
        <div class="sheet-head">
          <h2>{title}</h2>
          <button class="icon-btn" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

export function EmptyArt() {
  return (
    <svg class="art" viewBox="0 0 140 90" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">
      <path d="M4 80 L42 38 L60 56 L84 22 L136 80" stroke-linejoin="round" />
      <path d="M30 80 Q50 64 70 72 T110 70" stroke-dasharray="3 4" opacity=".6" />
      <path d="M52 80 Q70 70 88 76" stroke-dasharray="3 4" opacity=".4" />
      <circle cx="84" cy="14" r="3" fill="currentColor" />
      <circle cx="24" cy="18" r="1" fill="currentColor" />
      <circle cx="116" cy="26" r="1" fill="currentColor" />
    </svg>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ComponentChildren; action?: ComponentChildren }) {
  return (
    <div class="empty">
      <EmptyArt />
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function PageHead({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ComponentChildren }) {
  return (
    <div class="page-head">
      <div>
        {eyebrow && <div class="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
      </div>
      {right}
    </div>
  );
}
