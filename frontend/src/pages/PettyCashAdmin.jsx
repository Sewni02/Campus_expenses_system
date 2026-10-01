import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import useTabState from '../hooks/useTabState';
import {
  formatMoney,
  formatDate,
  monthLabel,
  currentMonthString,
  STATUS_LABELS,
  downloadVoucherPdf,
} from '../utils/pettyCash';
import './PettyCash.css';

const apiError = (err, fallback) => err.response?.data?.message || fallback;

// Super admin side of Petty Cash:
//   Overview  - month-end analysis (balances, overspending, where money went)
//   Allocate  - give an accountant a fund for a month
//   Expenses  - every voucher the accountants have issued
function PettyCashAdmin() {
  const [tab, setTab] = useTabState('pc', 'overview');
  const [month, setMonth] = useState(currentMonthString());
  const [accountants, setAccountants] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    axios.get('/api/petty-cash/admin/accountants').then((res) => setAccountants(res.data)).catch(() => {});
  }, []);

  return (
    <div className="sa-page pc-page">
      <div className="pc-toolbar">
        <h1 className="sa-page-title" style={{ margin: 0 }}>Petty Cash</h1>
        <label className="pc-field">
          Month
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        </label>
      </div>

      <div className="pc-tabs">
        {[['overview', 'Month-end Overview'], ['allocate', 'Allocate Funds'], ['expenses', 'Expenses']].map(([key, label]) => (
          <button key={key} className={`pc-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview month={month} refreshKey={refreshKey} />}
      {tab === 'allocate' && <Allocate month={month} accountants={accountants} onChanged={refresh} refreshKey={refreshKey} />}
      {tab === 'expenses' && <Expenses month={month} accountants={accountants} />}
    </div>
  );
}

function Overview({ month, refreshKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    axios
      .get('/api/petty-cash/admin/summary', { params: { month } })
      .then((res) => { if (!cancelled) { setData(res.data); setError(''); } })
      .catch((err) => { if (!cancelled) setError(apiError(err, 'Could not load the overview')); });
    return () => { cancelled = true; };
  }, [month, refreshKey]);

  if (error) return <div className="pc-alert err">{error}</div>;
  if (!data) return <p>Loading…</p>;

  const { totals, accountants, categories, topExpenses, overdrawnVouchers, previousMonth } = data;
  const overspent = accountants.filter((a) => a.status === 'overspent');
  const low = accountants.filter((a) => a.status === 'low');

  return (
    <>
      {data.isCurrentMonth && (
        <div className="pc-alert warn">{monthLabel(month)} is still in progress — figures are up to today.</div>
      )}

      {overspent.length > 0 ? (
        <div className="pc-alert err">
          Over budget: {overspent.map((a) => `${a.name} (${formatMoney(Math.abs(a.closing))} over)`).join(', ')}
        </div>
      ) : totals.available > 0 ? (
        <div className="pc-alert ok">
          No overspending in {monthLabel(month)}.
          {low.length > 0 && ` Running low: ${low.map((a) => a.name).join(', ')}.`}
        </div>
      ) : null}

      <div className="pc-cards">
        <div className="pc-card"><p>Brought forward</p><h2>{formatMoney(totals.opening)}</h2></div>
        <div className="pc-card"><p>Allocated</p><h2>{formatMoney(totals.allocated)}</h2></div>
        <div className="pc-card spent">
          <p>Spent</p><h2>{formatMoney(totals.spent)}</h2>
          <small>
            {totals.usedPercent}% of available
            {previousMonth.changePercent !== null &&
              ` · ${previousMonth.changePercent >= 0 ? '+' : ''}${previousMonth.changePercent}% vs ${monthLabel(previousMonth.month)}`}
          </small>
        </div>
        <div className={`pc-card balance ${totals.closing < 0 ? 'overspent' : ''}`}>
          <p>Closing balance</p><h2>{formatMoney(totals.closing)}</h2>
          <small>{totals.voucherCount} voucher(s)</small>
        </div>
      </div>

      <h3>By accountant</h3>
      <div className="pc-table-wrap" style={{ marginBottom: 24 }}>
        <table className="pc-table">
          <thead>
            <tr>
              <th>Accountant</th><th className="num">Brought fwd</th><th className="num">Allocated</th>
              <th className="num">Spent</th><th className="num">Balance</th><th>Used</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {accountants.length === 0 && <tr><td colSpan="7" className="pc-empty">No accountants yet — give someone the “Petty Cash” permission in User Management.</td></tr>}
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
        </table>
      </div>

      <div className="pc-two-col">
        <div className="pc-panel">
          <h3>Where the money went</h3>
          {categories.length === 0 && <p style={{ color: '#7C8FAD' }}>No spending this month.</p>}
          {categories.map((c) => (
            <div className="pc-bar-row" key={c.category}>
              <span>{c.category}</span>
              <div className="pc-bar"><span style={{ width: `${Math.min(c.percent, 100)}%` }} /></div>
              <span className="pc-bar-val">{formatMoney(c.total)} · {c.percent}%</span>
            </div>
          ))}
        </div>

        <div className="pc-panel">
          <h3>Largest vouchers</h3>
          <table className="pc-table">
            <tbody>
              {topExpenses.length === 0 && <tr><td className="pc-empty">Nothing yet</td></tr>}
              {topExpenses.map((x) => (
                <tr key={x._id}>
                  <td>{x.voucherNo}<br /><small>{x.payee} · {x.category}</small></td>
                  <td className="num">{formatMoney(x.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {overdrawnVouchers.length > 0 && (
        <div className="pc-panel">
          <h3>Vouchers issued beyond the available balance</h3>
          <table className="pc-table">
            <thead><tr><th>Voucher</th><th>Date</th><th>Accountant</th><th>Paid to</th><th className="num">Amount</th><th className="num">Balance before</th></tr></thead>
            <tbody>
              {overdrawnVouchers.map((x) => (
                <tr key={x._id} className="pc-row-over">
                  <td>{x.voucherNo}</td><td>{formatDate(x.date)}</td><td>{x.accountantName}</td><td>{x.payee}</td>
                  <td className="num">{formatMoney(x.amount)}</td><td className="num">{formatMoney(x.balanceBefore)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Allocate({ month, accountants, onChanged, refreshKey }) {
  const [form, setForm] = useState({ accountant: '', amount: '', note: '' });
  const [allocations, setAllocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(() => {
    axios
      .get('/api/petty-cash/admin/allocations', { params: { month } })
      .then((res) => setAllocations(res.data))
      .catch((err) => setMessage({ type: 'err', text: apiError(err, 'Could not load allocations') }));
  }, [month]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await axios.post('/api/petty-cash/admin/allocations', { ...form, month });
      setMessage({ type: 'ok', text: `Fund allocated for ${monthLabel(month)}` });
      setForm({ accountant: form.accountant, amount: '', note: '' });
      onChanged();
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not allocate the fund') });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this allocation? The accountant\'s balance will go down by this amount.')) return;
    try {
      await axios.delete(`/api/petty-cash/admin/allocations/${id}`);
      onChanged();
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not remove the allocation') });
    }
  };

  return (
    <>
      {message && <div className={`pc-alert ${message.type}`}>{message.text}</div>}

      <div className="pc-panel">
        <h3>Allocate petty cash for {monthLabel(month)}</h3>
        <form className="pc-form" onSubmit={submit}>
          <label className="pc-field">
            Accountant
            <select required value={form.accountant} onChange={(e) => setForm({ ...form, accountant: e.target.value })}>
              <option value="">Select…</option>
              {accountants.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </label>
          <label className="pc-field">
            Amount (Rs.)
            <input type="number" required min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </label>
          <label className="pc-field">
            Note (optional)
            <input type="text" maxLength={300} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
          <div><button className="pc-btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Allocate'}</button></div>
        </form>
        {accountants.length === 0 && (
          <p style={{ color: '#B7791F', marginBottom: 0 }}>
            No accountants found. Tick “Manage Petty Cash” for the accountant in User Management first.
          </p>
        )}
      </div>

      <h3>Allocations for {monthLabel(month)}</h3>
      <div className="pc-table-wrap">
        <table className="pc-table">
          <thead><tr><th>Date</th><th>Accountant</th><th>Note</th><th className="num">Amount</th><th></th></tr></thead>
          <tbody>
            {allocations.length === 0 && <tr><td colSpan="5" className="pc-empty">Nothing allocated for this month</td></tr>}
            {allocations.map((a) => (
              <tr key={a._id}>
                <td>{formatDate(a.createdAt)}</td><td>{a.accountantName}</td><td>{a.note || '-'}</td>
                <td className="num">{formatMoney(a.amount)}</td>
                <td><button className="pc-btn-sm pc-btn-danger" onClick={() => remove(a._id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
          {allocations.length > 0 && (
            <tfoot><tr><td colSpan="3">Total</td><td className="num">{formatMoney(allocations.reduce((t, a) => t + a.amount, 0))}</td><td></td></tr></tfoot>
          )}
        </table>
      </div>
    </>
  );
}

function Expenses({ month, accountants }) {
  const [accountant, setAccountant] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    axios
      .get('/api/petty-cash/admin/expenses', { params: { month, accountant: accountant || undefined } })
      .then((res) => { if (!cancelled) { setExpenses(res.data); setError(''); } })
      .catch((err) => { if (!cancelled) setError(apiError(err, 'Could not load expenses')); });
    return () => { cancelled = true; };
  }, [month, accountant]);

  const total = expenses.reduce((t, x) => t + x.amount, 0);

  return (
    <>
      {error && <div className="pc-alert err">{error}</div>}
      <div className="pc-toolbar">
        <h3 style={{ margin: 0 }}>Vouchers — {monthLabel(month)}</h3>
        <label className="pc-field">
          Accountant
          <select value={accountant} onChange={(e) => setAccountant(e.target.value)}>
            <option value="">All</option>
            {accountants.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
        </label>
      </div>
      <div className="pc-table-wrap">
        <table className="pc-table">
          <thead>
            <tr><th>Voucher</th><th>Date</th><th>Accountant</th><th>Paid to</th><th>Category</th><th>Description</th><th className="num">Amount</th><th className="num">Balance after</th><th></th></tr>
          </thead>
          <tbody>
            {expenses.length === 0 && <tr><td colSpan="9" className="pc-empty">No vouchers</td></tr>}
            {expenses.map((x) => (
              <tr key={x._id} className={x.overdrawn ? 'pc-row-over' : ''}>
                <td>{x.voucherNo}</td><td>{formatDate(x.date)}</td><td>{x.accountantName}</td><td>{x.payee}</td>
                <td>{x.category}</td><td>{x.description}</td>
                <td className="num">{formatMoney(x.amount)}</td>
                <td className="num">{formatMoney(x.balanceAfter)}</td>
                <td><button className="pc-btn-sm" onClick={() => downloadVoucherPdf(x)}>PDF</button></td>
              </tr>
            ))}
          </tbody>
          {expenses.length > 0 && (
            <tfoot><tr><td colSpan="6">Total</td><td className="num">{formatMoney(total)}</td><td colSpan="2"></td></tr></tfoot>
          )}
        </table>
      </div>
    </>
  );
}

export default PettyCashAdmin;