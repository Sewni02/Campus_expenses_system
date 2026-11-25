import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { monthLabel } from './pettyCash';

// Downloads of a saved Staff Salary month: a PDF salary sheet and an Excel-friendly CSV.
// Both take the salary records exactly as /api/staff-salary/salaries sends them.

const INK = [10, 31, 68];
const BLUE = [30, 86, 194];

const slug = (text) => String(text || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
const round2 = (n) => Math.round(n * 100) / 100;
// numbers only (the column headers say "Rs.") so the tables stay narrow
const money = (v) => Number(v || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// By location, then employee number (E2 before E10), then name.
const sortRecords = (records) =>
  [...records].sort(
    (a, b) =>
      (a.locationName || '').localeCompare(b.locationName || '') ||
      String(a.employeeNo || '').localeCompare(String(b.employeeNo || ''), undefined, { numeric: true }) ||
      (a.staffName || '').localeCompare(b.staffName || '')
  );

const sumOf = (records, key) => round2(records.reduce((total, r) => total + (r[key] || 0), 0));

// The allowance / deduction names used in these records (amount above 0), in the order they first appear.
const namesOf = (records, field) => {
  const names = [];
  records.forEach((r) =>
    (r[field] || []).forEach((line) => {
      if (line.amount > 0 && !names.includes(line.name)) names.push(line.name);
    })
  );
  return names;
};
const amountOf = (record, field, name) => {
  const line = (record[field] || []).find((l) => l.name === name);
  return line ? line.amount : 0;
};

const fileName = (month, locationName, extension) =>
  `Staff_Salary_${month}_${slug(locationName || 'All_locations')}.${extension}`;

// ---------------------------------------------------------------------------
// PDF salary sheet
// ---------------------------------------------------------------------------
export function downloadSalarySheetPdf({ month, records, locationName }) {
  const list = sortRecords(records);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  const tableBase = {
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.8, textColor: INK },
    headStyles: { fillColor: BLUE, textColor: 255 },
    footStyles: { fillColor: [234, 241, 252], textColor: INK, fontStyle: 'bold' },
    margin: { left: 12, right: 12 },
  };
  let y = 40;
  // Numbers on the right, in the header and the total row too.
  const draw = (opts) =>
    autoTable(doc, {
      ...tableBase,
      startY: y,
      ...opts,
      didParseCell: (data) => {
        const col = opts.columnStyles?.[data.column.index];
        if (data.section !== 'body' && col?.halign) data.cell.styles.halign = col.halign;
      },
    });
  const heading = (text) => {
    if (y > h - 35) {
      doc.addPage();
      y = 16;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(text, 12, y);
    y += 3;
  };
  const afterTable = () => {
    y = doc.lastAutoTable.finalY + 9;
  };
  const rightCols = (from, to) => Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [from + i, { halign: 'right' }]));

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text('STAFF SALARY SHEET', w / 2, 15, { align: 'center' });
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.6);
  doc.line(12, 19, w - 12, 19);

  doc.setFontSize(10);
  doc.text(`Month: ${monthLabel(month)}`, 12, 27);
  doc.setFont('helvetica', 'normal');
  doc.text(`Location: ${locationName || 'All locations'}`, 12, 32);
  doc.text(`Employees: ${list.length}`, 12, 37);
  doc.text(`Generated on ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })}`, w - 12, 27, { align: 'right' });

  // 1. Summary: one row per employee
  heading('Salary summary');
  draw({
    head: [['No', 'E.N.', 'Name', 'NIC', 'Location', 'Basic (Rs.)', 'Allowances (Rs.)', 'Gross (Rs.)', 'Deductions (Rs.)', 'Net salary (Rs.)']],
    body: list.map((r, i) => [
      String(i + 1).padStart(2, '0'),
      r.employeeNo || '-',
      r.staffName,
      r.nic || '-',
      r.locationName,
      money(r.basicSalary),
      money(r.totalAllowances),
      money(r.grossSalary),
      money(r.totalDeductions),
      money(r.netSalary),
    ]),
    foot: [['', '', `Total (${list.length})`, '', '', money(sumOf(list, 'basicSalary')), money(sumOf(list, 'totalAllowances')), money(sumOf(list, 'grossSalary')), money(sumOf(list, 'totalDeductions')), money(sumOf(list, 'netSalary'))]],
    columnStyles: rightCols(5, 9),
  });
  afterTable();

  // 2. + 3. Allowance and deduction breakdown (only the items that were used)
  [
    ['allowances', 'Allowances breakdown', 'totalAllowances'],
    ['deductions', 'Deductions breakdown', 'totalDeductions'],
  ].forEach(([field, title, totalKey]) => {
    const names = namesOf(list, field);
    if (names.length === 0) return;
    heading(title);
    draw({
      head: [['No', 'E.N.', 'Name', ...names.map((n) => `${n} (Rs.)`), 'Total (Rs.)']],
      body: list.map((r, i) => [
        String(i + 1).padStart(2, '0'),
        r.employeeNo || '-',
        r.staffName,
        ...names.map((n) => {
          const amount = amountOf(r, field, n);
          return amount > 0 ? money(amount) : '-';
        }),
        money(r[totalKey]),
      ]),
      foot: [['', '', 'Total', ...names.map((n) => money(round2(list.reduce((t, r) => t + amountOf(r, field, n), 0)))), money(sumOf(list, totalKey))]],
      columnStyles: rightCols(3, 3 + names.length),
    });
    afterTable();
  });

  // Signatures
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

  doc.save(fileName(month, locationName, 'pdf'));
}

// ---------------------------------------------------------------------------
// CSV (opens in Excel): one row per employee, one column per allowance / deduction
// ---------------------------------------------------------------------------
const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
// Written as ="200281604012" so Excel keeps the NIC / employee number as text (no 2.0E+11, no lost zeros).
const textCell = (value) => (value ? `="${String(value).replace(/"/g, '')}"` : '');

export function downloadSalarySheetCsv({ month, records, locationName }) {
  const list = sortRecords(records);
  const allowanceNames = namesOf(list, 'allowances');
  const deductionNames = namesOf(list, 'deductions');

  const head = ['No', 'Employee no', 'Name', 'NIC', 'Location', 'Basic salary', ...allowanceNames, 'Total allowances', 'Gross salary', ...deductionNames, 'Total deductions', 'Net salary', 'Note'];
  const rows = list.map((r, i) => [
    i + 1,
    textCell(r.employeeNo),
    r.staffName,
    textCell(r.nic),
    r.locationName,
    r.basicSalary,
    ...allowanceNames.map((n) => amountOf(r, 'allowances', n)),
    r.totalAllowances,
    r.grossSalary,
    ...deductionNames.map((n) => amountOf(r, 'deductions', n)),
    r.totalDeductions,
    r.netSalary,
    r.note || '',
  ]);
  const totals = [
    '',
    '',
    `Total (${list.length})`,
    '',
    '',
    sumOf(list, 'basicSalary'),
    ...allowanceNames.map((n) => round2(list.reduce((t, r) => t + amountOf(r, 'allowances', n), 0))),
    sumOf(list, 'totalAllowances'),
    sumOf(list, 'grossSalary'),
    ...deductionNames.map((n) => round2(list.reduce((t, r) => t + amountOf(r, 'deductions', n), 0))),
    sumOf(list, 'totalDeductions'),
    sumOf(list, 'netSalary'),
    '',
  ];

  const csv = [head, ...rows, totals].map((row) => row.map(csvCell).join(',')).join('\r\n');
  // The BOM makes Excel read Sinhala / Tamil names correctly.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName(month, locationName, 'csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 10000);
}