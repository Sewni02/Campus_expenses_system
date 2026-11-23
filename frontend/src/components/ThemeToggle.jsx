import { useState } from 'react';
import { loadSettings, saveSettings, applySettings, resolveTheme } from '../utils/appSettings';
import './ThemeToggle.css';

// Small sun / moon button for pages that have no sidebar (landing, login,
// sign up, forgot / reset password, waiting approval).
// It flips between light and dark and remembers the choice - the same setting
// the Settings page uses, so the whole app stays in sync.
//   <ThemeToggle />            sits inline (e.g. inside the landing nav)
//   <ThemeToggle floating />   fixed in the top-right corner of the page
function ThemeToggle({ floating = false }) {
  const [theme, setTheme] = useState(() => resolveTheme(loadSettings().theme));
  const isDark = theme === 'dark';

  const toggle = () => {
    const next = isDark ? 'light' : 'dark';
    const settings = { ...loadSettings(), theme: next };
    saveSettings(settings);
    applySettings(settings);
    setTheme(next);
  };

  return (
    <button
      type="button"
      className={`tt-btn ${floating ? 'tt-floating' : ''}`}
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {isDark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </>
        ) : (
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        )}
      </svg>
    </button>
  );
}

export default ThemeToggle;