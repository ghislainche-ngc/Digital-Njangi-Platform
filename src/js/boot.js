import Alpine from 'alpinejs';
import { createTheme } from './theme.js';
import { createI18n } from './i18n/index.js';

/* Register shared Alpine stores so every page can x-data="$store.*". */
Alpine.store('theme', createTheme());
Alpine.store('i18n',  createI18n());

/* Convenience: $t('login.title') from markup. */
Alpine.magic('t', () => (path) => Alpine.store('i18n').t(path));

setTimeout(() => Alpine.start(), 0);

/* PWA — register service worker in production builds. */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .catch((err) => console.warn('SW registration failed:', err));
  });
}

// Security: prevent back-button access after logout by checking token on page show
window.addEventListener('pageshow', () => {
  if (window.location.pathname.includes('/app/') && !localStorage.getItem('naas.jwt')) {
    window.location.replace('/login.html');
  }
});
