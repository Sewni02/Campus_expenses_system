import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { monthLabel } from './pettyCash';

// PDF of the "Monthly Attendance Report" (Staff Salary -> Attendance).
//
// It takes the employees in the shape the API sends them (arrivedDays, extraDays, leaveDays, medicalLeave,
// casualLeave, noPayDays, arrivalPercentage, allowance), so the same function makes the PDF of
//   - the sheet on the screen (any month, saved or not), and
//   - the saved copy of a past month (GET /api/staff-salary/attendance/saved/:month).

const INK = [10, 31, 68];
const BLUE = [30, 86, 194];

const slug = (text) => String(text || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
const round2 = (n) => Math.round(n * 100) / 100;
const money = (v) => Number(v || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// 0 is shown as "-" so the sheet is easy to read; half days show as 25.5
const days = (n) => (n ? String(round2(n)) : '-');

export const attendanceFileName = (month, locationName) => `Attendance_${slug(locationName || 'Location')}_${month}.pdf`;

// options:
//   month         "2026-11"
//   locationName  "Head Office"
//   totalDays     total days of the month (the Arrival % is arrival days / total days)
//   employees     the rows (see above), in the order of the report
//   ranges        the allowance ranges used [{ minPercent, amount }] (any order)
//   savedAt       when the saved copy was made (ISO string / Date) - leave out for the live sheet
//   draft         true = the screen has changes that are not saved yet (a note is printed on the PDF)
export function buildAttendancePdf({ month, locationName, totalDays, employees, ranges = [], savedAt = null, draft = false }) {
  const list = employees || [];
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  const totalOf = (e) => (e.arrivedDays || 0) + (e.extraDays || 0) + (e.leaveDays || 0) + (e.medicalLeave || 0) + (e.casualLeave || 0) + (e.noPayDays || 0);
  const sum = (pick) => round2(list.reduce((t, e) => t + (pick(e) || 0), 0));

  // ----- heading -----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text('MONTHLY ATTENDANCE REPORT', w / 2, 15, { align: 'center' });
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.6);
  doc.line(12, 19, w - 12, 19);

  doc.setFontSize(10);
  doc.text(`Month: ${monthLabel(month).toUpperCase()}`, 12, 27);
  doc.setFont('helvetica', 'normal');
  doc.text(`Location: ${locationName || '-'}`, 12, 32);
  doc.text(`Total days: ${totalDays || '-'}   |   Employees: ${list.length}`, 12, 37);

  const stamp = (date) => new Date(date).toLocaleString('en-GB', { timeZone: 'Asia/Colombo' });
  doc.text(`Generated on ${stamp(new Date())}`, w - 12, 27, { align: 'right' });
  if (draft) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(179, 56, 44);
    doc.text('DRAFT - includes changes that are not saved yet', w - 12, 32, { align: 'right' });
    doc.setTextColor(...INK);
  } else if (savedAt) {
    doc.text(`Saved on ${stamp(savedAt)}`, w - 12, 32, { align: 'right' });
  }

  // ----- the report -----
  const center = (content, extra = {}) => ({ content, styles: { halign: 'center', valign: 'middle' }, ...extra });
  autoTable(doc, {
    startY: 42,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 1.8, textColor: INK, valign: 'middle' },
    headStyles: { fillColor: BLUE, textColor: 255 },
    footStyles: { fillColor: [234, 241, 252], textColor: INK, fontStyle: 'bold' },
    margin: { left: 12, right: 12 },
    head: [
      [
        center('No', { rowSpan: 2 }),
        { content: 'Name', rowSpan: 2 },
        { content: 'E.N.', rowSpan: 2 },
        center('Arrived Days', { rowSpan: 2 }),
        center('Extra Days', { rowSpan: 2 }),
        center('Leave', { colSpan: 3 }),
        center('(NO PAY)', { rowSpan: 2 }),
        center('Total', { rowSpan: 2 }),
        { content: 'Arrival %', rowSpan: 2, styles: { halign: 'right', valign: 'middle' } },
        { content: 'Allowance (Rs.)', rowSpan: 2, styles: { halign: 'right', valign: 'middle' } },
      ],
      [center('Days'), center('M'), center('C')],
    ],
    body:
      list.length > 0
        ? list.map((e, i) => [
            String(i + 1).padStart(2, '0'),
            e.name,
            e.employeeNo || '-',
            days(e.arrivedDays),
            days(e.extraDays),
            days(e.leaveDays),
            days(e.medicalLeave),
            days(e.casualLeave),
            days(e.noPayDays),
            String(round2(totalOf(e))),
            `${round2(e.arrivalPercentage || 0)}%`,
            money(e.allowance),
          ])
        : [[{ content: 'No employees on this report.', colSpan: 12, styles: { halign: 'center', textColor: 120 } }]],
    foot:
      list.length > 0
        ? [[
            { content: `Total (${list.length} employee${list.length === 1 ? '' : 's'})`, colSpan: 3 },
            days(sum((e) => e.arrivedDays)),
            days(sum((e) => e.extraDays)),
            days(sum((e) => e.leaveDays)),
            days(sum((e) => e.medicalLeave)),
            days(sum((e) => e.casualLeave)),
            days(sum((e) => e.noPayDays)),
            String(sum(totalOf)),
            '',
            money(sum((e) => e.allowance)),
          ]]
        : undefined,
    columnStyles: {
      0: { halign: 'center', cellWidth: 11 },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'center' },
      7: { halign: 'center' },
      8: { halign: 'center' },
      9: { halign: 'center', fontStyle: 'bold' },
      10: { halign: 'right' },
      11: { halign: 'right', fontStyle: 'bold' },
    },
    // header / total cells follow the column's alignment too
    didParseCell: (data) => {
      if (data.section === 'foot') {
        const col = data.column.index;
        if (col >= 3 && col <= 9) data.cell.styles.halign = 'center';
        if (col >= 10) data.cell.styles.halign = 'right';
      }
    },
  });

  let y = doc.lastAutoTable.finalY + 8;

  // ----- allowance ranges that were used -----
  const sorted = [...ranges].sort((a, b) => b.minPercent - a.minPercent);
  if (sorted.length > 0) {
    if (y > h - 55) {
      doc.addPage();
      y = 16;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text('Arrival allowance ranges used', 12, y);
    autoTable(doc, {
      startY: y + 2,
      theme: 'grid',
      tableWidth: 110,
      styles: { fontSize: 8.5, cellPadding: 1.6, textColor: INK },
      headStyles: { fillColor: BLUE, textColor: 255 },
      margin: { left: 12, right: 12 },
      head: [['From (%)', 'Up to', 'Allowance (Rs.)']],
      body: sorted.map((r, i) => [`${r.minPercent}%`, i === 0 ? '100% (and above)' : `below ${sorted[i - 1].minPercent}%`, money(r.amount)]),
      columnStyles: { 2: { halign: 'right' } },
      didParseCell: (data) => {
        if (data.section === 'head' && data.column.index === 2) data.cell.styles.halign = 'right';
      },
    });
    y = doc.lastAutoTable.finalY + 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Below ${sorted[sorted.length - 1].minPercent}%: no arrival allowance.  Arrival % = (Arrived + Extra days) / Total days x 100.`, 12, y + 2);
    y += 8;
  }

  // ----- signatures -----
  if (y > h - 30) {
    doc.addPage();
    y = 20;
  }
  const sigY = y + 12;
  doc.setLineWidth(0.3);
  doc.setDrawColor(...INK);
  const colW = (w - 24) / 3;
  ['Prepared by (Accountant)', 'Checked by', 'Approved by (Super Admin)'].forEach((label, i) => {
    const x = 12 + i * colW;
    doc.line(x, sigY, x + colW - 10, sigY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(label, x, sigY + 5);
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Page ${i} of ${pages}`, w - 12, h - 7, { align: 'right' });
  }

  return doc;
}

export function downloadAttendancePdf(options) {
  buildAttendancePdf(options).save(attendanceFileName(options.month, options.locationName));
}