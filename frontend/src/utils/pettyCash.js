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