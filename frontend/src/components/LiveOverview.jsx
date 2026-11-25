import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../config/api';
import './LiveOverview.css';

// Live money overview for the landing page (replaces the old hero photo).
//   - "This month"  : bar graph of what each function spent this month
//   - "Year so far" : bar graph of the total spent in every month, January -> the month the page was opened
// Numbers come from GET /api/public/landing-summary (totals only, no individual records).
// Plain fetch() is used on purpose, so the global loading overlay never pops up over the landing page.

const FUNCTIONS = [
  { key: 'constructions', label: 'Constructions', color: '#2469C9' },
  { key: 'officeExpenses', label: 'Office Expenses', color: '#1FB5A4' },
  { key: 'pettyCash', label: 'Petty Cash', color: '#7C6CF2' },
  { key: 'lecturerSalary', label: 'Lecturer Salary', color: '#F2A93B' },
  { key: 'staffSalary', label: 'Staff Salary', color: '#E5586E' },
];

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const REFRESH_MS = 60 * 1000;

const lkr = (n) => `LKR ${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const compact = (n) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n) || 0);

const prefersReducedMotion = () =>
  document.documentElement.getAttribute('data-motion') === 'reduce' ||
  (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

// Counts a number up from 0 (or from its previous value) once `active` is true.
function useCountUp(target, active, duration = 1400) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!active) return undefined;
    const from = fromRef.current;
    const start = performance.now();
    // With reduced motion the number just jumps to its final value (one frame).
    const length = prefersReducedMotion() ? 1 : duration;
    let frame;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / length);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out
      setValue(from + (target - from) * eased);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, duration]);

  return value;
}

// true once the element has scrolled into view (so the animation plays when the visitor sees it).
function useInView(ref) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return seen;
}

function LiveOverview() {
  const rootRef = useRef(null);
  const inView = useInView(rootRef);
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/public/landing-summary`);
        if (!res.ok) throw new Error('bad response');
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // If the server can't be reached the chart still shows, with zero bars.
  const now = new Date();
  const monthKey = data?.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const year = Number(monthKey.slice(0, 4));
  const monthIndex = Number(monthKey.slice(5, 7)) - 1;

  const thisMonth = data?.thisMonth || {};
  const yearToDate = data?.yearToDate || {};
  const monthly = data?.monthly?.length
    ? data.monthly
    : Array.from({ length: monthIndex + 1 }, (_, i) => ({ month: `${year}-${String(i + 1).padStart(2, '0')}`, grandTotal: 0 }));

  const funcMax = Math.max(1, ...FUNCTIONS.map((f) => Number(thisMonth[f.key]) || 0));
  const monthMax = Math.max(1, ...monthly.map((m) => Number(m.grandTotal) || 0));

  const play = inView && (data !== null || failed);
  const monthTotal = useCountUp(Number(thisMonth.grandTotal) || 0, play);
  const ytdTotal = useCountUp(Number(yearToDate.grandTotal) || 0, play);

  return (
    <div className={`lo-wrap ${play ? 'lo-play' : ''}`} ref={rootRef}>
      <div className="lo-blob lo-blob-a" aria-hidden="true" />
      <div className="lo-blob lo-blob-b" aria-hidden="true" />

      <div className="lo-head">
        <span className="lo-live"><i /> Live</span>
        <span className="lo-head-text">Live spending overview</span>
        {failed && <span className="lo-note">Live data unavailable right now</span>}
      </div>

      <div className="lo-grid">
        {/* ---------- This month ---------- */}
        <div className="lo-card">
          <div className="lo-card-top">
            <div>
              <span className="lo-label">This month</span>
              <h4 className="lo-title">{MONTH_LONG[monthIndex]} {year}</h4>
            </div>
            <div className="lo-total">
              <small>Total spent</small>
              <strong>{lkr(monthTotal)}</strong>
            </div>
          </div>

          <div className="lo-hbars">
            {FUNCTIONS.map((f, i) => {
              const amount = Number(thisMonth[f.key]) || 0;
              const pct = play ? Math.max(amount > 0 ? 3 : 0, (amount / funcMax) * 100) : 0;
              return (
                <div className="lo-hrow" key={f.key} style={{ '--delay': `${i * 110}ms` }}>
                  <span className="lo-hname">{f.label}</span>
                  <div className="lo-htrack">
                    <div className="lo-hfill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${f.color}, ${f.color}CC)` }} />
                  </div>
                  <span className="lo-hval" title={lkr(amount)}>{compact(amount)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---------- Year so far ---------- */}
        <div className="lo-card">
          <div className="lo-card-top">
            <div>
              <span className="lo-label">Year so far</span>
              <h4 className="lo-title">Jan – {MONTH_SHORT[monthIndex]} {year}</h4>
            </div>
            <div className="lo-total">
              <small>Total spent</small>
              <strong>{lkr(ytdTotal)}</strong>
            </div>
          </div>

          <div className="lo-vbars" style={{ '--cols': monthly.length }}>
            {monthly.map((m, i) => {
              const amount = Number(m.grandTotal) || 0;
              const pct = play ? Math.max(amount > 0 ? 3 : 0, (amount / monthMax) * 100) : 0;
              const isCurrent = m.month === monthKey;
              return (
                <div className={`lo-vcol ${isCurrent ? 'current' : ''}`} key={m.month} style={{ '--delay': `${i * 70}ms` }}>
                  <span className="lo-vval">{amount > 0 ? compact(amount) : ''}</span>
                  <div className="lo-vtrack" title={`${MONTH_LONG[i]}: ${lkr(amount)}`}>
                    <div className="lo-vfill" style={{ height: `${pct}%` }} />
                  </div>
                  <span className="lo-vname">{MONTH_SHORT[Number(m.month.slice(5, 7)) - 1]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveOverview;