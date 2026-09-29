// One-off script: backfills invoiceNo for legacy hardware invoice records
// that were created before invoiceNo existed, and marks ALL currently
// pending hardware invoices as paid (using the supplier's own bank details
// as a placeholder, since there's no real payment slip for this old test
// data). Mirrors scripts/fixLegacyInvoices.js, but for the Hardware model's
// `invoices` array instead of the Contractor model's `payments` array.
//
// Run once from the backend folder with:  node scripts/fixLegacyHardwareInvoices.js
require('dotenv').config();
const mongoose = require('mongoose');
const Hardware = require('../models/hardware.model');

const generateInvoiceNo = () => {
  const timePart = Date.now().toString().slice(-6);
  const randPart = Math.floor(100 + Math.random() * 900);
  return `HINV-${timePart}-${randPart}`;
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const hardwareSuppliers = await Hardware.find({});
  let updatedCount = 0;

  for (const hardware of hardwareSuppliers) {
    let changed = false;

    (hardware.invoices || []).forEach((invoice) => {
      if (!invoice.invoiceNo) {
        invoice.invoiceNo = generateInvoiceNo();
        changed = true;
      }
      if (invoice.status !== 'paid') {
        invoice.status = 'paid';
        invoice.paymentDate = invoice.paymentDate || new Date();
        invoice.referenceNo = invoice.referenceNo || 'LEGACY-FIX';
        invoice.accountNumber = invoice.accountNumber || hardware.accountNumber || '';
        invoice.bankName = invoice.bankName || hardware.bankName || '';
        invoice.bankBranch = invoice.bankBranch || hardware.bankBranch || '';
        changed = true;
      }
    });

    if (changed) {
      await hardware.save({ validateModifiedOnly: true });
      updatedCount += 1;
      console.log(`Updated hardware supplier: ${hardware.supplierName}`);
    }
  }

  console.log(`Done. Updated ${updatedCount} hardware supplier(s).`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});