import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './PettyCash.css';

// Super admin only: who did what, and when. Read-only - nothing here can edit or delete a row.
// Data comes from GET /api/admin/audit-logs (filters + paging are done by the server).
const PAGE_SIZE = 25;

const whenText = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString();
};

function AuditLog() {
  const [filters, setFilters] = useState({ action: '', outcome: '', from: '', to: '' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: PAGE_SIZE };
      Object.entries(applied).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
      const res = await axios.get('/api/admin/audit-logs', { params });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load the audit log.');
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const search = (e) => {
    e.preventDefault();
    setPage(1);
    setApplied(filters);
  };
  const clear = () => {
    const empty = { action: '', outcome: '', from: '', to: '' };
    setFilters(empty);
    setApplied(empty);
    setPage(1);
  };

  return (
    <div className="sa-page pc-page">
      <div className="pc-toolbar">
        <h1 className="sa-page-title" style={{ margin: 0 }}>Audit Log</h1>
      </div>

      <form className="pc-panel" onSubmit={search} style={{ marginBottom: 18 }}>
        <div className="pc-form" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label className="pc-field">
            Action contains
            <input type="text" value={filters.action} onChange={set('action')} placeholder="e.g. LOGIN, DELETE" />
          </label>
          <label className="pc-field">
            Outcome
            <select value={filters.outcome} onChange={set('outcome')}>
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label className="pc-field">
            From
            <input type="date" value={filters.from} onChange={set('from')} />
          </label>
          <label className="pc-field">
            To
            <input type="date" value={filters.to} onChange={set('to')} />
          </label>
          <button type="submit" className="pc-btn">Search</button>
          <button type="button" className="pc-btn-sm" onClick={clear}>Clear</button>
        </div>
      </form>

      {error && <div className="pc-alert err">{error}</div>}

      <div className="pc-table-wrap">
        <table className="pc-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Outcome</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="pc-empty">Loading…</td></tr>
            )}
            {!loading && data.items.length === 0 && (
              <tr><td colSpan={5} className="pc-empty">No records match these filters.</td></tr>
            )}
            {!loading && data.items.map((row) => (
              <tr key={row._id}>
                <td>{whenText(row.createdAt)}</td>
                <td>
                  {row.actorName || row.actorEmail || '-'}
                  {row.actorRole && <small style={{ display: 'block', color: 'var(--ui-faint)' }}>{String(row.actorRole).replace(/_/g, ' ')}</small>}
                </td>
                <td>
                  {row.action}
                  {row.statusCode && <small style={{ display: 'block', color: 'var(--ui-faint)' }}>HTTP {row.statusCode}</small>}
                </td>
                <td>
                  <span className={`pc-badge ${row.outcome === 'failed' ? 'overspent' : 'ok'}`}>{row.outcome}</span>
                </td>
                <td>{row.ip || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pc-toolbar" style={{ marginTop: 16, justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--ui-muted)', fontSize: 13 }}>{data.total} record{data.total === 1 ? '' : 's'}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="pc-btn-sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span style={{ color: 'var(--ui-muted)', fontSize: 13 }}>Page {page} of {Math.max(data.pages || 1, 1)}</span>
          <button type="button" className="pc-btn-sm" disabled={page >= (data.pages || 1) || loading} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}

export default AuditLog;