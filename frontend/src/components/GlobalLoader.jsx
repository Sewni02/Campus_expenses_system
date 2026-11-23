import { useEffect, useState, useSyncExternalStore } from 'react';
import { subscribe, getSnapshot } from '../config/loadingStore';
import markUrl from '../assets/xpendly-mark.png';
import './GlobalLoader.css';

// Shows that "something is happening" whenever an API request is running.
//   - Thin progress bar at the top : any request (instant feedback)
//   - Centered loading card         : saves/uploads/deletes (POST/PUT/PATCH/DELETE),
//                                     or any request still running after 800 ms.
//     It also blocks clicks so a button can't be pressed twice by accident.
//   - "Server is waking up" message : if it still hasn't finished after 6 s
//     (free hosting often sleeps when nobody uses it).
// The small delays stop the screen flashing on very fast requests.
const OVERLAY_DELAY_WRITE_MS = 250;
const OVERLAY_DELAY_READ_MS = 800;
const SLOW_MS = 6000;

function GlobalLoader() {
  const { pending, writes } = useSyncExternalStore(subscribe, getSnapshot);
  const [showOverlay, setShowOverlay] = useState(false);
  const [slow, setSlow] = useState(false);

  const busy = pending > 0;
  const hasWrite = writes > 0;

  useEffect(() => {
    if (!busy) {
      setShowOverlay(false);
      setSlow(false);
      return undefined;
    }
    const overlayTimer = setTimeout(
      () => setShowOverlay(true),
      hasWrite ? OVERLAY_DELAY_WRITE_MS : OVERLAY_DELAY_READ_MS
    );
    const slowTimer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => {
      clearTimeout(overlayTimer);
      clearTimeout(slowTimer);
    };
  }, [busy, hasWrite]);

  if (!busy) return null;

  return (
    <>
      <div className="gl-bar" role="progressbar" aria-label="Loading" aria-busy="true">
        <div className="gl-bar-fill" />
      </div>

      {showOverlay && (
        <div className="gl-overlay" role="status" aria-live="polite">
          <div className="gl-card">
            <div className="gl-logo">
              <span className="gl-ring" />
              <span className="gl-ring gl-ring-inner" />
              <img className="gl-mark" src={markUrl} alt="" />
            </div>

            <p className="gl-text">
              {hasWrite ? 'Saving your changes' : 'Loading your data'}
              <span className="gl-dots" aria-hidden="true"><i /><i /><i /></span>
            </p>
            <p className="gl-hint">{hasWrite ? 'Please do not close or refresh this page.' : 'This will only take a moment.'}</p>

            <div className="gl-track" aria-hidden="true"><div className="gl-track-fill" /></div>

            {slow && (
              <div className="gl-slow">
                <b>Taking longer than usual</b>
                <span>The server may be waking up. Please keep this page open.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default GlobalLoader;