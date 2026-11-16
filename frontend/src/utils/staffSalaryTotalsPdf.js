import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { monthLabel } from './pettyCash';

// PDF of the "Month Totals" tab (Staff Salary): the total net salary of one month.
//
//   All locations  -> the 4 totals + a table with the total of EVERY location and the grand total.
//   One location   -> the 4 totals of that location + the net salary of each of its employees.
//
// It takes the numbers exactly as the page shows them (GET /api/staff-salary/salaries/totals and
// /api/staff-salary/salaries), so the PDF always matches the screen.

const INK = [10, 31, 68];
const BLUE = [30, 86, 194];
const GREEN = [47, 125, 87];
const RED = [179, 56, 44];

const slug = (text) => String(text || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
const money = (v) => Number(v || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rs = (v) => `Rs. ${money(v)}`;

export const salaryTotalsFileName = (month, locationName) => `Salary_Totals_${month}_${slug(locationName || 'All_locations')}.pdf`;

// options:
//   month         "2026-11"
//   locationName  "Head Office"; leave out / null for all locations
//   summary       { count, totalBasic, totalAllowances, totalDeductions, totalGross, totalNet } of what is shown
//   locations     the rows of the location table (all locations, in the order of the page) - used for "all locations"
//   employees     the salary records of the picked location (staffName, employeeNo, basicSalary, totalAllowances,
//                 totalDeductions, netSalary) - used for one location
export function buildSalaryTotalsPdf({ month, locationName = null, summary, locations = [], employees = [] }) {
  const single = Boolean(locationName);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // ----- heading -----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text('MONTHLY SALARY TOTALS', w / 2, 15, { align: 'center' });
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.6);
  doc.line(12, 19, w - 12, 19);

  doc.setFontSize(10);
  doc.text(`Month: ${monthLabel(month).toUpperCase()}`, 12, 27);
  doc.setFont('helvetica', 'normal');
  doc.text(`Location: ${single ? locationName : 'All locations'}`, 12, 32);
  doc.text(`Generated on ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })}`, w - 12, 27, { align: 'right' });

  // ----- the 4 totals -----
  const boxes = [
    ['TOTAL NET SALARY', rs(summary.totalNet), GREEN],
    ['EMPLOYEES PAID', String(summary.count), INK],
    ['GROSS SALARY', rs(summary.totalGross), INK],
    ['TOTAL DEDUCTIONS', rs(summary.totalDeductions), RED],
  ];
  const gap = 5;
  const boxW = (w - 24 - gap * 3) / 4;
  boxes.forEach(([label, value, color], i) => {
    const x = 12 + i * (boxW + gap);
    doc.setDrawColor(220, 230, 244);
    doc.setFillColor(244, 248, 253);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, 38, boxW, 20, 1.5, 1.5, 'FD');
    doc.setFillColor(...color);
    doc.rect(x, 38, 1.4, 20, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(74, 98, 136);
    doc.text(label, x + 5, 45);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(i === 0 ? 14 : 12);
    doc.setTextColor(...color);
    doc.text(value, x + 5, 53);
  });
  doc.setTextColor(...INK);

  const tableBase = {
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2, textColor: INK },
    headStyles: { fillColor: BLUE, textColor: 255 },
    footStyles: { fillColor: [234, 241, 252], textColor: INK, fontStyle: 'bold' },
    margin: { left: 12, right: 12 },
  };
  // numbers are right-aligned, in the header and the total row too
  const alignNumbers = (firstNumberColumn) => (data) => {
    if ((data.section === 'head' || data.section === 'foot') && data.column.index >= firstNumberColumn) data.cell.styles.halign = 'right';
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(single ? `Employees - ${locationName}` : 'Net salary by location', 12, 66);

  if (single) {
    // ----- one location: its employees -----
    const rows = [...employees].sort(
      (a, b) =>
        String(a.employeeNo || '').localeCompare(String(b.employeeNo || ''), undefined, { numeric: true }) ||
        (a.staffName || '').localeCompare(b.staffName || '')
    );
    autoTable(doc, {
      ...tableBase,
      startY: 69,
      head: [['No', 'Employee', 'Basic (Rs.)', 'Allowances (Rs.)', 'Deductions (Rs.)', 'Net salary (Rs.)']],
      body:
        rows.length > 0
          ? rows.map((r, i) => [
              String(i + 1).padStart(2, '0'),
              `${r.employeeNo ? `${r.employeeNo} - ` : ''}${r.staffName}`,
              money(r.basicSalary),
              money(r.totalAllowances),
              money(r.totalDeductions),
              money(r.netSalary),
            ])
          : [[{ content: `No salaries saved for ${locationName} in ${monthLabel(month)}.`, colSpan: 6, styles: { halign: 'center', textColor: 120 } }]],
      foot:
        rows.length > 0
          ? [[
              { content: `Total (${rows.length} employee${rows.length === 1 ? '' : 's'})`, colSpan: 2 },
              money(summary.totalBasic),
              money(summary.totalAllowances),
              money(summary.totalDeductions),
              money(summary.totalNet),
            ]]
          : undefined,
      columnStyles: { 0: { halign: 'center', cellWidth: 14 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: alignNumbers(2),
    });
  } else {
    // ----- all locations: one row per location + the grand total -----
    autoTable(doc, {
      ...tableBase,
      startY: 69,
      head: [['Location', 'Employees', 'Basic (Rs.)', 'Allowances (Rs.)', 'Deductions (Rs.)', 'Gross (Rs.)', 'Net salary (Rs.)']],
      body:
        locations.length > 0
          ? locations.map((l) => [l.name, String(l.count), money(l.totalBasic), money(l.totalAllowances), money(l.totalDeductions), money(l.totalGross), money(l.totalNet)])
          : [[{ content: 'No locations.', colSpan: 7, styles: { halign: 'center', textColor: 120 } }]],
      foot:
        locations.length > 0
          ? [[
              'Total - all locations',
              String(summary.count),
              money(summary.totalBasic),
              money(summary.totalAllowances),
              money(summary.totalDeductions),
              money(summary.totalGross),
              money(summary.totalNet),
            ]]
          : undefined,
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: alignNumbers(1),
    });
  }

  // ----- signatures -----
  let y = doc.lastAutoTable.finalY + 8;
  if (y > h - 30) {
    doc.addPage();
    y = 20;
  }
  const sigY = y + 14;
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

export function downloadSalaryTotalsPdf(options) {
  buildSalaryTotalsPdf(options).save(salaryTotalsFileName(options.month, options.locationName));
}