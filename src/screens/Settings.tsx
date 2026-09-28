import { useEffect, useState } from 'preact/hooks';
import { useStore } from '../store';
import { exportCSV } from '../data/importer';
import { makeBackup, parseBackup } from '../data/backup';
import { plural, todayISO } from '../data/util';
import { href } from '../router';
import { PageHead, toast } from '../ui/components';
import { IconDownload, IconUpload } from '../ui/icons';

export function download(name: string, data: string | Blob, type = 'text/plain') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

type Theme = 'system' | 'light' | 'dark';

export function applyTheme(t: Theme) {
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  const meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (meta) meta.setAttribute('content', t === 'dark' ? '#17131a' : '#1a1622');
}

export function savedTheme(): Theme {
  try {
    return (localStorage.getItem('bl-theme') as Theme) || 'system';
  } catch {
    return 'system';
  }
}

export function Settings() {
  const store = useStore();
  const [names, setNames] = useState(store.people.map((p) => p.name));
  const [theme, setTheme] = useState<Theme>(savedTheme);
  const [storage, setStorage] = useState<{ usage?: number; quota?: number; persisted?: boolean }>({});
  const [busy, setBusy] = useState('');

  useEffect(() => {
    (async () => {
      const est = await navigator.storage?.estimate?.().catch(() => undefined);
      const persisted = await navigator.storage?.persisted?.().catch(() => undefined);
      setStorage({ usage: est?.usage, quota: est?.quota, persisted });
    })();
  }, [store.views]);

  const setThemePref = (t: Theme) => {
    setTheme(t);
    try {
      localStorage.setItem('bl-theme', t);
    } catch {
      /* ignore */
    }
    applyTheme(t);
  };

  const savePeople = async () => {
    const people = store.people.map((p, i) => ({ ...p, name: names[i].trim() || p.name }));
    await store.updatePeople(people);
    toast('Names saved');
  };

  const exportJSON = async () => {
    setBusy('json');
    try {
      const backup = await makeBackup(store.snap, await store.repo.allPhotos());
      download(`brew-log-backup-${todayISO()}.json`, JSON.stringify(backup), 'application/json');
      toast('Backup downloaded');
    } finally {
      setBusy('');
    }
  };

  const restore = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      setBusy('restore');
      const { snapshot, photos } = parseBackup(await file.text());
      const { added, updated } = await store.restore(snapshot, photos);
      toast(`Restored: ${plural(added, 'new beer')}${updated ? `, ${updated} updated` : ''}`, 3500);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not restore that file.');
    } finally {
      setBusy('');
    }
  };

  const n = store.snap.beers.length;
  const mb = (b?: number) => (b === undefined ? '—' : b < 1e6 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1e6).toFixed(1)} MB`);
  const dirty = names.some((nm, i) => nm !== store.people[i]?.name);

  return (
    <div class="page-enter" style={{ maxWidth: '720px', margin: '0 auto' }}>
      <PageHead eyebrow="Settings" title="The logbook" />
      <div class="settings-list">
        <section class="card set-item">
          <h3>Tasters</h3>
          <p>Two people, two sets of scores. Renaming keeps every rating.</p>
          {store.people.map((p, i) => (
            <div class="field" key={p.id}>
              <label for={`person-${p.id}`}>
                <span class={`dot p${i}`} /> Taster {i + 1}
              </label>
              <input id={`person-${p.id}`} class="input" value={names[i]} onInput={(e) => setNames(names.map((x, j) => (j === i ? e.currentTarget.value : x)))} />
            </div>
          ))}
          {dirty && (
            <button class="btn primary" onClick={savePeople}>
              Save names
            </button>
          )}
        </section>

        <section class="card set-item">
          <h3>Appearance</h3>
          <div class="chips wrap" role="group" aria-label="Theme">
            {(['system', 'light', 'dark'] as Theme[]).map((t) => (
              <button key={t} class="chip" aria-pressed={theme === t} onClick={() => setThemePref(t)}>
                {t === 'system' ? 'Match device' : t === 'light' ? 'Field journal (light)' : 'Taproom (dark)'}
              </button>
            ))}
          </div>
        </section>

        <section class="card set-item">
          <h3>Export data</h3>
          <p>Your history is yours. Take it anywhere, any time.</p>
          <div class="row" style={{ flexWrap: 'wrap' }}>
            <button class="btn" disabled={!n} onClick={() => download(`brew-log-${todayISO()}.csv`, '﻿' + exportCSV(store.snap), 'text/csv;charset=utf-8')}>
              <IconDownload /> CSV spreadsheet
            </button>
            <button class="btn" disabled={!n || busy === 'json'} onClick={exportJSON}>
              <IconDownload /> {busy === 'json' ? 'Packing…' : 'Full backup (JSON + photos)'}
            </button>
          </div>
        </section>

        <section class="card set-item">
          <h3>Import data</h3>
          <p>Bring in your spreadsheet (CSV). You'll map the columns and preview everything before anything is saved. Duplicates are flagged, never overwritten.</p>
          <div class="row" style={{ flexWrap: 'wrap' }}>
            <a class="btn primary" href={href('import')}>
              <IconUpload /> Import CSV
            </a>
            <label class="btn" style={{ position: 'relative' }}>
              <IconUpload /> {busy === 'restore' ? 'Restoring…' : 'Restore JSON backup'}
              <input type="file" accept="application/json,.json" onChange={restore} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} aria-label="Restore JSON backup" />
            </label>
          </div>
          <p class="small muted">Restoring merges by entry: nothing is deleted, and the most recently edited version of each beer wins.</p>
        </section>

        <section class="card set-item">
          <h3>Demo data</h3>
          {store.hasDemo ? (
            <>
              <p>{plural(store.snap.beers.filter((b) => b.demo).length, 'demo beer')} are loaded and labeled “DEMO”. Clearing them leaves your own entries untouched.</p>
              <button
                class="btn"
                onClick={async () => {
                  await store.clear('demo');
                  toast('Demo data cleared');
                }}
              >
                Clear demo data
              </button>
            </>
          ) : (
            <>
              <p>Load a small, clearly-labeled fictional history to see how the landscape and insights look with more data.</p>
              <button
                class="btn"
                onClick={async () => {
                  await store.loadDemo();
                  toast('Demo data loaded');
                }}
              >
                Load demo data
              </button>
            </>
          )}
        </section>

        <section class="card set-item">
          <h3>Storage</h3>
          <p>
            Everything lives on this device, in your browser's database — no account, no server.
            {storage.usage !== undefined && ` Using ${mb(storage.usage)}.`}
            {storage.persisted === true && ' Storage is marked persistent.'}
          </p>
          <p class="small muted">
            Tip: on iPhone, add BREW LOG to your Home Screen (Share → Add to Home Screen). Export a backup now and then — it's the one thing
            that survives a lost phone.
          </p>
        </section>

        <section class="card set-item">
          <h3 style={{ color: 'var(--danger)' }}>Start over</h3>
          <p>Permanently delete every beer, rating, brewery and photo on this device.</p>
          <button
            class="btn danger"
            disabled={!n}
            onClick={async () => {
              if (!confirm(`Delete all ${plural(n, 'beer')} and photos? This can't be undone.`)) return;
              if (!confirm('Really delete everything? Consider exporting a backup first.')) return;
              await store.clear('all');
              toast('Everything deleted');
            }}
          >
            Delete everything
          </button>
        </section>

        <p class="small muted" style={{ textAlign: 'center', marginTop: '10px' }}>
          BREW LOG · v{__APP_VERSION__} · made for two
        </p>
      </div>
    </div>
  );
}
