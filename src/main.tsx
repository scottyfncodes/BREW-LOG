import { render } from 'preact';
import { App } from './App';
import { store } from './store';
import { applyTheme, savedTheme } from './screens/Settings';
import './styles.css';

applyTheme(savedTheme());
render(<App />, document.getElementById('app')!);
store.init();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
