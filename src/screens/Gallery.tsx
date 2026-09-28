import { useMemo } from 'preact/hooks';
import { useStore, usePhoto } from '../store';
import type { BeerView } from '../data/types';
import { chronoDesc } from '../data/views';
import { formatDate, formatScore, hash01, plural } from '../data/util';
import { href } from '../router';
import { Empty, PageHead } from '../ui/components';
import { IconPlus } from '../ui/icons';

export function Gallery() {
  const store = useStore();
  const photos = useMemo(() => store.views.filter((v) => v.beer.photoId).sort(chronoDesc), [store.views]);
  return (
    <div class="page-enter">
      <PageHead eyebrow={photos.length ? plural(photos.length, 'photo') : 'Scrapbook'} title="The gallery" />
      {photos.length ? (
        <div class="gallery">
          {photos.map((v) => (
            <Polaroid key={v.beer.id} v={v} />
          ))}
        </div>
      ) : (
        <Empty title="No photos yet." action={<a class="btn primary" href={href('log')}><IconPlus /> Log a beer with a photo</a>}>
          Snap the glass, the label, the view. Photos you attach become a scrapbook of where we've been.
        </Empty>
      )}
    </div>
  );
}

function Polaroid({ v }: { v: BeerView }) {
  const url = usePhoto(v.beer.photoId);
  const rot = (hash01(v.beer.id) - 0.5) * 3;
  return (
    <a class="polaroid" href={href(`beer/${v.beer.id}`)} style={{ '--rot': `${rot.toFixed(2)}deg` }}>
      {url ? <img src={url} alt={`${v.beer.name} photo`} loading="lazy" decoding="async" /> : <div style={{ aspectRatio: '1', background: '#eee' }} />}
      <div class="cap">
        {v.beer.name} {v.score !== undefined && <span style={{ float: 'right', fontStyle: 'normal' }}>{formatScore(v.score)}</span>}
        <small>
          {v.breweryName.toUpperCase()}
          {v.beer.date ? ` · ${formatDate(v.beer.date, 'short')}` : ''}
          {v.beer.city ? ` · ${v.beer.city}` : ''}
        </small>
      </div>
    </a>
  );
}
