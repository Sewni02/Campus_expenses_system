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
  downloadAllocationPdf,
  viewAllocationSlip,
  METHOD_LABELS,
  isReceived,
  fundDateOf,
} from '../utils/pettyCash';
import PettyCashReports from './PettyCashReports';
import './PettyCash.css';

const EMPTY_FORM = { date: todayString(), payee: '', category: '', description: '', amount: '' };

// The Petty Cash section of the user dashboard (shown to users who have the
// "Manage Petty Cash" permission): shows the petty cash funds the super admin gave
// them, the balance left, and lets them issue (and re-download) vouchers.
function PettyCashPanel() {
  const [month, setMonth] = useState(currentMonthString());
  const [summary, setSummary] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [pending, setPending] = useState([]); // funds waiting for this accountant to accept
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { type, text, expense? }
  const [showReport, setShowReport] = useState(false);

  const load = useCallback(() => {
    // One request returns everything the page shows (faster than 4 separate calls).
    return axios
      .get('/api/petty-cash/me/dashboard', { params: { month } })
      .then((res) => {
        setSummary(res.data.summary);
        setAllocations(res.data.allocations.filter(isReceived));
        setExpenses(res.data.expenses);
        setPending(res.data.pending);
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

  const confirmReceipt = async (allocation) => {
    const ok = window.confirm(
      `Accept ${formatMoney(allocation.amount)} (${allocation.referenceNo || 'fund'}) for ${monthLabel(allocation.month)}? ` +
      'It will be added to your petty cash balance for that month.'
    );
    if (!ok) return;
    try {
      const res = await axios.post(`/api/petty-cash/me/allocations/${allocation._id}/receive`);
      setMessage({ type: 'ok', text: res.data.message });
      // Jump to the month the fund is for, so the new amount is right there on the dashboard.
      if (allocation.month !== month && allocation.month <= currentMonthString()) setMonth(allocation.month);
      else load();
    } catch (err) {
      setMessage({ type: 'err', text: err.response?.data?.message || 'Could not confirm receipt' });
    }
  };

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
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <button className="pc-btn-sm" style={{ padding: '10px 16px' }} onClick={() => setShowReport((v) => !v)}>
              {showReport ? 'Back to petty cash' : '📄 My reports'}
            </button>
            {!showReport && (
              <label className="pc-field">
                Month
                <input type="month" value={month} max={currentMonthString()} onChange={(e) => e.target.value && setMonth(e.target.value)} />
              </label>
            )}
          </div>
        </div>

        {showReport ? <PettyCashReports mode="me" /> : (<>

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

        {pending.length > 0 && (
          <div className="pc-panel" style={{ borderColor: '#F1D79A', background: '#FFFBF0' }}>
            <h3>Funds waiting for your confirmation ({pending.length})</h3>
            <p style={{ marginTop: 0, color: '#8A5A0F', fontSize: 14 }}>
              Check the slip / voucher, then accept. The amount is added to your petty cash balance for the month it is meant for.
            </p>
            <div className="pc-table-wrap">
              <table className="pc-table">
                <thead>
                  <tr><th>Ref. no</th><th>Fund date</th><th>For month</th><th>Method</th><th className="num">Amount</th><th>Proof</th><th></th></tr>
                </thead>
                <tbody>
                  {pending.map((a) => (
                    <tr key={a._id}>
                      <td>{a.referenceNo || '-'}</td>
                      <td>{formatDate(fundDateOf(a))}</td>
                      <td>{monthLabel(a.month)}</td>
                      <td>
                        {METHOD_LABELS[a.method] || 'Cash'}{a.paymentRef ? ` · ${a.paymentRef}` : ''}
                        {a.note && <><br /><small>{a.note}</small></>}
                      </td>
                      <td className="num">{formatMoney(a.amount)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {a.slipUrl && <button className="pc-btn-sm" onClick={() => viewAllocationSlip(a, 'me')}>View slip</button>}{' '}
                        <button className="pc-btn-sm" onClick={() => downloadAllocationPdf(a)}>Voucher</button>
                      </td>
                      <td><button className="pc-btn" onClick={() => confirmReceipt(a)}>Accept fund</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                  <tr><th>Ref. no</th><th>Fund date</th><th>Method / note</th><th className="num">Amount</th><th></th></tr>
                </thead>
                <tbody>
                  {allocations.length === 0 && <tr><td colSpan="5" className="pc-empty">No funds received for this month</td></tr>}
                  {allocations.map((a) => (
                    <tr key={a._id}>
                      <td>{a.referenceNo || '-'}</td>
                      <td>{formatDate(fundDateOf(a))}</td>
                      <td>
                        {METHOD_LABELS[a.method] || 'Cash'}{a.paymentRef ? ` · ${a.paymentRef}` : ''}
                        <br /><small>{a.note || '-'}</small>
                      </td>
                      <td className="num">{formatMoney(a.amount)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {a.slipUrl && <button className="pc-btn-sm" onClick={() => viewAllocationSlip(a, 'me')}>View slip</button>}{' '}
                        <button className="pc-btn-sm" onClick={() => downloadAllocationPdf(a)}>Voucher</button>
                      </td>
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
        </>)}
      </div>
    </div>
  );
}

export default PettyCashPanel;