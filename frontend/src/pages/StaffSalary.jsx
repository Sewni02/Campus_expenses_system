import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import useTabState from '../hooks/useTabState';
import { API_BASE_URL } from '../config/api';
import { formatMoney, formatDate, monthLabel, currentMonthString } from '../utils/pettyCash';
import './PettyCash.css'; // re-uses the same cards / tables / buttons / tabs as Petty Cash

const STAFF_API = `${API_BASE_URL}/api/staff-salary`;

const apiError = (err, fallback) => err.response?.data?.message || fallback;
const round2 = (n) => Math.round(n * 100) / 100;
const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// Typing filters (the server checks the same rules again).
const cleanNic = (v) => v.toUpperCase().replace(/[^0-9VX]/g, '').slice(0, 12);
const cleanMobile = (v) => v.replace(/\D/g, '').slice(0, 10);
const cleanAmount = (v) => {
  let c = v.replace(/[^0-9.]/g, '');
  const dot = c.indexOf('.');
  if (dot !== -1) c = c.slice(0, dot + 1) + c.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  return c;
};

// Allowance / deduction rows are { name, amount } with the amount kept as typed text.
const sumRows = (rows) => round2(rows.reduce((total, r) => total + toNumber(r.amount), 0));
// Rows left completely empty are ignored; the server checks the rest.
const cleanRows = (rows) =>
  rows.filter((r) => r.name.trim() !== '' || r.amount !== '').map((r) => ({ name: r.name.trim(), amount: r.amount }));

// Names offered while typing (any other name can still be typed).
const ALLOWANCE_SUGGESTIONS = ['Transport allowance', 'Telephone allowance', 'Meal allowance', 'Attendance allowance', 'Overtime', 'Bonus', 'Special allowance'];
const DEDUCTION_SUGGESTIONS = ['EPF (employee 8%)', 'Salary advance', 'Loan instalment', 'Welfare', 'No-pay leave', 'Tax (APIT)'];

const infoBox = { background: '#F4F8FD', border: '1px solid #DCE6F4', borderRadius: 10, padding: '12px 16px', fontSize: 14 };
const actionsCell = { display: 'flex', gap: 8, justifyContent: 'flex-end' };

// ---------------------------------------------------------------------------
// Staff Salary (super admin sidebar tab)
//
//   Tab "Staff & Locations" -> pick a location (or "+ Add location"), then add / edit /
//                              delete the staff members of that location. The profile holds
//                              name, NIC, mobile, date joined and the BASIC SALARY.
//   Tab "Monthly Salary"    -> pick the month, the location and the employee (the basic salary
//                              fills in by itself), then add Allowances and Deductions.
// The selected tab ("ssec") and location ("sloc") live in the URL, so a refresh or the
// browser back button keeps you where you were.
// ---------------------------------------------------------------------------
function StaffSalary() {
  const [section, setSection] = useTabState('ssec', 'staff');
  const [locations, setLocations] = useState(null);
  const [loadError, setLoadError] = useState('');

  const loadLocations = () =>
    axios
      .get(`${STAFF_API}/locations`)
      .then((res) => {
        setLocations(res.data);
        setLoadError('');
      })
      .catch((err) => {
        setLocations((current) => current || []);
        setLoadError(apiError(err, 'Could not load the locations'));
      });
  useEffect(() => { loadLocations(); }, []);

  return (
    <div className="sa-page pc-page">
      <div className="pc-toolbar">
        <h1 className="sa-page-title" style={{ margin: 0 }}>Staff Salary</h1>
      </div>
      <div className="pc-tabs">
        {[['staff', 'Staff & Locations'], ['salaries', 'Monthly Salary']].map(([key, label]) => (
          <button key={key} className={`pc-tab ${section === key ? 'active' : ''}`} onClick={() => setSection(key)}>
            {label}
          </button>
        ))}
      </div>

      {loadError && <div className="pc-alert err">{loadError}</div>}

      {locations === null ? (
        <p style={{ color: '#7C8FAD' }}>Loading...</p>
      ) : section === 'staff' ? (
        <StaffSection locations={locations} onLocationsChanged={loadLocations} />
      ) : (
        <SalarySection locations={locations} />
      )}
    </div>
  );
}

// ---------- Staff & Locations ----------

// Location tabs (Head Office | Kelani Hostel ...) with a "+ Add location" tab at the end.
function LocationTabs({ locations, value, onChange, onAdded }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const add = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await axios.post(`${STAFF_API}/locations`, { name });
      setName('');
      setAdding(false);
      await onAdded();
      onChange(res.data.location._id);
    } catch (err) {
      setError(apiError(err, 'Could not add the location'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="pc-tabs" style={{ alignItems: 'center' }}>
        {locations.map((l) => (
          <button key={l._id} className={`pc-tab ${value === l._id ? 'active' : ''}`} onClick={() => onChange(l._id)}>
            {l.name}
          </button>
        ))}
        {!adding && (
          <button className="pc-tab pc-tab-add" onClick={() => setAdding(true)}>+ Add location</button>
        )}
        {adding && (
          <form onSubmit={add} className="pc-add-degree">
            <input type="text" required autoFocus maxLength={80} placeholder="e.g. Head Office" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="pc-btn-sm" type="submit" disabled={busy}>Add</button>
            <button className="pc-btn-sm" type="button" onClick={() => { setAdding(false); setName(''); setError(''); }}>Cancel</button>
          </form>
        )}
      </div>
      {error && <div className="pc-alert err">{error}</div>}
    </>
  );
}

function StaffSection({ locations, onLocationsChanged }) {
  const [wanted, setWanted] = useTabState('sloc', '');
  // The location in the URL if it still exists, else the first one.
  const location = locations.find((l) => l._id === wanted) || locations[0];

  return (
    <>
      <LocationTabs locations={locations} value={location ? location._id : ''} onChange={setWanted} onAdded={onLocationsChanged} />
      {location ? (
        <LocationStaff key={location._id} location={location} onLocationsChanged={onLocationsChanged} onDeleted={() => setWanted('')} />
      ) : (
        <div className="pc-panel" style={{ textAlign: 'center', color: '#4A6288' }}>
          No locations yet. Click “+ Add location” above to create the first one (for example Head Office), then add its staff.
        </div>
      )}
    </>
  );
}

const BLANK_STAFF = { name: '', nic: '', mobile: '', joinedDate: '', basicSalary: '' };

// The staff of ONE location (remounted with a fresh state whenever another location is picked).
function LocationStaff({ location, onLocationsChanged, onDeleted }) {
  const [staff, setStaff] = useState(null);
  const [form, setForm] = useState(BLANK_STAFF);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);

  const loadStaff = () =>
    axios
      .get(`${STAFF_API}/staff`, { params: { location: location._id } })
      .then((res) => setStaff(res.data))
      .catch((err) => {
        setStaff([]);
        setMessage({ type: 'err', text: apiError(err, 'Could not load the staff') });
      });
  // Loads once when this location opens (the component is remounted for every other location).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadStaff(); }, []);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const reset = () => {
    setEditing(null);
    setForm(BLANK_STAFF);
  };

  const startEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name,
      nic: s.nic,
      mobile: s.mobile,
      joinedDate: s.joinedDate ? s.joinedDate.slice(0, 10) : '',
      basicSalary: String(s.basicSalary),
    });
    setMessage(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const res = editing
        ? await axios.put(`${STAFF_API}/staff/${editing._id}`, form)
        : await axios.post(`${STAFF_API}/staff`, { ...form, locationId: location._id });
      setMessage({ type: 'ok', text: res.data.message });
      reset();
      await Promise.all([loadStaff(), onLocationsChanged()]);
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not save the staff member') });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s) => {
    if (!window.confirm(`Delete ${s.name}? Salaries already created for this person stay in the records.`)) return;
    setMessage(null);
    try {
      const res = await axios.delete(`${STAFF_API}/staff/${s._id}`);
      setMessage({ type: 'ok', text: res.data.message });
      if (editing && editing._id === s._id) reset();
      await Promise.all([loadStaff(), onLocationsChanged()]);
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not delete the staff member') });
    }
  };

  const removeLocation = async () => {
    if (!window.confirm(`Delete the location “${location.name}”?`)) return;
    setMessage(null);
    try {
      await axios.delete(`${STAFF_API}/locations/${location._id}`);
      await onLocationsChanged();
      onDeleted();
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not delete the location') });
    }
  };

  return (
    <>
      <div className="pc-toolbar">
        <h2 style={{ fontSize: 18 }}>
          {location.name}
          <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 400, color: '#4A6288' }}>
            {(staff ? staff.length : location.staffCount)} staff member{(staff ? staff.length : location.staffCount) === 1 ? '' : 's'}
          </span>
        </h2>
        <button className="pc-btn-sm pc-btn-danger" type="button" onClick={removeLocation}>Delete location</button>
      </div>

      {message && <div className={`pc-alert ${message.type}`}>{message.text}</div>}

      <div className="pc-panel" ref={formRef}>
        <h3>{editing ? `Edit ${editing.name}` : `Add a staff member to ${location.name}`}</h3>
        <form className="pc-form" onSubmit={submit}>
          <label className="pc-field">
            Full name
            <input type="text" required maxLength={100} value={form.name} onChange={(e) => setField('name', e.target.value)} />
          </label>
          <label className="pc-field">
            NIC
            <input
              type="text"
              required
              placeholder="901234567V or 199012345678"
              pattern="(\d{9}[VX]|\d{12})"
              title="9 digits followed by V or X, or 12 digits"
              value={form.nic}
              onChange={(e) => setField('nic', cleanNic(e.target.value))}
            />
          </label>
          <label className="pc-field">
            Mobile number
            <input
              type="text"
              inputMode="numeric"
              required
              placeholder="0771234567"
              pattern="0[0-9]{9}"
              title="10 digits starting with 0"
              value={form.mobile}
              onChange={(e) => setField('mobile', cleanMobile(e.target.value))}
            />
          </label>
          <label className="pc-field">
            Date joined
            <input type="date" required value={form.joinedDate} onChange={(e) => setField('joinedDate', e.target.value)} />
          </label>
          <label className="pc-field">
            Basic salary (Rs.)
            <input
              type="text"
              inputMode="decimal"
              required
              pattern="[0-9]+(\.[0-9]{1,2})?"
              title="An amount such as 85000 or 85000.50"
              value={form.basicSalary}
              onChange={(e) => setField('basicSalary', cleanAmount(e.target.value))}
            />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="pc-btn" type="submit" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Add staff member'}
            </button>
            {editing && <button className="pc-btn-sm" type="button" onClick={reset}>Cancel</button>}
          </div>
        </form>
      </div>

      <div className="pc-table-wrap">
        <table className="pc-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>NIC</th>
              <th>Mobile</th>
              <th>Date joined</th>
              <th className="num">Basic salary</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {staff === null && (
              <tr><td colSpan={6} className="pc-empty">Loading...</td></tr>
            )}
            {staff && staff.length === 0 && (
              <tr><td colSpan={6} className="pc-empty">No staff members in {location.name} yet. Add the first one above.</td></tr>
            )}
            {staff && staff.map((s) => (
              <tr key={s._id}>
                <td>{s.name}</td>
                <td>{s.nic}</td>
                <td>{s.mobile}</td>
                <td>{formatDate(s.joinedDate)}</td>
                <td className="num">{formatMoney(s.basicSalary)}</td>
                <td>
                  <div style={actionsCell}>
                    <button className="pc-btn-sm" type="button" onClick={() => startEdit(s)}>Edit</button>
                    <button className="pc-btn-sm pc-btn-danger" type="button" onClick={() => remove(s)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------- Monthly Salary ----------

function SalarySection({ locations }) {
  const [month, setMonth] = useState(currentMonthString());
  const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);

  return (
    <>
      <div className="pc-toolbar">
        <label className="pc-field" style={{ minWidth: 220 }}>
          Salary month
          <input type="month" required value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      </div>

      {locations.length === 0 ? (
        <div className="pc-alert warn">Add a location and its staff in the “Staff &amp; Locations” tab first.</div>
      ) : validMonth ? (
        // key = month: picking another month starts a clean form and loads that month's salaries.
        <MonthWorkspace key={month} month={month} locations={locations} />
      ) : (
        <p style={{ color: '#7C8FAD' }}>Pick a month to create or view its salaries.</p>
      )}
    </>
  );
}

// One row of the summary box (Basic salary, + Allowances, = Gross ...).
function SummaryLine({ label, value, strong = false, color }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        padding: strong ? '8px 0 0' : '4px 0',
        marginTop: strong ? 4 : 0,
        borderTop: strong ? '1px solid #DCE6F4' : 'none',
        fontWeight: strong ? 700 : 400,
        color: color || 'inherit',
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// The rows of one mini tab (Allowances or Deductions): a name and an amount, as many as needed.
function LineItems({ rows, onChange, suggestions, listId, nounLabel }) {
  const update = (index, key, value) => onChange(rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  const remove = (index) => onChange(rows.filter((_, i) => i !== index));

  return (
    <div>
      <datalist id={listId}>
        {suggestions.map((s) => <option key={s} value={s} />)}
      </datalist>

      {rows.length === 0 && (
        <p style={{ margin: '0 0 12px', color: '#7C8FAD', fontSize: 14 }}>
          No {nounLabel.toLowerCase()}s added. Click “+ Add {nounLabel.toLowerCase()}” if this employee has any.
        </p>
      )}

      {rows.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) auto', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <div className="pc-field">
            <input
              type="text"
              list={listId}
              maxLength={60}
              placeholder={`${nounLabel} name`}
              aria-label={`${nounLabel} name ${i + 1}`}
              value={r.name}
              onChange={(e) => update(i, 'name', e.target.value)}
            />
          </div>
          <div className="pc-field">
            <input
              type="text"
              inputMode="decimal"
              placeholder="Amount (Rs.)"
              aria-label={`${nounLabel} amount ${i + 1}`}
              value={r.amount}
              onChange={(e) => update(i, 'amount', cleanAmount(e.target.value))}
            />
          </div>
          <button className="pc-btn-sm pc-btn-danger" type="button" onClick={() => remove(i)}>Remove</button>
        </div>
      ))}

      <button className="pc-btn-sm" type="button" onClick={() => onChange([...rows, { name: '', amount: '' }])}>
        + Add {nounLabel.toLowerCase()}
      </button>
    </div>
  );
}

// The salary FORM for one month + that month's salaries.
function MonthWorkspace({ month, locations }) {
  const [records, setRecords] = useState(null);
  const [listLocation, setListLocation] = useState(''); // '' = every location
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);

  // the form
  const [editing, setEditing] = useState(null); // the salary being edited, or null for a new one
  const [locationId, setLocationId] = useState('');
  const [staffList, setStaffList] = useState([]); // employees of the chosen location
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [allowances, setAllowances] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [lineTab, setLineTab] = useState('allowances'); // the mini tab: 'allowances' | 'deductions'
  const [note, setNote] = useState('');
  const staffRequest = useRef(0); // ignores an old answer if another location was picked meanwhile

  const loadRecords = () =>
    axios
      .get(`${STAFF_API}/salaries`, { params: { month } })
      .then((res) => setRecords(res.data))
      .catch((err) => {
        setRecords((current) => current || []);
        setMessage({ type: 'err', text: apiError(err, 'Could not load the salaries') });
      });
  // Loads once per month (this component is remounted whenever the month changes).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadRecords(); }, []);

  // Picking a location loads its employees into the dropdown.
  const pickLocation = async (id) => {
    const mine = ++staffRequest.current;
    setLocationId(id);
    setStaffId('');
    setStaffList([]);
    if (!id) {
      setStaffLoading(false);
      return;
    }
    setStaffLoading(true);
    try {
      const res = await axios.get(`${STAFF_API}/staff`, { params: { location: id } });
      if (mine === staffRequest.current) setStaffList(res.data);
    } catch (err) {
      if (mine === staffRequest.current) setMessage({ type: 'err', text: apiError(err, 'Could not load the staff of this location') });
    } finally {
      if (mine === staffRequest.current) setStaffLoading(false);
    }
  };

  const resetForm = () => {
    setEditing(null);
    setStaffId('');
    setAllowances([]);
    setDeductions([]);
    setNote('');
    setLineTab('allowances');
  };

  const cancelEdit = () => {
    resetForm();
    pickLocation(locationId);
  };

  const startEdit = (rec) => {
    staffRequest.current += 1; // forget any employee list that is still loading
    setStaffLoading(false);
    setEditing(rec);
    setLocationId(rec.location);
    setStaffList([]);
    setStaffId(rec.staff);
    setAllowances((rec.allowances || []).map((l) => ({ name: l.name, amount: String(l.amount) })));
    setDeductions((rec.deductions || []).map((l) => ({ name: l.name, amount: String(l.amount) })));
    setNote(rec.note || '');
    setLineTab('allowances');
    setMessage(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // The basic salary comes from the employee's profile (read-only here). When editing, it is the
  // amount the salary was created with.
  const staffMember = staffList.find((s) => s._id === staffId);
  const basic = editing ? editing.basicSalary : staffMember ? staffMember.basicSalary : null;
  const totalAllowances = sumRows(allowances);
  const totalDeductions = sumRows(deductions);
  const gross = round2((basic || 0) + totalAllowances);
  const net = round2(gross - totalDeductions);
  // Employees who already have a salary this month cannot be picked again (edit it in the list below).
  const doneIds = new Set((records || []).map((r) => r.staff));

  const submit = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (!editing && !staffId) {
      setMessage({ type: 'err', text: 'Select a location and an employee first' });
      return;
    }
    if (net < 0) {
      setMessage({ type: 'err', text: 'The deductions are more than the gross salary' });
      return;
    }
    setSaving(true);
    try {
      const body = { allowances: cleanRows(allowances), deductions: cleanRows(deductions), note };
      const res = editing
        ? await axios.put(`${STAFF_API}/salaries/${editing._id}`, body)
        : await axios.post(`${STAFF_API}/salaries`, { ...body, staffId, month });
      setMessage({ type: 'ok', text: res.data.message });
      await loadRecords();
      resetForm();
      if (editing) pickLocation(locationId);
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not save the salary') });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (rec) => {
    if (!window.confirm(`Delete the ${monthLabel(month)} salary of ${rec.staffName}?`)) return;
    setMessage(null);
    try {
      const res = await axios.delete(`${STAFF_API}/salaries/${rec._id}`);
      setMessage({ type: 'ok', text: res.data.message });
      if (editing && editing._id === rec._id) cancelEdit();
      await loadRecords();
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not delete the salary') });
    }
  };

  const shown = (records || []).filter((r) => !listLocation || r.location === listLocation);
  const sum = (key) => round2(shown.reduce((total, r) => total + (r[key] || 0), 0));
  const lineSummary = (lines) => (lines || []).map((l) => `${l.name}: ${formatMoney(l.amount)}`).join('\n');

  const emptyListText = records && records.length > 0 ? 'No salaries for this location in this month.' : `No salaries created for ${monthLabel(month)} yet.`;

  return (
    <>
      {message && <div className={`pc-alert ${message.type}`}>{message.text}</div>}

      <div className="pc-panel" ref={formRef}>
        <h3>{editing ? `Edit salary: ${editing.staffName}` : 'Create a salary'} · {monthLabel(month)}</h3>

        <form className="pc-form" onSubmit={submit}>
          {editing ? (
            <div className="wide" style={infoBox}>
              <strong>{editing.staffName}</strong> · {editing.locationName} · NIC {editing.nic || '-'}
            </div>
          ) : (
            <>
              <label className="pc-field">
                Location
                <select required value={locationId} onChange={(e) => pickLocation(e.target.value)}>
                  <option value="">Select location...</option>
                  {locations.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
                </select>
              </label>

              <label className="pc-field">
                Employee
                <select required disabled={!locationId || staffLoading} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                  <option value="">
                    {!locationId ? 'Select a location first' : staffLoading ? 'Loading...' : staffList.length === 0 ? 'No staff in this location' : 'Select employee...'}
                  </option>
                  {staffList.map((s) => (
                    <option key={s._id} value={s._id} disabled={doneIds.has(s._id)}>
                      {s.name} · {s.nic}{doneIds.has(s._id) ? ' (salary already created)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label className="pc-field">
            Basic salary
            <input type="text" readOnly value={basic === null ? '' : formatMoney(basic)} placeholder="Fills in when you pick an employee" />
          </label>
          <p style={{ margin: 0, alignSelf: 'center', fontSize: 13, color: '#4A6288' }}>
            The basic salary comes from the staff profile. To change it, edit the employee in “Staff &amp; Locations”.
          </p>

          <div className="wide">
            <div className="pc-tabs" style={{ marginBottom: 14 }}>
              <button type="button" className={`pc-tab ${lineTab === 'allowances' ? 'active' : ''}`} onClick={() => setLineTab('allowances')}>
                Allowances{allowances.length > 0 ? ` · ${formatMoney(totalAllowances)}` : ''}
              </button>
              <button type="button" className={`pc-tab ${lineTab === 'deductions' ? 'active' : ''}`} onClick={() => setLineTab('deductions')}>
                Deductions{deductions.length > 0 ? ` · ${formatMoney(totalDeductions)}` : ''}
              </button>
            </div>

            {lineTab === 'allowances' ? (
              <LineItems rows={allowances} onChange={setAllowances} suggestions={ALLOWANCE_SUGGESTIONS} listId="staff-allowance-names" nounLabel="Allowance" />
            ) : (
              <LineItems rows={deductions} onChange={setDeductions} suggestions={DEDUCTION_SUGGESTIONS} listId="staff-deduction-names" nounLabel="Deduction" />
            )}
          </div>

          <label className="pc-field wide">
            Note (optional)
            <input type="text" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          <div className="wide" style={infoBox}>
            <SummaryLine label="Basic salary" value={basic === null ? '-' : formatMoney(basic)} />
            <SummaryLine label="+ Allowances" value={formatMoney(totalAllowances)} />
            <SummaryLine label="Gross salary" value={formatMoney(gross)} strong />
            <SummaryLine label="− Deductions" value={formatMoney(totalDeductions)} />
            <SummaryLine label="Net salary" value={formatMoney(net)} strong color={net < 0 ? '#B3382C' : '#2F7D57'} />
            {net < 0 && <p style={{ margin: '8px 0 0', color: '#B3382C' }}>The deductions are more than the gross salary.</p>}
          </div>

          <div className="wide" style={{ display: 'flex', gap: 8 }}>
            <button className="pc-btn" type="submit" disabled={saving || net < 0}>
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Save salary'}
            </button>
            {editing && <button className="pc-btn-sm" type="button" onClick={cancelEdit}>Cancel</button>}
          </div>
        </form>
      </div>

      <div className="pc-toolbar">
        <h2 style={{ fontSize: 18 }}>Salaries for {monthLabel(month)}</h2>
        <label className="pc-field" style={{ minWidth: 200 }}>
          Show location
          <select value={listLocation} onChange={(e) => setListLocation(e.target.value)}>
            <option value="">All locations</option>
            {locations.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
          </select>
        </label>
      </div>

      <div className="pc-table-wrap">
        <table className="pc-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Location</th>
              <th className="num">Basic</th>
              <th className="num">Allowances</th>
              <th className="num">Deductions</th>
              <th className="num">Net salary</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {records === null && (
              <tr><td colSpan={7} className="pc-empty">Loading...</td></tr>
            )}
            {records && shown.length === 0 && (
              <tr><td colSpan={7} className="pc-empty">{emptyListText}</td></tr>
            )}
            {shown.map((r) => (
              <tr key={r._id}>
                <td>
                  {r.staffName}
                  <br />
                  <small style={{ color: '#4A6288' }}>{r.nic}</small>
                </td>
                <td>{r.locationName}</td>
                <td className="num">{formatMoney(r.basicSalary)}</td>
                <td className="num" title={lineSummary(r.allowances)}>{formatMoney(r.totalAllowances)}</td>
                <td className="num" title={lineSummary(r.deductions)}>{formatMoney(r.totalDeductions)}</td>
                <td className="num"><strong>{formatMoney(r.netSalary)}</strong></td>
                <td>
                  <div style={actionsCell}>
                    <button className="pc-btn-sm" type="button" onClick={() => startEdit(r)}>Edit</button>
                    <button className="pc-btn-sm pc-btn-danger" type="button" onClick={() => remove(r)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {shown.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={2}>Total ({shown.length})</td>
                <td className="num">{formatMoney(sum('basicSalary'))}</td>
                <td className="num">{formatMoney(sum('totalAllowances'))}</td>
                <td className="num">{formatMoney(sum('totalDeductions'))}</td>
                <td className="num">{formatMoney(sum('netSalary'))}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}

export default StaffSalary;