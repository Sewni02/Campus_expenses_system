import { useState, useEffect, Fragment } from 'react';
import axios from 'axios';
import useTabState from '../hooks/useTabState';
import { formatMoney, formatDate, monthLabel, currentMonthString } from '../utils/pettyCash';
import { evaluateFormula, parseFormula, FormulaError, VARIABLES } from '../utils/lecturerFormula';
import './PettyCash.css'; // re-uses the same cards / tables / buttons as Petty Cash

const apiError = (err, fallback) => err.response?.data?.message || fallback;

// The 3 parts of every batch. One lecturer can be paid in all three.
const MODES = [
  ['online', 'Online'],
  ['physical', 'Physical'],
  ['recording', 'Recording'],
];
// The language a lecturer teaches in.
const MEDIUM_NAME = { english: 'English', sinhala: 'Sinhala' };
const MEDIUMS = [
  ['english', 'English'],
  ['sinhala', 'Sinhala'],
  ['both', 'Both (English & Sinhala)'],
];
const mediumLabel = (m) => (MEDIUMS.find(([key]) => key === m) || [null, '—'])[1];
// Each part of a batch has both mediums (a lecturer who teaches "both" gets an entry for each).
const ENTRY_MEDIUMS = [
  ['english', 'English'],
  ['sinhala', 'Sinhala'],
];
const entryMediumLabel = (m) => (ENTRY_MEDIUMS.find(([key]) => key === m) || [null, 'Not set'])[1];
// A lecturer has their own rates for each medium they teach (sub fee, percentage, hourly rate, fixed salary).
const blankRate = () => ({ subFee: '', percentage: '', hourRate: '', fixedSalary: '' });
const blankRates = () => ({ english: blankRate(), sinhala: blankRate() });
const mediumsOf = (medium) => (medium === 'both' ? ['english', 'sinhala'] : medium ? [medium] : []);
// One rate of a lecturer for a medium (older lecturers only have the plain fields).
const rateFor = (l, medium, key) => {
  const r = l.rates && medium ? l.rates[medium] : undefined;
  return r && r[key] !== undefined && r[key] !== null ? r[key] : l[key];
};
const ratesText = (l, medium) =>
  [rateFor(l, medium, 'subFee') ? `sub fee ${formatMoney(rateFor(l, medium, 'subFee'))}` : null,
   rateFor(l, medium, 'percentage') ? `${rateFor(l, medium, 'percentage')}%` : null,
   rateFor(l, medium, 'hourRate') ? `${formatMoney(rateFor(l, medium, 'hourRate'))} / hour` : null].filter(Boolean).join(', ');
const modeLabel = (m) => (MODES.find(([key]) => key === m) || [null, '—'])[1];

// The degree tab to show: the one in the URL if it still exists, else the first degree.
const pickCourse = (courses, wanted) => (courses.find((c) => c.name === wanted) || courses[0] || {}).name || '';

// Degree tabs (Management | Art | B.Com ...)
// The Super Admin also gets a "+ Add degree" tab at the end: type a name and a new tab appears.
function CourseTabs({ courses, value, onChange, canAdd = false, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const add = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await axios.post('/api/lecturer-salary/courses', { name });
      setName('');
      setAdding(false);
      if (onChanged) await onChanged();
      onChange(res.data.course.name);
    } catch (err) {
      setError(apiError(err, 'Could not add the degree'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="pc-tabs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        {courses.map((c) => (
          <button key={c._id} className={`pc-tab ${value === c.name ? 'active' : ''}`} onClick={() => onChange(c.name)}>
            {c.name}
          </button>
        ))}
        {canAdd && !adding && (
          <button className="pc-tab pc-tab-add" onClick={() => setAdding(true)}>+ Add degree</button>
        )}
        {canAdd && adding && (
          <form onSubmit={add} className="pc-add-degree">
            <input type="text" required autoFocus maxLength={60} placeholder="e.g. B.Com" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="pc-btn-sm" type="submit" disabled={busy}>Add</button>
            <button className="pc-btn-sm" type="button" onClick={() => { setAdding(false); setName(''); setError(''); }}>Cancel</button>
          </form>
        )}
      </div>
      {error && <div className="pc-alert err">{error}</div>}
    </>
  );
}

const round2 = (n) => Math.round(n * 100) / 100;

// Works a formula out for the live preview (the server always re-calculates when saving).
// Returns { amount } or { error }.
const tryFormula = (expression, values) => {
  try {
    return { amount: evaluateFormula(expression, values) };
  } catch (err) {
    if (err instanceof FormulaError) return { error: err.message };
    throw err;
  }
};

// The names a formula uses (empty list if the formula has a typo).
const formulaVariables = (expression) => {
  try {
    return parseFormula(expression).variables;
  } catch {
    return [];
  }
};

// Range formulas: the first range that contains the number (e.g. 10 belongs to 1-10). An empty "to" = and above.
const findTier = (tiers, n) => (tiers || []).find((t) => n >= t.from && (t.to === null || t.to === undefined || n <= t.to));
const tierLabel = (t) => (t.to === null || t.to === undefined ? `${t.from}+` : `${t.from}-${t.to}`);
// How a range pays: 'total' (the amount as it is) | 'unit' (amount x attendance/hours) | 'rate' (attendance/hours x (sub fee x percentage%)).
// Older formulas only had one total/unit switch for all ranges.
const tierPay = (formula, t) => t.payBy || (t.perUnit === true || formula.rangeBasis === 'perAttendance' ? 'unit' : 'total');
const hasPct = (t) => t.percentage !== null && t.percentage !== undefined && t.percentage !== '';

// The inputs a formula needs (a range formula needs the attendance, or the hours, and the percentage for "sub fee x percentage" ranges).
const formulaUses = (formula) => {
  if (!formula) return [];
  if (formula.kind === 'range') {
    const uses = [formula.rangeBy === 'hours' ? 'hours' : 'attendance'];
    if ((formula.tiers || []).some((t) => tierPay(formula, t) === 'rate' && !hasPct(t))) uses.push('percentage');
    return uses;
  }
  return formulaVariables(formula.expression);
};

// Dropdown options for choosing a formula. "emptyLabel" = the choice that means "none picked".
// "degree" hides the formulas that were made for a different degree (e.g. Art ranges for a Management batch).
function FormulaOptions({ formulas, emptyLabel, degree }) {
  return (
    <>
      <option value="">{emptyLabel}</option>
      {formulas
        .filter((f) => !f.isDefault && (!f.degree || !degree || f.degree.toLowerCase() === degree.toLowerCase()))
        .map((f) => <option key={f._id} value={f._id}>{f.name}{f.kind === 'range' ? ' (ranges)' : ''}</option>)}
    </>
  );
}

const SRI_LANKAN_BANKS = [
  'Bank of Ceylon',
  "People's Bank",
  'Commercial Bank of Ceylon',
  'Hatton National Bank',
  'Sampath Bank',
  'Seylan Bank',
  'National Savings Bank',
  'Nations Trust Bank',
  'DFCC Bank',
  'Pan Asia Banking Corporation',
  'Union Bank of Colombo',
  'NDB Bank',
  'Amana Bank',
  'Cargills Bank',
  'HSBC',
  'Standard Chartered Bank',
];

// Dropdown of common banks with an "Other..." option that turns into a text box.
function BankSelect({ value, onChange }) {
  const known = value === '' || SRI_LANKAN_BANKS.includes(value);
  const [other, setOther] = useState(!known);

  useEffect(() => {
    setOther(!(value === '' || SRI_LANKAN_BANKS.includes(value)));
  }, [value]);

  if (other) {
    return <input type="text" placeholder="Bank name" maxLength={100} value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value === '__other__') { setOther(true); onChange(''); } else { onChange(e.target.value); }
      }}
    >
      <option value="">Select bank...</option>
      {SRI_LANKAN_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
      <option value="__other__">Other...</option>
    </select>
  );
}

// Status of one salary record.
//   draft -> awaiting verification -> verified -> paid
const STATUS_INFO = {
  none: { label: 'Not calculated', style: { background: '#EEF2F8', color: '#7C8FAD', borderColor: '#D3DCEB' } },
  pending: { label: 'Draft', cls: 'low' },
  submitted: { label: 'Awaiting verification', style: { background: 'rgba(30,86,194,.10)', color: '#1E56C2', borderColor: 'rgba(30,86,194,.3)' } },
  verified: { label: 'Verified', style: { background: 'rgba(15,122,111,.12)', color: '#0F7A6F', borderColor: 'rgba(15,122,111,.3)' } },
  paid: { label: 'Paid', cls: 'ok' },
};
function StatusBadge({ status }) {
  const info = STATUS_INFO[status] || STATUS_INFO.none;
  return <span className={`pc-badge ${info.cls || ''}`} style={info.style}>{info.label}</span>;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Month + Year as two dropdowns. value / onChange use "YYYY-MM".
function MonthYearPicker({ value, onChange, disabled = false }) {
  const [year, month] = value.split('-');
  const thisYear = new Date().getFullYear();
  const years = [];
  for (let y = thisYear - 5; y <= thisYear + 1; y++) years.push(String(y));
  if (!years.includes(year)) years.push(year);

  return (
    <>
      <label className="pc-field">
        Month
        <select value={month} disabled={disabled} onChange={(e) => onChange(`${year}-${e.target.value}`)}>
          {MONTH_NAMES.map((name, i) => {
            const mm = String(i + 1).padStart(2, '0');
            return <option key={mm} value={mm}>{name}</option>;
          })}
        </select>
      </label>
      <label className="pc-field">
        Year
        <select value={year} disabled={disabled} onChange={(e) => onChange(`${e.target.value}-${month}`)}>
          {years.sort().map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
    </>
  );
}

// How a salary entry names its batch (older entries may have no degree / batch saved).
const entryBatchText = (i) => (i.faculty ? `${i.faculty} — ${i.batchYear} Batch` : 'Older entry (no batch saved)');
const batchLabel = (b) => `${b.faculty} — ${b.year} Batch`;
const payTypeLabel = (t) => (t === 'fixed' ? 'Fixed salary' : 'Formula');

// ---------------------------------------------------------------------------
// Lecturer Salary
//   isAdmin = true   -> super admin sidebar tab (can also create batches, set the
//                       deduction, verify, pay)
//   isAdmin = false  -> accountant (permission "Manage Lecturer Salary"): adds
//                       lecturers + bank details, enters salaries, submits them
//
//   Tab "Salaries"             -> the salary FORM (pick batch, month, year, lecturer) + that month's entries
//   Tab "Batches & Lecturers"  -> degrees (super admin adds them) -> batches -> lecturers (pay type, bank details)
//   Tab "Formulas" (super admin) -> write your own salary formulas
// The selected tab ("ls"), faculty ("lf") and opened batch ("lb") live in the URL, so a
// refresh or the browser back button keeps you where you were.
// ---------------------------------------------------------------------------
function LecturerSalary({ isAdmin = true }) {
  const [section, setSection] = useTabState('ls', 'salaries');
  const [formulas, setFormulas] = useState([]);
  const [courses, setCourses] = useState(null); // the degrees

  const loadFormulas = () =>
    axios.get('/api/lecturer-salary/formulas').then((res) => setFormulas(res.data)).catch(() => {});
  useEffect(() => { loadFormulas(); }, []);

  const loadCourses = () =>
    axios.get('/api/lecturer-salary/courses').then((res) => setCourses(res.data)).catch(() => setCourses([]));
  useEffect(() => { loadCourses(); }, []);

  return (
    <div className="sa-page pc-page">
      <div className="pc-toolbar">
        <h1 className="sa-page-title" style={{ margin: 0 }}>Lecturer Salary</h1>
      </div>
      <div className="pc-tabs">
        {[['salaries', 'Salaries'], ['payments', 'Payments'], ['batches', 'Batches & Lecturers'], ...(isAdmin ? [['formulas', 'Formulas']] : [])].map(([key, label]) => (
          <button key={key} className={`pc-tab ${section === key ? 'active' : ''}`} onClick={() => setSection(key)}>
            {label}
          </button>
        ))}
      </div>

      {section === 'salaries' && <SalariesSection isAdmin={isAdmin} formulas={formulas} courses={courses} onCoursesChanged={loadCourses} />}
      {section === 'payments' && <PaymentsSection isAdmin={isAdmin} courses={courses || []} />}
      {section === 'batches' && <BatchesSection isAdmin={isAdmin} formulas={formulas} courses={courses} onCoursesChanged={loadCourses} onFormulasChanged={loadFormulas} />}
      {section === 'formulas' && isAdmin && <FormulasSection formulas={formulas} courses={courses || []} onChanged={loadFormulas} />}
    </div>
  );
}

// ---------- Batches & lecturers ----------
function BatchesSection({ isAdmin, formulas, courses, onCoursesChanged, onFormulasChanged }) {
  const [faculty, setFaculty] = useTabState('lf', '');
  const [batchId, setBatchId] = useTabState('lb', '');

  if (batchId) return <BatchDetail batchId={batchId} isAdmin={isAdmin} formulas={formulas} onFormulasChanged={onFormulasChanged} onBack={() => setBatchId('')} />;
  if (courses === null) return <p>Loading…</p>;
  const active = pickCourse(courses, faculty);

  return (
    <>
      <CourseTabs courses={courses} value={active} onChange={setFaculty} canAdd={isAdmin} onChanged={onCoursesChanged} />
      {courses.length === 0 ? (
        <p className="pc-empty">
          {isAdmin ? 'No degrees yet — click “+ Add degree” above (for example Management, Art, B.Com), then add its batches.' : 'No degrees yet. The Super Admin needs to add a degree first.'}
        </p>
      ) : (
        <>
          {isAdmin && <CoursesPanel courses={courses} active={active} onSelect={setFaculty} onChanged={onCoursesChanged} />}
          <BatchList faculty={active} isAdmin={isAdmin} formulas={formulas} onOpen={setBatchId} />
        </>
      )}
    </>
  );
}

// Super admin: add / rename / delete degrees (Management, Art, B.Com ...).
function CoursesPanel({ courses, active, onSelect, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const current = courses.find((c) => c.name === active);

  const run = async (fn) => {
    setMessage(null);
    setBusy(true);
    try {
      const res = await fn();
      setMessage({ type: 'ok', text: res.data.message });
      onChanged();
      return res;
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not update the course') });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const rename = async () => {
    const next = window.prompt(`New name for "${current.name}"?`, current.name);
    if (next === null || !next.trim() || next.trim() === current.name) return;
    const res = await run(() => axios.put(`/api/lecturer-salary/courses/${current._id}`, { name: next.trim() }));
    if (res) onSelect(res.data.course.name);
  };

  const remove = async () => {
    if (!window.confirm(`Delete the degree "${current.name}"? This only works if it has no batches.`)) return;
    await run(() => axios.delete(`/api/lecturer-salary/courses/${current._id}`));
  };

  return (
    <div style={{ marginBottom: 14 }}>
      {message && <div className={`pc-alert ${message.type}`}>{message.text}</div>}
      {current && (
        <div>
          <small style={{ color: '#4A6288' }}>Selected degree: <strong>{current.name}</strong> ({current.batchCount} batch{current.batchCount === 1 ? '' : 'es'}) </small>{' '}
          <button className="pc-btn-sm" disabled={busy} onClick={rename}>Rename</button>{' '}
          <button className="pc-btn-sm pc-btn-danger" disabled={busy || current.batchCount > 0} title={current.batchCount > 0 ? 'Delete its batches first' : ''} onClick={remove}>Delete</button>
        </div>
      )}
    </div>
  );
}

// ---------- Batches of one faculty ----------
// readOnly = just pick a batch (no add / delete) - used by the Salaries tab.
function BatchList({ faculty, isAdmin, formulas = [], onOpen, readOnly = false }) {
  const canManage = isAdmin && !readOnly;
  const [batches, setBatches] = useState(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [formulaId, setFormulaId] = useState('');
  const defaultFormula = formulas.find((f) => f.isDefault);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setBatches(null);
    axios
      .get('/api/lecturer-salary/batches', { params: { faculty } })
      .then((res) => { if (!cancelled) setBatches(res.data); })
      .catch((err) => { if (!cancelled) { setBatches([]); setMessage({ type: 'err', text: apiError(err, 'Could not load batches') }); } });
    return () => { cancelled = true; };
  }, [faculty, refreshKey]);

  const addBatch = async (e) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const res = await axios.post('/api/lecturer-salary/batches', { faculty, year, formulaId });
      setMessage({ type: 'ok', text: res.data.message });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not add the batch') });
    } finally {
      setSaving(false);
    }
  };

  const removeBatch = async (batch) => {
    if (!window.confirm(`Delete the ${batch.year} batch? This only works if it has no salary records.`)) return;
    setMessage(null);
    try {
      await axios.delete(`/api/lecturer-salary/batches/${batch._id}`);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not delete the batch') });
    }
  };

  return (
    <>
      {message && <div className={`pc-alert ${message.type}`}>{message.text}</div>}

      {canManage && (
        <div className="pc-panel">
          <h3>Add a new {faculty} batch</h3>
          <form className="pc-form" onSubmit={addBatch}>
            <label className="pc-field">
              Batch year
              <input type="number" required min="2000" max="2100" step="1" value={year} onChange={(e) => setYear(e.target.value)} />
            </label>
            <label className="pc-field">
              Salary formula
              <select value={formulaId} onChange={(e) => setFormulaId(e.target.value)}>
                <FormulaOptions formulas={formulas} degree={faculty} emptyLabel={`${defaultFormula?.name || 'Standard'} (default)`} />
              </select>
            </label>
            <div>
              <button className="pc-btn" type="submit" disabled={saving}>{saving ? 'Adding…' : '+ Add Batch'}</button>
            </div>
          </form>
        </div>
      )}

      <h3>{faculty} batches</h3>
      {batches === null && <p>Loading…</p>}
      {batches && batches.length === 0 && (
        <p className="pc-empty">
          {canManage
            ? 'No batches yet — add the first one above.'
            : isAdmin
              ? 'No batches yet. Create one in the “Batches & Lecturers” tab first.'
              : 'No batches yet. The Super Admin needs to create the batch first.'}
        </p>
      )}
      {batches && batches.length > 0 && (
        <div className="pc-cards">
          {batches.map((b) => (
            <div
              key={b._id}
              className="pc-card"
              role="button"
              tabIndex={0}
              style={{ cursor: 'pointer' }}
              onClick={() => onOpen(b._id)}
              onKeyDown={(e) => e.key === 'Enter' && onOpen(b._id)}
            >
              <p>{faculty}</p>
              <h2>{b.year} Batch</h2>
              <small>{b.lecturerCount} lecturer(s) · {b.formulaName || defaultFormula?.name || 'Standard'}</small>
              {b.legacyDeduction > 0 && <><br /><small style={{ color: '#B7791F' }}>Old −{b.legacyDeduction}% deduction no longer used — choose a formula</small></>}
              <div style={{ marginTop: 12 }}>
                <button className="pc-btn-sm" onClick={(e) => { e.stopPropagation(); onOpen(b._id); }}>Open</button>{' '}
                {canManage && (
                  <button className="pc-btn-sm pc-btn-danger" onClick={(e) => { e.stopPropagation(); removeBatch(b); }}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ---------- One batch: its formula setting + its lecturers ----------
function BatchDetail({ batchId, isAdmin, formulas, onFormulasChanged, onBack }) {
  const [batch, setBatch] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`/api/lecturer-salary/batches/${batchId}`)
      .then((res) => { if (!cancelled) setBatch(res.data); })
      .catch((err) => { if (!cancelled) setError(apiError(err, 'Could not load this batch')); });
    return () => { cancelled = true; };
  }, [batchId]);

  if (error) {
    return (
      <>
        <div className="pc-alert err">{error}</div>
        <button className="pc-btn-sm" onClick={onBack}>← Back to batches</button>
      </>
    );
  }
  if (!batch) return <p>Loading…</p>;

  return (
    <>
      <div className="pc-toolbar">
        <h2 style={{ margin: 0 }}>{batchLabel(batch)}</h2>
        <button className="pc-btn-sm" onClick={onBack}>← Back to batches</button>
      </div>
      <BatchFormula batch={batch} isAdmin={isAdmin} formulas={formulas} onBatchChange={setBatch} />
      <LecturersPanel batch={batch} isAdmin={isAdmin} formulas={formulas} onFormulasChanged={onFormulasChanged} onBatchChange={setBatch} />
    </>
  );
}

// ---------- The formula the batch uses (only the super admin can change it) ----------
function BatchFormula({ batch, isAdmin, formulas, onBatchChange }) {
  const defaultFormula = formulas.find((f) => f.isDefault);
  const nameOf = (id) => (formulas.find((f) => f._id === id) || defaultFormula || {}).name || '…';
  const current = formulas.find((f) => f._id === batch.formula) || defaultFormula;
  const [value, setValue] = useState(batch.formula || '');
  const [english, setEnglish] = useState((batch.mediumFormulas && batch.mediumFormulas.english) || '');
  const [sinhala, setSinhala] = useState((batch.mediumFormulas && batch.mediumFormulas.sinhala) || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const savedEnglish = (batch.mediumFormulas && batch.mediumFormulas.english) || '';
  const savedSinhala = (batch.mediumFormulas && batch.mediumFormulas.sinhala) || '';
  const changed = value !== (batch.formula || '') || english !== savedEnglish || sinhala !== savedSinhala;

  const save = async () => {
    setMessage(null);
    setSaving(true);
    try {
      const res = await axios.patch(`/api/lecturer-salary/batches/${batch._id}/settings`, { formulaId: value, mediumFormulas: { english, sinhala } });
      onBatchChange(res.data.batch);
      setMessage({ type: 'ok', text: 'Formulas updated. Drafts use them the next time you press Update.' });
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not update the formulas') });
    } finally {
      setSaving(false);
    }
  };

  const legacy = !batch.formula && (batch.deductionPercent || 0) > 0;

  return (
    <>
      {message && <div className={`pc-alert ${message.type}`}>{message.text}</div>}
      <div className="pc-panel" style={{ padding: '14px 20px' }}>
        <div className="pc-toolbar" style={{ margin: 0, alignItems: 'flex-start' }}>
          <div>
            <strong>Salary formula:</strong> {current ? current.name : '…'}
            {current && <><br /><code style={{ fontSize: 13 }}>{current.expression}</code></>}
            <br />
            <small style={{ color: '#4A6288' }}>
              English medium: <strong>{nameOf(savedEnglish || batch.formula)}</strong> · Sinhala medium: <strong>{nameOf(savedSinhala || batch.formula)}</strong>
            </small>
            {legacy && (
              <><br /><small style={{ color: '#B7791F' }}>
                This batch had an old −{batch.deductionPercent}% deduction setting. It is no longer used — add a formula for it
                (Formulas tab) and choose it here.
              </small></>
            )}
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label className="pc-field">
                Formula (all mediums)
                <select value={value} onChange={(e) => setValue(e.target.value)}>
                  <FormulaOptions formulas={formulas} degree={batch.faculty} emptyLabel={`${defaultFormula?.name || 'Standard'} (default)`} />
                </select>
              </label>
              <label className="pc-field">
                English medium
                <select value={english} onChange={(e) => setEnglish(e.target.value)}>
                  <FormulaOptions formulas={formulas} degree={batch.faculty} emptyLabel="Same as above" />
                </select>
              </label>
              <label className="pc-field">
                Sinhala medium
                <select value={sinhala} onChange={(e) => setSinhala(e.target.value)}>
                  <FormulaOptions formulas={formulas} degree={batch.faculty} emptyLabel="Same as above" />
                </select>
              </label>
              <button className="pc-btn-sm" disabled={saving || !changed} onClick={save}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#4A6288' }}>
          English and Sinhala can use different formulas (the sub fee changes with the medium). When a salary is entered, the formula can also be picked on the salary form.
        </p>
      </div>
    </>
  );
}

// ---------- Lecturers of the batch (add / edit / remove, pay type, bank details) ----------
const emptyForm = {
  name: '', phone: '', subject: '', medium: '', modes: [], payType: 'formula', rates: blankRates(), formulaId: '',
  bankName: '', bankBranch: '', accountNumber: '', accountHolder: '',
};

function LecturersPanel({ batch, isAdmin, formulas = [], onFormulasChanged, onBatchChange }) {
  const [form, setForm] = useState(emptyForm);
  const [newFormula, setNewFormula] = useState(null); // { name, expression } while creating one
  const [creatingFormula, setCreatingFormula] = useState(false);
  const [people, setPeople] = useState([]); // lecturers already added in any batch
  const [editingId, setEditingId] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const fixed = form.payType === 'fixed';
  // The formula this lecturer will be paid by decides which rates are needed.
  const effFormula = formulas.find((f) => f._id === (form.formulaId || batch.formula)) || formulas.find((f) => f.isDefault);
  // The mediums this lecturer teaches, and the formula that pays each of them (the batch can use a different formula for English and Sinhala).
  const taught = mediumsOf(form.medium);
  const mediumFormula = (m) =>
    form.formulaId
      ? effFormula
      : formulas.find((x) => x._id === ((batch.mediumFormulas && batch.mediumFormulas[m]) || batch.formula)) || formulas.find((x) => x.isDefault);

  const setField = (key) => (e) => {
    let value = e.target.value;
    if (key === 'phone') value = value.replace(/\D/g, '').slice(0, 10);
    if (key === 'accountNumber') value = value.replace(/\D/g, '').slice(0, 20);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const reset = () => { setForm({ ...emptyForm, modes: [], rates: blankRates() }); setEditingId(''); };
  const setRate = (medium, key) => (e) => { const value = e.target.value; setForm((f) => ({ ...f, rates: { ...f.rates, [medium]: { ...f.rates[medium], [key]: value } } })); };
  const toggleMode = (key) => setForm((f) => ({ ...f, modes: f.modes.includes(key) ? f.modes.filter((m) => m !== key) : [...f.modes, key] }));

  // A formula made just for this lecturer: create it, then select it for them.
  const createLecturerFormula = async () => {
    setMessage(null);
    setCreatingFormula(true);
    try {
      const res = await axios.post('/api/lecturer-salary/formulas', { name: newFormula.name, expression: newFormula.expression });
      if (onFormulasChanged) await onFormulasChanged();
      setForm((f) => ({ ...f, formulaId: res.data.formula._id }));
      setNewFormula(null);
      setMessage({ type: 'ok', text: `Formula “${res.data.formula.name}” created and selected for this lecturer` });
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not create the formula') });
    } finally {
      setCreatingFormula(false);
    }
  };

  useEffect(() => {
    axios.get('/api/lecturer-salary/people').then((res) => setPeople(res.data)).catch(() => {});
  }, [batch]);

  // The same person teaching in another batch: picking their name fills in their details, so they are
  // recognised as ONE lecturer and can be paid in one payment.
  const nameChanged = (e) => {
    const value = e.target.value;
    const match = !editingId && people.find((p) => p.name.toLowerCase() === value.trim().toLowerCase());
    setForm((f) => ({
      ...f,
      name: value,
      ...(match
        ? {
            phone: f.phone || match.phone || '',
            subject: f.subject || match.subject || '',
            medium: f.medium || match.medium || '',
            modes: f.modes.length ? f.modes : match.modes || [],
            rates: f.rates.english.subFee || f.rates.sinhala.subFee || f.rates.english.fixedSalary || f.rates.sinhala.fixedSalary
              ? f.rates
              : {
                  english: { ...blankRate(), ...Object.fromEntries(['subFee', 'percentage', 'hourRate', 'fixedSalary'].map((k) => [k, rateFor(match, 'english', k) ? String(rateFor(match, 'english', k)) : ''])) },
                  sinhala: { ...blankRate(), ...Object.fromEntries(['subFee', 'percentage', 'hourRate', 'fixedSalary'].map((k) => [k, rateFor(match, 'sinhala', k) ? String(rateFor(match, 'sinhala', k)) : ''])) },
                },
            bankName: f.bankName || match.bankName || '',
            bankBranch: f.bankBranch || match.bankBranch || '',
            accountNumber: f.accountNumber || match.accountNumber || '',
            accountHolder: f.accountHolder || match.accountHolder || '',
          }
        : {}),
    }));
  };


  const submit = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (form.modes.length === 0) {
      setMessage({ type: 'err', text: 'Tick at least one part the lecturer teaches: Online, Physical or Recording' });
      return;
    }
    setSaving(true);
    try {
      const url = `/api/lecturer-salary/batches/${batch._id}/lecturers`;
      const res = editingId ? await axios.put(`${url}/${editingId}`, form) : await axios.post(url, form);
      onBatchChange(res.data.batch);
      setMessage({ type: 'ok', text: res.data.message });
      reset();
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not save the lecturer') });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (l) => {
    setEditingId(l._id);
    setForm({
      name: l.name, phone: l.phone || '', subject: l.subject, medium: l.medium || '', modes: l.modes || [], payType: l.payType || 'formula',
      rates: {
        english: { ...blankRate(), ...Object.fromEntries(['subFee', 'percentage', 'hourRate', 'fixedSalary'].map((k) => [k, rateFor(l, 'english', k) ? String(rateFor(l, 'english', k)) : ''])) },
        sinhala: { ...blankRate(), ...Object.fromEntries(['subFee', 'percentage', 'hourRate', 'fixedSalary'].map((k) => [k, rateFor(l, 'sinhala', k) ? String(rateFor(l, 'sinhala', k)) : ''])) },
      },
      formulaId: l.formula || '',
      bankName: l.bankName || '', bankBranch: l.bankBranch || '', accountNumber: l.accountNumber || '', accountHolder: l.accountHolder || '',
    });
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (l) => {
    if (!window.confirm(`Remove ${l.name} from this batch?`)) return;
    setMessage(null);
    try {
      const res = await axios.delete(`/api/lecturer-salary/batches/${batch._id}/lecturers/${l._id}`);
      onBatchChange(res.data.batch);
      if (editingId === l._id) reset();
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not remove the lecturer') });
    }
  };

  return (
    <>
      {message && <div className={`pc-alert ${message.type}`}>{message.text}</div>}

      <div className="pc-panel">
        <h3>{editingId ? 'Edit lecturer / bank details' : `Add a lecturer to the ${batch.year} batch`}</h3>
        <form className="pc-form" onSubmit={submit}>
          <label className="pc-field">
            Lecturer name
            <input type="text" required maxLength={100} list="lecturer-people" value={form.name} onChange={nameChanged} />
            <datalist id="lecturer-people">
              {people.map((p) => <option key={p.key} value={p.name}>{p.subject}{p.phone ? ` · ${p.phone}` : ''}</option>)}
            </datalist>
          </label>
          <label className="pc-field">
            Phone (optional)
            <input type="text" inputMode="numeric" value={form.phone} onChange={setField('phone')} />
          </label>
          <label className="pc-field">
            Subject
            <input type="text" required maxLength={100} value={form.subject} onChange={setField('subject')} />
          </label>
          <label className="pc-field">
            Medium
            <select required value={form.medium} onChange={setField('medium')}>
              <option value="">Select...</option>
              {MEDIUMS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <div className="pc-field">
            Teaches (tick all that apply)
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', minHeight: 40, textTransform: 'none', letterSpacing: 0, fontWeight: 500, fontSize: 14, color: '#0A1F44' }}>
              {MODES.map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" style={{ width: 16, height: 16, padding: 0 }} checked={form.modes.includes(key)} onChange={() => toggleMode(key)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <label className="pc-field">
            How is this lecturer paid?
            <select value={form.payType} onChange={setField('payType')}>
              <option value="formula">By formula</option>
              <option value="fixed">Fixed salary (outside the formula)</option>
            </select>
          </label>

          {fixed ? (
            <>
              {taught.length === 0 && <p className="wide" style={{ margin: 0, fontSize: 13, color: '#4A6288' }}>Choose the medium above, then enter the fixed salary for each medium.</p>}
              {taught.map((m) => (
                <label key={m} className="pc-field">
                  Fixed salary — {MEDIUM_NAME[m]} medium (Rs.)
                  <input type="number" required min="0.01" step="0.01" value={form.rates[m].fixedSalary} onChange={setRate(m, 'fixedSalary')} />
                </label>
              ))}
            </>
          ) : (
            <>
              <label className="pc-field">
                Formula for this lecturer (optional)
                <select value={form.formulaId} onChange={setField('formulaId')}>
                  <FormulaOptions formulas={formulas} degree={batch.faculty} emptyLabel="Same as the batch formula" />
                </select>
                {isAdmin && (
                  <button type="button" className="pc-btn-sm" style={{ marginTop: 6, alignSelf: 'flex-start' }} onClick={() => setNewFormula((f) => (f ? null : { name: '', expression: '' }))}>
                    {newFormula ? 'Cancel new formula' : '+ New formula for this lecturer'}
                  </button>
                )}
              </label>
              {newFormula && (
                <div className="wide pc-panel" style={{ margin: 0 }}>
                  <div className="pc-form">
                    <label className="pc-field">
                      Formula name
                      <input type="text" maxLength={60} placeholder="e.g. Nalin special" value={newFormula.name} onChange={(e) => setNewFormula((f) => ({ ...f, name: e.target.value }))} />
                    </label>
                    <label className="pc-field" style={{ flex: 2 }}>
                      Formula
                      <input type="text" maxLength={300} placeholder="attendance * subFee * percentage% - 5%" value={newFormula.expression} onChange={(e) => setNewFormula((f) => ({ ...f, expression: e.target.value }))} />
                    </label>
                    <div style={{ alignSelf: 'flex-end' }}>
                      <button type="button" className="pc-btn-sm" disabled={creatingFormula} onClick={createLecturerFormula}>
                        {creatingFormula ? 'Saving…' : 'Create & use'}
                      </button>
                    </div>
                  </div>
                  <small style={{ color: '#4A6288' }}>You can use attendance, subFee, percentage, hours, hourRate, numbers, + - * / ( ) and %. This formula is then used only for this lecturer. For attendance ranges, use the Formulas tab.</small>
                </div>
              )}
              {taught.length === 0 && <p className="wide" style={{ margin: 0, fontSize: 13, color: '#4A6288' }}>Choose the medium above, then enter the rates for each medium.</p>}
              {taught.map((m) => {
                const mf = mediumFormula(m);
                const u = formulaUses(mf);
                return (
                  <div key={m} className="wide pc-panel" style={{ margin: 0, padding: '12px 16px' }}>
                    <strong>{MEDIUM_NAME[m]} medium rates</strong>
                    <small style={{ color: '#4A6288' }}> — paid by “{mf ? mf.name : 'Standard'}”</small>
                    <div className="pc-form" style={{ marginTop: 8 }}>
                      {u.includes('subFee') && (
                        <label className="pc-field">
                          Sub fee (Rs.)
                          <input type="number" required min="0.01" step="0.01" value={form.rates[m].subFee} onChange={setRate(m, 'subFee')} />
                        </label>
                      )}
                      {u.includes('percentage') && (
                        <label className="pc-field">
                          Percentage (%)
                          <input type="number" required={!(mf && mf.kind === 'range')} min="0.01" max="100" step="0.01" value={form.rates[m].percentage} onChange={setRate(m, 'percentage')} />
                        </label>
                      )}
                      {u.includes('hourRate') && (
                        <label className="pc-field">
                          Hourly rate (Rs. per hour)
                          <input type="number" required min="0.01" step="0.01" value={form.rates[m].hourRate} onChange={setRate(m, 'hourRate')} />
                        </label>
                      )}
                      {mf && mf.kind === 'range' && (
                        <p className="wide" style={{ margin: 0, fontSize: 13, color: '#4A6288' }}>
                          Pays by ranges ({mf.expression}){u.includes('percentage') ? ' — the percentage is needed.' : ' — no sub fee or percentage is needed.'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          <p className="wide" style={{ margin: '6px 0 0', fontWeight: 600, color: '#4A6288' }}>
            Bank details (optional — can be added or changed later)
          </p>
          <label className="pc-field">
            Bank
            <BankSelect value={form.bankName} onChange={(v) => setForm((f) => ({ ...f, bankName: v }))} />
          </label>
          <label className="pc-field">
            Branch
            <input type="text" maxLength={100} value={form.bankBranch} onChange={setField('bankBranch')} />
          </label>
          <label className="pc-field">
            Account number
            <input type="text" inputMode="numeric" minLength={5} value={form.accountNumber} onChange={setField('accountNumber')} />
          </label>
          <label className="pc-field">
            Account holder name
            <input type="text" maxLength={100} value={form.accountHolder} onChange={setField('accountHolder')} />
          </label>

          <div className="wide">
            <button className="pc-btn" type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update lecturer' : 'Add lecturer'}
            </button>
            {editingId && (
              <button type="button" className="pc-btn-sm" style={{ marginLeft: 10 }} onClick={reset}>Cancel</button>
            )}
          </div>
        </form>
      </div>

      <h3>Lecturers ({batch.lecturers.length})</h3>
      <div className="pc-table-wrap">
        <table className="pc-table">
          <thead>
            <tr><th>Name</th><th>Subject</th><th>Medium</th><th>Teaches</th><th>Pay</th><th>Bank details</th><th></th></tr>
          </thead>
          <tbody>
            {batch.lecturers.length === 0 && <tr><td colSpan="7" className="pc-empty">No lecturers in this batch yet</td></tr>}
            {batch.lecturers.map((l) => (
              <tr key={l._id}>
                <td>{l.name}{l.phone && <><br /><small>{l.phone}</small></>}</td>
                <td>{l.subject}</td>
                <td>{mediumLabel(l.medium)}</td>
                <td>{l.modes && l.modes.length ? l.modes.map(modeLabel).join(', ') : <span style={{ color: '#8FA3C0' }}>Not set</span>}</td>
                <td>
                  {l.payType === 'fixed' ? 'Fixed' : <>Formula · {l.formula && formulas.find((f) => f._id === l.formula) ? formulas.find((f) => f._id === l.formula).name : 'batch formula'}</>}
                  {(mediumsOf(l.medium).length ? mediumsOf(l.medium) : [null]).map((m) => (
                    <div key={m || 'plain'}>
                      <small>
                        {m && mediumsOf(l.medium).length > 1 ? `${MEDIUM_NAME[m]}: ` : ''}
                        {l.payType === 'fixed' ? formatMoney(rateFor(l, m, 'fixedSalary')) : ratesText(l, m) || 'no rates needed'}
                      </small>
                    </div>
                  ))}
                </td>
                <td>
                  {l.accountNumber ? (
                    <>
                      {l.bankName} · {l.accountNumber}
                      {(l.bankBranch || l.accountHolder) && <><br /><small>{[l.bankBranch, l.accountHolder].filter(Boolean).join(' · ')}</small></>}
                      {l.bankUpdatedByName && <><br /><small>Updated by {l.bankUpdatedByName}, {formatDate(l.bankUpdatedAt)}</small></>}
                    </>
                  ) : (
                    <small style={{ color: '#B7791F' }}>Not added</small>
                  )}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="pc-btn-sm" onClick={() => startEdit(l)}>Edit</button>{' '}
                  <button className="pc-btn-sm pc-btn-danger" onClick={() => remove(l)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------- Salaries: Management | Art -> batch cards -> the batch's salary page ----------
function SalariesSection({ isAdmin, formulas, courses, onCoursesChanged }) {
  const [faculty, setFaculty] = useTabState('sf', '');
  const [batchId, setBatchId] = useTabState('sb', '');

  if (batchId) return <BatchSalaries batchId={batchId} isAdmin={isAdmin} formulas={formulas} onBack={() => setBatchId('')} />;
  if (courses === null) return <p>Loading…</p>;
  const active = pickCourse(courses, faculty);
  if (courses.length === 0) {
    return (
      <>
        <CourseTabs courses={courses} value="" onChange={setFaculty} canAdd={isAdmin} onChanged={onCoursesChanged} />
        <p className="pc-empty">{isAdmin ? 'No degrees yet — click “+ Add degree” above.' : 'No degrees yet. The Super Admin needs to add a degree first.'}</p>
      </>
    );
  }

  return (
    <>
      <p style={{ margin: '0 0 14px', color: '#4A6288', fontSize: 13 }}>Choose a batch to enter its salaries.</p>
      <CourseTabs courses={courses} value={active} onChange={setFaculty} canAdd={isAdmin} onChanged={onCoursesChanged} />
      <BatchList faculty={active} isAdmin={isAdmin} formulas={formulas} readOnly onOpen={setBatchId} />
    </>
  );
}

// The salary page of ONE batch: the form on top, that month's entries + amounts below.
function BatchSalaries({ batchId, isAdmin, formulas, onBack }) {
  const [batch, setBatch] = useState(null);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(currentMonthString());
  const [mode, setMode] = useTabState('sm', 'online'); // the 3 parts of a batch
  const [medium, setMedium] = useTabState('sd', 'english'); // English / Sinhala (both exist in every part)
  const [editing, setEditing] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`/api/lecturer-salary/batches/${batchId}`)
      .then((res) => { if (!cancelled) setBatch(res.data); })
      .catch((err) => { if (!cancelled) setError(apiError(err, 'Could not load this batch')); });
    return () => { cancelled = true; };
  }, [batchId]);

  if (error) {
    return (
      <>
        <div className="pc-alert err">{error}</div>
        <button className="pc-btn-sm" onClick={onBack}>← Back to batches</button>
      </>
    );
  }
  if (!batch) return <p>Loading…</p>;

  const saved = ({ month: savedMonth }) => {
    setEditing(null);
    setMonth(savedMonth);
    setRefreshKey((k) => k + 1);
  };

  return (
    <>
      <div className="pc-toolbar">
        <h2 style={{ margin: 0 }}>{batchLabel(batch)} — Salaries</h2>
        <button className="pc-btn-sm" onClick={onBack}>← Back to batches</button>
      </div>

      <div className="pc-tabs">
        {MODES.map(([key, label]) => (
          <button key={key} className={`pc-tab ${mode === key ? 'active' : ''}`} onClick={() => { setMode(key); setEditing(null); }}>
            {label}
          </button>
        ))}
        <button className={`pc-tab ${mode === 'summary' ? 'active' : ''}`} onClick={() => { setMode('summary'); setEditing(null); }}>
          Lecturer totals
        </button>
      </div>

      {mode === 'summary' ? (
        <BatchSummary batchId={batch._id} month={month} setMonth={setMonth} refreshKey={refreshKey} />
      ) : (
      <>
      <div className="pc-tabs">
        {ENTRY_MEDIUMS.map(([key, label]) => (
          <button key={key} className={`pc-tab ${medium === key ? 'active' : ''}`} onClick={() => { setMedium(key); setEditing(null); }}>
            {label} medium
          </button>
        ))}
      </div>

      <SalaryForm
        batch={batch}
        mode={mode}
        medium={medium}
        formulas={formulas}
        editing={editing}
        defaultMonth={month}
        onCancelEdit={() => setEditing(null)}
        onSaved={saved}
      />
      <SalaryList
        batchId={batch._id}
        mode={mode}
        medium={medium}
        month={month}
        setMonth={setMonth}
        refreshKey={refreshKey}
        reload={() => setRefreshKey((k) => k + 1)}
        isAdmin={isAdmin}
        onEdit={(rec) => { setEditing(rec); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
      />
      </>
      )}
    </>
  );
}

// ---------- Lecturer totals of ONE batch: every lecturer's total, split by part and medium ----------
function BatchSummary({ batchId, month, setMonth, refreshKey }) {
  const [allMonths, setAllMonths] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError('');
    axios
      .get(`/api/lecturer-salary/batches/${batchId}/summary`, { params: { month: allMonths ? 'all' : month } })
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch((err) => { if (!cancelled) setError(apiError(err, 'Could not load the totals')); });
    return () => { cancelled = true; };
  }, [batchId, month, allMonths, refreshKey]);

  const cell = (row, part, medium) => row.cells[`${part}|${medium}`] || 0;
  const other = (row) => round2(Object.entries(row.cells).filter(([k]) => k.includes('none')).reduce((t, [, v]) => t + v, 0));
  const show = (n) => (n ? formatMoney(n) : <span style={{ color: '#B8C4D8' }}>—</span>);
  const hasOther = data ? other(data.totals) > 0 : false;

  return (
    <>
      <div className="pc-toolbar">
        <h3 style={{ margin: 0 }}>Lecturer totals — {allMonths ? 'all months' : monthLabel(month)}</h3>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={allMonths} onChange={(e) => setAllMonths(e.target.checked)} /> All months together
          </label>
          <MonthYearPicker value={month} onChange={setMonth} disabled={allMonths} />
        </div>
      </div>
      <p style={{ margin: '0 0 14px', color: '#4A6288', fontSize: 13 }}>
        What every lecturer of this batch earned: split by part (online / physical / recording) and medium (English / Sinhala), with the grand total.
      </p>
      {error && <div className="pc-alert err">{error}</div>}
      {!data && !error && <p>Loading…</p>}
      {data && (
        <div className="pc-table-wrap">
          <table className="pc-table">
            <thead>
              <tr>
                <th rowSpan="2">Lecturer</th>
                {MODES.map(([key, label]) => <th key={key} colSpan="2" style={{ textAlign: 'center' }}>{label}</th>)}
                {hasOther && <th rowSpan="2" className="num">Not set</th>}
                <th rowSpan="2" className="num">Total</th>
                <th rowSpan="2" className="num">Paid</th>
                <th rowSpan="2" className="num">Not paid</th>
              </tr>
              <tr>
                {MODES.map(([key]) => ENTRY_MEDIUMS.map(([m, label]) => <th key={`${key}-${m}`} className="num">{label}</th>))}
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 && <tr><td colSpan="12" className="pc-empty">No lecturers in this batch yet</td></tr>}
              {data.rows.map((r) => (
                <tr key={String(r.lecturerId)}>
                  <td>
                    {r.name}{r.removed && <small style={{ color: '#B7791F' }}> (removed)</small>}
                    <br /><small style={{ color: '#4A6288' }}>{r.subject}{r.medium ? ` · ${mediumLabel(r.medium)}` : ''}</small>
                  </td>
                  {MODES.map(([key]) => ENTRY_MEDIUMS.map(([m]) => <td key={`${key}-${m}`} className="num">{show(cell(r, key, m))}</td>))}
                  {hasOther && <td className="num">{show(other(r))}</td>}
                  <td className="num"><strong>{formatMoney(r.total)}</strong></td>
                  <td className="num">{show(r.paid)}</td>
                  <td className="num">{show(r.notPaid)}</td>
                </tr>
              ))}
              {data.rows.length > 0 && (
                <tr style={{ background: '#F1F6FD', fontWeight: 700 }}>
                  <td>Batch total</td>
                  {MODES.map(([key]) => ENTRY_MEDIUMS.map(([m]) => <td key={`${key}-${m}`} className="num">{show(cell(data.totals, key, m))}</td>))}
                  {hasOther && <td className="num">{show(other(data.totals))}</td>}
                  <td className="num">{formatMoney(data.totals.total)}</td>
                  <td className="num">{show(data.totals.paid)}</td>
                  <td className="num">{show(data.totals.notPaid)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// The salary FORM of one batch. Pick the month + year and the lecturer: the lecturer's details
// fill in by themselves. Then either the formula (attendance) or a fixed salary.
function SalaryForm({ batch, mode, medium, formulas = [], editing, defaultMonth, onCancelEdit, onSaved }) {
  const batchId = batch._id;
  const defaultFormula = formulas.find((f) => f.isDefault);
  // The formula used when none is picked: the lecturer's own, else the batch's formula for this medium, else the batch formula.
  const defaultFor = (lec) => {
    const id = (lec && lec.formula) || (batch.mediumFormulas && batch.mediumFormulas[medium]) || batch.formula;
    return formulas.find((f) => f._id === id) || defaultFormula;
  };
  const [lecturerId, setLecturerId] = useState('');
  const [month, setMonth] = useState(defaultMonth);
  const [type, setType] = useState('formula');
  const [subFeeInput, setSubFeeInput] = useState('');
  const [percentageInput, setPercentageInput] = useState('');
  const [hoursInput, setHoursInput] = useState('');
  const [hourRateInput, setHourRateInput] = useState('');
  const [formulaId, setFormulaId] = useState(''); // the formula picked for this entry ('' = the default one)
  const [attendance, setAttendance] = useState('');
  const [fixedAmount, setFixedAmount] = useState('');
  const [note, setNote] = useState('');
  const [existing, setExisting] = useState([]); // entries this lecturer already has this month
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Entries the chosen lecturer already has in the chosen month (a lecturer may get more than one).
  useEffect(() => {
    if (!batchId || !lecturerId) { setExisting([]); return undefined; }
    let cancelled = false;
    axios
      .get('/api/lecturer-salary/salaries', { params: { month, batch: batchId } })
      .then((res) => { if (!cancelled) setExisting(res.data.filter((r) => r.lecturer === lecturerId && r._id !== editing?._id)); })
      .catch(() => { if (!cancelled) setExisting([]); });
    return () => { cancelled = true; };
  }, [batchId, lecturerId, month, editing]);

  // Clicking "Edit" on a draft in the list below loads it into this form.
  useEffect(() => {
    if (!editing) return;
    setLecturerId(editing.lecturer);
    setMonth(editing.month);
    setType(editing.type || 'formula');
    setSubFeeInput(editing.subFee ? String(editing.subFee) : '');
    setPercentageInput(editing.percentage ? String(editing.percentage) : '');
    setHoursInput(editing.hours ? String(editing.hours) : '');
    setHourRateInput(editing.hourRate ? String(editing.hourRate) : '');
    const lec = batch.lecturers.find((l) => l._id === editing.lecturer);
    // keep the formula that was picked for this entry (only when it differs from the default one)
    setFormulaId(editing.formula && editing.formula !== defaultFor(lec)?._id ? editing.formula : '');
    setAttendance(editing.type === 'fixed' || editing.attendance === undefined ? '' : String(editing.attendance));
    setFixedAmount(editing.type === 'fixed' ? String(editing.amount) : '');
    setNote(editing.note || '');
    setMessage(null);
  }, [editing, batch]);

  // Only the lecturers who teach in this medium (English-only lecturers are not offered in the Sinhala tab, and the other way round).
  const lecturersHere = batch.lecturers.filter(
    (l) => (!ENTRY_MEDIUMS.some(([key]) => key === l.medium) || l.medium === medium) && (!l.modes || l.modes.length === 0 || l.modes.includes(mode) || (mode === 'recording' && l.modes.includes('online')))
  );
  useEffect(() => {
    if (lecturerId && !editing && !lecturersHere.some((l) => l._id === lecturerId)) setLecturerId('');
    if (!editing) setFormulaId('');
    // switching the medium tab: take the rates of the other medium
    if (lecturerId && !editing) {
      const l = batch.lecturers.find((x) => x._id === lecturerId);
      if (l && lecturersHere.some((x) => x._id === lecturerId)) applyRates(l);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medium, mode]);
  const lecturer = batch.lecturers.find((l) => l._id === lecturerId) || null;

  // The lecturer's own rates for THIS medium (English and Sinhala have different sub fees) fill in the calculation.
  const applyRates = (l) => {
    const str = (k) => (rateFor(l, medium, k) ? String(rateFor(l, medium, k)) : '');
    setFixedAmount(str('fixedSalary'));
    setSubFeeInput(str('subFee'));
    setPercentageInput(str('percentage'));
    setHourRateInput(str('hourRate'));
  };

  // Choosing a lecturer fills in how they are paid.
  const pickLecturer = (id) => {
    setLecturerId(id);
    setAttendance('');
    setMessage(null);
    const l = batch.lecturers.find((x) => x._id === id);
    if (l) {
      setType(l.payType || 'formula');
      setFormulaId('');
      applyRates(l);
      setHoursInput('');
    }
  };

  const reset = () => {
    setLecturerId('');
    setAttendance('');
    setFixedAmount('');
    setNote('');
    setType('formula');
    setSubFeeInput('');
    setPercentageInput('');
    setHoursInput('');
    setHourRateInput('');
  };

  // Live preview of the amount (the server works it out again when saving).
  const formula = formulas.find((f) => f._id === formulaId) || defaultFor(lecturer);
  const attNum = Number(attendance);
  const validAtt = attendance !== '' && Number.isInteger(attNum) && attNum >= 0;
  const fixedNum = Number(fixedAmount);
  const validFixed = fixedAmount !== '' && fixedNum > 0;
  const used = formulaUses(formula);
  const needAtt = used.includes('attendance');
  const needHours = used.includes('hours');
  const subFeeNum = Number(subFeeInput) > 0 ? Number(subFeeInput) : 0;
  const percentageNum = Number(percentageInput) > 0 ? Number(percentageInput) : 0;
  const hoursNum = Number(hoursInput) > 0 ? Number(hoursInput) : 0;
  const hourRateNum = Number(hourRateInput) > 0 ? Number(hourRateInput) : 0;
  const missing = lecturer
    ? [
        used.includes('subFee') && !subFeeNum && 'sub fee',
        used.includes('percentage') && !percentageNum && 'percentage',
        used.includes('hourRate') && !hourRateNum && 'hourly rate',
      ].filter(Boolean)
    : [];
  const inputsOk = (!needAtt || validAtt) && (!needHours || hoursNum > 0);
  let calc = null;
  if (type === 'formula' && lecturer && formula && inputsOk && missing.length === 0) {
    if (formula.kind === 'range') {
      const value = formula.rangeBy === 'hours' ? hoursNum : attNum;
      const tier = findTier(formula.tiers, value);
      const pay = tier ? tierPay(formula, tier) : null;
      const pct = tier && hasPct(tier) ? Number(tier.percentage) : percentageNum;
      calc = tier
        ? { amount: round2(pay === 'rate' ? value * tier.amount * (pct / 100) : pay === 'unit' ? tier.amount * value : tier.amount), tier, value, pay, pct }
        : { error: `No range in “${formula.name}” covers ${value}. Add a range for it in the Formulas tab.` };
    } else {
      calc = tryFormula(formula.expression, { attendance: attNum || 0, subFee: subFeeNum, percentage: percentageNum, hours: hoursNum, hourRate: hourRateNum });
    }
  }
  const amount = type === 'fixed' ? (validFixed ? round2(fixedNum) : null) : calc && calc.amount !== undefined ? calc.amount : null;

  const submit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      // formulaId = the formula picked on the form; empty = the server uses the default for this lecturer / medium.
      const body = { type, mode, medium, note, ...(type === 'formula' ? { formulaId, attendance, hours: hoursInput, subFee: subFeeInput, percentage: percentageInput, hourRate: hourRateInput } : { fixedAmount }) };
      const res = editing
        ? await axios.put(`/api/lecturer-salary/salaries/${editing._id}`, body)
        : await axios.post('/api/lecturer-salary/salaries', { ...body, batchId, lecturerId, month });
      setMessage({ type: 'ok', text: res.data.message });
      reset();
      onSaved({ month, batchId });
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not save the salary') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pc-panel">
      <h3>{editing ? `Edit salary — ${editing.lecturerName}` : 'Add a salary'} · {modeLabel(mode)} · {entryMediumLabel(medium)}</h3>
      {message && <div className={`pc-alert ${message.type}`}>{message.text}</div>}

      <form className="pc-form" onSubmit={submit}>
        <MonthYearPicker value={month} onChange={setMonth} disabled={!!editing} />

        <label className="pc-field">
          Lecturer
          <select required disabled={!!editing} value={lecturerId} onChange={(e) => pickLecturer(e.target.value)}>
            <option value="">Select lecturer...</option>
            {lecturersHere.map((l) => <option key={l._id} value={l._id}>{l.name} — {l.subject}{l.medium === 'both' ? ' (both mediums)' : ''}{mode === 'recording' && l.modes && l.modes.length > 0 && !l.modes.includes('recording') ? ' (online lecturer)' : ''}</option>)}
          </select>
        </label>

        {batch.lecturers.length === 0 && (
          <p className="wide" style={{ margin: 0, color: '#B7791F' }}>
            This batch has no lecturers yet — add them in the “Batches &amp; Lecturers” tab.
          </p>
        )}
        {mode === 'recording' && (
          <p className="wide" style={{ margin: 0, fontSize: 13, color: '#4A6288' }}>
            Recordings are made from online classes, so the lecturers who teach Online are listed here too.
          </p>
        )}
        {batch.lecturers.length > 0 && lecturersHere.length === 0 && (
          <p className="wide" style={{ margin: 0, color: '#B7791F' }}>
            No lecturer of this batch teaches {modeLabel(mode)} in {entryMediumLabel(medium)}. Set each lecturer's medium and parts (Online / Physical / Recording) in the “Batches &amp; Lecturers” tab.
          </p>
        )}

        {lecturer && (
          <div className="wide" style={{ background: '#F4F8FD', border: '1px solid #DCE6F4', borderRadius: 10, padding: '12px 16px', fontSize: 14 }}>
            <strong>{lecturer.name}</strong> · {lecturer.subject}{lecturer.phone && ` · ${lecturer.phone}`}
            <br />
            Normally paid: <strong>{payTypeLabel(lecturer.payType)}</strong>
            {lecturer.payType === 'fixed'
              ? ` — ${formatMoney(rateFor(lecturer, medium, 'fixedSalary'))} (${entryMediumLabel(medium)})`
              : ` — ${ratesText(lecturer, medium) || 'by the formula'} (${entryMediumLabel(medium)} medium)`}
            <br />
            Bank:{' '}
            {lecturer.accountNumber
              ? `${lecturer.bankName} · ${lecturer.accountNumber}${lecturer.bankBranch ? ` · ${lecturer.bankBranch}` : ''}${lecturer.accountHolder ? ` · ${lecturer.accountHolder}` : ''}`
              : <span style={{ color: '#B7791F' }}>no bank details added yet</span>}
            {existing.length > 0 && (
              <>
                <br />
                <span style={{ color: '#1E56C2' }}>
                  Already has {existing.length} salary entr{existing.length === 1 ? 'y' : 'ies'} in {monthLabel(month)}
                  {' '}({existing.map((r) => `${modeLabel(r.mode)} / ${entryMediumLabel(r.medium)} ${formatMoney(r.amount)}`).join(', ')}). You can still add another one.
                </span>
              </>
            )}
          </div>
        )}

        {lecturer && (
          <>
            <label className="pc-field">
              Salary type
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="formula">By formula</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </label>

            {type === 'formula' && (
              <label className="pc-field">
                Formula
                <select value={formulaId} onChange={(e) => setFormulaId(e.target.value)}>
                  <FormulaOptions
                    formulas={formulas}
                    degree={batch.faculty}
                    emptyLabel={`${defaultFor(lecturer)?.name || 'Standard'} (default for ${entryMediumLabel(medium)} medium)`}
                  />
                </select>
              </label>
            )}

            {type === 'formula' ? (
              <>
                {needAtt && (
                  <label className="pc-field">
                    Attendance
                    <input type="number" required min="0" step="1" value={attendance} onChange={(e) => setAttendance(e.target.value)} />
                  </label>
                )}
                {needHours && (
                  <label className="pc-field">
                    Hours
                    <input type="number" required min="0.01" step="0.01" value={hoursInput} onChange={(e) => setHoursInput(e.target.value)} />
                  </label>
                )}
              </>
            ) : (
              <label className="pc-field">
                Fixed salary (Rs.)
                <input type="number" required min="0.01" step="0.01" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} />
              </label>
            )}

            {type === 'formula' && used.includes('subFee') && (
              <label className="pc-field">
                Sub fee (Rs.)
                <input type="number" required min="0.01" step="0.01" value={subFeeInput} onChange={(e) => setSubFeeInput(e.target.value)} />
              </label>
            )}
            {type === 'formula' && used.includes('percentage') && (
              <label className="pc-field">
                Percentage (%)
                <input type="number" required min="0.01" max="100" step="0.01" value={percentageInput} onChange={(e) => setPercentageInput(e.target.value)} />
              </label>
            )}
            {type === 'formula' && used.includes('hourRate') && (
              <label className="pc-field">
                Hourly rate (Rs. per hour)
                <input type="number" required min="0.01" step="0.01" value={hourRateInput} onChange={(e) => setHourRateInput(e.target.value)} />
              </label>
            )}

            <label className="pc-field">
              Note (optional)
              <input type="text" maxLength={200} placeholder="e.g. Part 2, Extra classes" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>

            {type === 'formula' && missing.length > 0 && (
              <p className="wide" style={{ margin: 0, color: '#B3382C' }}>
                This formula needs the {missing.join(' and ')}. Type {missing.length > 1 ? 'them' : 'it'} above, or choose “Fixed amount”.
              </p>
            )}
            {calc?.error && <p className="wide" style={{ margin: 0, color: '#B3382C' }}>{calc.error}</p>}

            <div className="wide" style={{ background: '#fff', border: '1px dashed #B8C8E0', borderRadius: 10, padding: '12px 16px' }}>
              {type === 'formula' && formula ? (
                <div style={{ color: '#4A6288', fontSize: 13 }}>
                  <strong>{formula.name}:</strong> <code>{formula.expression}</code>
                  {lecturer && inputsOk && (
                    <><br />
                      {[
                        needAtt && `attendance = ${attNum}`,
                        needHours && `hours = ${hoursNum}`,
                        used.includes('subFee') && `subFee = ${formatMoney(subFeeNum)}`,
                        used.includes('percentage') && `percentage = ${percentageNum}`,
                        used.includes('hourRate') && `hourRate = ${formatMoney(hourRateNum)}`,
                      ].filter(Boolean).join(', ')}
                      {calc?.tier && <><br />Range {tierLabel(calc.tier)} applies{calc.pay === 'rate' ? ` (${calc.value} × (${formatMoney(calc.tier.amount)} × ${calc.pct}%))` : calc.pay === 'unit' ? ` (${formatMoney(calc.tier.amount)} × ${calc.value})` : ` (${formatMoney(calc.tier.amount)})`}</>}
                    </>
                  )}
                </div>
              ) : (
                <div style={{ color: '#4A6288', fontSize: 13 }}>Fixed amount — no formula is used.</div>
              )}
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
                Salary: {amount === null ? '-' : formatMoney(amount)}
              </div>
            </div>

            <div className="wide">
              <button className="pc-btn" type="submit" disabled={saving || amount === null}>
                {saving ? 'Saving…' : editing ? 'Update salary' : 'Save salary (draft)'}
              </button>
              {editing && <button type="button" className="pc-btn-sm" style={{ marginLeft: 10 }} onClick={() => { onCancelEdit(); reset(); }}>Cancel</button>}
            </div>
          </>
        )}
      </form>
    </div>
  );
}

// The entries of one batch for one month, with the submit -> verify -> pay steps.
function SalaryList({ batchId, mode, medium, month, setMonth, refreshKey, reload, isAdmin, onEdit }) {
  const [records, setRecords] = useState(null);
  const [message, setMessage] = useState(null);
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    let cancelled = false;
    setRecords(null);
    axios
      .get('/api/lecturer-salary/salaries', { params: { month, batch: batchId } })
      .then((res) => { if (!cancelled) setRecords(res.data); })
      .catch((err) => { if (!cancelled) { setRecords([]); setMessage({ type: 'err', text: apiError(err, 'Could not load salaries') }); } });
    return () => { cancelled = true; };
  }, [month, batchId, refreshKey]);

  const replace = (salary) => setRecords((rs) => rs.map((r) => (r._id === salary._id ? salary : r)));

  const act = async (rec, action, note) => {
    setMessage(null);
    setBusyId(rec._id);
    try {
      const res = await axios.patch(`/api/lecturer-salary/salaries/${rec._id}/action`, { action, note });
      replace(res.data.salary);
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not update this salary') });
    } finally {
      setBusyId('');
    }
  };

  const sendBack = (rec) => {
    const note = window.prompt('Why is this being sent back? (the accountant will see this note)');
    if (note === null) return;
    if (!note.trim()) {
      setMessage({ type: 'err', text: 'Please write a short reason when sending a salary back' });
      return;
    }
    act(rec, 'return', note.trim());
  };

  const undoPaid = (rec) => {
    if (window.confirm('Undo this payment? It goes back to "Verified".')) act(rec, 'unpay');
  };

  const remove = async (rec) => {
    if (!window.confirm(`Delete this draft salary of ${rec.lecturerName}?`)) return;
    setMessage(null);
    setBusyId(rec._id);
    try {
      await axios.delete(`/api/lecturer-salary/salaries/${rec._id}`);
      setRecords((rs) => rs.filter((r) => r._id !== rec._id));
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not delete this entry') });
    } finally {
      setBusyId('');
    }
  };

  const bulk = async (action) => {
    const text = action === 'submit' ? 'Submit ALL drafts of this batch for this month for verification?' : 'Verify ALL submitted salaries of this batch for this month?';
    if (!window.confirm(text)) return;
    setMessage(null);
    try {
      const res = await axios.post('/api/lecturer-salary/salaries/bulk', { month, batchId, action });
      reload();
      setMessage({ type: 'ok', text: res.data.message });
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not update the salaries') });
    }
  };

  // Only this part (Online / Physical / Recording). Older entries saved before the 3 parts existed show under Online.
  // Entries saved before the mediums existed show under English.
  const list = (records || []).filter((r) => (r.mode === mode || (!r.mode && mode === 'online')) && (r.medium === medium || (!r.medium && medium === 'english')));
  const sum = (items) => items.reduce((t, s) => t + s.amount, 0);
  const total = sum(list);
  const paid = sum(list.filter((s) => s.status === 'paid'));
  const awaiting = sum(list.filter((s) => s.status === 'submitted'));
  const draftCount = list.filter((s) => s.status === 'pending').length;
  const submittedCount = list.filter((s) => s.status === 'submitted').length;

  return (
    <>
      <div className="pc-toolbar" style={{ marginTop: 24 }}>
        <h3 style={{ margin: 0 }}>{modeLabel(mode)} · {entryMediumLabel(medium)} salaries — {monthLabel(month)}</h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <MonthYearPicker value={month} onChange={(v) => { setMonth(v); setMessage(null); }} />
        </div>
      </div>

      <p style={{ margin: '0 0 14px', color: '#4A6288', fontSize: 13 }}>
        Steps: add the salary above (draft) → Submit → Super Admin verifies → paid from the “Payments” tab (one payment per lecturer, all their batches together).
      </p>

      {message && <div className={`pc-alert ${message.type}`}>{message.text}</div>}

      <div className="pc-cards">
        <div className="pc-card"><p>Total salary</p><h2>{formatMoney(total)}</h2></div>
        <div className="pc-card"><p>Awaiting verification</p><h2>{formatMoney(awaiting)}</h2><small>{submittedCount} entr{submittedCount === 1 ? 'y' : 'ies'}</small></div>
        <div className="pc-card balance"><p>Paid</p><h2>{formatMoney(paid)}</h2></div>
        <div className="pc-card spent"><p>Not yet paid</p><h2>{formatMoney(total - paid)}</h2></div>
      </div>

      {(draftCount > 0 || (isAdmin && submittedCount > 0)) && (
        <div style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {draftCount > 0 && <button className="pc-btn" onClick={() => bulk('submit')}>Submit all drafts ({draftCount})</button>}
          {isAdmin && submittedCount > 0 && <button className="pc-btn" onClick={() => bulk('verify')}>Verify all submitted ({submittedCount})</button>}
        </div>
      )}

      {records === null && <p>Loading…</p>}
      {records && (
        <div className="pc-table-wrap">
          <table className="pc-table">
            <thead>
              <tr><th>Lecturer</th><th>How it was calculated</th><th className="num">Salary</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan="5" className="pc-empty">No salary entries for this month</td></tr>}
              {list.map((rec) => {
                const busy = busyId === rec._id;
                return (
                  <tr key={rec._id}>
                    <td>
                      {rec.lecturerName}<br /><small>{rec.subject}</small>
                      {rec.note && <><br /><small style={{ color: '#1E56C2' }}>{rec.note}</small></>}
                    </td>
                    <td>
                      {rec.type === 'fixed' ? (
                        'Fixed salary'
                      ) : rec.expression ? (
                        <span title={rec.expression}>
                          {rec.formulaName}
                          <br />
                          <small>
                            {rec.calcText ? rec.calcText : (
                              <>
                                {[
                                  rec.attendance !== undefined && rec.attendance !== null ? `${rec.attendance} attendance` : null,
                                  rec.hours ? `${rec.hours} hours` : null,
                                  rec.hourRate ? `${formatMoney(rec.hourRate)} / hour` : null,
                                  rec.subFee ? formatMoney(rec.subFee) : null,
                                  rec.percentage ? `${rec.percentage}%` : null,
                                ].filter(Boolean).join(' · ')}
                              </>
                            )}
                          </small>
                        </span>
                      ) : (
                        <>
                          {rec.attendance} × {formatMoney(rec.subFee)} × {rec.percentage}%
                          {rec.deductionPercent > 0 && <><br /><small>−{rec.deductionPercent}% deduction</small></>}
                        </>
                      )}
                    </td>
                    <td className="num">{formatMoney(rec.amount)}</td>
                    <td>
                      <StatusBadge status={rec.status} />
                      {rec.status === 'pending' && rec.returnNote && <><br /><small style={{ color: '#B3382C' }}>Sent back: {rec.returnNote}</small></>}
                      {rec.status === 'submitted' && <><br /><small>by {rec.submittedByName}, {formatDate(rec.submittedAt)}</small></>}
                      {rec.status === 'verified' && <><br /><small>by {rec.verifiedByName}, {formatDate(rec.verifiedAt)}</small></>}
                      {rec.status === 'paid' && (
                        <>
                          <br /><small>{formatDate(rec.paidDate)}</small>
                          {rec.paidAccountNumber && <><br /><small>{rec.paidBankName} · {rec.paidAccountNumber}</small></>}
                        </>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {rec.status === 'pending' && (
                        <>
                          <button className="pc-btn-sm" disabled={busy} onClick={() => onEdit(rec)}>Edit</button>{' '}
                          <button className="pc-btn-sm" disabled={busy} onClick={() => act(rec, 'submit')}>Submit</button>{' '}
                          <button className="pc-btn-sm pc-btn-danger" disabled={busy} onClick={() => remove(rec)}>Delete</button>
                        </>
                      )}
                      {rec.status === 'submitted' && isAdmin && (
                        <>
                          <button className="pc-btn-sm" disabled={busy} onClick={() => act(rec, 'verify')}>Verify</button>{' '}
                          <button className="pc-btn-sm pc-btn-danger" disabled={busy} onClick={() => sendBack(rec)}>Send back</button>
                        </>
                      )}
                      {rec.status === 'submitted' && !isAdmin && <small>Waiting for Super Admin</small>}
                      {rec.status === 'verified' && isAdmin && (
                        <>
                          <button className="pc-btn-sm pc-btn-danger" disabled={busy} onClick={() => sendBack(rec)}>Send back</button>
                        </>
                      )}
                      {rec.status === 'verified' && !isAdmin && <small>Verified — waiting for payment</small>}
                      {rec.status === 'verified' && isAdmin && <small style={{ display: 'block', marginTop: 4 }}>Pay it in the Payments tab</small>}
                      {rec.status === 'paid' && isAdmin && (
                        <button className="pc-btn-sm pc-btn-danger" disabled={busy} onClick={() => undoPaid(rec)}>Undo paid</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {list.length > 0 && (
              <tfoot>
                <tr><td colSpan="2">Total</td><td className="num">{formatMoney(total)}</td><td colSpan="2"></td></tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </>
  );
}

// ---------- Payments: one payment per lecturer per month, ALL their batches added together ----------
function PaymentsSection({ isAdmin, courses }) {
  const [month, setMonth] = useState(currentMonthString());
  const [degree, setDegree] = useState(''); // '' = every degree
  const [search, setSearch] = useState('');
  const [people, setPeople] = useState(null);
  const [message, setMessage] = useState(null);
  const [busyKey, setBusyKey] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPeople(null);
    axios
      .get('/api/lecturer-salary/payments', { params: { month } })
      .then((res) => { if (!cancelled) setPeople(res.data); })
      .catch((err) => { if (!cancelled) { setPeople([]); setMessage({ type: 'err', text: apiError(err, 'Could not load the payments') }); } });
    return () => { cancelled = true; };
  }, [month, refreshKey]);

  const act = async (person, action) => {
    const text = action === 'pay'
      ? `Pay ${person.name} ${formatMoney(person.readyTotal)} now, for all their verified entries this month?`
      : `Undo the payment of ${person.name}? Their entries go back to “Verified”.`;
    if (!window.confirm(text)) return;
    setMessage(null);
    setBusyKey(person.key);
    try {
      const res = await axios.post('/api/lecturer-salary/payments', { month, personKey: person.key, action });
      setMessage({ type: 'ok', text: res.data.message });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not update this payment') });
    } finally {
      setBusyKey('');
    }
  };

  // One tab per degree. Only lecturers who have entries in that degree are listed.
  const active = pickCourse(courses, degree);
  const rows = (people || [])
    .map((p) => {
      const here = p.items.filter((i) => i.faculty === active);
      return { ...p, here, others: p.items.filter((i) => i.faculty !== active) };
    })
    .filter((p) => p.here.length > 0)
    .filter((p) => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()));
  const totalOf = (items, status) => round2(items.filter((i) => !status || i.status === status).reduce((t, i) => t + i.amount, 0));
  const sumHere = (status) => round2(rows.reduce((t, p) => t + totalOf(p.here, status), 0));
  const notVerifiedHere = round2(rows.reduce((t, p) => t + totalOf(p.here.filter((i) => i.status !== 'verified' && i.status !== 'paid')), 0));
  const shown = rows;

  return (
    <>
      <div className="pc-toolbar">
        <h3 style={{ margin: 0 }}>Payments — {monthLabel(month)}</h3>
        <MonthYearPicker value={month} onChange={(v) => { setMonth(v); setMessage(null); }} />
      </div>
      <p style={{ margin: '0 0 14px', color: '#4A6288', fontSize: 13 }}>
        Salaries are listed degree by degree. A lecturer who teaches in more than one degree is still paid <strong>once</strong>:
        the Pay button adds up all their verified salaries (every batch, degree and online / physical / recording part).
        People are matched by phone number (or by name when there is no phone number).
      </p>

      {message && <div className={`pc-alert ${message.type}`}>{message.text}</div>}

      <div className="pc-cards">
        <div className="pc-card"><p>{active} — total salaries</p><h2>{formatMoney(sumHere())}</h2><small>{rows.length} lecturer{rows.length === 1 ? '' : 's'}</small></div>
        <div className="pc-card"><p>Ready to pay (verified)</p><h2>{formatMoney(sumHere('verified'))}</h2></div>
        <div className="pc-card balance"><p>Paid</p><h2>{formatMoney(sumHere('paid'))}</h2></div>
        <div className="pc-card spent"><p>Not verified yet</p><h2>{formatMoney(notVerifiedHere)}</h2></div>
      </div>

      <CourseTabs courses={courses} value={active} onChange={setDegree} />

      <div className="pc-form" style={{ marginBottom: 14 }}>
        <label className="pc-field">
          Lecturer
          <input type="text" placeholder="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>

      {courses.length === 0 && <p className="pc-empty">No degrees yet.</p>}
      {people === null && <p>Loading…</p>}
      {people && courses.length > 0 && shown.length === 0 && <p className="pc-empty">No salary entries in {active} for this month.</p>}

      {shown.map((p) => {
        const allPaid = p.paidTotal > 0 && p.readyTotal === 0 && p.notReadyTotal === 0;
        return (
          <div key={p.key} className="pc-panel">
            <div className="pc-toolbar" style={{ marginBottom: 8 }}>
              <div>
                <h3 style={{ margin: 0 }}>{p.name}</h3>
                <small style={{ color: '#4A6288' }}>{p.subjects.join(', ')}{p.phone ? ` · ${p.phone}` : ''}</small>
                <br />
                <small>
                  Bank: {p.bank
                    ? `${p.bank.bankName} · ${p.bank.accountNumber}${p.bank.bankBranch ? ` · ${p.bank.bankBranch}` : ''}${p.bank.accountHolder ? ` · ${p.bank.accountHolder}` : ''}`
                    : <span style={{ color: '#B7791F' }}>no bank details added yet</span>}
                </small>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{formatMoney(totalOf(p.here))}</div>
                <small style={{ color: '#4A6288' }}>{active} total for {monthLabel(month)}</small>
                {p.others.length > 0 && <small style={{ display: 'block', color: '#4A6288' }}>All degrees together: <strong>{formatMoney(p.total)}</strong></small>}
              </div>
            </div>

            <div className="pc-table-wrap">
              <table className="pc-table">
                <thead><tr><th>Degree / batch</th><th>Part</th><th>Medium</th><th className="num">Amount</th><th>Status</th></tr></thead>
                <tbody>
                  {[['english', 'English medium'], ['sinhala', 'Sinhala medium'], ['', 'Medium not set']].map(([key, title]) => {
                    const rowsHere = [...p.here.map((i) => ({ ...i, other: false })), ...p.others.map((i) => ({ ...i, other: true }))].filter((i) => (i.medium || '') === key);
                    if (rowsHere.length === 0) return null;
                    const sub = round2(rowsHere.reduce((t, i) => t + i.amount, 0));
                    return (
                      <Fragment key={key || 'none'}>
                        <tr style={{ background: '#F1F6FD' }}>
                          <td colSpan="4"><strong>{title}</strong></td>
                          <td className="num"><strong>{formatMoney(sub)}</strong></td>
                        </tr>
                        {rowsHere.map((i) => (
                          <tr key={i._id} style={i.other ? { opacity: 0.6 } : undefined}>
                            <td>{entryBatchText(i)}{i.other && <> <small>(other degree)</small></>}{i.note && i.note !== '-' && <><br /><small style={{ color: '#1E56C2' }}>{i.note}</small></>}</td>
                            <td>{i.mode ? modeLabel(i.mode) : <span style={{ color: '#8FA3C0' }}>Not set</span>}{i.type === 'fixed' ? ' · fixed' : ''}</td>
                            <td>{i.medium ? entryMediumLabel(i.medium) : <span style={{ color: '#8FA3C0' }}>Not set</span>}</td>
                            <td className="num">{formatMoney(i.amount)}</td>
                            <td><StatusBadge status={i.status} /></td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {p.items.some((i) => !i.mode || !i.medium) && (
              <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#B7791F' }}>
                “Not set” entries were saved before the parts / mediums existed. Open them in the Salaries tab (they show under Online · English) and press Update to set them.
              </p>
            )}

            <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {p.readyTotal > 0 && isAdmin && (
                <button className="pc-btn" disabled={busyKey === p.key} onClick={() => act(p, 'pay')}>
                  {busyKey === p.key ? 'Paying…' : `Pay ${formatMoney(p.readyTotal)}`}
                </button>
              )}
              {p.readyTotal > 0 && p.others.length > 0 && (
                <small style={{ color: '#4A6288' }}>One payment for all degrees together{p.others.some((i) => i.status === 'verified') ? ' (includes verified salaries from the other degree)' : ''}.</small>
              )}
              {p.readyTotal > 0 && !isAdmin && <small>{formatMoney(p.readyTotal)} verified — waiting for the Super Admin to pay</small>}
              {p.notReadyTotal > 0 && (
                <small style={{ color: '#B7791F' }}>{formatMoney(p.notReadyTotal)} is not verified yet and is not included in the payment.</small>
              )}
              {p.paidTotal > 0 && (
                <small style={{ color: '#0F7A6F' }}>
                  Paid {formatMoney(p.paidTotal)}{p.paidDate ? ` on ${formatDate(p.paidDate)}` : ''}{p.paidByName ? ` by ${p.paidByName}` : ''}
                </small>
              )}
              {p.paidTotal > 0 && isAdmin && (
                <button className="pc-btn-sm pc-btn-danger" disabled={busyKey === p.key} onClick={() => act(p, 'unpay')}>
                  {allPaid ? 'Undo payment' : 'Undo paid part'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ---------- Formulas (super admin): write your own salary formulas ----------
const FORMULA_EXAMPLES = [
  ['Standard', 'attendance * subFee * percentage%'],
  ['Minus 5%', 'attendance * subFee * percentage% - 5%'],
  ['Pay by hours', 'hours * hourRate'],
  ['Capped at 100,000', 'min(attendance * subFee * percentage%, 100000)'],
];

const blankTier = () => ({ from: '', to: '', amount: '', payBy: 'total', percentage: '' });
const blankFormulaForm = () => ({
  name: '', description: '', kind: 'expression', expression: '', degree: '', rangeBy: 'attendance',
  tiers: [blankTier()],
});

function FormulasSection({ formulas, courses = [], onChanged }) {
  const [form, setForm] = useState(blankFormulaForm);
  const [editingId, setEditingId] = useState('');
  const [test, setTest] = useState({ attendance: '20', subFee: '5000', percentage: '60', hours: '10', hourRate: '500' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const isRange = form.kind === 'range';
  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const reset = () => { setForm(blankFormulaForm()); setEditingId(''); };
  const setTier = (i, key, value) => setForm((f) => ({ ...f, tiers: f.tiers.map((t, idx) => (idx === i ? { ...t, [key]: value } : t)) }));
  // Typing a percentage on a range means "sub fee × percentage", so the Pays choice follows automatically.
  const setTierPercentage = (i, value) => setForm((f) => ({
    ...f,
    tiers: f.tiers.map((t, idx) => (idx === i ? { ...t, percentage: value, ...(value !== '' ? { payBy: 'rate' } : {}) } : t)),
  }));
  const addTier = () => setForm((f) => {
    const last = f.tiers[f.tiers.length - 1];
    const next = last && last.to !== '' && Number(last.to) >= 0 ? String(Math.floor(Number(last.to)) + 1) : '';
    return { ...f, tiers: [...f.tiers, { ...blankTier(), from: next }] };
  });
  const removeTier = (i) => setForm((f) => ({ ...f, tiers: f.tiers.length > 1 ? f.tiers.filter((_, idx) => idx !== i) : f.tiers }));

  // Live check while typing: does the formula work, and what does it give for the test numbers?
  const num = (v) => Number(v) || 0;
  let result = null;
  const byHours = form.rangeBy === 'hours';
  if (isRange) {
    const tiers = form.tiers.map((t) => ({ from: Number(t.from), to: t.to === '' ? null : Number(t.to), amount: Number(t.amount), payBy: t.payBy, percentage: t.percentage, empty: t.from === '' && t.to === '' && t.amount === '' }));
    const okNum = (n) => Number.isFinite(n) && n >= 0 && (byHours || Number.isInteger(n));
    const bad = tiers.findIndex((t) => !okNum(t.from) || (t.to !== null && (!okNum(t.to) || t.to < t.from)) || !(t.amount > 0));
    if (tiers.every((t) => t.empty)) result = null;
    else if (bad >= 0) result = { error: `Range ${bad + 1}: fill in ${byHours ? 'numbers' : 'whole numbers'} for from / to (to is not less than from, or leave it empty for “and above”) and an amount above 0.` };
    else {
      const value = num(byHours ? test.hours : test.attendance);
      const sorted = [...tiers].sort((a, b) => a.from - b.from || (a.to ?? Infinity) - (b.to ?? Infinity));
      const tier = findTier(sorted, value);
      const pct = tier && tier.percentage !== '' ? Number(tier.percentage) : num(test.percentage);
      result = tier
        ? { amount: tier.payBy === 'rate' ? value * tier.amount * (pct / 100) : tier.payBy === 'unit' ? tier.amount * value : tier.amount, tier, value }
        : { error: `No range covers ${byHours ? 'hours' : 'attendance'} ${value}.` };
    }
  } else if (form.expression.trim()) {
    result = tryFormula(form.expression, { attendance: num(test.attendance), subFee: num(test.subFee), percentage: num(test.percentage), hours: num(test.hours), hourRate: num(test.hourRate) });
  }

  const submit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const res = editingId
        ? await axios.put(`/api/lecturer-salary/formulas/${editingId}`, form)
        : await axios.post('/api/lecturer-salary/formulas', form);
      setMessage({ type: 'ok', text: res.data.message });
      reset();
      onChanged();
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not save the formula') });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (f) => {
    setEditingId(f._id);
    setForm({
      name: f.name,
      description: f.description || '',
      kind: f.kind || 'expression',
      expression: f.kind === 'range' ? '' : f.expression,
      degree: f.degree || '',
      rangeBy: f.rangeBy || 'attendance',
      tiers: f.kind === 'range' && f.tiers?.length
        ? f.tiers.map((t) => ({ from: String(t.from), to: t.to === null || t.to === undefined ? '' : String(t.to), amount: String(t.amount), payBy: tierPay(f, t), percentage: t.percentage === null || t.percentage === undefined ? '' : String(t.percentage) }))
        : [blankTier()],
    });
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (f) => {
    if (!window.confirm(`Delete the formula "${f.name}"?`)) return;
    setMessage(null);
    try {
      await axios.delete(`/api/lecturer-salary/formulas/${f._id}`);
      if (editingId === f._id) reset();
      onChanged();
    } catch (err) {
      setMessage({ type: 'err', text: apiError(err, 'Could not delete the formula') });
    }
  };

  return (
    <>
      {message && <div className={`pc-alert ${message.type}`}>{message.text}</div>}

      <div className="pc-panel">
        <h3>{editingId ? 'Edit formula' : 'Add a formula'}</h3>
        <form className="pc-form" onSubmit={submit}>
          <label className="pc-field">
            Formula name
            <input type="text" required maxLength={60} placeholder={isRange ? 'e.g. Art 2025 ranges' : 'e.g. Standard minus 5%'} value={form.name} onChange={setField('name')} />
          </label>
          <label className="pc-field">
            Type
            <select value={form.kind} onChange={setField('kind')}>
              <option value="expression">Maths formula (you type the calculation)</option>
              <option value="range">Ranges (the pay changes with the attendance or hours)</option>
            </select>
          </label>
          <label className="pc-field">
            Only for degree (optional)
            <select value={form.degree} onChange={setField('degree')}>
              <option value="">Every degree</option>
              {courses.map((c) => <option key={c._id} value={c.name}>{c.name}</option>)}
            </select>
          </label>
          <label className="pc-field">
            Description (optional)
            <input type="text" maxLength={200} value={form.description} onChange={setField('description')} />
          </label>

          <p className="wide" style={{ margin: 0, fontSize: 13, color: '#4A6288' }}>
            {isRange
              ? 'Ranges: you list the ranges yourself (as many as you need). The attendance (or hours) typed when entering the salary decides which range is used.'
              : 'Maths formula: you type the calculation, for example attendance × sub fee × percentage, or hours × hourly rate.'}
          </p>

          {!isRange && (
            <>
              <label className="pc-field wide">
                Formula
                <input
                  type="text"
                  required
                  maxLength={200}
                  style={{ fontFamily: 'monospace' }}
                  placeholder="attendance * subFee * percentage%"
                  value={form.expression}
                  onChange={setField('expression')}
                />
              </label>

              <div className="wide" style={{ fontSize: 13, color: '#4A6288' }}>
                Click to add a name:{' '}
                {VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="pc-btn-sm"
                    style={{ marginRight: 6 }}
                    onClick={() => setForm((f) => ({ ...f, expression: `${f.expression}${f.expression && !f.expression.endsWith(' ') ? ' ' : ''}${v}` }))}
                  >
                    {v}
                  </button>
                ))}
                <br />
                Use <code>+ − * /</code> and brackets <code>( )</code>. <code>%</code> after a number or name divides it by 100 (<code>5%</code> = 0.05,{' '}
                <code>percentage%</code> = the lecturer's percentage as a fraction). After <code>+</code> or <code>−</code>, <code>5%</code> means 5% of the amount so far
                (<code>… − 5%</code> takes 5% off). Also <code>min(a, b)</code>, <code>max(a, b)</code>, <code>round(a)</code>, <code>floor(a)</code> (drops the cents).
                <br />
                <code>hours</code> and <code>hourRate</code> are for lecturers paid by the hour: the hours are typed when the salary is entered, and the
                hourly rate is set on each lecturer (so it can be different for every batch and every lecturer).
                <br />
                Examples:{' '}
                {FORMULA_EXAMPLES.map(([label, expression]) => (
                  <button
                    key={label}
                    type="button"
                    className="pc-btn-sm"
                    style={{ marginRight: 6, marginTop: 4 }}
                    onClick={() => setForm((f) => ({ ...f, name: f.name || label, expression }))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}

          {isRange && (
            <div className="wide" style={{ background: '#F4F8FD', border: '1px solid #DCE6F4', borderRadius: 10, padding: '12px 16px' }}>
              <label className="pc-field" style={{ maxWidth: 320, marginBottom: 10 }}>
                Ranges are counted on
                <select value={form.rangeBy} onChange={setField('rangeBy')}>
                  <option value="attendance">Attendance</option>
                  <option value="hours">Hours</option>
                </select>
              </label>
              <div className="pc-table-wrap">
                <table className="pc-table">
                  <thead>
                    <tr>
                      <th>{byHours ? 'Hours' : 'Attendance'} from</th>
                      <th>to (empty = and above)</th>
                      <th>Pays</th>
                      <th>Amount (Rs.)</th>
                      <th>Percentage (%)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.tiers.map((t, i) => (
                      <tr key={i}>
                        <td><input type="number" min="0" step={byHours ? 'any' : '1'} required value={t.from} onChange={(e) => setTier(i, 'from', e.target.value)} style={{ width: 100 }} /></td>
                        <td><input type="number" min="0" step={byHours ? 'any' : '1'} placeholder="and above" value={t.to} onChange={(e) => setTier(i, 'to', e.target.value)} style={{ width: 120 }} /></td>
                        <td>
                          <select value={t.payBy} onChange={(e) => setTier(i, 'payBy', e.target.value)}>
                            <option value="total">This amount in total</option>
                            <option value="unit">This amount × {byHours ? 'hours' : 'attendance'}</option>
                            <option value="rate">{byHours ? 'Hours' : 'Attendance'} × (sub fee × percentage)</option>
                          </select>
                        </td>
                        <td><input type="number" min="0.01" step="0.01" required placeholder={t.payBy === 'rate' ? 'sub fee' : ''} value={t.amount} onChange={(e) => setTier(i, 'amount', e.target.value)} style={{ width: 130 }} /></td>
                        <td>
                          <input
                            type="number"
                            min="0.01"
                            max="100"
                            step="0.01"
                            placeholder={t.payBy === 'rate' ? "lecturer's %" : 'e.g. 50'}
                            value={t.percentage}
                            onChange={(e) => setTierPercentage(i, e.target.value)}
                            style={{ width: 120 }}
                          />
                        </td>
                        <td><button type="button" className="pc-btn-sm pc-btn-danger" disabled={form.tiers.length === 1} onClick={() => removeTier(i)}>Remove</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" className="pc-btn-sm" style={{ marginTop: 8 }} onClick={addTier}>+ Add a range</button>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: '#4A6288' }}>
                Each range has its own “Pays” choice. Type a <strong>Percentage</strong> on a range to get “{byHours ? 'Hours' : 'Attendance'} × (sub fee × percentage)”: the Amount is the sub fee for that
                range, and the salary = {byHours ? 'hours' : 'attendance'} × sub fee × percentage ÷ 100. Leave the percentage empty (with that Pays choice) to use each lecturer's own percentage, typed when entering the salary.
                Other examples: 1 to 10 = 500 in total, 11 to 50 = 400 in total, 101 and above (leave “to” empty) = 25 × attendance.
                If two ranges share a number (like 10), the lower range is used. Make a separate formula for every batch that has different ranges
                (e.g. “Art 2025 ranges”, “Art 2024 ranges”), then choose it on that batch.
              </p>
            </div>
          )}

          <div className="wide" style={{ background: '#F4F8FD', border: '1px solid #DCE6F4', borderRadius: 10, padding: '12px 16px' }}>
            <strong>Try it</strong>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '8px 0' }}>
              {(isRange ? [byHours ? 'hours' : 'attendance', ...(form.tiers.some((t) => t.payBy === 'rate') ? ['percentage'] : [])] : VARIABLES).map((v) => (
                <label key={v} className="pc-field">
                  {v}
                  <input type="number" step="any" style={{ width: 120 }} value={test[v]} onChange={(e) => setTest((t) => ({ ...t, [v]: e.target.value }))} />
                </label>
              ))}
            </div>
            {result === null && <span style={{ color: '#4A6288' }}>{isRange ? 'Fill in the ranges to test them.' : 'Type a formula to test it.'}</span>}
            {result?.error && <span style={{ color: '#B3382C' }}>{result.error}</span>}
            {result && result.amount !== undefined && (
              <span style={{ fontSize: 18, fontWeight: 700 }}>
                Result: {formatMoney(result.amount)}
                {result.tier && <small style={{ fontWeight: 400, color: '#4A6288' }}> (range {tierLabel(result.tier)})</small>}
              </span>
            )}
          </div>

          <div className="wide">
            <button className="pc-btn" type="submit" disabled={saving || (!isRange && result && result.error !== undefined && !/negative/.test(result.error))}>
              {saving ? 'Saving…' : editingId ? 'Update formula' : 'Add formula'}
            </button>
            {editingId && <button type="button" className="pc-btn-sm" style={{ marginLeft: 10 }} onClick={reset}>Cancel</button>}
            <small style={{ marginLeft: 12, color: '#4A6288' }}>
              Salaries already calculated keep the formula they were calculated with. Drafts use the new one when you press Update.
            </small>
          </div>
        </form>
      </div>

      <h3>Formulas ({formulas.length})</h3>
      <div className="pc-table-wrap">
        <table className="pc-table">
          <thead><tr><th>Name</th><th>Formula</th><th></th></tr></thead>
          <tbody>
            {formulas.length === 0 && <tr><td colSpan="3" className="pc-empty">No formulas yet</td></tr>}
            {formulas.map((f) => (
              <tr key={f._id}>
                <td>
                  {f.name}
                  {f.isDefault && <> <span className="pc-badge ok">Default</span></>}
                  {f.kind === 'range' && <> <span className="pc-badge">Ranges</span></>}
                  {f.degree && <> <span className="pc-badge">{f.degree} only</span></>}
                  {f.description && <><br /><small>{f.description}</small></>}
                </td>
                <td>
                  <code>{f.expression}</code>
                  {f.kind === 'range' && <><br /><small>ranges counted on {f.rangeBy === 'hours' ? 'hours' : 'attendance'}</small></>}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="pc-btn-sm" onClick={() => startEdit(f)}>Edit</button>{' '}
                  {!f.isDefault && <button className="pc-btn-sm pc-btn-danger" onClick={() => remove(f)}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default LecturerSalary;