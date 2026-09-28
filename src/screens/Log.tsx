import { useMemo, useState } from 'preact/hooks';
import { useStore, ValidationError, type BeerInput } from '../store';
import type { ID, Photo } from '../data/types';
import { formatScore, todayISO } from '../data/util';
import { sharedScore, chronoDesc } from '../data/views';
import { STYLE_SUGGESTIONS } from '../data/styles';
import { processPhoto } from '../data/image';
import { navigate, back } from '../router';
import { ScoreControl } from '../ui/ScoreControl';
import { toast, PageHead } from '../ui/components';
import { IconCamera, IconX, IconTrash, IconPin } from '../ui/icons';
import { usePhoto } from '../store';

function rankBy<T>(items: T[], key: (t: T) => string): string[] {
  const counts = new Map<string, number>();
  for (const i of items) {
    const k = key(i).trim();
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

function matches(options: string[], q: string, limit = 6): string[] {
  const t = q.trim().toLowerCase();
  if (!t) return options.slice(0, limit);
  const starts = options.filter((o) => o.toLowerCase().startsWith(t));
  const contains = options.filter((o) => !o.toLowerCase().startsWith(t) && o.toLowerCase().includes(t));
  return [...starts, ...contains].filter((o) => o.toLowerCase() !== t).slice(0, limit);
}

export function Log({ id }: { id?: ID }) {
  const store = useStore();
  const people = store.people;
  const existing = id ? store.view(id) : undefined;
  const b = existing?.beer;

  const [name, setName] = useState(b?.name ?? '');
  const [brewery, setBrewery] = useState(existing?.brewery?.name ?? '');
  const [style, setStyle] = useState(b?.style ?? '');
  const [scores, setScores] = useState<Record<ID, number | undefined>>(existing ? { ...existing.scores } : {});
  const [date, setDate] = useState(b?.date ?? todayISO());
  const [notes, setNotes] = useState(b?.notes ?? '');
  const [location, setLocation] = useState(b?.location ?? '');
  const [city, setCity] = useState(b?.city ?? '');
  const [state, setState] = useState(b?.state ?? '');
  const [country, setCountry] = useState(b?.country ?? '');
  const [abv, setAbv] = useState(b?.abv !== undefined ? String(b.abv) : '');
  const [firstTime, setFirstTime] = useState<boolean | undefined>(b?.firstTime);
  const [photo, setPhoto] = useState<Photo | null | undefined>(undefined);
  const [photoPreview, setPhotoPreview] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [breweryFocus, setBreweryFocus] = useState(false);
  const [styleFocus, setStyleFocus] = useState(false);
  const existingPhoto = usePhoto(photo === undefined ? b?.photoId : undefined, 'thumb');

  const breweryOptions = useMemo(() => {
    const recent = [...store.views].sort(chronoDesc).map((v) => v.breweryName);
    return [...new Set([...recent, ...store.snap.breweries.map((x) => x.name)])];
  }, [store.views]);
  const styleOptions = useMemo(() => {
    const used = rankBy(store.snap.beers, (x) => x.style);
    const lower = new Set(used.map((u) => u.toLowerCase()));
    return [...used, ...STYLE_SUGGESTIONS.filter((s) => !lower.has(s.toLowerCase()))];
  }, [store.views]);
  const lastPlace = useMemo(() => {
    const v = [...store.views].sort(chronoDesc).find((x) => x.beer.location || x.beer.city);
    return v?.beer;
  }, [store.views]);

  const values = people.map((p) => scores[p.id]).filter((s): s is number => s !== undefined);
  const shared = values.length >= 2 ? sharedScore(values) : undefined;

  const pickPhoto = async (e: Event) => {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      setBusy(true);
      const p = await processPhoto(file);
      setPhoto(p);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(URL.createObjectURL(p.thumb));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use that photo.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    setError(undefined);
    const abvNum = abv.trim() ? parseFloat(abv.replace(',', '.').replace('%', '')) : undefined;
    const input: BeerInput = {
      id,
      name,
      breweryName: brewery,
      style,
      date,
      scores,
      notes,
      location,
      city,
      state,
      country,
      abv: abvNum,
      firstTime,
      photo,
    };
    try {
      setBusy(true);
      const savedId = await store.saveBeer(input);
      if (id) {
        toast('Changes saved');
        navigate(`beer/${savedId}`, undefined, true);
      } else {
        toast('Beer saved');
        navigate('', undefined, true);
        window.scrollTo({ top: 0 });
      }
    } catch (err) {
      setError(err instanceof ValidationError || err instanceof Error ? err.message : 'Something went wrong saving.');
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!id || !confirm(`Delete “${b?.name}”? This can't be undone.`)) return;
    await store.deleteBeer(id);
    toast('Beer deleted');
    navigate('beers', undefined, true);
  };

  const shownPhoto = photo === null ? undefined : photoPreview ?? existingPhoto;
  const brewerySuggest = breweryFocus ? matches(breweryOptions, brewery, 5) : [];
  const styleSuggest = matches(styleOptions, style, styleFocus || !style ? 8 : 0);
  const moreFilled = !!(location || city || state || country || abv || firstTime !== undefined);

  return (
    <div class="log-page page-enter">
      <PageHead
        eyebrow={id ? 'Edit entry' : 'New entry'}
        title={id ? 'Edit beer' : 'Log a beer'}
        right={
          <button type="button" class="icon-btn" aria-label="Cancel" onClick={() => back(id ? `beer/${id}` : '')}>
            <IconX />
          </button>
        }
      />
      <form class="form" onSubmit={submit} noValidate>
        <div class="field">
          <label for="f-name">Beer</label>
          <input id="f-name" class="input big" value={name} onInput={(e) => setName(e.currentTarget.value)} placeholder="Maharaja IPA" autocomplete="off" enterKeyHint="next" required />
        </div>

        <div class="field">
          <label for="f-brewery">Brewery</label>
          <input
            id="f-brewery"
            class="input"
            value={brewery}
            onInput={(e) => setBrewery(e.currentTarget.value)}
            onFocus={() => setBreweryFocus(true)}
            onBlur={() => setTimeout(() => setBreweryFocus(false), 150)}
            placeholder="Avery Brewing"
            autocomplete="off"
            enterKeyHint="next"
          />
          {brewerySuggest.length > 0 && (
            <div class="suggest" role="listbox" aria-label="Breweries you've logged">
              {brewerySuggest.map((o) => (
                <button type="button" class="chip" key={o} onMouseDown={(e) => e.preventDefault()} onClick={() => { setBrewery(o); setBreweryFocus(false); }}>
                  {o}
                </button>
              ))}
            </div>
          )}
        </div>

        <div class="field">
          <label for="f-style">Style</label>
          <input
            id="f-style"
            class="input"
            value={style}
            onInput={(e) => setStyle(e.currentTarget.value)}
            onFocus={() => setStyleFocus(true)}
            onBlur={() => setTimeout(() => setStyleFocus(false), 150)}
            placeholder="IPA, Pilsner, anything"
            autocomplete="off"
          />
          {styleSuggest.length > 0 && (
            <div class="chips" aria-label="Style suggestions">
              {styleSuggest.map((o) => (
                <button type="button" class="chip" key={o} aria-pressed={o === style} onMouseDown={(e) => e.preventDefault()} onClick={() => setStyle(o)}>
                  {o}
                </button>
              ))}
            </div>
          )}
        </div>

        <div class="field">
          <span class="label">Score</span>
          <div style={{ display: 'grid', gap: '10px' }}>
            {people.map((p, i) => (
              <ScoreControl
                key={p.id}
                id={`score-${p.id}`}
                label={p.name}
                colorVar={`--p${i}`}
                value={scores[p.id]}
                onChange={(v) => setScores((s) => ({ ...s, [p.id]: v }))}
              />
            ))}
          </div>
          {shared !== undefined && (
            <div class="shared-line" aria-live="polite">
              <span class="label">Shared score</span>
              <span class={`v ${shared === 10 ? 'summit' : ''}`}>{formatScore(shared)}</span>
            </div>
          )}
        </div>

        <div class="field">
          <label for="f-date">Date</label>
          <input id="f-date" type="date" class="input" value={date} max="2100-12-31" onInput={(e) => setDate(e.currentTarget.value)} />
        </div>

        <div class="field">
          <label for="f-notes">Notes & memories</label>
          <textarea id="f-notes" class="input" value={notes} onInput={(e) => setNotes(e.currentTarget.value)} placeholder="Had this after hiking. Big citrus. Ellen loved it…" rows={3} />
        </div>

        <div class="field">
          <span class="label">Photo</span>
          <div class="photo-drop">
            {shownPhoto ? (
              <>
                <img src={shownPhoto} alt="Selected beer photo" />
                <button
                  type="button"
                  class="icon-btn photo-remove"
                  aria-label="Remove photo"
                  onClick={() => {
                    setPhoto(null);
                    setPhotoPreview(undefined);
                  }}
                >
                  <IconX />
                </button>
              </>
            ) : (
              <>
                <div class="ph">
                  <IconCamera />
                  Add a photo
                </div>
                <input type="file" accept="image/*" aria-label="Add a photo" onChange={pickPhoto} />
              </>
            )}
          </div>
        </div>

        <details class="disclosure" open={moreFilled}>
          <summary>
            <span>Where & more</span>
            <span class="muted small">optional</span>
          </summary>
          <div class="inner">
            {lastPlace && !location && !city && (
              <button
                type="button"
                class="chip"
                style={{ justifySelf: 'start' }}
                onClick={() => {
                  setLocation(lastPlace.location ?? '');
                  setCity(lastPlace.city ?? '');
                  setState(lastPlace.state ?? '');
                  setCountry(lastPlace.country ?? '');
                }}
              >
                <IconPin width={14} height={14} /> Same place as last time · {lastPlace.location || lastPlace.city}
              </button>
            )}
            <div class="field">
              <label for="f-where">Where</label>
              <input id="f-where" class="input" value={location} onInput={(e) => setLocation(e.currentTarget.value)} placeholder="Taproom, home, a friend's porch…" autocomplete="off" />
            </div>
            <div class="grid2">
              <div class="field">
                <label for="f-city">City</label>
                <input id="f-city" class="input" value={city} onInput={(e) => setCity(e.currentTarget.value)} autocomplete="address-level2" />
              </div>
              <div class="field">
                <label for="f-state">State / region</label>
                <input id="f-state" class="input" value={state} onInput={(e) => setState(e.currentTarget.value)} autocomplete="address-level1" />
              </div>
            </div>
            <div class="grid2">
              <div class="field">
                <label for="f-country">Country</label>
                <input id="f-country" class="input" value={country} onInput={(e) => setCountry(e.currentTarget.value)} autocomplete="country-name" />
              </div>
              <div class="field">
                <label for="f-abv">ABV %</label>
                <input id="f-abv" class="input" inputMode="decimal" value={abv} onInput={(e) => setAbv(e.currentTarget.value)} placeholder="6.5" />
              </div>
            </div>
            <div class="field">
              <span class="label">First time trying it?</span>
              <div class="chips wrap" role="group" aria-label="First time trying it?">
                {([['Yes', true], ['No', false], ['Not sure', undefined]] as const).map(([l, v]) => (
                  <button type="button" key={l} class="chip" aria-pressed={firstTime === v} onClick={() => setFirstTime(v)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </details>

        {error && (
          <div class="error" role="alert">
            {error}
          </div>
        )}

        <div class="form-actions">
          {id && (
            <button type="button" class="btn danger" onClick={remove} aria-label="Delete beer" style={{ flex: '0 0 auto' }}>
              <IconTrash />
            </button>
          )}
          <button type="submit" class="btn primary block" disabled={busy}>
            {busy ? 'Saving…' : id ? 'Save changes' : 'Save beer'}
          </button>
        </div>
      </form>
    </div>
  );
}
