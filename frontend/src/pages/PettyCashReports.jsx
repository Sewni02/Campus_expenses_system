import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  formatMoney,
  formatDate,
  monthLabel,
  todayString,
  STATUS_LABELS,
  METHOD_LABELS,
  isReceived,
  fundDateOf,
  REPORT_PERIODS,
  MONTH_NAMES,
  periodRange,
  describePeriod,
  downloadReportPdf,
} from '../utils/pettyCash';
import './PettyCash.css';

const apiError = (err, fallback) => err.response?.data?.message || fallback;

const thisYear = Number(todayString().slice(0, 4));
const YEAR_OPTIONS = Array.from({ length: 8 }, (_, i) => thisYear - 6 + i);

// Petty cash reports.
//   mode="admin" - super admin: OVERALL (all accountants) or ONE accountant at a time
//   mode="me"    - accountant: their own report only
// Period: weekly / monthly / yearly / all time. Shows the report on screen and
// downloads the same thing as a PDF.
function PettyCashReports({ mode = 'admin', accountants = [] }) {
  const today = todayString();
  const [period, setPeriod] = useState('monthly');
  const [dayDate, setDayDate] = useState(today);
  const [weekDate, setWeekDate] = useState(today);
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [accountant, setAccountant] = useState(''); // '' = overall (admin only)
  const [result, setResult] = useState({ key: '', data: null, error: '' });

  const range = periodRange(period, { dayDate, weekDate, year, month });
  const periodLabel = describePeriod(period, range, { year, month });
  const valid = Boolean(range);
  const from = range?.from || '';
  const to = range?.to || '';
  const who = mode === 'admin' ? accountant : '';
  const key = `${mode}|${from}|${to}|${who}`;

  useEffect(() => {
    if (!valid) return undefined;
    let cancelled = false;
    axios
      .get(`/api/petty-cash/${mode === 'admin' ? 'admin' : 'me'}/report`, {
        params: { from: from || undefined, to: to || undefined, accountant: who || undefined },
      })
      .then((res) => { if (!cancelled) setResult({ key, data: res.data, error: '' }); })
      .catch((err) => { if (!cancelled) setResult({ key, data: null, error: apiError(err, 'Could not load the report') }); });
    return () => { cancelled = true; };
  }, [valid, mode, from, to, who, key]);

  const loading = valid && result.key !== key;
  const report = result.key === key ? result.data : null;

  return (
    <>
      <div className="pc-panel">
        <h3>{mode === 'admin' ? 'Petty cash report' : 'My petty cash report'}</h3>
        <div className="pc-form">
          {mode === 'admin' && (
            <label className="pc-field">
              Report for
              <select value={accountant} onChange={(e) => setAccountant(e.target.value)}>
                <option value="">Overall — all accountants</option>
                {accountants.map((a) => <option key={a._id} value={a._id}>{a.name} (individual)</option>)}
              </select>
            </label>
          )}
          <label className="pc-field">
            Period
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              {REPORT_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
          {period === 'daily' && (
            <label className="pc-field">
              Date
              <input type="date" max={today} value={dayDate} onChange={(e) => e.target.value && setDayDate(e.target.value)} />
            </label>
          )}
          {period === 'weekly' && (
            <label className="pc-field">
              Any date in the week
              <input type="date" max={today} value={weekDate} onChange={(e) => e.target.value && setWeekDate(e.target.value)} />
            </label>
          )}
          {period === 'monthly' && (
            <label className="pc-field">
              Month
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
              </select>
            </label>
          )}
          {(period === 'monthly' || period === 'yearly') && (
            <label className="pc-field">
              Year
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          )}
          <div>
            <button className="pc-btn" disabled={!report} onClick={() => downloadReportPdf(report, periodLabel)}>
              ⬇ Download PDF
            </button>
          </div>
        </div>
      </div>

      {result.error && result.key === key && <div className="pc-alert err">{result.error}</div>}
      {loading && <p>Loading…</p>}
      {report && <ReportView report={report} periodLabel={periodLabel} />}
    </>
  );
}

function ReportView({ report, periodLabel }) {
  const overall = report.scope === 'overall';
  const { totals, accountants, categories, allocations, expenses, pendingFunds } = report;

  return (
    <>
      <h3 style={{ marginTop: 0 }}>
        {overall ? 'All accountants' : report.accountant?.name} — {periodLabel}
      </h3>

      {report.truncated && (
        <div className="pc-alert warn">This period has a lot of records — only the first 5,000 rows are listed. Pick a shorter period for the full list.</div>
      )}
      {pendingFunds.count > 0 && (
        <div className="pc-alert warn">
          {pendingFunds.count} fund(s) worth {formatMoney(pendingFunds.amount)} are not confirmed by the accountant yet, so they are not counted below.
        </div>
      )}

      <div className="pc-cards">
        <div className="pc-card"><p>Brought forward</p><h2>{formatMoney(totals.opening)}</h2></div>
        <div className="pc-card"><p>Funds received</p><h2>{formatMoney(totals.allocated)}</h2></div>
        <div className="pc-card spent">
          <p>Spent</p><h2>{formatMoney(totals.spent)}</h2>
          <small>{totals.usedPercent}% of available · {totals.voucherCount} voucher(s)</small>
        </div>
        <div className={`pc-card balance ${totals.closing < 0 ? 'overspent' : ''}`}>
          <p>Closing balance</p><h2>{formatMoney(totals.closing)}</h2>
          {totals.overdrawnCount > 0 && <small>{totals.overdrawnCount} voucher(s) over the balance</small>}
        </div>
      </div>

      {overall && (
        <>
          <h3>By accountant</h3>
          <div className="pc-table-wrap" style={{ marginBottom: 24 }}>
            <table className="pc-table">
              <thead>
                <tr>
                  <th>Accountant</th><th className="num">Brought fwd</th><th className="num">Funds received</th>
                  <th className="num">Spent</th><th className="num">Closing</th><th>Used</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {accountants.length === 0 && <tr><td colSpan="7" className="pc-empty">No activity in this period</td></tr>}
                {accountants.map((a) => (
                  <tr key={a.accountantId} className={a.status === 'overspent' ? 'pc-row-over' : ''}>
                    <td>{a.name}<br /><small>{a.email}</small></td>
                    <td className="num">{formatMoney(a.opening)}</td>
                    <td className="num">{formatMoney(a.allocated)}</td>
                    <td className="num">{formatMoney(a.spent)}</td>
                    <td className="num">{formatMoney(a.closing)}</td>
                    <td>{a.usedPercent}%</td>
                    <td><span className={`pc-badge ${a.status}`}>{STATUS_LABELS[a.status]}</span></td>
                  </tr>
                ))}
              </tbody>
              {accountants.length > 0 && (
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td className="num">{formatMoney(totals.opening)}</td>
                    <td className="num">{formatMoney(totals.allocated)}</td>
                    <td className="num">{formatMoney(totals.spent)}</td>
                    <td className="num">{formatMoney(totals.closing)}</td>
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      <div className="pc-panel">
        <h3>Spending by category</h3>
        {categories.length === 0 && <p style={{ color: '#7C8FAD', margin: 0 }}>No spending in this period.</p>}
        {categories.map((c) => (
          <div className="pc-bar-row" key={c.category}>
            <span>{c.category}</span>
            <div className="pc-bar"><span style={{ width: `${Math.min(c.percent, 100)}%` }} /></div>
            <span className="pc-bar-val">{formatMoney(c.total)} · {c.percent}%</span>
          </div>
        ))}
      </div>

      <h3>Funds given</h3>
      <div className="pc-table-wrap" style={{ marginBottom: 24 }}>
        <table className="pc-table">
          <thead>
            <tr>
              <th>Ref. no</th><th>Fund date</th><th>For month</th>{overall && <th>Accountant</th>}
              <th>Method</th><th>Status</th><th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {allocations.length === 0 && <tr><td colSpan={overall ? 7 : 6} className="pc-empty">No funds in this period</td></tr>}
            {allocations.map((a) => (
              <tr key={a._id}>
                <td>{a.referenceNo || '-'}</td>
                <td>{formatDate(fundDateOf(a))}</td>
                <td>{monthLabel(a.month)}</td>
                {overall && <td>{a.accountantName}</td>}
                <td>{METHOD_LABELS[a.method] || 'Cash'}{a.paymentRef && <><br /><small>{a.paymentRef}</small></>}</td>
                <td><span className={`pc-badge ${isReceived(a) ? 'ok' : 'low'}`}>{isReceived(a) ? 'Received' : 'Pending'}</span></td>
                <td className="num">{formatMoney(a.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Vouchers issued</h3>
      <div className="pc-table-wrap">
        <table className="pc-table">
          <thead>
            <tr>
              <th>Voucher</th><th>Date</th>{overall && <th>Accountant</th>}
              <th>Paid to</th><th>Category</th><th>Description</th><th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && <tr><td colSpan={overall ? 7 : 6} className="pc-empty">No vouchers in this period</td></tr>}
            {expenses.map((x) => (
              <tr key={x._id} className={x.overdrawn ? 'pc-row-over' : ''}>
                <td>{x.voucherNo}</td><td>{formatDate(x.date)}</td>
                {overall && <td>{x.accountantName}</td>}
                <td>{x.payee}</td><td>{x.category}</td><td>{x.description}</td>
                <td className="num">{formatMoney(x.amount)}</td>
              </tr>
            ))}
          </tbody>
          {expenses.length > 0 && (
            <tfoot>
              <tr><td colSpan={overall ? 6 : 5}>Total</td><td className="num">{formatMoney(totals.spent)}</td></tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}

export default PettyCashReports;