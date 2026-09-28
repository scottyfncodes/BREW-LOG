import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useStore } from '../store';
import { activeFilterCount, applyFilters, sortViews, type Filters, type SortKey } from '../data/library';
import { byBrewery, byStyle } from '../data/stats';
import { plural } from '../data/util';
import { href } from '../router';
import { BeerCard, Empty, Sheet } from '../ui/components';
import { IconFilter, IconSearch, IconX, IconPlus } from '../ui/icons';

// Kept at module level so coming back from a beer restores the same view.
let saved: { filters: Filters; sort: SortKey } = { filters: {}, sort: 'newest' };
const PAGE = 60;

export function Beers({ query }: { query: URLSearchParams }) {
  const store = useStore();
  const people = store.people;
  const [filters, setFilters] = useState<Filters>(() => {
    const f: Filters = query.toString() ? {} : { ...saved.filters };
    if (query.get('style')) f.styles = [query.get('style')!.toLowerCase()];
    if (query.get('brewery')) f.breweryIds = [query.get('brewery')!];
    if (query.get('q')) f.q = query.get('q')!;
    if (query.get('place')) f.place = query.get('place')!;
    if (query.get('rater')) f.rater = query.get('rater')!;
    return f;
  });
  const [sort, setSort] = useState<SortKey>((query.get('sort') as SortKey) || saved.sort);
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saved = { filters, sort };
    setLimit(PAGE);
  }, [filters, sort]);

  const results = useMemo(
    () => sortViews(applyFilters(store.views, filters, people.map((p) => p.id)), sort),
    [store.views, filters, sort],
  );

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => es[0].isIntersecting && setLimit((l) => l + PAGE), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [results.length > limit]);

  const nActive = activeFilterCount(filters);
  const total = store.views.length;

  if (!total) {
    return (
      <div class="page-enter">
        <Empty title="No beers yet." action={<a class="btn primary" href={href('log')}><IconPlus /> Log your first beer</a>}>
          Every beer you log lands here — searchable by name, brewery, style, place, or the memories in your notes.
        </Empty>
      </div>
    );
  }

  return (
    <div class="page-enter">
      <div class="searchbar">
        <div class="eyebrow" style={{ margin: '6px 0 8px' }}>
          The library · {plural(total, 'beer')}
        </div>
        <div class="search">
          <IconSearch />
          <input
            class="input"
            type="search"
            placeholder="Search beers, breweries, places, notes"
            value={filters.q ?? ''}
            onInput={(e) => setFilters({ ...filters, q: e.currentTarget.value })}
            aria-label="Search beers"
            enterKeyHint="search"
          />
          {filters.q && (
            <button class="clear" aria-label="Clear search" onClick={() => setFilters({ ...filters, q: '' })}>
              <IconX width={16} />
            </button>
          )}
        </div>
        <div class="toolbar">
          <select class="input" value={sort} onChange={(e) => setSort(e.currentTarget.value as SortKey)} aria-label="Sort by">
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="highest">Highest rated</option>
            <option value="lowest">Lowest rated</option>
            {people.map((p) => (
              <option key={p.id} value={`person:${p.id}`}>
                {p.name}'s rating
              </option>
            ))}
            <option value="disagreement">Biggest disagreement</option>
            <option value="brewery">Brewery A–Z</option>
            <option value="style">Style A–Z</option>
          </select>
          <button class="btn sm" onClick={() => setOpen(true)} aria-haspopup="dialog">
            <IconFilter /> Filters{nActive ? ` · ${nActive}` : ''}
          </button>
        </div>
        {nActive > 0 && <ActiveFilters filters={filters} setFilters={setFilters} />}
      </div>

      <div class="result-count" aria-live="polite">
        {results.length === total ? plural(total, 'beer') : `${results.length.toLocaleString()} of ${plural(total, 'beer')}`}
      </div>

      {results.length ? (
        <div class="beer-list wide">
          {results.slice(0, limit).map((v) => (
            <BeerCard key={v.beer.id} v={v} people={people} />
          ))}
        </div>
      ) : (
        <Empty title="Nothing matches that.">Try a different word, or loosen a filter.</Empty>
      )}
      {results.length > limit && (
        <div ref={sentinel} style={{ textAlign: 'center', marginTop: '16px' }}>
          <button class="btn" onClick={() => setLimit((l) => l + PAGE)}>
            Show more
          </button>
        </div>
      )}

      {open && <FilterSheet filters={filters} setFilters={setFilters} onClose={() => setOpen(false)} count={results.length} />}
    </div>
  );
}

function ActiveFilters({ filters, setFilters }: { filters: Filters; setFilters: (f: Filters) => void }) {
  const store = useStore();
  const chips: [string, () => void][] = [];
  for (const s of filters.styles ?? [])
    chips.push([s, () => setFilters({ ...filters, styles: filters.styles!.filter((x) => x !== s) })]);
  for (const id of filters.breweryIds ?? [])
    chips.push([store.brewery(id)?.name ?? 'Brewery', () => setFilters({ ...filters, breweryIds: filters.breweryIds!.filter((x) => x !== id) })]);
  if (filters.dateFrom || filters.dateTo)
    chips.push([`${filters.dateFrom ?? '…'} → ${filters.dateTo ?? '…'}`, () => setFilters({ ...filters, dateFrom: undefined, dateTo: undefined })]);
  if (filters.minScore !== undefined || filters.maxScore !== undefined)
    chips.push([`Score ${filters.minScore ?? 1}–${filters.maxScore ?? 10}`, () => setFilters({ ...filters, minScore: undefined, maxScore: undefined })]);
  if (filters.place) chips.push([filters.place, () => setFilters({ ...filters, place: undefined })]);
  if (filters.rater && filters.rater !== 'any') {
    const p = store.people.find((x) => x.id === filters.rater);
    const label = p ? `Rated by ${p.name}` : filters.rater === 'both' ? 'Rated by both' : 'Unrated';
    chips.push([label, () => setFilters({ ...filters, rater: 'any' })]);
  }
  if (filters.photosOnly) chips.push(['With photos', () => setFilters({ ...filters, photosOnly: false })]);
  return (
    <div class="chips" style={{ marginTop: '10px' }}>
      {chips.map(([label, remove]) => (
        <button class="chip" aria-pressed="true" onClick={remove} key={label}>
          {label} <IconX width={14} height={14} />
        </button>
      ))}
    </div>
  );
}

function FilterSheet({ filters, setFilters, onClose, count }: { filters: Filters; setFilters: (f: Filters) => void; onClose: () => void; count: number }) {
  const store = useStore();
  const people = store.people;
  const styles = useMemo(() => byStyle(store.views, people), [store.views]);
  const breweries = useMemo(() => byBrewery(store.views, people), [store.views]);
  const [showAllBreweries, setShowAll] = useState(false);
  const toggle = (list: string[] | undefined, v: string) => (list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v]);

  return (
    <Sheet title="Filters" onClose={onClose}>
      <div class="group">
        <span class="label">Who rated it</span>
        <div class="chips wrap">
          {[['any', 'Anyone'], ...people.map((p) => [p.id, p.name]), ['both', 'Both'], ['none', 'Not rated']].map(([id, label]) => (
            <button key={id} class="chip" aria-pressed={(filters.rater ?? 'any') === id} onClick={() => setFilters({ ...filters, rater: id })}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div class="group">
        <span class="label">Score range</span>
        <div class="row">
          <select class="input" aria-label="Minimum score" value={filters.minScore ?? ''} onChange={(e) => setFilters({ ...filters, minScore: e.currentTarget.value ? +e.currentTarget.value : undefined })}>
            <option value="">Min</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}.0+</option>)}
          </select>
          <select class="input" aria-label="Maximum score" value={filters.maxScore ?? ''} onChange={(e) => setFilters({ ...filters, maxScore: e.currentTarget.value ? +e.currentTarget.value : undefined })}>
            <option value="">Max</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>≤ {n}.0</option>)}
          </select>
        </div>
      </div>
      <div class="group">
        <span class="label">Style</span>
        <div class="chips wrap">
          {styles.map((s) => (
            <button key={s.key} class="chip" aria-pressed={!!filters.styles?.includes(s.key)} onClick={() => setFilters({ ...filters, styles: toggle(filters.styles, s.key) })}>
              {s.label} <span class="count">{s.count}</span>
            </button>
          ))}
        </div>
      </div>
      <div class="group">
        <span class="label">Brewery</span>
        <div class="chips wrap">
          {(showAllBreweries ? breweries : breweries.slice(0, 12)).map((b) => (
            <button key={b.key} class="chip" aria-pressed={!!filters.breweryIds?.includes(b.key)} onClick={() => setFilters({ ...filters, breweryIds: toggle(filters.breweryIds, b.key) })}>
              {b.label} <span class="count">{b.count}</span>
            </button>
          ))}
          {breweries.length > 12 && !showAllBreweries && (
            <button class="chip" onClick={() => setShowAll(true)}>
              +{breweries.length - 12} more
            </button>
          )}
        </div>
      </div>
      <div class="group">
        <span class="label">Date</span>
        <div class="row">
          <input class="input" type="date" aria-label="From date" value={filters.dateFrom ?? ''} onInput={(e) => setFilters({ ...filters, dateFrom: e.currentTarget.value || undefined })} />
          <input class="input" type="date" aria-label="To date" value={filters.dateTo ?? ''} onInput={(e) => setFilters({ ...filters, dateTo: e.currentTarget.value || undefined })} />
        </div>
      </div>
      <div class="group">
        <label class="label" for="flt-place">Place</label>
        <input id="flt-place" class="input" placeholder="City, state, country, or venue" value={filters.place ?? ''} onInput={(e) => setFilters({ ...filters, place: e.currentTarget.value || undefined })} />
      </div>
      <div class="group toggle">
        <span>Only beers with photos</span>
        <label class="switch">
          <input type="checkbox" checked={!!filters.photosOnly} onChange={(e) => setFilters({ ...filters, photosOnly: e.currentTarget.checked })} aria-label="Only beers with photos" />
          <span />
        </label>
      </div>
      <div class="row" style={{ position: 'sticky', bottom: 0, background: 'var(--paper)', paddingTop: '8px' }}>
        <button class="btn" onClick={() => setFilters({ q: filters.q })}>
          Reset
        </button>
        <button class="btn primary" onClick={onClose}>
          Show {plural(count, 'beer')}
        </button>
      </div>
    </Sheet>
  );
}
