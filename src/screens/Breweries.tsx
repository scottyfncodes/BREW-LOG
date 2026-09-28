import { useMemo, useState } from 'preact/hooks';
import { useStore, usePhoto } from '../store';
import type { BeerView, ID } from '../data/types';
import { breweryDetail, byBrewery } from '../data/stats';
import { formatDate, formatScore, plural } from '../data/util';
import { href, back } from '../router';
import { BeerCard, Empty, PageHead, toast } from '../ui/components';
import { IconBack, IconEdit, IconPlus, IconSearch } from '../ui/icons';

type Sort = 'count' | 'rating' | 'name' | 'recent';

export function Breweries() {
  const store = useStore();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('count');
  const groups = useMemo(() => byBrewery(store.views, store.people), [store.views]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const filtered = groups.filter((g) => {
      if (!t) return true;
      const br = store.brewery(g.key);
      return [g.label, br?.city, br?.state, br?.country].some((s) => s?.toLowerCase().includes(t));
    });
    const last = (g: (typeof groups)[number]) => g.views.reduce((m, v) => (v.beer.date > m ? v.beer.date : m), '');
    return filtered.sort((a, b) =>
      sort === 'name'
        ? a.label.localeCompare(b.label)
        : sort === 'rating'
          ? (b.average ?? 0) - (a.average ?? 0) || b.count - a.count
          : sort === 'recent'
            ? last(b).localeCompare(last(a))
            : b.count - a.count || (b.average ?? 0) - (a.average ?? 0),
    );
  }, [groups, q, sort]);

  if (!groups.length) {
    return (
      <div class="page-enter">
        <PageHead eyebrow="Breweries" title="Breweries we've met" />
        <Empty title="No breweries yet." action={<a class="btn primary" href={href('log')}><IconPlus /> Log a beer</a>}>
          Breweries appear here on their own as you log beers — only the ones you've actually encountered.
        </Empty>
      </div>
    );
  }

  return (
    <div class="page-enter">
      <PageHead eyebrow={plural(groups.length, 'brewery', 'breweries')} title="Breweries we've met" />
      <div class="search">
        <IconSearch />
        <input class="input" type="search" placeholder="Find a brewery or place" value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label="Search breweries" />
      </div>
      <div class="chips" style={{ margin: '10px -16px 12px' }} role="group" aria-label="Sort breweries">
        {([['count', 'Most logged'], ['rating', 'Highest rated'], ['recent', 'Most recent'], ['name', 'A–Z']] as const).map(([k, l]) => (
          <button key={k} class="chip" aria-pressed={sort === k} onClick={() => setSort(k)}>
            {l}
          </button>
        ))}
      </div>
      <div class="beer-list wide">
        {list.map((g) => {
          const br = store.brewery(g.key);
          const loc = [br?.city, br?.state, br?.country].filter(Boolean).join(', ');
          return (
            <a key={g.key} class="card brewery-card" href={href(`brewery/${g.key}`)}>
              <div style={{ minWidth: 0 }}>
                <div class="name">{g.label}</div>
                <div class="loc">
                  {plural(g.count, 'beer')}
                  {loc ? ` · ${loc}` : ''}
                </div>
                <div class="pips" aria-hidden="true">
                  {g.views.slice(0, 24).map((v) => (
                    <i key={v.beer.id} style={{ opacity: v.score ? 0.25 + (v.score / 10) * 0.75 : 0.2 }} />
                  ))}
                </div>
              </div>
              <div class="score-badge">
                <div class="big">{formatScore(g.average)}</div>
                <div class="shared-tag">AVG</div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export function BreweryDetail({ id }: { id: ID }) {
  const store = useStore();
  const people = store.people;
  const brewery = store.brewery(id);
  const d = useMemo(() => (brewery ? breweryDetail(brewery, store.views, people) : undefined), [store.views, brewery]);
  const [editing, setEditing] = useState(false);

  if (!brewery || !d) {
    return (
      <Empty title="That brewery isn't here." action={<a class="btn" href={href('breweries')}>All breweries</a>}>
        Breweries disappear when their last beer is deleted.
      </Empty>
    );
  }
  const loc = [brewery.city, brewery.state, brewery.country].filter(Boolean).join(', ');

  return (
    <div class="page-enter">
      <div class="page-head" style={{ alignItems: 'flex-start' }}>
        <button class="icon-btn" aria-label="Back" onClick={() => back('breweries')}>
          <IconBack />
        </button>
        <button class="icon-btn" aria-label="Edit brewery" onClick={() => setEditing(!editing)}>
          <IconEdit />
        </button>
      </div>
      <div class="eyebrow">Brewery{loc ? ` · ${loc}` : ''}</div>
      <h1 style={{ marginTop: '4px' }}>{brewery.name}</h1>

      {editing && <BreweryEditor id={id} onDone={() => setEditing(false)} />}

      <div class="kv" style={{ marginTop: '18px' }}>
        <div class="card">
          <div class="k">Beers logged</div>
          <div class="v">{d.count}</div>
        </div>
        <div class="card">
          <div class="k">Average</div>
          <div class="v">{formatScore(d.average)}</div>
        </div>
        {people.map((p, i) =>
          d.perPerson[p.id] !== undefined ? (
            <div class="card" key={p.id}>
              <div class="k">
                <span class={`dot p${i}`} /> {p.name}
              </div>
              <div class="v">{formatScore(d.perPerson[p.id])}</div>
            </div>
          ) : null,
        )}
        {d.first && (
          <div class="card">
            <div class="k">First encounter</div>
            <div class="v sm">{formatDate(d.first, 'short')}</div>
          </div>
        )}
        {d.last && d.last !== d.first && (
          <div class="card">
            <div class="k">Most recent</div>
            <div class="v sm">{formatDate(d.last, 'short')}</div>
          </div>
        )}
      </div>

      {d.best && d.count > 1 && (
        <section class="section">
          <div class="section-head">
            <h2>Our highest rated here</h2>
          </div>
          <BeerCard v={d.best} people={people} />
        </section>
      )}

      {d.photos.length > 0 && (
        <section class="section">
          <div class="section-head">
            <h2>Photos</h2>
          </div>
          <div class="hscroll" style={{ gridAutoColumns: 'minmax(150px, 42%)' }}>
            {d.photos.map((v) => (
              <PhotoTile key={v.beer.id} v={v} />
            ))}
          </div>
        </section>
      )}

      {d.notes.length > 0 && (
        <section class="section">
          <div class="section-head">
            <h2>Notes & memories</h2>
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {d.notes.slice(0, 6).map((v) => (
              <a key={v.beer.id} href={href(`beer/${v.beer.id}`)} style={{ textDecoration: 'none' }}>
                <blockquote class="memory" style={{ margin: 0, fontSize: '17px' }}>
                  {v.beer.notes}
                  <div class="small muted" style={{ fontStyle: 'normal', fontFamily: 'var(--sans)', marginTop: '6px' }}>
                    — {v.beer.name}, {formatDate(v.beer.date, 'short')}
                  </div>
                </blockquote>
              </a>
            ))}
          </div>
        </section>
      )}

      <section class="section">
        <div class="section-head">
          <h2>Every beer</h2>
        </div>
        <div class="beer-list">
          {d.views.map((v) => (
            <BeerCard key={v.beer.id} v={v} people={people} />
          ))}
        </div>
      </section>
    </div>
  );
}

function PhotoTile({ v }: { v: BeerView }) {
  const url = usePhoto(v.beer.photoId);
  return (
    <a class="polaroid" href={href(`beer/${v.beer.id}`)} style={{ marginBottom: 0 }}>
      {url && <img src={url} alt={v.beer.name} loading="lazy" />}
      <div class="cap">{v.beer.name}</div>
    </a>
  );
}

function BreweryEditor({ id, onDone }: { id: ID; onDone: () => void }) {
  const store = useStore();
  const br = store.brewery(id)!;
  const [name, setName] = useState(br.name);
  const [city, setCity] = useState(br.city ?? '');
  const [state, setState] = useState(br.state ?? '');
  const [country, setCountry] = useState(br.country ?? '');
  const save = async (e: Event) => {
    e.preventDefault();
    if (!name.trim()) return;
    await store.updateBrewery({ ...br, name, city: city || undefined, state: state || undefined, country: country || undefined });
    toast('Brewery updated');
    onDone();
  };
  return (
    <form class="card pad" style={{ display: 'grid', gap: '12px', marginTop: '14px' }} onSubmit={save}>
      <div class="field">
        <label for="b-name">Name</label>
        <input id="b-name" class="input" value={name} onInput={(e) => setName(e.currentTarget.value)} />
      </div>
      <div class="grid2">
        <div class="field">
          <label for="b-city">City</label>
          <input id="b-city" class="input" value={city} onInput={(e) => setCity(e.currentTarget.value)} />
        </div>
        <div class="field">
          <label for="b-state">State / region</label>
          <input id="b-state" class="input" value={state} onInput={(e) => setState(e.currentTarget.value)} />
        </div>
      </div>
      <div class="field">
        <label for="b-country">Country</label>
        <input id="b-country" class="input" value={country} onInput={(e) => setCountry(e.currentTarget.value)} />
      </div>
      <div class="row">
        <button type="button" class="btn" onClick={onDone}>
          Cancel
        </button>
        <button class="btn primary">Save</button>
      </div>
    </form>
  );
}
