import { useMemo, useState } from 'preact/hooks';
import { useStore } from '../store';
import {
  byBrewery,
  byPlace,
  byStyle,
  disagreements,
  MIN_BREWERY_SAMPLE,
  ourTaste,
  ratingDistribution,
  summarize,
  timeline,
} from '../data/stats';
import { formatDate, formatScore, plural } from '../data/util';
import { href } from '../router';
import { Empty, PageHead } from '../ui/components';
import { BarList, BeerMap, ChartCard, DataTable, Dumbbells, Histogram, HistoryScatter, MonthBars, tipProps } from '../ui/charts';
import { IconPhoto, IconPlus } from '../ui/icons';

export function Insights() {
  const store = useStore();
  const views = store.views;
  const people = store.people;
  const [histFor, setHistFor] = useState<string>('all');

  const d = useMemo(() => {
    const styles = byStyle(views, people);
    const breweries = byBrewery(views, people);
    return {
      s: summarize(views, people),
      styles,
      breweries,
      taste: ourTaste(views, people),
      dist: ratingDistribution(views, people),
      months: timeline(views),
      split: disagreements(views, 8, 0),
      places: byPlace(views),
    };
  }, [views, people]);

  const n = views.length;
  if (!n) {
    return (
      <div class="page-enter">
        <PageHead eyebrow="Insights" title="Our taste" />
        <Empty title="Nothing to see — yet." action={<a class="btn primary" href={href('log')}><IconPlus /> Log a beer</a>}>
          Patterns appear here as your history grows. We'll only say things the data actually supports.
        </Empty>
      </div>
    );
  }

  const { s, taste } = d;
  const ratedStyles = d.styles.filter((g) => g.count >= 2 && people.some((p) => g.perPerson[p.id] !== undefined)).slice(0, 10);
  const breweryPerf = d.breweries.filter((b) => b.average !== undefined && b.count >= 2).sort((a, b) => b.average! - a.average!).slice(0, 10);
  const styleRows = d.styles.slice(0, 12).map((g) => ({ label: g.label, value: g.count, note: g.average !== undefined ? `avg ${formatScore(g.average)}` : undefined, link: href('beers', { style: g.label }) }));
  const otherStyles = d.styles.slice(12).reduce((a, g) => a + g.count, 0);
  const histIdx = people.findIndex((p) => p.id === histFor);
  const histBins = d.dist.map((b) => ({ from: b.from, count: histFor === 'all' ? b.total : b.perPerson[histFor] ?? 0 }));
  const splitAny = d.split.length > 0;

  return (
    <div class="page-enter">
      <PageHead eyebrow={s.firstDate ? `Since ${formatDate(s.firstDate, 'short')}` : 'Insights'} title="Our taste" />

      <div class="kv">
        <div class="card">
          <div class="k">Beers</div>
          <div class="v">{s.count.toLocaleString()}</div>
        </div>
        <div class="card">
          <div class="k">Breweries</div>
          <div class="v">{s.breweryCount.toLocaleString()}</div>
        </div>
        {s.average !== undefined && (
          <div class="card">
            <div class="k">Average</div>
            <div class="v">{formatScore(s.average)}</div>
          </div>
        )}
        {s.perPerson.map((pp, i) =>
          pp.count ? (
            <div class="card" key={pp.person.id}>
              <div class="k">
                <span class={`dot p${i}`} /> {pp.person.name}
              </div>
              <div class="v">{formatScore(pp.average)}</div>
            </div>
          ) : null,
        )}
        {s.sharedCount > 0 && (
          <div class="card">
            <div class="k">Shared avg</div>
            <div class="v">{formatScore(s.sharedAverage)}</div>
          </div>
        )}
        {s.styleCount > 1 && (
          <div class="card">
            <div class="k">Styles</div>
            <div class="v">{s.styleCount}</div>
          </div>
        )}
        {s.placeCount > 1 && (
          <div class="card">
            <div class="k">Places</div>
            <div class="v">{s.placeCount}</div>
          </div>
        )}
      </div>

      <section class="section">
        <div class="section-head">
          <h2>What the data says</h2>
        </div>
        <div class="taste">
          {taste.styleTendencies.length > 0 && (
            <div class="card obs">
              <div class="k">We tend to rate…</div>
              <div style={{ marginTop: '6px' }}>
                {taste.styleTendencies.map((g) => (
                  <div class="tendency" key={g.key}>
                    <span>
                      {g.label} <span class="muted small">· {g.count}</span>
                    </span>
                    <b>{formatScore(g.average)}</b>
                  </div>
                ))}
              </div>
            </div>
          )}
          {taste.mostLoggedStyle && (
            <div class="card obs">
              <div class="k">Our most logged style</div>
              <div class="v">{taste.mostLoggedStyle.label}</div>
              <div class="d">{plural(taste.mostLoggedStyle.count, 'beer')} — {Math.round((taste.mostLoggedStyle.count / n) * 100)}% of everything we've logged.</div>
            </div>
          )}
          {taste.topBrewery ? (
            <div class="card obs">
              <div class="k">Our highest-rated brewery</div>
              <a class="v" href={href(`brewery/${taste.topBrewery.key}`)} style={{ display: 'block' }}>
                {taste.topBrewery.label}
              </a>
              <div class="d">
                Averaging {formatScore(taste.topBrewery.average)} across {plural(taste.topBrewery.count, 'beer')}.
              </div>
            </div>
          ) : (
            n >= 3 && (
              <div class="card obs">
                <div class="k">Our highest-rated brewery</div>
                <div class="d">Needs {MIN_BREWERY_SAMPLE}+ beers from one brewery before we'll call it.</div>
              </div>
            )
          )}
          {taste.mostDivisive && (
            <div class="card obs">
              <div class="k">Our most divisive beer</div>
              <a class="v" href={href(`beer/${taste.mostDivisive.beer.id}`)} style={{ display: 'block' }}>
                {taste.mostDivisive.beer.name}
              </a>
              <div class="d">
                {people.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && ' · '}
                    <span class={`p${i}`}>{p.name}</span> {formatScore(taste.mostDivisive!.scores[p.id])}
                  </span>
                ))}{' '}
                — {formatScore(taste.mostDivisive.disagreement)} apart.
              </div>
            </div>
          )}
          {taste.highest && n > 1 && (
            <div class="card obs">
              <div class="k">Highest on the mountain</div>
              <a class="v" href={href(`beer/${taste.highest.beer.id}`)} style={{ display: 'block' }}>
                {taste.highest.beer.name}
              </a>
              <div class="d">
                {formatScore(taste.highest.score)} · {taste.highest.breweryName}
                {taste.summits.length > 1 ? ` · ${taste.summits.length} beers have reached 10.0` : ''}
              </div>
            </div>
          )}
          {taste.mostRecent && (
            <div class="card obs">
              <div class="k">Our most recent beer</div>
              <a class="v" href={href(`beer/${taste.mostRecent.beer.id}`)} style={{ display: 'block' }}>
                {taste.mostRecent.beer.name}
              </a>
              <div class="d">
                {taste.mostRecent.breweryName}
                {taste.mostRecent.beer.date ? ` · ${formatDate(taste.mostRecent.beer.date)}` : ''}
              </div>
            </div>
          )}
        </div>
      </section>

      <section class="section ins-grid two">
        <ChartCard title="Style breakdown" sub={`${plural(d.styles.length, 'style')} so far`}>
          <BarList rows={styleRows} />
          {otherStyles > 0 && (
            <p class="small muted" style={{ margin: '8px 0 0' }}>
              + {plural(d.styles.length - 12, 'more style')} ({plural(otherStyles, 'beer')})
            </p>
          )}
          <DataTable head={['Style', 'Beers', 'Avg']} rows={d.styles.map((g) => [g.label, g.count, formatScore(g.average)])} />
        </ChartCard>

        {ratedStyles.length > 0 ? (
          <ChartCard title="How we rate each style" sub="Average score by style (styles with 2+ beers)">
            <Dumbbells groups={ratedStyles} people={people} />
            <DataTable head={['Style', ...people.map((p) => p.name)]} rows={ratedStyles.map((g) => [g.label, ...people.map((p) => formatScore(g.perPerson[p.id]))])} />
          </ChartCard>
        ) : (
          <ChartCard title="How we rate each style">
            <p class="muted small">Log two or more beers of a style to compare how each of you rates it.</p>
          </ChartCard>
        )}
      </section>

      <section class="section ins-grid two">
        <ChartCard title="Rating distribution" sub="How scores spread from 1.0 to 10.0">
          <div class="chips wrap" style={{ marginBottom: '10px' }} role="group" aria-label="Whose ratings">
            {[{ id: 'all', name: 'Everyone' }, ...people].map((p) => (
              <button key={p.id} class="chip" aria-pressed={histFor === p.id} onClick={() => setHistFor(p.id)}>
                {p.name}
              </button>
            ))}
          </div>
          <Histogram bins={histBins} series={histFor === 'all' ? 'everyone' : people[histIdx]?.name} color={histIdx >= 0 ? `var(--p${histIdx})` : 'var(--accent)'} />
        </ChartCard>

        <ChartCard title="Brewery performance" sub="Average score, breweries with 2+ beers">
          {breweryPerf.length ? (
            <div>
              {breweryPerf.map((b) => (
                <a class="bar-row" key={b.key} href={href(`brewery/${b.key}`)} {...tipProps(`${b.label}: ${formatScore(b.average)} avg over ${plural(b.count, 'beer')}`)}>
                  <span class="lbl">{b.label}</span>
                  <span class="track">
                    <span class="bar" style={{ display: 'block', width: `${((b.average! - 1) / 9) * 100}%`, background: b.average! >= 9 ? 'var(--gold)' : 'var(--accent)' }} />
                  </span>
                  <span class="val">{formatScore(b.average)}</span>
                </a>
              ))}
              <DataTable head={['Brewery', 'Beers', 'Avg']} rows={breweryPerf.map((b) => [b.label, b.count, formatScore(b.average)])} />
            </div>
          ) : (
            <p class="muted small">Once you've had two beers from the same brewery, it'll show up here.</p>
          )}
        </ChartCard>
      </section>

      <section class="section ins-grid">
        <ChartCard title="Our beer history" sub="Every beer, placed by date and score. Tap one to open it.">
          <HistoryScatter views={views} />
          {d.months.length > 1 && (
            <div style={{ marginTop: '18px' }}>
              <div class="label" style={{ marginBottom: '6px' }}>
                Beers per month
              </div>
              <MonthBars months={d.months} />
            </div>
          )}
        </ChartCard>
      </section>

      <section class="section ins-grid two">
        <ChartCard title="Where we disagree" sub="Largest gaps between our scores — nobody's wrong">
          {splitAny ? (
            <div>
              {d.split.map((v) => {
                const a = v.scores[people[0].id];
                const b = v.scores[people[1].id];
                return (
                  <a key={v.beer.id} href={href(`beer/${v.beer.id}`)} class="tendency" style={{ textDecoration: 'none', display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px' }}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.beer.name}
                      <span class="muted small"> · {v.breweryName}</span>
                    </span>
                    <span class="small" style={{ fontFamily: 'var(--mono)' }}>
                      <span class="p0">{formatScore(a)}</span> / <span class="p1">{formatScore(b)}</span> <b style={{ fontFamily: 'var(--serif)', fontSize: '17px' }}>Δ{formatScore(v.disagreement)}</b>
                    </span>
                  </a>
                );
              })}
            </div>
          ) : (
            <p class="muted small">When you both rate the same beer differently, the biggest gaps show up here.</p>
          )}
        </ChartCard>

        <ChartCard title="Beer map" sub={d.places.length ? `${plural(d.places.length, 'place')} in our history` : undefined}>
          {d.places.length ? (
            <BeerMap places={d.places} />
          ) : (
            <p class="muted small">Add a city, state, or country when you log and your map will fill in — only with places you've actually been.</p>
          )}
        </ChartCard>
      </section>

      <section class="section">
        <a class="card pad" href={href('gallery')} style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
          <IconPhoto width={28} height={28} />
          <div style={{ flex: 1 }}>
            <h3>The gallery</h3>
            <div class="small muted">Every photo from our history, as a scrapbook.</div>
          </div>
          <span aria-hidden="true">→</span>
        </a>
      </section>
    </div>
  );
}
