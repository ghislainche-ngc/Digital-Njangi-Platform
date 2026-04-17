/* Theme store — light | dark | system.
   Persists to localStorage, respects prefers-color-scheme when "system". */

const STORAGE_KEY = 'naas.theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

function resolved(mode) {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  return media.matches ? 'dark' : 'light';
}

function apply(mode) {
  const effective = resolved(mode);
  document.documentElement.classList.toggle('dark', effective === 'dark');
  document.documentElement.dataset.theme = effective;
}

export function createTheme() {
  return {
    mode: localStorage.getItem(STORAGE_KEY) || 'system',
    init() {
      apply(this.mode);
      media.addEventListener('change', () => {
        if (this.mode === 'system') apply('system');
      });
    },
    set(next) {
      this.mode = next;
      localStorage.setItem(STORAGE_KEY, next);
      apply(next);
    },
    toggle() {
      this.set(resolved(this.mode) === 'dark' ? 'light' : 'dark');
    },
    get effective() {
      return resolved(this.mode);
    },
  };
}

/* Run on import so the <html> class is set before Alpine mounts,
   avoiding a light-mode flash on dark-preferring devices. */
apply(localStorage.getItem(STORAGE_KEY) || 'system');
