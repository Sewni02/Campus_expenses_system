import { useSearchParams } from 'react-router-dom';

// Keeps a tab / section selection in the URL instead of in component state.
//
// Because the value lives in the query string, a page refresh (F5), a copied
// link, or the browser back/forward buttons all land the user on exactly the
// same tab they were on. Every tab switch is a new history entry, so Back /
// Forward (and the arrow buttons in the sidebar) step through the tabs the
// user opened, in order.
//
// Usage (drop-in replacement for useState):
//   const [activeTab, setActiveTab] = useTabState('tab', 'A');
//   const [subTab, setSubTab]       = useTabState('sub', 'contractors');
//
// Rules:
//   - every key ('tab', 'sub', 'hw', ...) must be unique within one page
//   - the default value is never written to the URL, so links stay clean
export default function useTabState(key, defaultValue) {
  const [searchParams, setSearchParams] = useSearchParams();

  const value = searchParams.get(key) || defaultValue;

  const setValue = (next) => {
    if (next === value) return; // clicking the tab you are already on adds nothing to the history
    const params = new URLSearchParams(searchParams);

    if (next === defaultValue) {
      params.delete(key);
    } else {
      params.set(key, next);
    }

    // replace: false -> each tab switch is a history entry, so the back button
    // steps through previously opened tabs. (Use { replace: true } for a state
    // that should NOT be a separate "page" in the history.)
    setSearchParams(params, { replace: false });
  };

  return [value, setValue];
}