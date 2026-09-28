import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import type { BeerView, Person } from '../data/types';
import type { GroupStat, MonthStat, PlaceStat } from '../data/stats';
import { formatDate, formatScore, monthLabel, plural } from '../data/util';
import { countryInfo, stateName, US_TILES, usStateCode } from '../data/geo';
import { href } from '../router';

// ---------------------------------------------------------------------------
// Tooltip: one floating label shared by every chart.

let tipSet: ((t: { x: number; y: number; text: string } | undefined) => void) | undefined;

export function TipHost() {
  const [tip, setTip] = useState<{ x: number; y: number; text: string }>();
  tipSet = setTip;
  if (!tip) return null;
  return (
    <div class="chart-tip" style={{ left: `${tip.x}px`, top: `${tip.y}px` }} role="tooltip">
      {tip.text}
    </div>
  );
}

export function tipProps(text: string) {
  const show = (e: PointerEvent) => {
    const r = (e.currentTarget as Element).getBoundingClientRect();
    tipSet?.({ x: Math.min(window.innerWidth - 80, Math.max(80, r.left + r.width / 2)), y: r.top, text });
  };
  return {
    onPointerEnter: show,
    onPointerDown: show,
    onPointerLeave: () => tipSet?.(undefined),
    'aria-label': text,
  };
}

if (typeof window !== 'undefined') window.addEventListener('scroll', () => tipSet?.(undefined), { passive: true });

// ---------------------------------------------------------------------------

export function ChartCard({ title, sub, children }: { title: string; sub?: string; children: ComponentChildren }) {
  return (
    <section class="card chart-card">
      <h3>{title}</h3>
      {sub && <div class="sub">{sub}</div>}
      {children}
    </section>
  );
}

export function PeopleLegend({ people }: { people: Person[] }) {
  return (
    <div class="legend" aria-hidden="true">
      {people.map((p, i) => (
        <span key={p.id}>
          <span class={`dot p${i}`} /> {p.name}
        </span>
      ))}
    </div>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details class="table-toggle">
      <summary>View as table</summary>
      <table class="data-table">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} class={i ? 'n' : ''}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} class={j ? 'n' : ''}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Single-series horizontal bars (counts). */
export function BarList({ rows, color = 'var(--accent)' }: { rows: { label: string; value: number; note?: string; link?: string }[]; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div>
      {rows.map((r) => {
        const content = (
          <>
            <span class="lbl">{r.label}</span>
            <span class="track">
              <span class="bar" style={{ width: `${(r.value / max) * 100}%`, background: color, display: 'block' }} />
            </span>
            <span class="val">{r.value}</span>
          </>
        );
        const tip = tipProps(`${r.label}: ${r.value}${r.note ? ` · ${r.note}` : ''}`);
        return r.link ? (
          <a key={r.label} class="bar-row" href={r.link} {...tip}>
            {content}
          </a>
        ) : (
          <div key={r.label} class="bar-row" {...tip}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

/** Per-person average on a shared 1–10 scale (dumbbell). */
export function Dumbbells({ groups, people, domain }: { groups: GroupStat[]; people: Person[]; domain?: [number, number] }) {
  const all = groups.flatMap((g) => people.map((p) => g.perPerson[p.id]).filter((x): x is number => x !== undefined));
  const lo = domain?.[0] ?? Math.max(1, Math.floor(Math.min(...all, 10) - 0.5));
  const hi = domain?.[1] ?? 10;
  const x = (v: number) => ((v - lo) / (hi - lo)) * 100;
  return (
    <div>
      <PeopleLegend people={people} />
      {groups.map((g) => {
        const vals = people.map((p) => g.perPerson[p.id]);
        const present = vals.filter((v): v is number => v !== undefined);
        return (
          <div class="dumbbell" key={g.key}>
            <span class="lbl" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {g.label} <span class="muted small">· {g.count}</span>
            </span>
            <div
              style={{ position: 'relative', height: '22px' }}
              role="img"
              aria-label={`${g.label}: ${people.map((p, i) => `${p.name} ${formatScore(vals[i])}`).join(', ')}`}
            >
              <svg viewBox="0 0 100 22" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '22px' }} aria-hidden="true">
                <line x1="0" x2="100" y1="11" y2="11" stroke="var(--line)" vector-effect="non-scaling-stroke" />
                {present.length === 2 && (
                  <line x1={x(present[0])} x2={x(present[1])} y1="11" y2="11" stroke="var(--line-2)" stroke-width="2" vector-effect="non-scaling-stroke" />
                )}
              </svg>
              {people.map((p, i) =>
                vals[i] !== undefined ? (
                  <span
                    key={p.id}
                    {...tipProps(`${g.label} · ${p.name}: ${formatScore(vals[i])}`)}
                    style={{
                      position: 'absolute',
                      left: `${x(vals[i]!)}%`,
                      top: '4px',
                      width: '14px',
                      height: '14px',
                      marginLeft: '-7px',
                      borderRadius: '50%',
                      background: `var(--p${i})`,
                      boxShadow: '0 0 0 2px var(--card)',
                    }}
                  />
                ) : null,
              )}
            </div>
          </div>
        );
      })}
      <div class="dumbbell" aria-hidden="true">
        <span />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--ink-3)' }}>
          <span>{lo.toFixed(0)}</span>
          <span>{((lo + hi) / 2).toFixed(1)}</span>
          <span>{hi.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}

/** Half-point histogram, one series at a time. */
export function Histogram({ bins, series, color }: { bins: { from: number; count: number }[]; series: string; color: string }) {
  const max = Math.max(1, ...bins.map((b) => b.count));
  const W = 380;
  const H = 130;
  const bw = W / bins.length;
  return (
    <svg class="chart-svg" viewBox={`0 0 ${W} ${H + 20}`} role="img" aria-label={`Rating distribution for ${series}`}>
      {[0.5, 1].map((f) => (
        <line key={f} class="grid" x1="0" x2={W} y1={H - f * H} y2={H - f * H} stroke-dasharray="2 3" />
      ))}
      <line x1="0" x2={W} y1={H} y2={H} stroke="var(--line-2)" />
      {bins.map((b, i) => {
        const h = (b.count / max) * (H - 6);
        const label = `${b.from.toFixed(1)}–${(b.from + (i === bins.length - 1 ? 1 : 0.4)).toFixed(1)}: ${plural(b.count, 'beer')}`;
        return (
          <g key={i} {...tipProps(label)}>
            <rect class="hit" x={i * bw} y={0} width={bw} height={H} />
            {b.count > 0 && <path class="mark" d={roundedTop(i * bw + 1, H - h, bw - 2, h, 3)} fill={b.from >= 9.5 ? 'var(--gold)' : color} />}
          </g>
        );
      })}
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
        <text key={n} x={Math.min(W - 6, (n - 1) * 2 * bw)} y={H + 14} text-anchor={n === 10 ? 'end' : 'start'}>
          {n}
        </text>
      ))}
      <text x={W} y={10} text-anchor="end">
        {max}
      </text>
    </svg>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

/** Every beer as a point in time × score: the history, chronologically. */
export function HistoryScatter({ views }: { views: BeerView[] }) {
  const dated = views.filter((v) => v.beer.date && v.score !== undefined);
  if (dated.length < 2) return <p class="muted small">A few more dated, rated beers and your history will draw itself here.</p>;
  const ts = dated.map((v) => Date.parse(v.beer.date));
  const t0 = Math.min(...ts);
  const t1 = Math.max(...ts);
  const W = 380;
  const H = 150;
  const x = (t: number) => (t1 === t0 ? W / 2 : 6 + ((t - t0) / (t1 - t0)) * (W - 12));
  const y = (s: number) => H - ((s - 1) / 9) * (H - 8) - 4;
  const r = dated.length > 300 ? 2 : dated.length > 80 ? 3 : 4;
  const years: number[] = [];
  for (let yr = new Date(t0).getUTCFullYear() + 1; yr <= new Date(t1).getUTCFullYear(); yr++) years.push(yr);
  return (
    <svg class="chart-svg" viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label={`${dated.length} beers plotted by date and score`}>
      {[1, 5.5, 10].map((s) => (
        <g key={s}>
          <line class="grid" x1="0" x2={W} y1={y(s)} y2={y(s)} stroke-dasharray="2 3" />
          <text x="0" y={y(s) - 3}>
            {s === 5.5 ? '5.5' : s.toFixed(0)}
          </text>
        </g>
      ))}
      {years.map((yr) => {
        const xx = x(Date.UTC(yr, 0, 1));
        return (
          <g key={yr}>
            <line x1={xx} x2={xx} y1={0} y2={H} stroke="var(--line-2)" stroke-dasharray="1 3" />
            <text x={xx + 3} y={H + 14}>
              {yr}
            </text>
          </g>
        );
      })}
      <text x="0" y={H + 14}>{formatDate(dated.reduce((a, b) => (a.beer.date < b.beer.date ? a : b)).beer.date, 'short')}</text>
      {dated.map((v, i) => (
        <a key={v.beer.id} href={href(`beer/${v.beer.id}`)} {...tipProps(`${v.beer.name} · ${formatScore(v.score)} · ${formatDate(v.beer.date, 'short')}`)}>
          <circle cx={x(ts[i])} cy={y(v.score!)} r={r + 4} fill="transparent" />
          <circle
            cx={x(ts[i])}
            cy={y(v.score!)}
            r={r}
            fill={v.score === 10 ? 'var(--gold)' : 'var(--accent)'}
            fill-opacity={0.75}
            stroke="var(--card)"
            stroke-width="1"
          />
        </a>
      ))}
    </svg>
  );
}

export function MonthBars({ months }: { months: MonthStat[] }) {
  const shown = months.slice(-36);
  const max = Math.max(1, ...shown.map((m) => m.count));
  const W = 380;
  const H = 70;
  const bw = W / shown.length;
  return (
    <svg class="chart-svg" viewBox={`0 0 ${W} ${H + 16}`} role="img" aria-label="Beers logged per month">
      <line x1="0" x2={W} y1={H} y2={H} stroke="var(--line-2)" />
      {shown.map((m, i) => {
        const h = (m.count / max) * (H - 4);
        return (
          <g key={m.key} {...tipProps(`${monthLabel(m.key)}: ${plural(m.count, 'beer')}${m.average !== undefined ? ` · avg ${formatScore(m.average)}` : ''}`)}>
            <rect class="hit" x={i * bw} y={0} width={bw} height={H} />
            {m.count > 0 && <path class="mark" d={roundedTop(i * bw + Math.min(1, bw * 0.15), H - h, Math.max(1, bw - Math.min(2, bw * 0.3)), h, 2)} fill="var(--accent)" />}
          </g>
        );
      })}
      <text x="0" y={H + 13}>
        {monthLabel(shown[0].key)}
      </text>
      <text x={W} y={H + 13} text-anchor="end">
        {monthLabel(shown[shown.length - 1].key)}
      </text>
      <text x={W} y={9} text-anchor="end">
        {max}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Beer Map

export function BeerMap({ places }: { places: PlaceStat[] }) {
  const states = new Map<string, { count: number; avg?: number; cities: Set<string> }>();
  const countries = new Map<string, { name: string; lat: number; lon: number; count: number }>();
  const unknown: PlaceStat[] = [];
  for (const p of places) {
    const code = usStateCode(p.state);
    const isUS = code && (!p.country || countryInfo(p.country)?.key === 'usa');
    const c = isUS ? countryInfo('usa') : countryInfo(p.country);
    if (isUS && code) {
      const s = states.get(code) ?? { count: 0, cities: new Set<string>() };
      s.count += p.count;
      if (p.city) s.cities.add(p.city);
      states.set(code, s);
    }
    if (c) {
      const cur = countries.get(c.key) ?? { name: c.name, lat: c.lat, lon: c.lon, count: 0 };
      cur.count += p.count;
      countries.set(c.key, cur);
    } else if (!isUS) unknown.push(p);
  }
  const maxState = Math.max(1, ...[...states.values()].map((s) => s.count));
  const cs = [...countries.values()];
  const maxC = Math.max(1, ...cs.map((c) => c.count));
  const onlyUS = cs.length <= 1 && (cs[0]?.name === 'USA' || !cs.length);

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      {!onlyUS && cs.length > 0 && <WorldDots countries={cs} max={maxC} />}
      {states.size > 0 && (
        <div>
          <div class="label" style={{ marginBottom: '8px' }}>
            United States
          </div>
          <div class="tilemap" role="img" aria-label={`Beers logged in ${states.size} US states`}>
            {Object.entries(US_TILES).map(([code, [row, col]]) => {
              const s = states.get(code);
              const t = s ? 0.3 + 0.7 * Math.sqrt(s.count / maxState) : 0;
              return (
                <a
                  key={code}
                  class={`tile ${s ? 'on' : ''}`}
                  href={s ? href('beers', { place: stateName(code) }) : undefined}
                  style={{
                    gridRow: row + 1,
                    gridColumn: col + 1,
                    background: s ? `color-mix(in srgb, var(--accent) ${Math.round(t * 100)}%, var(--card-2))` : undefined,
                    textDecoration: 'none',
                  }}
                  {...(s ? tipProps(`${stateName(code)}: ${plural(s.count, 'beer')}${s.cities.size ? ` · ${[...s.cities].slice(0, 3).join(', ')}` : ''}`) : {})}
                >
                  {code}
                </a>
              );
            })}
          </div>
        </div>
      )}
      {unknown.length > 0 && (
        <p class="small muted">
          Also: {unknown.slice(0, 8).map((p) => p.label).join(' · ')}
          {unknown.length > 8 ? '…' : ''}
        </p>
      )}
    </div>
  );
}

function WorldDots({ countries, max }: { countries: { name: string; lat: number; lon: number; count: number }[]; max: number }) {
  const W = 360;
  const H = 180;
  const x = (lon: number) => ((lon + 180) / 360) * W;
  const y = (lat: number) => ((90 - lat) / 180) * H;
  return (
    <svg class="chart-svg" viewBox={`0 -4 ${W} ${H + 8}`} role="img" aria-label={`Beers logged in ${plural(countries.length, 'country', 'countries')}`}>
      <rect x="0" y="0" width={W} height={H} rx="10" fill="var(--card-2)" />
      {[-60, -30, 0, 30, 60].map((lat) => (
        <line key={lat} class="grid" x1="0" x2={W} y1={y(lat)} y2={y(lat)} stroke-dasharray={lat === 0 ? '' : '2 4'} />
      ))}
      {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lon) => (
        <line key={lon} class="grid" y1="0" y2={H} x1={x(lon)} x2={x(lon)} stroke-dasharray="2 4" />
      ))}
      {countries
        .sort((a, b) => b.count - a.count)
        .map((c) => {
          const r = 3 + 9 * Math.sqrt(c.count / max);
          return (
            <a key={c.name} href={href('beers', { place: c.name === 'USA' ? '' : c.name })} {...tipProps(`${c.name}: ${plural(c.count, 'beer')}`)}>
              <circle cx={x(c.lon)} cy={y(c.lat)} r={r * 2.2} fill="var(--accent)" opacity=".12" />
              <circle cx={x(c.lon)} cy={y(c.lat)} r={r} fill="var(--accent)" stroke="var(--card)" stroke-width="1.5" />
              <text x={x(c.lon)} y={y(c.lat) - r - 4} text-anchor="middle" style={{ fill: 'var(--ink-2)', fontWeight: 600 }}>
                {c.name}
              </text>
            </a>
          );
        })}
    </svg>
  );
}
