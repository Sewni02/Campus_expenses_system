import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  formatMoney,
  formatDate,
  monthLabel,
  todayString,
  currentMonthString,
  STATUS_LABELS,
  downloadVoucherPdf,
} from '../utils/pettyCash';
import './PettyCash.css';

const EMPTY_FORM = { date: todayString(), payee: '', category: '', description: '', amount: '' };

// The Petty Cash section of the user dashboard (shown to users who have the
// "Manage Petty Cash" permission): shows the petty cash funds the super admin gave
// them, the balance left, and lets them issue (and re-download) vouchers.
function PettyCashPanel() {
  const [month, setMonth] = useState(currentMonthString());
  const [summary, setSummary] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { type, text, expense? }

  const load = useCallback(() => {
    const params = { month };
    return Promise.all([
      axios.get('/api/petty-cash/me/summary', { params }),
      axios.get('/api/petty-cash/me/allocations', { params }),
      axios.get('/api/petty-cash/me/expenses', { params }),
    ])
      .then(([s, a, e]) => {
        setSummary(s.data);
        setAllocations(a.data);
        setExpenses(e.data);
      })
      .catch((err) => {
        setMessage({ type: 'err', text: err.response?.data?.message || 'Could not load petty cash data' });
      });
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    axios.get('/api/petty-cash/categories').then((res) => setCategories(res.data)).catch(() => {});
  }, []);

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    // Warn before a payment bigger than what is left for that month.
    const amount = Number(form.amount);
    if (summary && form.date.slice(0, 7) === summary.month && amount > summary.closing) {
      const ok = window.confirm(
        `This is more than your remaining balance (${formatMoney(summary.closing)}). Issue the voucher anyway?`
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      const res = await axios.post('/api/petty-cash/me/expenses', form);
      setMessage({
        type: res.data.expense.overdrawn ? 'warn' : 'ok',
        text: `${res.data.message} (${res.data.expense.voucherNo})`,
        expense: res.data.expense,
      });
      setForm({ ...EMPTY_FORM, date: form.date });
      // Show the month the voucher belongs to.
      if (res.data.expense.month !== month) setMonth(res.data.expense.month);
      else load();
    } catch (err) {
      setMessage({ type: 'err', text: err.response?.data?.message || 'Could not issue the voucher' });
    } finally {
      setSaving(false);
    }
  };

  const balanceClass = summary?.status === 'overspent' ? 'overspent' : summary?.status === 'low' ? 'low' : '';

  return (
    <div className="sa-page pc-page">
      <div>
        <div className="pc-toolbar">
          <h1 className="sa-page-title" style={{ margin: 0 }}>Petty Cash — {monthLabel(month)}</h1>
          <label className="pc-field">
            Month
            <input type="month" value={month} max={currentMonthString()} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          </label>
        </div>

        {message && (
          <div className={`pc-alert ${message.type}`}>
            <span>{message.text}</span>
            {message.expense && (
              <button className="pc-btn-sm" onClick={() => downloadVoucherPdf(message.expense)}>
                Download voucher
              </button>
            )}
          </div>
        )}

        {summary && (
          <>
            {summary.status === 'overspent' && (
              <div className="pc-alert err">
                You have spent {formatMoney(Math.abs(summary.closing))} more than the petty cash available.
              </div>
            )}
            <div className="pc-cards">
              <div className={`pc-card balance ${balanceClass}`}>
                <p>Petty cash balance</p>
                <h2>{formatMoney(summary.closing)}</h2>
                <small>{STATUS_LABELS[summary.status]} · {summary.usedPercent}% used</small>
              </div>
              <div className="pc-card">
                <p>Brought forward</p>
                <h2>{formatMoney(summary.opening)}</h2>
              </div>
              <div className="pc-card">
                <p>Allocated this month</p>
                <h2>{formatMoney(summary.allocated)}</h2>
              </div>
              <div className="pc-card spent">
                <p>Spent this month</p>
                <h2>{formatMoney(summary.spent)}</h2>
                <small>{summary.voucherCount} voucher(s)</small>
              </div>
            </div>
          </>
        )}

        <div className="pc-panel">
          <h3>Issue a new voucher</h3>
          <form className="pc-form" onSubmit={handleSubmit}>
            <label className="pc-field">
              Date
              <input type="date" required value={form.date} max={todayString()} onChange={setField('date')} />
            </label>
            <label className="pc-field">
              Paid to
              <input type="text" required maxLength={120} value={form.payee} onChange={setField('payee')} placeholder="Name / shop" />
            </label>
            <label className="pc-field">
              Category
              <select required value={form.category} onChange={setField('category')}>
                <option value="">Select…</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="pc-field">
              Amount (Rs.)
              <input type="number" required min="0.01" step="0.01" value={form.amount} onChange={setField('amount')} />
            </label>
            <label className="pc-field wide">
              Description
              <input type="text" required maxLength={300} value={form.description} onChange={setField('description')} placeholder="What was this payment for?" />
            </label>
            <div className="wide">
              <button className="pc-btn" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Issue voucher'}
              </button>
            </div>
          </form>
        </div>

        <div className="pc-two-col">
          <div>
            <h3>Funds received</h3>
            <div className="pc-table-wrap">
              <table className="pc-table">
                <thead>
                  <tr><th>Received on</th><th>Note</th><th className="num">Amount</th></tr>
                </thead>
                <tbody>
                  {allocations.length === 0 && <tr><td colSpan="3" className="pc-empty">No funds allocated for this month</td></tr>}
                  {allocations.map((a) => (
                    <tr key={a._id}>
                      <td>{formatDate(a.createdAt)}</td>
                      <td>{a.note || '-'}</td>
                      <td className="num">{formatMoney(a.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h3>Vouchers issued</h3>
            <div className="pc-table-wrap">
              <table className="pc-table">
                <thead>
                  <tr><th>Voucher</th><th>Date</th><th>Paid to</th><th className="num">Amount</th><th></th></tr>
                </thead>
                <tbody>
                  {expenses.length === 0 && <tr><td colSpan="5" className="pc-empty">No vouchers for this month</td></tr>}
                  {expenses.map((x) => (
                    <tr key={x._id} className={x.overdrawn ? 'pc-row-over' : ''}>
                      <td>{x.voucherNo}</td>
                      <td>{formatDate(x.date)}</td>
                      <td>{x.payee}<br /><small>{x.category}</small></td>
                      <td className="num">{formatMoney(x.amount)}</td>
                      <td><button className="pc-btn-sm" onClick={() => downloadVoucherPdf(x)}>Download</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PettyCashPanel;