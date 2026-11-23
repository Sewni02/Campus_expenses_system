import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatMoney, monthLabel } from '../utils/pettyCash';
import './GrandTotal.css';

// ---------------------------------------------------------------------------
// Super Admin -> "Grand Total" tab
//
//   Every function's SPENT money added together, month by month:
//     Constructions + Office Expenses + Petty Cash + Lecturer Salary + Staff Salary = Grand Total
//
//   Pick a YEAR and a MONTH (each can also be "All") and only the matching months are shown:
//     - the cards show the total of every function (and the grand total) of what was picked,
//     - the table lists the picked month(s) with a total row at the bottom.
//
//   The figures come from GET /api/grand-total - the same paid / saved records the function tabs use.
//   Pending / unpaid items are never counted.
// ---------------------------------------------------------------------------

const FUNCTIONS = [
  { key: 'constructions', label: 'Constructions', hint: 'Paid construction, contractor & hardware payments', color: '#2469C9' },
  { key: 'officeExpenses', label: 'Office Expenses', hint: 'Paid office bills', color: '#1FB5A4' },
  { key: 'pettyCash', label: 'Petty Cash', hint: 'Petty cash vouchers spent', color: '#D69E2E' },
  { key: 'lecturerSalary', label: 'Lecturer Salary', hint: 'Paid lecturer salaries', color: '#7C5CCB' },
  { key: 'staffSalary', label: 'Staff Salary', hint: 'Net staff salaries', color: '#2F7D57' },
];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ALL = 'all';
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// adds up a list of month rows into one total row
const sumRows = (rows) => {
  const total = {};
  FUNCTIONS.forEach((f) => { total[f.key] = round2(rows.reduce((t, r) => t + r[f.key], 0)); });
  total.grandTotal = round2(rows.reduce((t, r) => t + r.grandTotal, 0));
  return total;
};

function GrandTotal() {
  const [data, setData] = useState(null); // { months, allTime }
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(ALL); // 'all' or '2026'
  const [month, setMonth] = useState(ALL); // 'all' or '01'..'12'

  const load = () => {
    setLoading(true);
    setError('');
    axios
      .get('/api/grand-total')
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load the grand total'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const allMonths = useMemo(() => data?.months || [], [data]);

  // every year that has spending (newest first)
  // (the current year is always in the list, so a new year can be picked even before its first spending)
  const years = useMemo(() => {
    const set = new Set(allMonths.map((m) => m.month.slice(0, 4)));
    set.add(String(new Date().getFullYear()));
    return [...set].sort().reverse();
  }, [allMonths]);

  // only the months that match the picked year + month
  const rows = useMemo(
    () => allMonths.filter((m) => (year === ALL || m.month.slice(0, 4) === year) && (month === ALL || m.month.slice(5) === month)),
    [allMonths, year, month]
  );
  const total = useMemo(() => sumRows(rows), [rows]);

  // "November 2026", "2026", "November (all years)" or "All months"
  const title =
    year !== ALL && month !== ALL ? `${MONTH_NAMES[Number(month) - 1]} ${year}`
      : year !== ALL ? `Year ${year}`
        : month !== ALL ? `${MONTH_NAMES[Number(month) - 1]} (all years)`
          : 'All months';

  const downloadPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text(`Grand Total - ${title}`, 14, 16);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 14, 23);
    autoTable(doc, {
      startY: 28,
      head: [['Month', ...FUNCTIONS.map((f) => f.label), 'Grand Total']],
      body: rows.map((m) => [monthLabel(m.month), ...FUNCTIONS.map((f) => formatMoney(m[f.key])), formatMoney(m.grandTotal)]),
      foot: [['Total', ...FUNCTIONS.map((f) => formatMoney(total[f.key])), formatMoney(total.grandTotal)]],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [36, 105, 201] },
      footStyles: { fillColor: [234, 241, 252], textColor: [10, 31, 68], fontStyle: 'bold' },
      columnStyles: Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => [i, { halign: 'right' }])),
    });
    doc.save(`grand-total-${title.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}.pdf`);
  };

  const share = (value) => (total.grandTotal > 0 ? Math.round((value / total.grandTotal) * 1000) / 10 : 0);
  const filtered = year !== ALL || month !== ALL;

  if (loading && !data) return <div className="gt-page"><div className="gt-loading">Loading grand total…</div></div>;
  if (error && !data) {
    return (
      <div className="gt-page">
        <div className="gt-alert err">
          <span>{error}</span>
          <button type="button" className="gt-btn" onClick={load}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="gt-page">
      {/* ----- header ----- */}
      <div className="gt-header">
        <div>
          <h1 className="gt-title">Grand Total</h1>
          <p className="gt-subtitle">Everything spent across all five functions, month by month.</p>
        </div>
        <div className="gt-actions">
          <button type="button" className="gt-btn" onClick={load} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" className="gt-btn primary" onClick={downloadPdf} disabled={rows.length === 0}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
            Download PDF
          </button>
        </div>
      </div>

      {error && <div className="gt-alert err"><span>{error}</span></div>}

      {/* ----- year / month filters ----- */}
      <div className="gt-filters">
        <label className="gt-field">
          <span>Year</span>
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value={ALL}>All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="gt-field">
          <span>Month</span>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value={ALL}>All months</option>
            {MONTH_NAMES.map((name, i) => {
              const value = String(i + 1).padStart(2, '0');
              return <option key={value} value={value}>{name}</option>;
            })}
          </select>
        </label>
        <button type="button" className="gt-clear" onClick={() => { setYear(ALL); setMonth(ALL); }} disabled={!filtered}>Clear filters</button>
        <span className="gt-chip">Showing: {title}</span>
      </div>

      {/* ----- grand total ----- */}
      <div className="gt-hero">
        <div>
          <p className="gt-hero-label">Grand Total · {title}</p>
          <p className="gt-hero-amount">{formatMoney(total.grandTotal)}</p>
          <p className="gt-hero-sub">Constructions + Office Expenses + Petty Cash + Lecturer Salary + Staff Salary</p>
        </div>
        <div className="gt-hero-meta">
          <div className="gt-hero-stat"><p>Months</p><b>{rows.length}</b></div>
          <div className="gt-hero-stat">
            <p>Monthly average</p>
            <b>{formatMoney(rows.length ? round2(total.grandTotal / rows.length) : 0)}</b>
          </div>
        </div>
      </div>

      {/* ----- one card per function ----- */}
      <div className="gt-cards">
        {FUNCTIONS.map((f) => {
          const pct = share(total[f.key]);
          return (
            <div className="gt-card" key={f.key} style={{ '--c': f.color }}>
              <p className="gt-card-label"><i className="gt-dot" />{f.label}</p>
              <p className={`gt-card-amount ${total[f.key] === 0 ? 'zero' : ''}`}>{formatMoney(total[f.key])}</p>
              <p className="gt-card-hint">{f.hint}</p>
              <div className="gt-share">
                <div className="gt-share-bar"><span style={{ width: `${pct}%` }} /></div>
                <span className="gt-share-pct">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ----- month by month ----- */}
      <div className="gt-panel">
        <div className="gt-panel-head">
          <h3>Month by month</h3>
          <span>{rows.length} {rows.length === 1 ? 'month' : 'months'} · click a row to show only that month</span>
        </div>
        <div className="gt-table-wrap">
          <table className="gt-table">
            <thead>
              <tr>
                <th>Month</th>
                {FUNCTIONS.map((f) => <th key={f.key} className="num">{f.label}</th>)}
                <th className="num">Grand Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={FUNCTIONS.length + 2} className="gt-empty">No spending recorded for {title}.</td></tr>
              )}
              {rows.map((m) => (
                <tr key={m.month} onClick={() => { setYear(m.month.slice(0, 4)); setMonth(m.month.slice(5)); }}>
                  <td className="month">{monthLabel(m.month)}</td>
                  {FUNCTIONS.map((f) => (
                    <td key={f.key} className={`num ${m[f.key] === 0 ? 'zero' : ''}`}>{formatMoney(m[f.key])}</td>
                  ))}
                  <td className="num grand">{formatMoney(m.grandTotal)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td>Total</td>
                  {FUNCTIONS.map((f) => <td key={f.key} className="num">{formatMoney(total[f.key])}</td>)}
                  <td className="num grand">{formatMoney(total.grandTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="gt-note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
        <span>
          Only money that was actually spent is counted - pending / unpaid items are left out. Petty cash funds given to accountants are not added
          (only the vouchers spent from them), so nothing is counted twice.
        </span>
      </div>
    </div>
  );
}

export default GrandTotal;