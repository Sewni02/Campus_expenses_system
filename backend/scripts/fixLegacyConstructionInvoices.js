// One-off script: backfills invoiceNo for legacy construction payment
// records that were created before invoiceNo/status existed, and marks
// ALL currently pending ones as paid (using whatever bank info was already
// on the record as a placeholder, since there's no real payment slip for
// this old test data). Mirrors scripts/fixLegacyInvoices.js and
// scripts/fixLegacyHardwareInvoices.js, but for the ConstructionPayment
// collection.
//
// Run once from the backend folder with:  node scripts/fixLegacyConstructionInvoices.js
require('dotenv').config();
const mongoose = require('mongoose');
const ConstructionPayment = require('../models/constructionPayment.model');

const generateInvoiceNo = () => {
  const timePart = Date.now().toString().slice(-6);
  const randPart = Math.floor(100 + Math.random() * 900);
  return `CINV-${timePart}-${randPart}`;
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const payments = await ConstructionPayment.find({});
  let updatedCount = 0;

  for (const payment of payments) {
    let changed = false;

    if (!payment.invoiceNo) {
      payment.invoiceNo = generateInvoiceNo();
      changed = true;
    }
    if (payment.status !== 'paid') {
      payment.status = 'paid';
      payment.paymentDate = payment.paymentDate || payment.date || new Date();
      payment.referenceNo = payment.referenceNo || 'LEGACY-FIX';
      changed = true;
    }

    if (changed) {
      await payment.save({ validateModifiedOnly: true });
      updatedCount += 1;
      console.log(`Updated payment: ${payment.title}`);
    }
  }

  console.log(`Done. Updated ${updatedCount} construction payment(s).`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});