import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import useTabState from '../hooks/useTabState';
import { formatMoney, monthLabel, currentMonthString } from '../utils/pettyCash';
import { downloadAttendancePdf } from '../utils/attendancePdf';
import './PettyCash.css'; // same cards / tables / buttons as the rest of Staff Salary

const apiError = (err, fallback) => err.response?.data?.message || fallback;
const round2 = (n) => Math.round(n * 100) / 100;
const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// Typing filters (the server checks the same rules again).
const cleanCount = (v) => v.replace(/[^0-9]/g, '').slice(0, 2); // whole numbers (total days)
const cleanEmployeeNo = (v) => v.toUpperCase().replace(/[^A-Z0-9/_-]/g, '').slice(0, 20);
// whole or half days, one decimal at most (25, 25.5 ...)
const cleanDays = (v) => {
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

// The numbers typed on the sheet, in the order of the paper report's columns.
//   key = the name on screen, api = the name the server uses
const FIELDS = [
  { key: 'arrived', api: 'arrivedDays', label: 'Arrived days' },
  { key: 'extra', api: 'extraDays', label: 'Extra days' },
  { key: 'leave', api: 'leaveDays', label: 'Leave days' },
  { key: 'medical', api: 'medicalLeave', label: 'Medical leave (M)' },
  { key: 'casual', api: 'casualLeave', label: 'Casual leave (C)' },
  { key: 'noPay', api: 'noPayDays', label: 'No-pay days' },
];
const BLANK_MARKS = Object.fromEntries(FIELDS.map((f) => [f.key, '']));
const numText = (n) => (n ? String(n) : '');
const marksOf = (e) => Object.fromEntries(FIELDS.map((f) => [f.key, numText(e[f.api])]));

// arrival percentage = arrival days / total days x 100;  the highest allowance range that is reached applies
// (the server works the same out when it sends the sheet).
const percentOf = (arrivalDays, totalDays) => (totalDays > 0 ? (arrivalDays * 100) / totalDays : 0);
const allowanceFor = (percent, ranges) => {
  const range = [...ranges].sort((a, b) => b.minPercent - a.minPercent).find((r) => percent + 1e-9 >= r.minPercent);
  return range ? range.amount : 0;
};

const actionsCell = { display: 'flex', gap: 8, justifyContent: 'flex-end' };
const cellInput = { width: 62, padding: '5px 6px', border: '1px solid var(--ui-line)', borderRadius: 5, textAlign: 'center', font: 'inherit', fontSize: 14 };
const centered = { textAlign: 'center' };

// ---------------------------------------------------------------------------
// Attendance (Staff Salary tab) - the "Monthly Attendance Report"
//
//   1. Pick the MONTH and the LOCATION.
//   2. Add the employees: type the EMPLOYEE NUMBER in the last row - the NAME comes by itself (from the
//      staff of Staff & Locations) - and press Enter / Add. They stay on the report of every month until
//      removed. "Add all employees" adds everyone of the location who has an employee number.
//   3. Type the numbers like on the paper report (whole or half days: 25, 25.5 ...):
//        Arrived Days | Extra Days | Leave: Days, M (medical), C (casual) | No pay
//      The Total column adds them up - it should be the total days of the month.
//
//   Arrival days = Arrived days + Extra days (extra work days count as arrival days)
//   TOTAL DAYS is ONE fixed number (25 at first), NOT the days of the calendar month. Every month uses the same
//   number until the accountant types a new one and saves; then the new number is used from that point on.
//   Months that were already saved keep the total days they were saved with. Then:
//       Arrival Allowance % = Arrival days / Total days x 100
//   The ARRIVAL ALLOWANCE (Rs.) comes from the allowance ranges (below the report; editable), for example
//       90% - 100% = Rs. 5,000   80% - 90% = Rs. 4,000   70% - 80% = Rs. 2,000   below 70% = nothing
//   "Save attendance" saves only the rows that were changed (and the total days if it was changed).
//
//   DOWNLOAD PDF   prints the report on the screen (any month) as a PDF.
//   SAVED MONTHS   every month that was saved stays stored. The list under the report opens a past month again
//                  ("Open") or downloads its PDF exactly as it was saved. The allowance ranges of a month are
//                  frozen when it is saved, so changing the ranges later does not change old months
//                  ("Use current ranges" re-applies the current ones to one month).
// ---------------------------------------------------------------------------
function StaffAttendance({ locations }) {
  const [wantedLocation, setWantedLocation] = useTabState('aloc', '');
  // The location in the URL if it still exists, else the first one.
  const location = locations.find((l) => l._id === wantedLocation) || locations[0];
  const locationId = location ? location._id : '';
  const [month, setMonth] = useState(currentMonthString());
  const [sheet, setSheet] = useState(null); // everything as saved on the server for this month
  const [marks, setMarks] = useState({}); // { [employeeId]: { arrived, extra, leave, medical, casual, noPay } } as typed on screen
  const [totalDraft, setTotalDraft] = useState(null); // the total days being typed (null = not changed)
  const [rangesDraft, setRangesDraft] = useState(null); // the allowance ranges being edited (null = not changed)
  const [newNo, setNewNo] = useState(''); // the employee number typed in the last row
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null); // the saved months of this location: { months: [...] } (null = loading)
  const [savedError, setSavedError] = useState('');
  const [pdfMonth, setPdfMonth] = useState(''); // the saved month whose PDF is being prepared
  const latest = useRef(0);
  const latestSaved = useRef(0);
  const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  const canLoad = validMonth && Boolean(locationId);

  const marksFromSheet = (employees) => Object.fromEntries(employees.map((e) => [e._id, marksOf(e)]));

  // keepLocal = keep what was already typed (but not saved yet) for employees that are still on the sheet.
  const load = async (forMonth, forLocation, keepLocal = false) => {
    const ticket = ++latest.current;
    try {
      const res = await axios.get('/api/staff-salary/attendance', { params: { month: forMonth, location: forLocation } });
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

  // Loads when the month or the location changes (changeMonth / changeLocation clear the old sheet first).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (canLoad) load(month, locationId); }, [month, locationId]);

  // The list of saved months (every month that was saved for this location, newest first).
  const loadSaved = async (forLocation) => {
    const ticket = ++latestSaved.current;
    try {
      const res = await axios.get('/api/staff-salary/attendance/saved', { params: { location: forLocation } });
      if (ticket !== latestSaved.current) return;
      setSavedError('');
      setSaved(res.data);
    } catch (err) {
      if (ticket !== latestSaved.current) return;
      setSavedError(apiError(err, 'Could not load the saved months'));
    }
  };
  // Loads when the location changes (changeLocation clears the old list first).
  useEffect(() => {
    if (!locationId) return;
    const ticket = ++latestSaved.current;
    axios
      .get('/api/staff-salary/attendance/saved', { params: { location: locationId } })
      .then((res) => {
        if (ticket !== latestSaved.current) return;
        setSavedError('');
        setSaved(res.data);
      })
      .catch((err) => {
        if (ticket !== latestSaved.current) return;
        setSavedError(apiError(err, 'Could not load the saved months'));
      });
  }, [locationId]);

  // The employees whose row on screen is different from what is saved.
  const dirtyIds = sheet
    ? sheet.employees
        .filter((e) => {
          const m = marks[e._id];
          return m && FIELDS.some((f) => toNumber(m[f.key]) !== e[f.api]);
        })
        .map((e) => e._id)
    : [];
  const totalDirty = sheet !== null && totalDraft !== null && toNumber(totalDraft) !== sheet.totalDays;
  const hasChanges = dirtyIds.length > 0 || totalDirty;

  const totalShown = totalDraft !== null ? totalDraft : sheet ? String(sheet.totalDays) : '';
  const totalValue = toNumber(totalShown);
  const totalValid = Number.isInteger(totalValue) && totalValue >= 1 && totalValue <= 31;

  const clearScreen = () => {
    setMessage(null);
    setLoadError('');
    setSheet(null);
    setMarks({});
    setTotalDraft(null);
    setNewNo('');
  };
  const changeMonth = (next) => {
    if (hasChanges && !window.confirm('You have attendance changes that are not saved. Change the month and lose them?')) return;
    clearScreen();
    setMonth(next);
  };
  const changeLocation = (next) => {
    if (hasChanges && !window.confirm('You have attendance changes that are not saved. Change the location and lose them?')) return;
    clearScreen();
    setSaved(null);
    setSavedError('');
    setWantedLocation(next);
  };

  const setNumber = (id, key, value) => setMarks((all) => ({ ...all, [id]: { ...(all[id] || BLANK_MARKS), [key]: value } }));

  const discard = () => {
    if (sheet) setMarks(marksFromSheet(sheet.employees));
    setTotalDraft(null);
  };

  // refresh = true: also use the CURRENT allowance ranges for this month again (its saved ranges are replaced).
  const save = async (refresh = false) => {
    setMessage(null);
    if (!totalValid) {
      setMessage({ type: 'err', text: 'Total days must be a whole number from 1 to 31' });
      return;
    }
    const bad = dirtyIds
      .flatMap((id) => FIELDS.map((f) => ({ id, label: f.label, value: toNumber(marks[id][f.key]) })))
      .find((x) => x.value < 0 || x.value > 31 || !Number.isInteger(x.value * 2));
    if (bad) {
      const emp = sheet.employees.find((e) => e._id === bad.id);
      setMessage({ type: 'err', text: `${emp.name}: ${bad.label} must be whole or half days (0, 0.5, 1, 1.5 ... up to 31)` });
      return;
    }

    setSaving(true);
    try {
      const body = {
        month,
        location: locationId,
        rows: dirtyIds.map((id) => ({
          employeeId: id,
          ...Object.fromEntries(FIELDS.map((f) => [f.api, toNumber(marks[id][f.key])])),
        })),
      };
      if (totalDirty) body.totalDays = totalValue;
      if (refresh) body.refreshRanges = true;
      const res = await axios.put('/api/staff-salary/attendance', body);
      setSheet(res.data);
      setMarks(marksFromSheet(res.data.employees));
      setTotalDraft(null);
      setMessage({ type: 'ok', text: res.data.message });
      loadSaved(locationId);
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not save the attendance') });
    } finally {
      setSaving(false);
    }
  };

  // ----- the employees on the sheet: add by employee number (the name comes by itself), remove -----
  const candidates = sheet ? sheet.candidates : [];
  const onSheetIds = sheet ? sheet.employees.map((e) => e._id) : [];
  const typedNo = newNo.trim().toUpperCase();
  const match = typedNo ? candidates.find((c) => c.employeeNo === typedNo) : null;
  const alreadyOn = Boolean(match) && onSheetIds.includes(match._id);
  const notOnSheet = candidates.filter((c) => c.employeeNo && !onSheetIds.includes(c._id));

  // The sheet keeps the order the employees were added in. Records already saved are never deleted here.
  const saveEmployees = async (ids) => {
    setMessage(null);
    setSaving(true);
    try {
      await axios.put('/api/staff-salary/attendance/selection', { location: locationId, staffIds: ids });
      setNewNo('');
      await load(month, locationId, true);
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not save the employees') });
    } finally {
      setSaving(false);
    }
  };
  const addEmployee = () => {
    if (match && !alreadyOn && !saving) saveEmployees([...onSheetIds, match._id]);
  };
  const addAll = () => saveEmployees([...onSheetIds, ...notOnSheet.map((c) => c._id)]);
  const removeEmployee = (row) => {
    if (!window.confirm(`Remove ${row.employeeNo} · ${row.name} from this sheet? Attendance already saved for ${row.name} is kept.`)) return;
    saveEmployees(onSheetIds.filter((id) => id !== row._id));
  };

  // ----- allowance ranges (edited here, saved with "Save ranges") -----
  // appliedRanges = the ranges THIS month uses (frozen once the month is saved); currentRanges = what the editor below saves.
  const appliedRanges = sheet ? sheet.ranges : [];
  const savedRanges = sheet ? sheet.currentRanges || sheet.ranges : [];
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
      await load(month, locationId, true);
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not save the allowance ranges') });
    } finally {
      setSaving(false);
    }
  };

  // ----- numbers shown on the sheet (worked out from what is typed, so they follow every key press) -----
  const rows = sheet
    ? sheet.employees.map((e) => {
        const m = marks[e._id] || BLANK_MARKS;
        const n = Object.fromEntries(FIELDS.map((f) => [f.key, toNumber(m[f.key])]));
        const arrival = n.arrived + n.extra; // extra work days are arrival days too
        const accounted = arrival + n.leave + n.medical + n.casual + n.noPay; // every day written on the row
        const percent = totalValid ? percentOf(arrival, totalValue) : null;
        return { ...e, m, n, arrival, accounted, percent, allowance: percent === null ? 0 : allowanceFor(percent, appliedRanges) };
      })
    : [];
  const sumOf = (pick) => rows.reduce((t, r) => t + pick(r), 0);

  // ----- PDF of the report on the screen (what you see, also when it is not saved yet) -----
  const downloadScreenPdf = () => {
    downloadAttendancePdf({
      month,
      locationName: location.name,
      totalDays: totalValue,
      ranges: appliedRanges,
      draft: hasChanges,
      employees: rows.map((r) => ({
        employeeNo: r.employeeNo,
        name: r.name,
        arrivedDays: r.n.arrived,
        extraDays: r.n.extra,
        leaveDays: r.n.leave,
        medicalLeave: r.n.medical,
        casualLeave: r.n.casual,
        noPayDays: r.n.noPay,
        arrivalPercentage: r.percent === null ? 0 : round2(r.percent),
        allowance: r.allowance,
      })),
    });
  };

  // ----- PDF of a saved past month: made from the saved copy, so the figures are the ones saved then -----
  const downloadSavedPdf = async (savedMonth) => {
    setMessage(null);
    setPdfMonth(savedMonth);
    try {
      const res = await axios.get(`/api/staff-salary/attendance/saved/${savedMonth}`, { params: { location: locationId } });
      downloadAttendancePdf({
        month: savedMonth,
        locationName: res.data.location.name,
        totalDays: res.data.totalDays,
        ranges: res.data.ranges,
        employees: res.data.employees,
        savedAt: res.data.savedAt,
      });
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not download the PDF') });
    } finally {
      setPdfMonth('');
    }
  };

  // ----- open a saved month again on the report above -----
  const openSaved = (savedMonth) => {
    if (savedMonth === month) return;
    changeMonth(savedMonth);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <div className="pc-toolbar">
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label className="pc-field" style={{ minWidth: 220 }}>
            Attendance month
            <input type="month" required value={month} disabled={saving} onChange={(e) => changeMonth(e.target.value)} />
          </label>
          <label className="pc-field" style={{ minWidth: 200 }}>
            Location
            <select value={locationId} disabled={saving || locations.length === 0} onChange={(e) => changeLocation(e.target.value)}>
              {locations.length === 0 && <option value="">No locations</option>}
              {locations.map((l) => (
                <option key={l._id} value={l._id}>{l.name}</option>
              ))}
            </select>
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
                style={!totalValid ? { borderColor: 'var(--ui-danger)' } : undefined}
              />
            </label>
          )}
          {sheet && (
            <span style={{ fontSize: 12, color: 'var(--ui-muted)', maxWidth: 260, paddingBottom: 8 }}>
              Same for every month. Change it only when the number of days changes - then press Save attendance.
            </span>
          )}
        </div>
        {sheet && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {hasChanges && (
              <span style={{ fontSize: 13, color: 'var(--ui-warn-ink)' }}>
                {dirtyIds.length > 0 && `${dirtyIds.length} employee${dirtyIds.length === 1 ? '' : 's'} changed`}
                {dirtyIds.length > 0 && totalDirty && ' · '}
                {totalDirty && 'total days changed'}
              </span>
            )}
            <button className="pc-btn-sm" type="button" disabled={saving || !totalValid || sheet.employees.length === 0} onClick={downloadScreenPdf}>
              Download PDF
            </button>
            <button className="pc-btn-sm" type="button" disabled={saving || !hasChanges} onClick={discard}>Undo changes</button>
            <button className="pc-btn" type="button" disabled={saving || !hasChanges} onClick={() => save()}>
              {saving ? 'Saving...' : 'Save attendance'}
            </button>
          </div>
        )}
      </div>

      {message && <div className={`pc-alert ${message.type}`}>{message.text}</div>}
      {loadError && (
        <div className="pc-alert err">
          {loadError}
          <button className="pc-btn-sm" type="button" onClick={() => load(month, locationId)}>Try again</button>
        </div>
      )}

      {locations.length === 0 ? (
        <div className="pc-alert warn">Add a location and its staff (with their employee numbers) in the “Staff &amp; Locations” tab first.</div>
      ) : !validMonth ? (
        <p style={{ color: 'var(--ui-faint)' }}>Pick a month to see its attendance.</p>
      ) : sheet === null ? (
        !loadError && <p style={{ color: 'var(--ui-faint)' }}>Loading...</p>
      ) : (
        <>
          <div style={{ textAlign: 'center', margin: '8px 0 14px' }}>
            <h3 style={{ margin: 0, textDecoration: 'underline' }}>Monthly Attendance Report</h3>
            <div style={{ marginTop: 6, fontSize: 15 }}>
              Month = <b>{monthLabel(month).toUpperCase()}</b> &nbsp;·&nbsp; Location = <b>{location.name}</b> &nbsp;·&nbsp; Total days = <b>{totalValid ? totalValue : '?'}</b>
            </div>
          </div>

          {sheet.rangesFrozen && sheet.rangesOutdated && (
            <div className="pc-alert warn" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <span>
                This month keeps the allowance ranges it was saved with, which are different from the current ranges below. Its allowance
                figures have not changed.
              </span>
              <button className="pc-btn-sm" type="button" disabled={saving || !totalValid} onClick={() => save(true)}>
                Use current ranges
              </button>
            </div>
          )}

          <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ui-muted)' }}>
            Type the numbers like on the paper report (whole or half days: 25, 25.5 ...). Arrival days = Arrived days + Extra days.
            Arrival Allowance % = Arrival days ÷ Total days × 100. The <b>Total</b> column adds up every day typed on the row; it turns orange
            when it is not the total days of the month.
          </p>

          <div className="pc-table-wrap">
            <table className="pc-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="num">No</th>
                  <th rowSpan={2}>Name</th>
                  <th rowSpan={2}>E.N.</th>
                  <th rowSpan={2} style={centered}>Arrived Days</th>
                  <th rowSpan={2} style={centered}>Extra Days</th>
                  <th colSpan={3} style={centered}>Leave</th>
                  <th rowSpan={2} style={centered}>(NO PAY)</th>
                  <th rowSpan={2} style={centered}>Total</th>
                  <th rowSpan={2} className="num">Arrival Allowance %</th>
                  <th rowSpan={2} className="num">Allowance (Rs.)</th>
                  <th rowSpan={2}></th>
                </tr>
                <tr>
                  <th style={centered} title="Leave days that are not medical or casual">Days</th>
                  <th style={centered} title="Medical leave">M</th>
                  <th style={centered} title="Casual leave">C</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={13} className="pc-empty">No employees on this report yet. Type an employee number in the last row to add the first one.</td></tr>
                )}
                {rows.map((r, index) => {
                  const changed = dirtyIds.includes(r._id);
                  const totalOk = totalValid && r.accounted === totalValue;
                  return (
                    <tr key={r._id} style={changed ? { background: 'var(--ui-warn-bg)' } : undefined}>
                      <td className="num">{String(index + 1).padStart(2, '0')}</td>
                      <td>{r.name}</td>
                      <td style={{ fontWeight: 600 }}>{r.employeeNo}</td>
                      {FIELDS.map((f) => (
                        <td key={f.key} style={centered}>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            aria-label={`${r.name} ${f.label}`}
                            style={cellInput}
                            value={r.m[f.key]}
                            onChange={(e) => setNumber(r._id, f.key, cleanDays(e.target.value))}
                          />
                        </td>
                      ))}
                      <td
                        style={{ ...centered, fontWeight: 700, color: totalOk ? 'var(--ui-ok)' : 'var(--ui-warn)' }}
                        title={`Arrived ${r.n.arrived} + Extra ${r.n.extra} + Leave ${r.n.leave} + M ${r.n.medical} + C ${r.n.casual} + No pay ${r.n.noPay} = ${r.accounted} (total days ${totalValid ? totalValue : '?'})`}
                      >
                        {r.accounted}
                      </td>
                      <td className="num" style={{ fontWeight: 700 }} title={`Arrival days ${r.arrival}`}>{r.percent === null ? '—' : `${round2(r.percent)}%`}</td>
                      <td className="num" style={{ fontWeight: 700, color: r.allowance > 0 ? 'var(--ui-ok)' : 'var(--ui-faint)' }}>{formatMoney(r.allowance)}</td>
                      <td>
                        <div style={actionsCell}>
                          <button className="pc-btn-sm pc-btn-danger" type="button" disabled={saving} onClick={() => removeEmployee(r)}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* the last row: type the employee number, the name comes by itself */}
                <tr style={{ background: 'var(--ui-soft)' }}>
                  <td className="num">{String(rows.length + 1).padStart(2, '0')}</td>
                  <td>
                    {match ? (
                      <b>{match.name}</b>
                    ) : (
                      <span style={{ color: typedNo ? 'var(--ui-danger)' : 'var(--ui-faint)', fontSize: 13 }}>
                        {typedNo ? `No employee ${typedNo} in ${location.name}` : 'Type the employee number →'}
                      </span>
                    )}
                  </td>
                  <td>
                    <input
                      type="text"
                      list="attendance-employee-numbers"
                      placeholder="E.N."
                      aria-label="Employee number to add"
                      maxLength={20}
                      disabled={saving}
                      style={{ ...cellInput, width: 96 }}
                      value={newNo}
                      onChange={(e) => setNewNo(cleanEmployeeNo(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addEmployee();
                        }
                      }}
                    />
                    <datalist id="attendance-employee-numbers">
                      {notOnSheet.map((c) => (
                        <option key={c._id} value={c.employeeNo}>{c.name}</option>
                      ))}
                    </datalist>
                  </td>
                  <td colSpan={10}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button className="pc-btn-sm" type="button" disabled={saving || !match || alreadyOn} onClick={addEmployee}>Add</button>
                      {alreadyOn && <span style={{ fontSize: 13, color: 'var(--ui-warn-ink)' }}>{match.name} is already on this report</span>}
                      {notOnSheet.length > 0 && (
                        <button className="pc-btn-sm" type="button" disabled={saving} onClick={addAll}>
                          Add all employees of {location.name} ({notOnSheet.length})
                        </button>
                      )}
                      {candidates.some((c) => !c.employeeNo) && (
                        <span style={{ fontSize: 12, color: 'var(--ui-faint)' }}>
                          Some staff have no employee number yet - add it in “Staff &amp; Locations” to use them here.
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3}>Total ({rows.length} employee{rows.length === 1 ? '' : 's'})</td>
                    {FIELDS.map((f) => (
                      <td key={f.key} style={centered}>{sumOf((r) => r.n[f.key])}</td>
                    ))}
                    <td style={centered}>{sumOf((r) => r.accounted)}</td>
                    <td />
                    <td className="num">{formatMoney(sumOf((r) => r.allowance))}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="pc-panel" style={{ marginTop: 24 }}>
            <h3>Saved months · {location.name}</h3>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ui-muted)' }}>
              Every month you save is kept here. <b>Open</b> shows it on the report above; <b>Download PDF</b> gives the report exactly as it was saved.
            </p>
            {savedError && (
              <div className="pc-alert err">
                {savedError}
                <button className="pc-btn-sm" type="button" onClick={() => loadSaved(locationId)}>Try again</button>
              </div>
            )}
            {saved === null && !savedError ? (
              <p style={{ color: 'var(--ui-faint)' }}>Loading...</p>
            ) : (
              <div className="pc-table-wrap">
                <table className="pc-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th style={centered}>Employees</th>
                      <th style={centered}>Total days</th>
                      <th className="num">Total allowance</th>
                      <th>Last saved</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {saved && saved.months.length === 0 && (
                      <tr><td colSpan={6} className="pc-empty">No saved months yet. Type the attendance above and press “Save attendance”.</td></tr>
                    )}
                    {saved && saved.months.map((m) => (
                      <tr key={m.month} style={m.month === month ? { background: 'var(--ui-primary-soft)' } : undefined}>
                        <td style={{ fontWeight: 600 }}>{monthLabel(m.month)}{m.month === month && ' (open)'}</td>
                        <td style={centered}>{m.employees}</td>
                        <td style={centered}>{m.totalDays}</td>
                        <td className="num">{formatMoney(m.totalAllowance)}</td>
                        <td>{new Date(m.savedAt).toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })}</td>
                        <td>
                          <div style={actionsCell}>
                            <button className="pc-btn-sm" type="button" disabled={saving || m.month === month} onClick={() => openSaved(m.month)}>Open</button>
                            <button className="pc-btn-sm" type="button" disabled={pdfMonth === m.month} onClick={() => downloadSavedPdf(m.month)}>
                              {pdfMonth === m.month ? 'Preparing...' : 'Download PDF'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="pc-panel" style={{ marginTop: 24 }}>
            <h3>Arrival allowance ranges</h3>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ui-muted)' }}>
              The allowance depends on the Arrival Allowance % (arrival days ÷ total days × 100). Change the “from %” or the amount of a range,
              add or remove ranges, then press <b>Save ranges</b>. The new ranges are used for months that are not saved yet. A month that was
              already saved keeps the ranges it was saved with, so old reports never change.
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
                          style={{ ...cellInput, width: 90 }}
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
                          style={{ ...cellInput, width: 130 }}
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
            <p style={{ margin: '10px 0 12px', fontSize: 13, color: 'var(--ui-muted)' }}>
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