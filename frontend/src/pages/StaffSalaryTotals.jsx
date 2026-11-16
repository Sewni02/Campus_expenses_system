import { useState, useEffect } from 'react';
import axios from 'axios';
import { formatMoney, monthLabel, currentMonthString } from '../utils/pettyCash';
import { downloadSalaryTotalsPdf } from '../utils/staffSalaryTotalsPdf';
import './PettyCash.css'; // re-uses the same cards / tables / buttons as Petty Cash

const apiError = (err, fallback) => err.response?.data?.message || fallback;

// ---------------------------------------------------------------------------
// Staff Salary -> "Month Totals" tab
//
//   Pick a month and see its TOTAL NET SALARY (the sum of the net salary of every salary saved for that month):
//     - "All locations"  -> the grand total of the month,
//     - one location     -> the total of that location, and the net salary of each of its employees.
//   The table always lists EVERY location of the month with its own total (a location without salaries shows 0.00),
//   so all the locations can be compared at a glance. "Show" on a row (or the "Show location" box) picks a location.
//
//   "Download PDF" prints what is on the screen: the totals of all locations (with the grand total), or the totals
//   and the employees of the picked location.
//
//   The figures are the salaries as saved in the "Monthly Salary" tab - nothing is worked out again here.
// ---------------------------------------------------------------------------
function StaffSalaryTotals({ locations }) {
  const [month, setMonth] = useState(currentMonthString());
  const [locationId, setLocationId] = useState(''); // '' = all locations
  const [savedMonths, setSavedMonths] = useState([]); // every month that has salaries (a shortcut list)
  const [totals, setTotals] = useState(null); // the answer for `totals.month`
  const [error, setError] = useState(null); // { month, text }
  const [people, setPeople] = useState(null); // the employees of one location: { key, rows, failed }
  const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);

  // the list of months that have salaries
  useEffect(() => {
    axios
      .get('/api/staff-salary/salaries/months')
      .then((res) => setSavedMonths(res.data))
      .catch(() => {}); // only a shortcut - the month picker still works without it
  }, []);

  // the totals of the picked month (all locations)
  useEffect(() => {
    if (!validMonth) return undefined;
    let cancelled = false;
    axios
      .get('/api/staff-salary/salaries/totals', { params: { month } })
      .then((res) => {
        if (cancelled) return;
        setError(null);
        setTotals(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError({ month, text: apiError(err, 'Could not load the totals') });
      });
    return () => { cancelled = true; };
  }, [month, validMonth]);

  // the employees of the picked location in the picked month
  const peopleKey = `${month}|${locationId}`;
  useEffect(() => {
    if (!validMonth || !locationId) return undefined;
    let cancelled = false;
    axios
      .get('/api/staff-salary/salaries', { params: { month, location: locationId } })
      .then((res) => {
        if (!cancelled) setPeople({ key: peopleKey, rows: res.data });
      })
      .catch(() => {
        if (!cancelled) setPeople({ key: peopleKey, rows: [], failed: true });
      });
    return () => { cancelled = true; };
  }, [month, locationId, validMonth, peopleKey]);

  const ready = validMonth && totals && totals.month === month;
  const failed = validMonth && error && error.month === month && !ready;
  const peopleReady = people && people.key === peopleKey;

  // the location picked (it may have been deleted since - then the grand total is shown)
  const picked = ready && locationId ? totals.locations.find((l) => String(l.location) === locationId) : null;
  const shown = picked || (ready ? { ...totals.grand, name: 'All locations' } : null);
  const isAll = !picked;

  const pick = (id) => setLocationId(id === locationId ? '' : id);

  // the PDF needs the employees of the picked location, so it waits until they are loaded
  const canDownload = ready && (!picked || (peopleReady && !people.failed));
  const downloadPdf = () => {
    downloadSalaryTotalsPdf({
      month,
      locationName: picked ? picked.name : null,
      summary: shown,
      locations: totals.locations,
      employees: picked && peopleReady ? people.rows : [],
    });
  };

  return (
    <>
      <div className="pc-toolbar">
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label className="pc-field" style={{ minWidth: 200 }}>
            Salary month
            <input type="month" required value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <label className="pc-field" style={{ minWidth: 260 }}>
            Saved months
            <select value={savedMonths.some((m) => m.month === month) ? month : ''} onChange={(e) => e.target.value && setMonth(e.target.value)}>
              <option value="">{savedMonths.length === 0 ? 'No saved salaries yet' : 'Jump to a saved month...'}</option>
              {savedMonths.map((m) => (
                <option key={m.month} value={m.month}>
                  {monthLabel(m.month)} · {formatMoney(m.totalNet)}
                </option>
              ))}
            </select>
          </label>
          <label className="pc-field" style={{ minWidth: 220 }}>
            Show location
            <select value={picked ? locationId : ''} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">All locations</option>
              {locations.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
            </select>
          </label>
          <button className="pc-btn-sm" type="button" disabled={!canDownload} onClick={downloadPdf}>
            Download PDF
          </button>
        </div>
      </div>

      {!validMonth && <p style={{ color: '#7C8FAD' }}>Pick a month to see its total net salary.</p>}
      {failed && <div className="pc-alert err">{error.text}</div>}
      {validMonth && !ready && !failed && <p style={{ color: '#7C8FAD' }}>Loading...</p>}

      {ready && (
        <>
          <div className="pc-cards">
            <div className="pc-card balance">
              <p>Total net salary</p>
              <h2>{formatMoney(shown.totalNet)}</h2>
              <small>{shown.name} · {monthLabel(month)}</small>
            </div>
            <div className="pc-card">
              <p>Employees paid</p>
              <h2>{shown.count}</h2>
              <small>{isAll ? `${totals.locations.filter((l) => l.count > 0).length} of ${totals.locations.length} locations` : shown.name}</small>
            </div>
            <div className="pc-card">
              <p>Gross salary</p>
              <h2>{formatMoney(shown.totalGross)}</h2>
              <small>Basic + allowances</small>
            </div>
            <div className="pc-card spent">
              <p>Total deductions</p>
              <h2>{formatMoney(shown.totalDeductions)}</h2>
              <small>Taken off the gross salary</small>
            </div>
          </div>

          {totals.grand.count === 0 && (
            <div className="pc-alert warn">No salaries are saved for {monthLabel(month)} yet. Add them in the “Monthly Salary” tab.</div>
          )}

          <div className="pc-toolbar">
            <h2 style={{ fontSize: 18 }}>Net salary by location · {monthLabel(month)}</h2>
          </div>
          <div className="pc-table-wrap">
            <table className="pc-table">
              <thead>
                <tr>
                  <th>Location</th>
                  <th className="num">Employees</th>
                  <th className="num">Basic</th>
                  <th className="num">Allowances</th>
                  <th className="num">Deductions</th>
                  <th className="num">Gross</th>
                  <th className="num">Net salary</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {totals.locations.length === 0 && (
                  <tr><td colSpan={8} className="pc-empty">No locations yet. Add one in the “Staff &amp; Locations” tab.</td></tr>
                )}
                {totals.locations.map((l) => {
                  const selected = picked && String(l.location) === locationId;
                  const known = locations.some((x) => x._id === String(l.location));
                  return (
                    <tr key={l.location} style={selected ? { background: '#EAF1FC' } : undefined}>
                      <td style={{ fontWeight: 600 }}>{l.name}{!known && <small style={{ color: '#7C8FAD', fontWeight: 400 }}> (deleted location)</small>}</td>
                      <td className="num">{l.count}</td>
                      <td className="num">{formatMoney(l.totalBasic)}</td>
                      <td className="num">{formatMoney(l.totalAllowances)}</td>
                      <td className="num">{formatMoney(l.totalDeductions)}</td>
                      <td className="num">{formatMoney(l.totalGross)}</td>
                      <td className="num"><strong>{formatMoney(l.totalNet)}</strong></td>
                      <td>
                        {known && (
                          <button className="pc-btn-sm" type="button" onClick={() => pick(String(l.location))}>
                            {selected ? 'Show all' : 'Show'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {totals.locations.length > 0 && (
                <tfoot>
                  <tr>
                    <td>Total · all locations</td>
                    <td className="num">{totals.grand.count}</td>
                    <td className="num">{formatMoney(totals.grand.totalBasic)}</td>
                    <td className="num">{formatMoney(totals.grand.totalAllowances)}</td>
                    <td className="num">{formatMoney(totals.grand.totalDeductions)}</td>
                    <td className="num">{formatMoney(totals.grand.totalGross)}</td>
                    <td className="num">{formatMoney(totals.grand.totalNet)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {picked && (
            <>
              <div className="pc-toolbar" style={{ marginTop: 24 }}>
                <h2 style={{ fontSize: 18 }}>Employees · {picked.name} · {monthLabel(month)}</h2>
              </div>
              <div className="pc-table-wrap">
                <table className="pc-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th className="num">Basic</th>
                      <th className="num">Allowances</th>
                      <th className="num">Deductions</th>
                      <th className="num">Net salary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!peopleReady && <tr><td colSpan={5} className="pc-empty">Loading...</td></tr>}
                    {peopleReady && people.failed && <tr><td colSpan={5} className="pc-empty">Could not load the employees.</td></tr>}
                    {peopleReady && !people.failed && people.rows.length === 0 && (
                      <tr><td colSpan={5} className="pc-empty">No salaries saved for {picked.name} in {monthLabel(month)}.</td></tr>
                    )}
                    {peopleReady && people.rows.map((r) => (
                      <tr key={r._id}>
                        <td>{r.employeeNo && <b>{r.employeeNo} · </b>}{r.staffName}</td>
                        <td className="num">{formatMoney(r.basicSalary)}</td>
                        <td className="num">{formatMoney(r.totalAllowances)}</td>
                        <td className="num">{formatMoney(r.totalDeductions)}</td>
                        <td className="num"><strong>{formatMoney(r.netSalary)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                  {peopleReady && people.rows.length > 0 && (
                    <tfoot>
                      <tr>
                        <td>Total ({people.rows.length})</td>
                        <td className="num">{formatMoney(picked.totalBasic)}</td>
                        <td className="num">{formatMoney(picked.totalAllowances)}</td>
                        <td className="num">{formatMoney(picked.totalDeductions)}</td>
                        <td className="num">{formatMoney(picked.totalNet)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

export default StaffSalaryTotals;