import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { formatMoney, monthLabel, currentMonthString } from '../utils/pettyCash';
import './PettyCash.css'; // same cards / tables / buttons as the rest of Staff Salary

const apiError = (err, fallback) => err.response?.data?.message || fallback;
const round2 = (n) => Math.round(n * 100) / 100;
const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// Typing filters (the server checks the same rules again).
const cleanEmployeeNo = (v) => v.toUpperCase().replace(/[^A-Z0-9/_-]/g, '').slice(0, 20);
const cleanCount = (v) => v.replace(/[^0-9]/g, '').slice(0, 2); // whole numbers (total days)
// leave days: whole or half days, one decimal at most (1, 1.5, 2 ...)
const cleanLeave = (v) => {
  let c = v.replace(/[^0-9.]/g, '');
  const dot = c.indexOf('.');
  if (dot !== -1) c = c.slice(0, dot + 1) + c.slice(dot + 1).replace(/\./g, '').slice(0, 1);
  return c.slice(0, 4);
};
const cleanPercent = (v) => {
  let c = v.replace(/[^0-9.]/g, '');
  const dot = c.indexOf('.');
  if (dot !== -1) c = c.slice(0, dot + 1) + c.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  return c.slice(0, 6);
};
const cleanAmount = (v) => {
  let c = v.replace(/[^0-9.]/g, '');
  const dot = c.indexOf('.');
  if (dot !== -1) c = c.slice(0, dot + 1) + c.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  return c.slice(0, 11);
};

const BLANK_EMPLOYEE = { employeeNo: '', name: '' };
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const NORMAL_COLOR = '#2E86DE';
const EXTRA_COLOR = '#F39C12';
const LEAVE_FIELDS = [
  ['medical', 'medicalLeave', 'Medical leave'],
  ['casual', 'casualLeave', 'Casual leave'],
  ['noPay', 'noPayDays', 'No-pay days'],
];

const sorted = (list) => [...list].sort((a, b) => a - b);
const sameDays = (a, b) => a.length === b.length && a.every((d, i) => d === b[i]);
const dayState = (m, day) => (m.normal.includes(day) ? 'N' : m.extra.includes(day) ? 'E' : '');
const weekdayOf = (month, day) => {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m - 1, day)).getUTCDay();
};
const leaveText = (n) => (n ? String(n) : '');

// arrival percentage = arrival days / total days x 100;  the highest allowance range that is reached applies
// (the server works the same out when it sends the sheet).
const percentOf = (arrivalDays, totalDays) => (totalDays > 0 ? (arrivalDays * 100) / totalDays : 0);
const allowanceFor = (percent, ranges) => {
  const range = [...ranges].sort((a, b) => b.minPercent - a.minPercent).find((r) => percent + 1e-9 >= r.minPercent);
  return range ? range.amount : 0;
};

const infoBox = { background: '#F4F8FD', border: '1px solid #DCE6F4', borderRadius: 10, padding: '12px 16px', fontSize: 14 };
const actionsCell = { display: 'flex', gap: 8, justifyContent: 'flex-end' };
const leaveInput = { width: 58, padding: '5px 6px', border: '1px solid #DCE6F4', borderRadius: 5, textAlign: 'right', font: 'inherit', fontSize: 13 };

// Sticky first two columns (employee number + name) so they stay visible while the days scroll sideways.
const NO_WIDTH = 90;
const NAME_WIDTH = 170;
const stickyNo = { position: 'sticky', left: 0, zIndex: 2, minWidth: NO_WIDTH, maxWidth: NO_WIDTH };
const stickyName = { position: 'sticky', left: NO_WIDTH, zIndex: 2, minWidth: NAME_WIDTH, maxWidth: NAME_WIDTH, boxShadow: '2px 0 0 #E1E8F2' };

// ---------------------------------------------------------------------------
// Attendance (Staff Salary tab)
//
//   One sheet per month. The employee list is permanent: an employee added once is on the sheet of
//   every month until deleted. Click a day to cycle it:  empty -> Normal day -> Extra work day -> empty.
//   Normal days and extra-work days are shown separately, and both are arrival days:
//       Arrival days = Normal days + Extra days
//   Leaves (Medical, Casual) and No-pay days are typed in (whole or half days) and shown separately.
//
//   TOTAL DAYS of the month comes pre-filled (the days of the calendar month: 30, 31, 28 / 29) and can be
//   changed for that month. Then:
//       Arrival % = Arrival days / Total days x 100
//   The ARRIVAL ALLOWANCE comes from the allowance ranges (below the sheet; editable), for example
//       90% - 100% = Rs. 5,000   80% - 90% = Rs. 4,000   70% - 80% = Rs. 2,000   below 70% = nothing
//   "Save attendance" saves only the rows that were changed (and the total days if it was changed).
// ---------------------------------------------------------------------------
function StaffAttendance() {
  const [month, setMonth] = useState(currentMonthString());
  const [sheet, setSheet] = useState(null); // everything as saved on the server for this month
  const [marks, setMarks] = useState({}); // { [employeeId]: { normal, extra, medical, casual, noPay } } as shown on screen
  const [totalDraft, setTotalDraft] = useState(null); // the total days being typed (null = not changed)
  const [rangesDraft, setRangesDraft] = useState(null); // the allowance ranges being edited (null = not changed)
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(BLANK_EMPLOYEE);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const latest = useRef(0);
  const formRef = useRef(null);
  const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);

  const marksFromSheet = (employees) =>
    Object.fromEntries(
      employees.map((e) => [
        e._id,
        { normal: e.normalDates, extra: e.extraDates, medical: leaveText(e.medicalLeave), casual: leaveText(e.casualLeave), noPay: leaveText(e.noPayDays) },
      ])
    );

  // keepLocal = keep what was already typed / clicked (but not saved yet) for employees that are still in the list.
  const load = async (forMonth, keepLocal = false) => {
    const ticket = ++latest.current;
    try {
      const res = await axios.get('/api/staff-salary/attendance', { params: { month: forMonth } });
      if (ticket !== latest.current) return; // a newer request has started
      setLoadError('');
      setSheet(res.data);
      const fresh = marksFromSheet(res.data.employees);
      setMarks((old) => (keepLocal ? Object.fromEntries(Object.entries(fresh).map(([id, m]) => [id, old[id] || m])) : fresh));
    } catch (err) {
      if (ticket !== latest.current) return;
      setLoadError(apiError(err, 'Could not load the attendance'));
    }
  };

  // Loads when the month changes (changeMonth clears the old sheet first).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (validMonth) load(month); }, [month]);

  // The employees whose row on screen is different from what is saved.
  const dirtyIds = sheet
    ? sheet.employees
        .filter((e) => {
          const m = marks[e._id];
          return (
            m &&
            (!sameDays(sorted(m.normal), e.normalDates) ||
              !sameDays(sorted(m.extra), e.extraDates) ||
              toNumber(m.medical) !== e.medicalLeave ||
              toNumber(m.casual) !== e.casualLeave ||
              toNumber(m.noPay) !== e.noPayDays)
          );
        })
        .map((e) => e._id)
    : [];
  const totalDirty = sheet !== null && totalDraft !== null && toNumber(totalDraft) !== sheet.totalDays;
  const hasChanges = dirtyIds.length > 0 || totalDirty;

  const totalShown = totalDraft !== null ? totalDraft : sheet ? String(sheet.totalDays) : '';
  const totalValue = toNumber(totalShown);
  const totalValid = Number.isInteger(totalValue) && totalValue >= 1 && totalValue <= 31;

  const changeMonth = (next) => {
    if (hasChanges && !window.confirm('You have attendance changes that are not saved. Change the month and lose them?')) return;
    setMessage(null);
    setLoadError('');
    setSheet(null);
    setMarks({});
    setTotalDraft(null);
    setMonth(next);
  };

  // empty -> Normal -> Extra -> empty
  const cycle = (id, day) =>
    setMarks((all) => {
      const m = all[id] || { normal: [], extra: [] };
      const without = (list) => list.filter((d) => d !== day);
      const state = dayState(m, day);
      const next =
        state === ''
          ? { ...m, normal: [...m.normal, day], extra: m.extra }
          : state === 'N'
            ? { ...m, normal: without(m.normal), extra: [...m.extra, day] }
            : { ...m, normal: m.normal, extra: without(m.extra) };
      return { ...all, [id]: next };
    });

  const setLeave = (id, field, value) => setMarks((all) => ({ ...all, [id]: { ...(all[id] || { normal: [], extra: [] }), [field]: value } }));

  const discard = () => {
    if (sheet) setMarks(marksFromSheet(sheet.employees));
    setTotalDraft(null);
  };

  const save = async () => {
    setMessage(null);
    if (!totalValid) {
      setMessage({ type: 'err', text: 'Total days must be a whole number from 1 to 31' });
      return;
    }
    const badLeave = dirtyIds
      .flatMap((id) => LEAVE_FIELDS.map(([field, , label]) => ({ id, label, value: toNumber(marks[id][field]) })))
      .find((l) => l.value < 0 || l.value > 31 || !Number.isInteger(l.value * 2));
    if (badLeave) {
      const emp = sheet.employees.find((e) => e._id === badLeave.id);
      setMessage({ type: 'err', text: `${emp.name}: ${badLeave.label} must be whole or half days (0, 0.5, 1, 1.5 ... up to 31)` });
      return;
    }

    setSaving(true);
    try {
      const body = {
        month,
        rows: dirtyIds.map((id) => ({
          employeeId: id,
          normalDates: sorted(marks[id].normal),
          extraDates: sorted(marks[id].extra),
          medicalLeave: toNumber(marks[id].medical),
          casualLeave: toNumber(marks[id].casual),
          noPayDays: toNumber(marks[id].noPay),
        })),
      };
      if (totalDirty) body.totalDays = totalValue;
      const res = await axios.put('/api/staff-salary/attendance', body);
      setSheet(res.data);
      setMarks(marksFromSheet(res.data.employees));
      setTotalDraft(null);
      setMessage({ type: 'ok', text: res.data.message });
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not save the attendance') });
    } finally {
      setSaving(false);
    }
  };

  // ----- employee list (add / edit / delete) -----
  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const resetForm = () => {
    setEditing(null);
    setForm(BLANK_EMPLOYEE);
  };
  const startEdit = (emp) => {
    setEditing(emp);
    setForm({ employeeNo: emp.employeeNo, name: emp.name });
    setMessage(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const submitEmployee = async (e) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const res = editing
        ? await axios.put(`/api/staff-salary/attendance/employees/${editing._id}`, form)
        : await axios.post('/api/staff-salary/attendance/employees', form);
      setMessage({ type: 'ok', text: res.data.message });
      resetForm();
      await load(month, true);
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not save the employee') });
    } finally {
      setSaving(false);
    }
  };
  const removeEmployee = async (emp) => {
    if (!window.confirm(`Delete ${emp.employeeNo} · ${emp.name}? Their attendance of every month is deleted too.`)) return;
    setMessage(null);
    try {
      const res = await axios.delete(`/api/staff-salary/attendance/employees/${emp._id}`);
      setMessage({ type: 'ok', text: res.data.message });
      if (editing && editing._id === emp._id) resetForm();
      await load(month, true);
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not delete the employee') });
    }
  };

  // ----- allowance ranges (edited here, saved with "Save ranges") -----
  const savedRanges = sheet ? sheet.ranges : [];
  const draft = rangesDraft || savedRanges.map((r) => ({ minPercent: String(r.minPercent), amount: String(r.amount) }));
  const editDraft = (index, field, value) => setRangesDraft(draft.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  const draftMins = draft.map((r) => toNumber(r.minPercent)).filter((n) => n > 0);
  const toText = (row) => {
    const min = toNumber(row.minPercent);
    const above = draftMins.filter((n) => n > min);
    return above.length > 0 ? `below ${Math.min(...above)}%` : '100% (and above)';
  };
  const saveRanges = async () => {
    setMessage(null);
    setSaving(true);
    try {
      const res = await axios.put('/api/staff-salary/attendance/allowance-ranges', { ranges: draft });
      setRangesDraft(null);
      setMessage({ type: 'ok', text: res.data.message });
      await load(month, true);
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not save the allowance ranges') });
    } finally {
      setSaving(false);
    }
  };

  // ----- numbers shown on the sheet (worked out from what is on screen, so they follow every click) -----
  const rows = sheet
    ? sheet.employees.map((e) => {
        const m = marks[e._id] || { normal: [], extra: [], medical: '', casual: '', noPay: '' };
        const normalDays = m.normal.length;
        const extraDays = m.extra.length;
        const arrivalDays = normalDays + extraDays;
        const percent = totalValid ? percentOf(arrivalDays, totalValue) : null;
        // the chart bar: normal days (blue) then extra work days (orange), out of the total days (never past 100%)
        const normalPct = totalValid ? Math.min((normalDays / totalValue) * 100, 100) : 0;
        const extraPct = totalValid ? Math.min((extraDays / totalValue) * 100, 100 - normalPct) : 0;
        return {
          ...e,
          m,
          normalDays,
          extraDays,
          arrivalDays,
          medicalLeave: toNumber(m.medical),
          casualLeave: toNumber(m.casual),
          noPayDays: toNumber(m.noPay),
          percent,
          normalPct,
          extraPct,
          allowance: percent === null ? 0 : allowanceFor(percent, savedRanges),
        };
      })
    : [];
  const sum = (key) => rows.reduce((t, r) => t + r[key], 0);
  const days = sheet ? Array.from({ length: sheet.daysInMonth }, (_, i) => i + 1) : [];

  return (
    <>
      <div className="pc-toolbar">
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label className="pc-field" style={{ minWidth: 220 }}>
            Attendance month
            <input type="month" required value={month} disabled={saving} onChange={(e) => changeMonth(e.target.value)} />
          </label>
          {sheet && (
            <label className="pc-field" style={{ width: 130 }}>
              Total days
              <input
                type="text"
                inputMode="numeric"
                value={totalShown}
                disabled={saving}
                onChange={(e) => setTotalDraft(cleanCount(e.target.value))}
                style={!totalValid ? { borderColor: '#B3382C' } : undefined}
              />
            </label>
          )}
          {sheet && totalValue !== sheet.daysInMonth && (
            <button className="pc-btn-sm" type="button" disabled={saving} onClick={() => setTotalDraft(String(sheet.daysInMonth))}>
              Use {sheet.daysInMonth} (days of the month)
            </button>
          )}
        </div>
        {sheet && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {hasChanges && (
              <span style={{ fontSize: 13, color: '#8A5A0F' }}>
                {dirtyIds.length > 0 && `${dirtyIds.length} employee${dirtyIds.length === 1 ? '' : 's'} changed`}
                {dirtyIds.length > 0 && totalDirty && ' · '}
                {totalDirty && 'total days changed'}
              </span>
            )}
            <button className="pc-btn-sm" type="button" disabled={saving || !hasChanges} onClick={discard}>Undo changes</button>
            <button className="pc-btn" type="button" disabled={saving || !hasChanges} onClick={save}>
              {saving ? 'Saving...' : 'Save attendance'}
            </button>
          </div>
        )}
      </div>

      {message && <div className={`pc-alert ${message.type}`}>{message.text}</div>}
      {loadError && (
        <div className="pc-alert err">
          {loadError}
          <button className="pc-btn-sm" type="button" onClick={() => load(month)}>Try again</button>
        </div>
      )}

      <div className="pc-panel" ref={formRef}>
        <h3>{editing ? `Edit ${editing.name}` : 'Add an employee to the attendance sheet'}</h3>
        <form className="pc-form" onSubmit={submitEmployee}>
          <label className="pc-field">
            Employee number
            <input
              type="text"
              required
              maxLength={20}
              placeholder="E001"
              value={form.employeeNo}
              onChange={(e) => setField('employeeNo', cleanEmployeeNo(e.target.value))}
            />
          </label>
          <label className="pc-field">
            Name
            <input type="text" required maxLength={100} value={form.name} onChange={(e) => setField('name', e.target.value)} />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="pc-btn" type="submit" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Add employee'}
            </button>
            {editing && <button className="pc-btn-sm" type="button" onClick={resetForm}>Cancel</button>}
          </div>
        </form>
        <p style={{ margin: '10px 0 0', fontSize: 13, color: '#4A6288' }}>
          An employee added here is on the sheet of every month until you delete him / her.
        </p>
      </div>

      {!validMonth ? (
        <p style={{ color: '#7C8FAD' }}>Pick a month to see its attendance.</p>
      ) : sheet === null ? (
        !loadError && <p style={{ color: '#7C8FAD' }}>Loading...</p>
      ) : (
        <>
          <div style={{ ...infoBox, marginBottom: 12, display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <strong>{monthLabel(month)}</strong>
            <span>Click a day: <b>1st click = Normal day</b>, <b>2nd click = Extra work day</b>, <b>3rd click = clear</b>.</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, background: NORMAL_COLOR, display: 'inline-block' }} /> Normal
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: 3, background: EXTRA_COLOR, display: 'inline-block' }} /> Extra work
            </span>
            <span>Arrival days = Normal + Extra &nbsp;·&nbsp; Arrival % = Arrival days ÷ Total days ({totalValid ? totalValue : '?'}) × 100</span>
          </div>

          <div className="pc-table-wrap">
            <table className="pc-table">
              <thead>
                <tr>
                  <th style={{ ...stickyNo, zIndex: 3 }}>Emp. no</th>
                  <th style={{ ...stickyName, zIndex: 3 }}>Name</th>
                  {days.map((d) => {
                    const weekend = [0, 6].includes(weekdayOf(month, d));
                    return (
                      <th key={d} style={{ textAlign: 'center', padding: '6px 2px', minWidth: 32, background: weekend ? '#DCE6F4' : undefined }}>
                        <div>{d}</div>
                        <div style={{ fontSize: 10, fontWeight: 400 }}>{WEEKDAYS[weekdayOf(month, d)]}</div>
                      </th>
                    );
                  })}
                  <th className="num" style={{ color: NORMAL_COLOR }}>Normal days</th>
                  <th className="num" style={{ color: '#B8730A' }}>Extra days</th>
                  <th className="num">Arrival days</th>
                  <th className="num">Medical leave</th>
                  <th className="num">Casual leave</th>
                  <th className="num">No-pay days</th>
                  <th className="num">Arrival %</th>
                  <th className="num">Arrival allowance</th>
                  <th style={{ minWidth: 130 }}>Chart</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={days.length + 12} className="pc-empty">No employees yet. Add the first employee above, then mark the days they came.</td></tr>
                )}
                {rows.map((r) => {
                  const changed = dirtyIds.includes(r._id);
                  const rowBg = changed ? '#FFF9E8' : '#fff';
                  return (
                    <tr key={r._id}>
                      <td style={{ ...stickyNo, background: rowBg, fontWeight: 600 }}>{r.employeeNo}</td>
                      <td style={{ ...stickyName, background: rowBg }}>{r.name}</td>
                      {days.map((d) => {
                        const state = dayState(r.m, d);
                        const weekend = [0, 6].includes(weekdayOf(month, d));
                        return (
                          <td key={d} style={{ padding: 3, textAlign: 'center', background: weekend ? '#F4F7FB' : undefined }}>
                            <button
                              type="button"
                              aria-label={`${r.name}, day ${d}: ${state === 'N' ? 'normal' : state === 'E' ? 'extra work' : 'not marked'}`}
                              onClick={() => cycle(r._id, d)}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 5,
                                border: state ? 'none' : '1px solid #DCE6F4',
                                background: state === 'N' ? NORMAL_COLOR : state === 'E' ? EXTRA_COLOR : '#fff',
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              {state}
                            </button>
                          </td>
                        );
                      })}
                      <td className="num" style={{ color: NORMAL_COLOR, fontWeight: 600 }}>{r.normalDays}</td>
                      <td className="num" style={{ color: '#B8730A', fontWeight: 600 }}>{r.extraDays}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{r.arrivalDays}</td>
                      {LEAVE_FIELDS.map(([field, , label]) => (
                        <td key={field} className="num">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            aria-label={`${r.name} ${label}`}
                            style={leaveInput}
                            value={r.m[field] || ''}
                            onChange={(e) => setLeave(r._id, field, cleanLeave(e.target.value))}
                          />
                        </td>
                      ))}
                      <td className="num" style={{ fontWeight: 700 }}>{r.percent === null ? '—' : `${round2(r.percent)}%`}</td>
                      <td className="num" style={{ fontWeight: 700, color: r.allowance > 0 ? '#2F7D57' : '#7C8FAD' }}>{formatMoney(r.allowance)}</td>
                      <td>
                        {/* stacked bar: normal (blue) + extra work (orange), out of the total days */}
                        <div
                          title={`${r.normalDays} normal + ${r.extraDays} extra = ${r.arrivalDays} of ${totalValid ? totalValue : '?'} days`}
                          style={{ display: 'flex', height: 14, minWidth: 110, background: '#EEF2F8', borderRadius: 4, overflow: 'hidden' }}
                        >
                          <div style={{ width: `${r.normalPct}%`, background: NORMAL_COLOR }} />
                          <div style={{ width: `${r.extraPct}%`, background: EXTRA_COLOR }} />
                        </div>
                      </td>
                      <td>
                        <div style={actionsCell}>
                          <button className="pc-btn-sm" type="button" onClick={() => startEdit(r)}>Edit</button>
                          <button className="pc-btn-sm pc-btn-danger" type="button" onClick={() => removeEmployee(r)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr>
                    <td style={{ ...stickyNo, background: '#F4F7FB' }} />
                    <td style={{ ...stickyName, background: '#F4F7FB' }}>Total ({rows.length} employee{rows.length === 1 ? '' : 's'})</td>
                    <td colSpan={days.length} />
                    <td className="num" style={{ color: NORMAL_COLOR }}>{sum('normalDays')}</td>
                    <td className="num" style={{ color: '#B8730A' }}>{sum('extraDays')}</td>
                    <td className="num">{sum('arrivalDays')}</td>
                    <td className="num">{sum('medicalLeave')}</td>
                    <td className="num">{sum('casualLeave')}</td>
                    <td className="num">{sum('noPayDays')}</td>
                    <td />
                    <td className="num">{formatMoney(sum('allowance'))}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="pc-panel" style={{ marginTop: 24 }}>
            <h3>Arrival allowance ranges</h3>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#4A6288' }}>
              The allowance depends on the arrival % (arrival days ÷ total days × 100). Change the “from %” or the amount of a range, add or
              remove ranges, then press <b>Save ranges</b>. The sheet above uses the saved ranges for every month.
            </p>
            <div className="pc-table-wrap">
              <table className="pc-table" style={{ maxWidth: 640 }}>
                <thead>
                  <tr>
                    <th>From (%)</th>
                    <th>Up to</th>
                    <th>Allowance (Rs.)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {draft.length === 0 && (
                    <tr><td colSpan={4} className="pc-empty">No ranges: nobody gets an arrival allowance. Add a range below.</td></tr>
                  )}
                  {draft.map((row, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={`Range ${index + 1} from percent`}
                          style={{ ...leaveInput, width: 90 }}
                          value={row.minPercent}
                          onChange={(e) => editDraft(index, 'minPercent', cleanPercent(e.target.value))}
                        />
                      </td>
                      <td>{toText(row)}</td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={`Range ${index + 1} amount`}
                          style={{ ...leaveInput, width: 130 }}
                          value={row.amount}
                          onChange={(e) => editDraft(index, 'amount', cleanAmount(e.target.value))}
                        />
                      </td>
                      <td>
                        <div style={actionsCell}>
                          <button className="pc-btn-sm pc-btn-danger" type="button" onClick={() => setRangesDraft(draft.filter((_, i) => i !== index))}>
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ margin: '10px 0 12px', fontSize: 13, color: '#4A6288' }}>
              {draftMins.length > 0 ? `Below ${Math.min(...draftMins)}%: no arrival allowance (Rs. 0).` : 'Nobody gets an arrival allowance.'}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="pc-btn-sm" type="button" disabled={saving || draft.length >= 10} onClick={() => setRangesDraft([...draft, { minPercent: '', amount: '' }])}>
                + Add range
              </button>
              <button className="pc-btn" type="button" disabled={saving || rangesDraft === null} onClick={saveRanges}>Save ranges</button>
              <button className="pc-btn-sm" type="button" disabled={saving || rangesDraft === null} onClick={() => setRangesDraft(null)}>Undo</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default StaffAttendance;