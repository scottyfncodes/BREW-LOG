import { useRef, useState } from 'preact/hooks';
import { clampScore, formatScore, SCORE_MAX, SCORE_MIN } from '../data/util';
import { IconX } from './icons';

interface Props {
  label: string;
  colorVar: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  id: string;
}

const W = 1000; // viewBox width; scaled to the element

function toX(v: number) {
  return ((v - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * W;
}

function buzz() {
  try {
    navigator.vibrate?.(4);
  } catch {
    /* unsupported */
  }
}

/**
 * A tactile 1.0–10.0 rating ruler. Drag or tap anywhere on the track;
 * fine-tune with − / + (0.1). Starts unrated until touched.
 */
export function ScoreControl({ label, colorVar, value, onChange, id }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const lastWhole = useRef<number | undefined>(undefined);

  const fromEvent = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect();
    const pad = 14;
    const t = Math.min(1, Math.max(0, (clientX - rect.left - pad) / (rect.width - pad * 2)));
    return clampScore(SCORE_MIN + t * (SCORE_MAX - SCORE_MIN));
  };

  const set = (v: number) => {
    const whole = Math.floor(v);
    if (lastWhole.current !== undefined && whole !== lastWhole.current) buzz();
    lastWhole.current = whole;
    onChange(v);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    lastWhole.current = value === undefined ? undefined : Math.floor(value);
    set(fromEvent(e.clientX));
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    set(fromEvent(e.clientX));
  };
  const end = () => setDragging(false);

  const onKey = (e: KeyboardEvent) => {
    const cur = value ?? 7;
    let next: number | undefined;
    const big = e.shiftKey ? 1 : 0.1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = cur + big;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = cur - big;
    else if (e.key === 'PageUp') next = cur + 1;
    else if (e.key === 'PageDown') next = cur - 1;
    else if (e.key === 'Home') next = SCORE_MIN;
    else if (e.key === 'End') next = SCORE_MAX;
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onChange(undefined);
      return;
    }
    if (next !== undefined) {
      e.preventDefault();
      // First key press on an unrated score starts at 7.0, except Home/End which jump.
      onChange(clampScore(value === undefined && e.key !== 'Home' && e.key !== 'End' ? 7 : next));
    }
  };

  const nudge = (d: number) => {
    buzz();
    onChange(clampScore((value ?? 7) + d));
  };

  const active = value !== undefined;
  const ten = value === 10;
  const x = active ? toX(value!) : 0;

  return (
    <div class={`score-row ${active ? 'active' : ''}`} style={{ '--pc': `var(${colorVar})` }}>
      <div class="score-head">
        <div class="score-name">
          <span class="dot" />
          <span id={`${id}-label`}>{label}</span>
          {ten && <span class="score-ten-note">Summit</span>}
        </div>
        <div class="score-actions">
          {active && (
            <>
              <button type="button" class="nudge" aria-label={`Lower ${label}'s score by 0.1`} onClick={() => nudge(-0.1)}>
                −
              </button>
              <button type="button" class="nudge" aria-label={`Raise ${label}'s score by 0.1`} onClick={() => nudge(0.1)}>
                +
              </button>
            </>
          )}
          <div class={`score-value ${active ? '' : 'is-empty'} ${ten ? 'ten' : ''}`} aria-hidden="true">
            {active ? formatScore(value) : 'Not rated'}
          </div>
          {active && (
            <button type="button" class="nudge" aria-label={`Clear ${label}'s score`} onClick={() => onChange(undefined)}>
              <IconX width={16} height={16} />
            </button>
          )}
        </div>
      </div>
      <div
        ref={track}
        class={`score-track ${active ? '' : 'idle'}`}
        style={{ touchAction: 'pan-y' }}
        role="slider"
        tabIndex={0}
        aria-labelledby={`${id}-label`}
        aria-valuemin={SCORE_MIN}
        aria-valuemax={SCORE_MAX}
        aria-valuenow={value}
        aria-valuetext={active ? `${formatScore(value)} out of 10` : 'Not rated'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={onKey}
      >
        <svg
          viewBox={`0 0 ${W} 58`}
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ left: '14px', right: '14px', width: 'calc(100% - 28px)' }}
        >
          <rect class="fill" x={0} y={6} width={x} height={30} rx={8} />
          <g class="ticks">
            {Array.from({ length: 91 }, (_, i) => {
              const v = 1 + i * 0.1;
              const tx = toX(v);
              const major = i % 10 === 0;
              const half = i % 5 === 0;
              return (
                <line
                  key={i}
                  class={major ? 'major' : ''}
                  x1={tx}
                  x2={tx}
                  y1={major ? 8 : half ? 16 : 24}
                  y2={34}
                  vector-effect="non-scaling-stroke"
                />
              );
            })}
          </g>
        </svg>
        {/* Labels in HTML so they aren't stretched by preserveAspectRatio. */}
        <div style={{ position: 'absolute', left: '14px', right: '14px', bottom: '2px', height: '14px' }} aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: `${(i / 9) * 100}%`,
                transform: 'translateX(-50%)',
                fontFamily: 'var(--mono)',
                fontSize: '10px',
                color: 'var(--ink-3)',
              }}
            >
              {i + 1}
            </span>
          ))}
        </div>
        {active && (
          <div
            class="thumb"
            style={{
              position: 'absolute',
              top: '3px',
              left: `calc(14px + (100% - 28px) * ${(value! - 1) / 9})`,
              width: '4px',
              height: '36px',
              marginLeft: '-2px',
              borderRadius: '2px',
              background: `var(${colorVar})`,
              boxShadow: dragging ? `0 0 0 6px color-mix(in srgb, var(${colorVar}) 25%, transparent)` : 'none',
              transition: 'box-shadow .15s',
            }}
          />
        )}
        {!active && <div class="score-hint">Tap or slide to rate</div>}
      </div>
    </div>
  );
}
