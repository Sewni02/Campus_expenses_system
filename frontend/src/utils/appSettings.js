// Basic app settings (theme, text size, table density, motion).
// Saved in localStorage on this device only - nothing is sent to the server.
// applySettings() writes the choices onto <html> as data-* attributes, and
// dark-theme.css / settings.css react to those attributes.

const KEY = 'xpendly-settings';

export const DEFAULT_SETTINGS = {
  theme: 'light', // 'light' | 'dark' | 'system'
  fontSize: 'medium', // 'small' | 'medium' | 'large'
  density: 'comfortable', // 'comfortable' | 'compact'
  reduceMotion: false,
};

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return { ...DEFAULT_SETTINGS, ...(saved || {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage blocked - the setting still applies for this visit */
  }
}

// 'system' follows the device's own light/dark choice.
export function resolveTheme(theme) {
  if (theme === 'system') {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme === 'dark' ? 'dark' : 'light';
}

export function applySettings(settings) {
  const root = document.documentElement;
  root.setAttribute('data-theme', resolveTheme(settings.theme));
  root.setAttribute('data-font-size', settings.fontSize);
  root.setAttribute('data-density', settings.density);
  root.setAttribute('data-motion', settings.reduceMotion ? 'reduce' : 'full');
  root.style.colorScheme = resolveTheme(settings.theme);
}

// Call once at start-up (main.jsx). Also keeps "system" theme live when the
// device switches between light and dark.
export function initSettings() {
  applySettings(loadSettings());
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const s = loadSettings();
      if (s.theme === 'system') applySettings(s);
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
  }
}