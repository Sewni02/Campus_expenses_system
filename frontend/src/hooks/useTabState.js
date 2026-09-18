import { useSearchParams } from 'react-router-dom';

// Keeps a tab / section selection in the URL instead of in component state.
//
// Because the value lives in the query string, a page refresh (F5), a copied
// link, or the browser back/forward buttons all land the user on exactly the
// same tab they were on.
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
    const params = new URLSearchParams(searchParams);

    if (next === defaultValue) {
      params.delete(key);
    } else {
      params.set(key, next);
    }

    // replace: true -> switching tabs does not pile up history entries.
    // Change to { replace: false } if you want the back button to step
    // through previously opened tabs.
    setSearchParams(params, { replace: true });
  };

  return [value, setValue];
}