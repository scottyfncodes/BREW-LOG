import { useMemo, useState } from 'preact/hooks';
import { useStore } from '../store';
import { parseCSV } from '../data/csv';
import { analyzeRows, autoMap, fieldDefs, planImport, type FieldKey, type Mapping } from '../data/importer';
import { formatScore, plural, todayISO } from '../data/util';
import { navigate, back } from '../router';
import { PageHead, toast } from '../ui/components';
import { IconUpload, IconX } from '../ui/icons';

export function Import() {
  const store = useStore();
  const people = store.people;
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<Mapping>({});
  const [includeRepeats, setIncludeRepeats] = useState(true);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const defs = fieldDefs(people);

  const headers = rows.length ? (hasHeader ? rows[0] : rows[0].map((_, i) => `Column ${i + 1}`)) : [];
  const body = hasHeader ? rows.slice(1) : rows;

  const load = (text: string, name: string) => {
    const parsed = parseCSV(text);
    if (!parsed.length) {
      setError('That file looks empty.');
      return;
    }
    setError('');
    setFileName(name);
    setRows(parsed);
    setMapping(autoMap(parsed[0], people));
  };

  const onFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (/\.(xlsx?|numbers)$/i.test(f.name)) {
      setError('Export your spreadsheet as CSV first (File → Export → CSV), then import that file.');
      return;
    }
    load(await f.text(), f.name);
  };

  const analyzed = useMemo(() => (rows.length ? analyzeRows(body, mapping, store.snap) : []), [rows, mapping, hasHeader, store.snap]);
  const counts = useMemo(() => {
    const c = { new: 0, repeat: 0, duplicate: 0, invalid: 0 };
    for (const r of analyzed) c[r.status]++;
    return c;
  }, [analyzed]);
  const willImport = counts.new + (includeRepeats ? counts.repeat : 0) + (includeDuplicates ? counts.duplicate : 0);
  const mapped = new Set(Object.values(mapping).filter(Boolean));
  const missingBeer = !mapped.has('beer');

  const commit = async () => {
    setBusy(true);
    try {
      const plan = planImport(analyzed, store.snap, { includeDuplicates, includeRepeats, fallbackDate: todayISO() });
      await store.applyImport(plan);
      toast(`Imported ${plural(plan.beers.length, 'beer')}`, 3000);
      navigate('', undefined, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
      setBusy(false);
    }
  };

  return (
    <div class="page-enter" style={{ maxWidth: '860px', margin: '0 auto' }}>
      <PageHead
        eyebrow="Import"
        title="Bring in the spreadsheet"
        right={
          <button class="icon-btn" aria-label="Close import" onClick={() => back('settings')}>
            <IconX />
          </button>
        }
      />

      {!rows.length && (
        <div class="card set-item">
          <p>
            Choose a <b>.csv</b> file. From Google Sheets: File → Download → CSV. From Excel or Numbers: Export → CSV. Include a header row if you
            have one — we'll guess which column is which.
          </p>
          <label class="btn primary" style={{ position: 'relative', justifySelf: 'start' }}>
            <IconUpload /> Choose CSV file
            <input type="file" accept=".csv,text/csv,text/plain" onChange={onFile} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} aria-label="Choose CSV file" />
          </label>
          <details>
            <summary class="small muted" style={{ cursor: 'pointer' }}>
              …or paste CSV text
            </summary>
            <textarea class="input" rows={6} placeholder={'Date,Brewery,Beer,Style,Scott,Ellen,Notes'} id="paste" style={{ marginTop: '8px' }} />
            <button class="btn" style={{ marginTop: '8px' }} onClick={() => load((document.getElementById('paste') as HTMLTextAreaElement).value, 'pasted text')}>
              Use pasted text
            </button>
          </details>
          {error && <div class="error">{error}</div>}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div class="card set-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <div>
                <h3>1 · Match the columns</h3>
                <p class="small">
                  {fileName} · {plural(body.length, 'row')}
                </p>
              </div>
              <button class="btn sm" onClick={() => setRows([])}>
                Change file
              </button>
            </div>
            <label class="toggle">
              <span>First row is a header</span>
              <span class="switch">
                <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.currentTarget.checked)} />
                <span />
              </span>
            </label>
            <div>
              {headers.map((h, i) => (
                <div class="map-row" key={i}>
                  <div class="col">
                    {h || `Column ${i + 1}`}
                    <small>{body.slice(0, 3).map((r) => r[i]).filter(Boolean).join(' · ') || 'empty'}</small>
                  </div>
                  <select
                    class="input"
                    aria-label={`Field for column ${h || i + 1}`}
                    value={mapping[i] ?? ''}
                    onChange={(e) => setMapping({ ...mapping, [i]: e.currentTarget.value as FieldKey | '' })}
                  >
                    <option value="">— Skip —</option>
                    {defs.map((d) => (
                      <option key={d.key} value={d.key} disabled={mapped.has(d.key) && mapping[i] !== d.key}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {missingBeer && <div class="error">Map a column to “Beer” to continue.</div>}
            <p class="small muted">Shared score is only used when neither individual score is present. Individual scores are never overwritten.</p>
          </div>

          {!missingBeer && (
            <div class="card set-item" style={{ marginTop: '12px' }}>
              <h3>2 · Preview</h3>
              <div class="chips wrap">
                <span class="status new">{counts.new} new</span>
                {counts.repeat > 0 && <span class="status repeat">{counts.repeat} same beer, new date</span>}
                {counts.duplicate > 0 && <span class="status duplicate">{counts.duplicate} duplicates</span>}
                {counts.invalid > 0 && <span class="status invalid">{counts.invalid} skipped</span>}
              </div>
              {counts.repeat > 0 && (
                <label class="toggle">
                  <span class="small">
                    Import beers we've logged before on a <b>different date</b> (a re-encounter)
                  </span>
                  <span class="switch">
                    <input type="checkbox" checked={includeRepeats} onChange={(e) => setIncludeRepeats(e.currentTarget.checked)} />
                    <span />
                  </span>
                </label>
              )}
              {counts.duplicate > 0 && (
                <label class="toggle">
                  <span class="small">
                    Also import exact <b>duplicates</b> (same brewery, beer and date as an existing entry)
                  </span>
                  <span class="switch">
                    <input type="checkbox" checked={includeDuplicates} onChange={(e) => setIncludeDuplicates(e.currentTarget.checked)} />
                    <span />
                  </span>
                </label>
              )}
              <div class="preview-wrap">
                <table class="preview-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Beer</th>
                      <th>Brewery</th>
                      <th>Style</th>
                      {people.map((p) => (
                        <th key={p.id}>{p.name}</th>
                      ))}
                      <th>Date</th>
                      <th>Place</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyzed.slice(0, 200).map((r) => (
                      <tr key={r.index} title={r.issues.join('\n')}>
                        <td>
                          <span class={`status ${r.status}`}>{r.status === 'repeat' ? 'again' : r.status}</span>
                          {r.issues.length > 0 && r.status !== 'invalid' && <div class="small muted">⚠︎ {r.issues[0]}</div>}
                        </td>
                        <td>{r.beer || <span class="muted">{r.issues[0]}</span>}</td>
                        <td>{r.brewery}</td>
                        <td>{r.style}</td>
                        {people.map((p) => (
                          <td key={p.id}>{r.scores[p.id] !== undefined ? formatScore(r.scores[p.id]) : r.shared !== undefined && !Object.keys(r.scores).length ? <span class="muted">{formatScore(r.shared)}*</span> : ''}</td>
                        ))}
                        <td style={{ whiteSpace: 'nowrap' }}>{r.date ?? <span class="muted">today</span>}</td>
                        <td>{[r.location, r.city, r.state, r.country].filter(Boolean).join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {analyzed.length > 200 && <p class="small muted">Showing the first 200 of {analyzed.length} rows.</p>}
              {error && <div class="error">{error}</div>}
              <button class="btn primary block" disabled={!willImport || busy} onClick={commit}>
                {busy ? 'Importing…' : `Import ${plural(willImport, 'beer')}`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
