import { useEffect } from 'preact/hooks';
import { useStore } from './store';
import { href, useRoute } from './router';
import { Home } from './screens/Home';
import { Log } from './screens/Log';
import { Beers } from './screens/Beers';
import { BeerDetail } from './screens/BeerDetail';
import { Breweries, BreweryDetail } from './screens/Breweries';
import { Insights } from './screens/Insights';
import { Gallery } from './screens/Gallery';
import { Settings } from './screens/Settings';
import { Import } from './screens/Import';
import { ToastHost } from './ui/components';
import { TipHost } from './ui/charts';
import { BrandMark, IconBeers, IconBrewery, IconHome, IconInsights, IconPlus } from './ui/icons';

export function App() {
  const store = useStore();
  const route = useRoute();
  const [section, id] = route.path;

  useEffect(() => {
    if (section !== 'beers') window.scrollTo(0, 0);
  }, [route.path.join('/')]);

  if (!store.ready) return <div class="boot">BREW LOG</div>;
  if (store.error)
    return (
      <div class="boot" style={{ letterSpacing: 0, padding: '24px', textAlign: 'center' }}>
        Couldn't open the on-device database: {store.error}. Private browsing can block storage — try a normal window.
      </div>
    );

  let page;
  switch (section) {
    case undefined:
      page = <Home />;
      break;
    case 'log':
      page = <Log key={id ?? 'new'} id={id} />;
      break;
    case 'beers':
      page = <Beers key={route.query.toString()} query={route.query} />;
      break;
    case 'beer':
      page = <BeerDetail key={id} id={id} />;
      break;
    case 'breweries':
      page = <Breweries />;
      break;
    case 'brewery':
      page = <BreweryDetail key={id} id={id} />;
      break;
    case 'insights':
      page = <Insights />;
      break;
    case 'gallery':
      page = <Gallery />;
      break;
    case 'settings':
      page = <Settings />;
      break;
    case 'import':
      page = <Import />;
      break;
    default:
      page = <Home />;
  }

  const tab = section === undefined ? 'home' : section === 'beer' ? 'beers' : section === 'brewery' ? 'breweries' : section;
  const cur = (t: string) => (tab === t ? 'page' : undefined);

  return (
    <div class="app">
      <main class={`main ${section === undefined ? 'flush' : ''}`} id="main">
        {page}
      </main>
      <nav class="nav" aria-label="Primary">
        <a class="brand-mini" href={href('')} aria-label="BREW LOG home" style={{ display: 'none' }}>
          <BrandMark size={40} />
        </a>
        <a href={href('')} aria-current={cur('home')}>
          <IconHome />
          Home
        </a>
        <a href={href('beers')} aria-current={cur('beers')}>
          <IconBeers />
          Beers
        </a>
        <a class="log-btn" href={href('log')} aria-label="Log a beer" aria-current={cur('log')}>
          <IconPlus />
        </a>
        <a href={href('breweries')} aria-current={cur('breweries')}>
          <IconBrewery />
          Breweries
        </a>
        <a href={href('insights')} aria-current={cur('insights')}>
          <IconInsights />
          Insights
        </a>
      </nav>
      <ToastHost />
      <TipHost />
    </div>
  );
}
