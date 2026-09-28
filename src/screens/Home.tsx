import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useStore } from '../store';
import { Landscape } from '../viz/landscape';
import { summarize } from '../data/stats';
import { chronoDesc } from '../data/views';
import { formatScore, plural } from '../data/util';
import { href, navigate } from '../router';
import { BeerCard } from '../ui/components';
import { BrandMark, IconGear, IconPlus, IconSpark } from '../ui/icons';

export const prefersReducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Home() {
  const store = useStore();
  const canvas = useRef<HTMLCanvasElement>(null);
  const land = useRef<Landscape>();
  const [peek, setPeek] = useState<{ kind: 'beer' | 'star'; id: string; x: number; y: number }>();
  const views = store.views;
  const people = store.people;
  const s = useMemo(() => summarize(views, people), [views, people]);
  const recent = useMemo(() => [...views].sort(chronoDesc).slice(0, 6), [views]);

  useEffect(() => {
    if (!canvas.current) return;
    land.current = new Landscape(canvas.current, {
      reducedMotion: prefersReducedMotion(),
      onPickBeer: (id, at) => setPeek({ kind: 'beer', id, ...at }),
      onPickStar: (id, at) => setPeek({ kind: 'star', id, ...at }),
      onPickNothing: () => setPeek(undefined),
    });
    return () => land.current?.destroy();
  }, []);

  useEffect(() => {
    const arrival = store.arrival;
    store.arrival = undefined;
    land.current?.setData(store.views, store.snap.breweries, arrival);
  }, [store.views]);

  useEffect(() => land.current?.setHighlight(peek?.kind === 'beer' ? peek.id : undefined), [peek]);

  const n = views.length;
  const peekView = peek?.kind === 'beer' ? store.view(peek.id) : undefined;
  const peekBrewery = peek?.kind === 'star' ? store.brewery(peek.id) : undefined;
  const peekBreweryCount = peekBrewery ? views.filter((v) => v.beer.breweryId === peekBrewery.id).length : 0;

  let title = '';
  let line = '';
  if (n >= 1 && n <= 5) {
    title = 'Your landscape is beginning to take shape.';
    line = `${plural(n, 'beer')} so far. Every one you log adds to the range.`;
  } else if (n > 5) {
    title = `${plural(n, 'beer')}, ${plural(s.breweryCount, 'brewery', 'breweries')}.`;
    line =
      s.placeCount > 1
        ? `Gathered across ${plural(s.placeCount, 'place')}. Higher on the mountain means we loved it more.`
        : 'Higher on the mountain means we loved it more.';
  }

  return (
    <div>
      <section class="hero" aria-label="Beer landscape">
        <canvas
          ref={canvas}
          role="img"
          aria-label={
            n
              ? `A landscape of ${plural(n, 'beer')}: each style is a mountain, each beer a light placed at the height of its score, each brewery a star.`
              : 'An empty twilight landscape waiting for the first beer.'
          }
        />
        <div class="hero-top">
          <div class="wordmark">
            <BrandMark size={24} />
            BREW LOG
          </div>
          <a class="icon-btn" href={href('settings')} aria-label="Settings">
            <IconGear />
          </a>
        </div>

        {n === 0 && store.ready ? (
          <div class="hero-empty">
            <div>
              <div class="eyebrow" style={{ color: 'rgba(255,230,200,.6)' }}>
                Our beer landscape
              </div>
              <h1>Your beer history starts here.</h1>
              <a class="btn primary" href={href('log')}>
                <IconPlus /> Log your first beer
              </a>
            </div>
          </div>
        ) : (
          <div class="hero-caption">
            <div class="eyebrow">Our beer landscape</div>
            <h1>{title}</h1>
            <p>{line}</p>
            <div class="hero-legend" aria-hidden="true">
              <span>
                <i /> a beer · height = score
              </span>
              <span>
                <i class="star" /> a brewery
              </span>
              <span>
                <i class="cairn" /> a place
              </span>
            </div>
          </div>
        )}

        {peekView && peek && (
          <a class="peek" href={href(`beer/${peekView.beer.id}`)} style={{ left: `${clampX(peek.x, canvas.current?.clientWidth)}px`, top: `${peek.y}px` }}>
            <span class="n">{formatScore(peekView.score)}</span>
            <div class="t">{peekView.beer.name}</div>
            <div class="s">
              {peekView.breweryName} · {peekView.beer.style || 'Unstyled'}
            </div>
          </a>
        )}
        {peekBrewery && peek && (
          <a class="peek" href={href(`brewery/${peekBrewery.id}`)} style={{ left: `${clampX(peek.x, canvas.current?.clientWidth)}px`, top: `${peek.y}px` }}>
            <div class="t">{peekBrewery.name}</div>
            <div class="s">{plural(peekBreweryCount, 'beer')} logged</div>
          </a>
        )}
      </section>

      <div class="home-body">
        {n > 0 && (
          <div class="card stat-strip">
            <div class="stat">
              <div class="v">{n.toLocaleString()}</div>
              <div class="k">{n === 1 ? 'Beer' : 'Beers'}</div>
            </div>
            <div class="stat">
              <div class="v">{s.breweryCount.toLocaleString()}</div>
              <div class="k">{s.breweryCount === 1 ? 'Brewery' : 'Breweries'}</div>
            </div>
            <div class="stat">
              <div class="v">{formatScore(s.sharedCount >= 3 ? s.sharedAverage : s.average)}</div>
              <div class="k">{s.sharedCount >= 3 ? 'Shared avg' : 'Average'}</div>
            </div>
          </div>
        )}

        {n > 0 && n <= 5 && (
          <div class="card growing-note">
            <IconSpark />
            <div class="small">
              Each style becomes its own mountain, each brewery a star. Log a few more and the ranges start to rise — insights
              appear once there's enough history to say something true.
            </div>
          </div>
        )}


        {n > 0 && (
          <section class="section">
            <div class="section-head">
              <h2>Recently</h2>
              <a href={href('beers')}>All beers</a>
            </div>
            <div class="beer-list">
              {recent.map((v) => (
                <BeerCard key={v.beer.id} v={v} people={people} />
              ))}
            </div>
            {n >= 6 && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <button class="btn block" onClick={() => navigate('insights')}>
                  Our taste
                </button>
                <button class="btn block" onClick={() => navigate('gallery')}>
                  Gallery
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function clampX(x: number, w = 400) {
  return Math.max(130, Math.min(w - 130, x));
}
