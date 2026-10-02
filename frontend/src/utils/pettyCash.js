import axios from 'axios';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Shared helpers for the Petty Cash screens (accountant dashboard + super admin tab).

export const formatMoney = (value) =>
  `Rs. ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatDate = (value) => {
  if (!value) return '-';
  // Dates are stored at UTC midnight - read them back in UTC so they never shift a day.
  return new Date(value).toLocaleDateString('en-GB', { timeZone: 'UTC' });
};

export const monthLabel = (month) => {
  if (!month) return '';
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

// Today / this month in Sri Lanka, as the values <input type="date|month"> expect.
export const todayString = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
export const currentMonthString = () => todayString().slice(0, 7);

export const STATUS_LABELS = { ok: 'Healthy', low: 'Low balance', overspent: 'Overspent' };

export const METHOD_LABELS = { cash: 'Cash', bank_transfer: 'Bank transfer', bank_deposit: 'Bank deposit', cheque: 'Cheque' };

// For these the super admin must upload the bank slip.
export const needsSlip = (method) => method === 'bank_transfer' || method === 'bank_deposit';

// The day the money was given (older records fall back to the day they were issued).
export const fundDateOf = (allocation) => allocation.fundDate || allocation.createdAt;

// Opens the uploaded bank slip in a new tab. `who` is 'admin' (super admin) or 'me' (accountant).
// Goes through the API (not a direct Cloudinary link) so the login token is sent.
export async function viewAllocationSlip(allocation, who = 'me') {
  const tab = window.open('', '_blank');
  try {
    const res = await axios.get(`/api/petty-cash/${who === 'admin' ? 'admin' : 'me'}/allocations/${allocation._id}/slip`, {
      responseType: 'blob',
    });
    const blobUrl = window.URL.createObjectURL(res.data);
    if (tab) tab.location.href = blobUrl;
    else window.open(blobUrl, '_blank');
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
  } catch (err) {
    if (tab) tab.close();
    let message = 'Could not open the slip. Please try again.';
    try {
      if (err.response?.data instanceof Blob) {
        const parsed = JSON.parse(await err.response.data.text());
        if (parsed?.message) message = parsed.message;
      }
    } catch { /* keep the default message */ }
    window.alert(message);
  }
}

// Old allocations (before the receipt step existed) have no status and count as received.
export const isReceived = (allocation) => allocation.status !== 'pending';

// Builds and downloads the fund allocation voucher (super admin -> accountant).
export function downloadAllocationPdf(allocation) {
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'landscape' });
  const w = doc.internal.pageSize.getWidth();
  const refNo = allocation.referenceNo || 'FUND-ALLOCATION';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('PETTY CASH FUND ALLOCATION', w / 2, 16, { align: 'center' });

  doc.setDrawColor(30, 86, 194);
  doc.setLineWidth(0.6);
  doc.line(12, 20, w - 12, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Reference No:', 12, 28);
  doc.setFont('helvetica', 'bold');
  doc.text(refNo, 40, 28);
  doc.setFont('helvetica', 'normal');
  doc.text('Date:', w - 62, 28);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDate(fundDateOf(allocation)), w - 50, 28);

  const body = [
    ['Issued To', allocation.accountantName],
    ['For Month', monthLabel(allocation.month)],
    ['Fund Date', formatDate(fundDateOf(allocation))],
    ['Method', METHOD_LABELS[allocation.method] || 'Cash'],
  ];
  if (allocation.paymentRef) body.push(['Cheque / Transfer Ref', allocation.paymentRef]);
  if (allocation.slipUrl) body.push(['Bank Slip', 'Attached in the system']);
  if (allocation.note) body.push(['Note', allocation.note]);
  body.push(['Amount', formatMoney(allocation.amount)]);
  body.push(['Status', isReceived(allocation) ? `Received${allocation.receivedAt ? ' on ' + formatDate(allocation.receivedAt) : ''}` : 'Pending - awaiting accountant confirmation']);

  autoTable(doc, {
    startY: 33,
    theme: 'grid',
    body,
    styles: { fontSize: 10, cellPadding: 2.2, textColor: [10, 31, 68] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 44, fillColor: [234, 241, 252] },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 12, right: 12 },
  });

  const pageH = doc.internal.pageSize.getHeight();
  const y = Math.min(doc.lastAutoTable.finalY + 18, pageH - 14);
  doc.setLineWidth(0.3);
  doc.setDrawColor(10, 31, 68);
  const sigs = [
    ['Issued by (Super Admin)', allocation.allocatedByName],
    ['Received by (Accountant)', isReceived(allocation) ? allocation.accountantName : ''],
  ];
  const colW = (w - 24) / 2;
  sigs.forEach(([label, name], i) => {
    const x = 12 + i * colW;
    doc.line(x, y, x + colW - 10, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(label, x, y + 5);
    if (name) {
      doc.setFont('helvetica', 'normal');
      doc.text(name, x, y + 10);
    }
  });

  doc.save(`${refNo}.pdf`);
}

// Builds and downloads the petty cash voucher PDF for one expense record.
export function downloadVoucherPdf(expense) {
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'landscape' });
  const w = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('PETTY CASH VOUCHER', w / 2, 16, { align: 'center' });

  doc.setDrawColor(30, 86, 194);
  doc.setLineWidth(0.6);
  doc.line(12, 20, w - 12, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Voucher No:', 12, 28);
  doc.setFont('helvetica', 'bold');
  doc.text(expense.voucherNo, 36, 28);
  doc.setFont('helvetica', 'normal');
  doc.text('Date:', w - 62, 28);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDate(expense.date), w - 50, 28);

  autoTable(doc, {
    startY: 33,
    theme: 'grid',
    body: [
      ['Paid To', expense.payee],
      ['Category', expense.category],
      ['Description', expense.description],
      ['Amount', formatMoney(expense.amount)],
    ],
    styles: { fontSize: 10, cellPadding: 2.5, textColor: [10, 31, 68] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 34, fillColor: [234, 241, 252] },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 12, right: 12 },
  });

  const y = doc.lastAutoTable.finalY + 22;
  doc.setLineWidth(0.3);
  doc.setDrawColor(10, 31, 68);
  const sigs = [
    ['Prepared by', expense.accountantName],
    ['Approved by', ''],
    ['Received by', ''],
  ];
  const colW = (w - 24) / 3;
  sigs.forEach(([label, name], i) => {
    const x = 12 + i * colW;
    doc.line(x, y, x + colW - 8, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(label, x, y + 5);
    if (name) {
      doc.setFont('helvetica', 'normal');
      doc.text(name, x, y + 10);
    }
  });

  doc.save(`${expense.voucherNo}.pdf`);
}


// ---------------------------------------------------------------------------
// Reports (overall / one accountant, weekly / monthly / yearly / all time)
// ---------------------------------------------------------------------------
export const REPORT_PERIODS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'all', label: 'Overall (all time)' },
];

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad2 = (n) => String(n).padStart(2, '0');
const DAY_MS = 24 * 60 * 60 * 1000;

// [from, to] as 'YYYY-MM-DD' (both inclusive) for the chosen period, or null if the
// inputs are not usable yet. Plain string / UTC maths so the date never shifts a day.
// 'all' returns empty strings = no limits.
export const periodRange = (period, { weekDate, year, month }) => {
  if (period === 'all') return { from: '', to: '' };
  if (period === 'weekly') {
    const ref = new Date(`${weekDate}T00:00:00.000Z`);
    if (Number.isNaN(ref.getTime())) return null;
    const day = ref.getUTCDay(); // 0 = Sunday
    const monday = new Date(ref.getTime() + ((day === 0 ? -6 : 1) - day) * DAY_MS);
    const sunday = new Date(monday.getTime() + 6 * DAY_MS);
    return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
  }
  if (period === 'monthly') {
    if (!year || !month) return null;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { from: `${year}-${pad2(month)}-01`, to: `${year}-${pad2(month)}-${pad2(lastDay)}` };
  }
  if (!year) return null;
  return { from: `${year}-01-01`, to: `${year}-12-31` };
};

// e.g. "Week of 07/09/2026 – 13/09/2026", "September 2026", "2026", "All time"
export const describePeriod = (period, range, { year, month }) => {
  if (period === 'all' || !range) return 'All time';
  if (period === 'weekly') return `Week of ${formatDate(range.from)} – ${formatDate(range.to)}`;
  if (period === 'monthly') return `${MONTH_NAMES[month - 1]} ${year}`;
  return String(year);
};

const fileSlug = (text) => String(text || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');

// Builds and downloads the petty cash report PDF from the /report API response.
export function downloadReportPdf(report, periodLabel) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const overall = report.scope === 'overall';
  const who = overall ? 'All accountants' : report.accountant?.name || 'Accountant';
  const { totals } = report;
  const BLUE = [30, 86, 194];
  const INK = [10, 31, 68];
  const tableBase = {
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2, textColor: INK },
    headStyles: { fillColor: BLUE, textColor: 255 },
    footStyles: { fillColor: [234, 241, 252], textColor: INK, fontStyle: 'bold' },
    margin: { left: 12, right: 12 },
  };
  const numCols = (...idx) => Object.fromEntries(idx.map((i) => [i, { halign: 'right' }]));
  // Header and total-row cells follow the column's alignment (numbers on the right).
  const draw = (opts) =>
    autoTable(doc, {
      ...tableBase,
      startY: y,
      ...opts,
      didParseCell: (data) => {
        const col = opts.columnStyles?.[data.column.index];
        if (data.section !== 'body' && col?.halign) data.cell.styles.halign = col.halign;
        if (opts.didParseCell) opts.didParseCell(data);
      },
    });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text('PETTY CASH REPORT', w / 2, 15, { align: 'center' });
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.6);
  doc.line(12, 19, w - 12, 19);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(who, 12, 26);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${periodLabel}`, 12, 31);
  doc.text(`Generated on ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })}`, w - 12, 26, { align: 'right' });

  let y = 42;
  const heading = (text) => {
    if (y > h - 35) { doc.addPage(); y = 16; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(text, 12, y);
    y += 3;
  };
  const afterTable = () => { y = doc.lastAutoTable.finalY + 9; };

  // 1. Summary
  heading('Summary');
  draw({
    body: [
      ['Brought forward', formatMoney(totals.opening), 'Vouchers issued', String(totals.voucherCount)],
      ['Funds received', formatMoney(totals.allocated), 'Vouchers over the balance', String(totals.overdrawnCount)],
      ['Total available', formatMoney(totals.available), 'Share of funds used', `${totals.usedPercent}%`],
      ['Spent', formatMoney(totals.spent), 'Funds not yet confirmed', `${report.pendingFunds.count} (${formatMoney(report.pendingFunds.amount)})`],
      ['Closing balance', formatMoney(totals.closing), '', ''],
    ],
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [234, 241, 252], cellWidth: 45 },
      1: { halign: 'right', cellWidth: 45 },
      2: { fontStyle: 'bold', fillColor: [234, 241, 252], cellWidth: 55 },
      3: { halign: 'right' },
    },
  });
  afterTable();

  // 2. By accountant (overall report only)
  if (overall) {
    heading('By accountant');
    draw({
      head: [['Accountant', 'Brought fwd', 'Funds received', 'Spent', 'Closing balance', 'Used', 'Status']],
      body: report.accountants.length
        ? report.accountants.map((a) => [a.name, formatMoney(a.opening), formatMoney(a.allocated), formatMoney(a.spent), formatMoney(a.closing), `${a.usedPercent}%`, STATUS_LABELS[a.status]])
        : [['No activity in this period', '', '', '', '', '', '']],
      foot: report.accountants.length
        ? [['Total', formatMoney(totals.opening), formatMoney(totals.allocated), formatMoney(totals.spent), formatMoney(totals.closing), `${totals.usedPercent}%`, '']]
        : undefined,
      columnStyles: numCols(1, 2, 3, 4, 5),
    });
    afterTable();
  }

  // 3. Where the money went
  heading('Spending by category');
  draw({
    head: [['Category', 'Vouchers', 'Amount', '% of spending']],
    body: report.categories.length
      ? report.categories.map((c) => [c.category, String(c.count), formatMoney(c.total), `${c.percent}%`])
      : [['No spending in this period', '', '', '']],
    foot: report.categories.length ? [['Total', String(totals.voucherCount), formatMoney(totals.spent), '100%']] : undefined,
    columnStyles: numCols(1, 2, 3),
  });
  afterTable();

  // 4. Funds
  heading('Funds given');
  draw({
    head: [['Ref. no', 'Fund date', 'For month', ...(overall ? ['Accountant'] : []), 'Method', 'Status', 'Amount']],
    body: report.allocations.length
      ? report.allocations.map((a) => [
          a.referenceNo || '-',
          formatDate(fundDateOf(a)),
          monthLabel(a.month),
          ...(overall ? [a.accountantName] : []),
          `${METHOD_LABELS[a.method] || 'Cash'}${a.paymentRef ? ` · ${a.paymentRef}` : ''}`,
          isReceived(a) ? 'Received' : 'Pending',
          formatMoney(a.amount),
        ])
      : [['No funds in this period', ...Array(overall ? 6 : 5).fill('')]],
    foot: report.allocations.length
      ? [['Received (counted in the balance)', ...Array(overall ? 5 : 4).fill(''), formatMoney(totals.allocated)]]
      : undefined,
    columnStyles: numCols(overall ? 6 : 5),
  });
  afterTable();

  // 5. Vouchers
  heading('Vouchers issued');
  draw({
    head: [['Voucher', 'Date', ...(overall ? ['Accountant'] : []), 'Paid to', 'Category', 'Description', 'Amount']],
    body: report.expenses.length
      ? report.expenses.map((x) => [x.voucherNo, formatDate(x.date), ...(overall ? [x.accountantName] : []), x.payee, x.category, x.description, formatMoney(x.amount)])
      : [['No vouchers in this period', ...Array(overall ? 6 : 5).fill('')]],
    foot: report.expenses.length
      ? [['Total', ...Array(overall ? 5 : 4).fill(''), formatMoney(totals.spent)]]
      : undefined,
    columnStyles: numCols(overall ? 6 : 5),
    didParseCell: (data) => {
      // Vouchers issued beyond the available balance are shaded light red.
      if (data.section === 'body' && report.expenses[data.row.index]?.overdrawn) {
        data.cell.styles.fillColor = [253, 243, 241];
      }
    },
  });
  y = doc.lastAutoTable.finalY + 5;
  if (report.expenses.some((x) => x.overdrawn)) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Shaded rows = voucher issued for more than the balance available at that time.', 12, y);
  }
  if (report.truncated) {
    doc.setFontSize(8);
    doc.text('Note: very long period - only the first 5,000 rows are listed. Narrow the period for the full list.', 12, y + 4);
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Page ${i} of ${pages}`, w - 12, h - 7, { align: 'right' });
  }

  doc.save(`Petty_Cash_Report_${fileSlug(overall ? 'All' : who)}_${fileSlug(periodLabel)}.pdf`);
}
