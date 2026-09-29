// One-off script: backfills invoiceNo for legacy payment records that were
// created before invoiceNo existed, and marks ALL currently pending
// invoices as paid (using the contractor's own bank details as a
// placeholder, since there's no real payment slip for this old test data).
//
// Run once from the backend folder with:  node scripts/fixLegacyInvoices.js
require('dotenv').config();
const mongoose = require('mongoose');
const Contractor = require('../models/contractor.model');

const generateInvoiceNo = () => {
  const timePart = Date.now().toString().slice(-6);
  const randPart = Math.floor(100 + Math.random() * 900);
  return `INV-${timePart}-${randPart}`;
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const contractors = await Contractor.find({});
  let updatedCount = 0;

  for (const contractor of contractors) {
    let changed = false;

    contractor.payments.forEach((invoice) => {
      if (!invoice.invoiceNo) {
        invoice.invoiceNo = generateInvoiceNo();
        changed = true;
      }
      if (invoice.status !== 'paid') {
        invoice.status = 'paid';
        invoice.paymentDate = invoice.paymentDate || new Date();
        invoice.referenceNo = invoice.referenceNo || 'LEGACY-FIX';
        invoice.accountNumber = invoice.accountNumber || contractor.accountNumber || '';
        invoice.bankName = invoice.bankName || contractor.bankName || '';
        invoice.bankBranch = invoice.bankBranch || contractor.bankBranch || '';
        changed = true;
      }
    });

    if (changed) {
      await contractor.save({ validateModifiedOnly: true });
      updatedCount += 1;
      console.log(`Updated contractor: ${contractor.name}`);
    }
  }

  console.log(`Done. Updated ${updatedCount} contractor(s).`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});