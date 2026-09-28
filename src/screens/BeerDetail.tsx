import { useMemo } from 'preact/hooks';
import { useStore, usePhoto } from '../store';
import type { ID } from '../data/types';
import { chronoDesc } from '../data/views';
import { formatDate, formatScore } from '../data/util';
import { styleFamily } from '../data/styles';
import { href, back } from '../router';
import { BeerCard, Empty } from '../ui/components';
import { IconBack, IconCalendar, IconDrop, IconEdit, IconPin, IconSpark } from '../ui/icons';

export function BeerDetail({ id }: { id: ID }) {
  const store = useStore();
  const people = store.people;
  const v = store.view(id);
  const photo = usePhoto(v?.beer.photoId, 'full');

  const { prev, next, sameBrewery, sameStyle } = useMemo(() => {
    const sorted = [...store.views].sort(chronoDesc);
    const i = sorted.findIndex((x) => x.beer.id === id);
    if (!v) return { prev: undefined, next: undefined, sameBrewery: [], sameStyle: [] };
    const fam = styleFamily(v.beer.style);
    return {
      // "Previous" is the older beer, "next" the newer one.
      prev: sorted[i + 1],
      next: i > 0 ? sorted[i - 1] : undefined,
      sameBrewery: sorted.filter((x) => x.beer.breweryId === v.beer.breweryId && x.beer.id !== id).slice(0, 8),
      sameStyle: sorted
        .filter((x) => x.beer.id !== id && x.beer.breweryId !== v.beer.breweryId && styleFamily(x.beer.style) === fam)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 8),
    };
  }, [store.views, id]);

  if (!v) {
    return (
      <Empty title="That beer isn't here." action={<a class="btn" href={href('beers')}>Back to the library</a>}>
        It may have been deleted.
      </Empty>
    );
  }
  const b = v.beer;
  const ten = v.score === 10;

  return (
    <div class="page-enter">
      <div class={`detail-hero ${photo ? '' : 'noimg'}`}>
        {photo && <img src={photo} alt={`Photo of ${b.name}`} />}
        <div class="topbar">
          <button class="icon-btn" aria-label="Back" onClick={() => back('beers')}>
            <IconBack />
          </button>
          <a class="icon-btn" aria-label="Edit beer" href={href(`log/${b.id}`)}>
            <IconEdit />
          </a>
        </div>
      </div>

      <article class="card detail-card">
        <h1 class="detail-title">{b.name}</h1>
        <div class="detail-sub">
          <a href={href(`brewery/${b.breweryId}`)}>{v.breweryName}</a>
        </div>
        {b.style && (
          <a class="style-pill" href={href('beers', { style: b.style })}>
            {b.style}
          </a>
        )}

        <div class="score-panel">
          <div>
            <div class={`main-score ${ten ? 'summit' : ''}`}>{formatScore(v.score)}</div>
            <div class="eyebrow" style={{ marginTop: '6px' }}>
              {v.shared !== undefined ? 'Shared score' : Object.keys(v.scores).length === 1 ? 'Score' : v.score !== undefined ? 'Imported score' : 'Not rated yet'}
            </div>
          </div>
          <div class="people">
            {people.map((p, i) => (
              <div key={p.id}>
                <span>
                  <span class={`dot p${i}`} /> {p.name}
                </span>
                <b class={v.scores[p.id] === 10 ? 'summit' : ''}>{v.scores[p.id] !== undefined ? formatScore(v.scores[p.id]) : '—'}</b>
              </div>
            ))}
            {v.disagreement !== undefined && v.disagreement >= 1 && <div class="small muted">{formatScore(v.disagreement)} apart — a divisive one.</div>}
          </div>
        </div>
        {ten && (
          <p class="small summit" style={{ marginTop: '10px', fontWeight: 600 }}>
            <IconSpark width={14} height={14} style={{ verticalAlign: '-2px' }} /> A summit beer: 10.0.
          </p>
        )}

        <div class="facts">
          <div class="fact">
            <IconCalendar />
            <span>{b.date ? formatDate(b.date) : 'Undated'}</span>
          </div>
          {v.placeLabel && (
            <div class="fact">
              <IconPin />
              <span>{v.placeLabel}</span>
            </div>
          )}
          {(b.abv !== undefined || b.firstTime !== undefined) && (
            <div class="fact">
              <IconDrop />
              <span>
                {[b.abv !== undefined ? `${b.abv}% ABV` : '', b.firstTime === true ? 'First time trying it' : b.firstTime === false ? 'Had it before' : '']
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
          )}
        </div>

        {b.notes && <blockquote class="memory">{b.notes}</blockquote>}
      </article>

      <nav class="pager" aria-label="Beer history">
        {prev ? (
          <a class="card prev" href={href(`beer/${prev.beer.id}`)}>
            <div class="eyebrow">← Earlier</div>
            <div class="t">{prev.beer.name}</div>
          </a>
        ) : (
          <span />
        )}
        {next ? (
          <a class="card next" href={href(`beer/${next.beer.id}`)}>
            <div class="eyebrow">Later →</div>
            <div class="t">{next.beer.name}</div>
          </a>
        ) : (
          <span />
        )}
      </nav>

      {sameBrewery.length > 0 && (
        <section class="section">
          <div class="section-head">
            <h2>More from {v.breweryName}</h2>
            <a href={href(`brewery/${b.breweryId}`)}>Brewery</a>
          </div>
          <div class="hscroll">
            {sameBrewery.map((x) => (
              <BeerCard key={x.beer.id} v={x} people={people} />
            ))}
          </div>
        </section>
      )}
      {sameStyle.length > 0 && (
        <section class="section">
          <div class="section-head">
            <h2>Other {styleFamily(b.style)} we've had</h2>
          </div>
          <div class="hscroll">
            {sameStyle.map((x) => (
              <BeerCard key={x.beer.id} v={x} people={people} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
