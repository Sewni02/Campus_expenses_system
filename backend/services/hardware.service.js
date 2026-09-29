const Hardware = require('../models/hardware.model');
const { ApiError, findOrFail } = require('../utils/ApiError');

// Generates a short, human-readable invoice number, e.g. HINV-482913-57
const generateInvoiceNo = () => {
  const timePart = Date.now().toString().slice(-6);
  const randPart = Math.floor(100 + Math.random() * 900);
  return `HINV-${timePart}-${randPart}`;
};

const getHardware = async () => {
  return Hardware.find().sort({ createdAt: -1 });
};

const createHardware = async ({ supplierName, phone, accountNumber, bankName, bankBranch }) => {
  if (!supplierName || !phone) {
    throw new ApiError(400, 'supplierName and phone are required');
  }
  const hardware = await Hardware.create({ supplierName, phone, accountNumber, bankName, bankBranch });
  return { message: 'Hardware supplier added successfully', hardware };
};

const updateHardware = async (id, { supplierName, phone, accountNumber, bankName, bankBranch }) => {
  const hardware = await Hardware.findByIdAndUpdate(
    id,
    { supplierName, phone, accountNumber, bankName, bankBranch },
    { new: true, runValidators: true }
  );

  if (!hardware) throw new ApiError(404, 'Hardware supplier not found');

  return { message: 'Hardware supplier updated successfully', hardware };
};

const deleteHardware = async (id) => {
  const hardware = await Hardware.findByIdAndDelete(id);
  if (!hardware) throw new ApiError(404, 'Hardware supplier not found');
  return { message: 'Hardware supplier deleted successfully' };
};

const addItem = async (id, { name, unitPrice, quantity }) => {
  if (!name || !unitPrice || quantity === undefined) {
    throw new ApiError(400, 'name, unitPrice, and quantity are required');
  }

  const hardware = await findOrFail(Hardware, id, 'Hardware supplier not found');

  hardware.items.push({ name, unitPrice, quantity });
  await hardware.save();

  return { message: 'Item added successfully', hardware };
};

// Full item edit: name, unitPrice, quantity - any subset of these can be sent
const updateItem = async (id, itemId, { name, unitPrice, quantity }) => {
  const hardware = await findOrFail(Hardware, id, 'Hardware supplier not found');

  const item = hardware.items.id(itemId);
  if (!item) throw new ApiError(404, 'Item not found');

  if (name !== undefined) item.name = name;
  if (unitPrice !== undefined) item.unitPrice = unitPrice;
  if (quantity !== undefined) item.quantity = quantity;

  await hardware.save();

  return { message: 'Item updated successfully', hardware };
};

const deleteItem = async (id, itemId) => {
  const hardware = await findOrFail(Hardware, id, 'Hardware supplier not found');

  const item = hardware.items.id(itemId);
  if (!item) throw new ApiError(404, 'Item not found');

  item.deleteOne();
  await hardware.save();

  return { message: 'Item deleted successfully', hardware };
};

const placeOrder = async (id, { items }) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'At least one item with quantity is required');
  }

  const hardware = await findOrFail(Hardware, id, 'Hardware supplier not found');

  const orderItems = [];
  let total = 0;

  for (const orderedItem of items) {
    const item = hardware.items.id(orderedItem.itemId);
    if (!item) continue;

    const qty = Number(orderedItem.quantity) || 0;
    if (qty <= 0) continue;

    item.quantity += qty;
    const lineTotal = item.unitPrice * qty;
    total += lineTotal;

    orderItems.push({
      itemId: item._id,
      name: item.name,
      unitPrice: item.unitPrice,
      quantity: qty,
    });
  }

  if (orderItems.length === 0) {
    throw new ApiError(400, 'No valid items selected');
  }

  hardware.orders.push({ items: orderItems, total });
  await hardware.save();

  const newOrder = hardware.orders[hardware.orders.length - 1];

  return { message: 'Order placed successfully', hardware, order: newOrder };
};

// Record a bill received from this hardware supplier + the bank payment made
// against it, tagged with the project it was bought for.
const addPayment = async (id, { projectName, amount, date, referenceNo, accountNumber, bankName, bankBranch, note }, files) => {
  if (!projectName || !amount) {
    throw new ApiError(400, 'projectName and amount are required');
  }
  const hardware = await findOrFail(Hardware, id, 'Hardware supplier not found');

  const billFiles = files?.bills || files?.bill || [];
  const bills = billFiles.map((file) => ({ url: file.path, name: file.originalname }));
  const billUrl = bills[0]?.url;
  const slipUrl = files?.slip?.[0]?.path;

  hardware.payments.push({
    projectName,
    amount,
    date: date || Date.now(),
    bills,
    billUrl,
    slipUrl,
    referenceNo,
    accountNumber: accountNumber || hardware.accountNumber,
    bankName: bankName || hardware.bankName,
    bankBranch: bankBranch || hardware.bankBranch,
    note,
    status: 'pending',
  });
  await hardware.save();

  return { message: 'Payment added successfully', hardware };
};

// Best-price finder: given a wishlist of { name, quantity }, work out what each
// hardware supplier would charge for the items they actually stock, and which
// items they don't have at all. Matching is by item name (case-insensitive).
const getQuote = async ({ items }) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'At least one item is required');
  }

  const cleanedRequest = items
    .map((i) => ({ name: (i.name || '').trim(), quantity: Number(i.quantity) || 0 }))
    .filter((i) => i.name && i.quantity > 0);

  if (cleanedRequest.length === 0) {
    throw new ApiError(400, 'At least one valid item with quantity is required');
  }

  const hardwareList = await Hardware.find();

  const results = hardwareList.map((hw) => {
    const matchedItems = [];
    const missingItems = [];
    let total = 0;

    cleanedRequest.forEach((requested) => {
      const found = hw.items.find(
        (i) => i.name.trim().toLowerCase() === requested.name.toLowerCase()
      );

      if (found) {
        const lineTotal = found.unitPrice * requested.quantity;
        total += lineTotal;
        matchedItems.push({
          name: found.name,
          unitPrice: found.unitPrice,
          requestedQuantity: requested.quantity,
          lineTotal,
        });
      } else {
        missingItems.push(requested.name);
      }
    });

    return {
      hardwareId: hw._id,
      supplierName: hw.supplierName,
      phone: hw.phone,
      matchedItems,
      missingItems,
      total,
      fullyAvailable: missingItems.length === 0,
    };
  });

  // Only show suppliers that can provide at least one of the requested items,
  // cheapest total first.
  const usableResults = results
    .filter((r) => r.matchedItems.length > 0)
    .sort((a, b) => a.total - b.total);

  return { requestedItems: cleanedRequest, results: usableResults };
};

// Edit an existing direct bill+payment record (the "+ Record Payment" flow).
// Works whether it's still pending or already confirmed as paid.
const updatePayment = async (id, paymentId, { projectName, amount, date, referenceNo, accountNumber, bankName, bankBranch, note }, files) => {
  const hardware = await findOrFail(Hardware, id, 'Hardware supplier not found');

  const payment = hardware.payments.id(paymentId);
  if (!payment) throw new ApiError(404, 'Payment not found');

  if (projectName !== undefined) payment.projectName = projectName;
  if (amount !== undefined && amount !== '') payment.amount = amount;
  if (date) payment.date = date;
  if (referenceNo !== undefined) payment.referenceNo = referenceNo;
  if (accountNumber !== undefined) payment.accountNumber = accountNumber;
  if (bankName !== undefined) payment.bankName = bankName;
  if (bankBranch !== undefined) payment.bankBranch = bankBranch;
  if (note !== undefined) payment.note = note;

  const billFiles = files?.bills || files?.bill || [];
  if (billFiles.length > 0) {
    const bills = billFiles.map((file) => ({ url: file.path, name: file.originalname }));
    payment.bills = bills;
    payment.billUrl = bills[0]?.url;
  }
  const slipUrl = files?.slip?.[0]?.path;
  if (slipUrl) payment.slipUrl = slipUrl;

  await hardware.save({ validateModifiedOnly: true });

  return { message: 'Payment updated successfully', hardware };
};

const deletePayment = async (id, paymentId) => {
  const hardware = await findOrFail(Hardware, id, 'Hardware supplier not found');

  const payment = hardware.payments.id(paymentId);
  if (!payment) throw new ApiError(404, 'Payment not found');

  payment.deleteOne();
  await hardware.save();

  return { message: 'Payment deleted successfully', hardware };
};

// Confirm a recorded bill+payment (flip it from 'pending' to 'paid'). This is
// separate from the invoice flow above - it's for the direct "Record
// Payment" form, which already collects the bill and bank slip up front, so
// confirming just means finance has checked and signed off on it.
const confirmPayment = async (id, paymentId) => {
  const hardware = await findOrFail(Hardware, id, 'Hardware supplier not found');

  const payment = hardware.payments.id(paymentId);
  if (!payment) throw new ApiError(404, 'Payment not found');

  payment.status = 'paid';
  await hardware.save();

  return { message: 'Payment confirmed as paid', hardware };
};

// STEP 1 of the invoice flow: raise an invoice against a hardware supplier
// for a project. Created with status 'pending' and only carries
// invoice-side details (amount, reason, the bill file received from the
// supplier). No payment/bank info exists yet - that only gets attached
// once finance actually pays it (see payInvoice below).
const createInvoice = async (id, { amount, date, reason, note, projectName }, files) => {
  if (!amount) throw new ApiError(400, 'amount is required');
  if (!projectName || !projectName.trim()) throw new ApiError(400, 'projectName is required');
  if (!reason || !reason.trim()) throw new ApiError(400, 'reason is required');

  const hardware = await findOrFail(Hardware, id, 'Hardware supplier not found');

  const billFiles = files?.bills || files?.bill || [];
  const bills = billFiles.map((file) => ({ url: file.path, name: file.originalname }));
  const billUrl = bills[0]?.url;

  hardware.invoices.push({
    invoiceNo: generateInvoiceNo(),
    amount,
    invoiceDate: date || Date.now(),
    reason,
    note,
    bills,
    billUrl,
    status: 'pending',
    projectName,
  });
  await hardware.save();

  return {
    message: 'Invoice created successfully. Send it to finance to record the payment once it is settled.',
    hardware,
  };
};

// STEP 2 of the invoice flow: record the actual bank payment made against a
// pending invoice. This attaches the payment/bank details to the SAME
// invoice record and flips its status to 'paid'.
const payInvoice = async (id, invoiceId, { date, referenceNo, accountNumber, bankName, bankBranch, note }, files) => {
  const hardware = await findOrFail(Hardware, id, 'Hardware supplier not found');

  const invoice = hardware.invoices.id(invoiceId);
  if (!invoice) throw new ApiError(404, 'Invoice not found');

  if (invoice.status === 'paid') {
    throw new ApiError(400, 'This invoice has already been paid');
  }

  if (!referenceNo || !referenceNo.trim()) {
    throw new ApiError(400, 'referenceNo is required to record the payment');
  }

  const slipUrl = files?.slip?.[0]?.path;

  invoice.status = 'paid';
  invoice.paymentDate = date || Date.now();
  invoice.referenceNo = referenceNo;
  invoice.accountNumber = accountNumber || hardware.accountNumber;
  invoice.bankName = bankName || hardware.bankName;
  invoice.bankBranch = bankBranch || hardware.bankBranch;
  if (slipUrl) invoice.slipUrl = slipUrl;
  invoice.paymentNote = note;

  await hardware.save();

  return { message: 'Payment recorded - invoice marked as paid', hardware };
};

// EDIT an existing invoice — works for both pending and paid invoices.
// Lets you correct invoice-side details (amount, reason, invoice date,
// note) and, if the invoice has already been paid, also correct the
// payment-side details (reference no, bank info, payment date, note).
const updateInvoice = async (id, invoiceId, body, files) => {
  const {
    amount, reason, date, note, projectName,
    referenceNo, accountNumber, bankName, bankBranch, paymentDate, paymentNote,
  } = body;

  const hardware = await findOrFail(Hardware, id, 'Hardware supplier not found');

  const invoice = hardware.invoices.id(invoiceId);
  if (!invoice) throw new ApiError(404, 'Invoice not found');

  if (amount !== undefined && amount !== '') invoice.amount = amount;
  if (reason !== undefined) invoice.reason = reason;
  if (date) invoice.invoiceDate = date;
  if (note !== undefined) invoice.note = note;
  if (projectName !== undefined && projectName !== '') invoice.projectName = projectName;

  const billFiles = files?.bills || files?.bill || [];
  if (billFiles.length > 0) {
    const bills = billFiles.map((file) => ({ url: file.path, name: file.originalname }));
    invoice.bills = bills;
    invoice.billUrl = bills[0]?.url;
  }

  if (invoice.status === 'paid') {
    if (referenceNo !== undefined) invoice.referenceNo = referenceNo;
    if (accountNumber !== undefined) invoice.accountNumber = accountNumber;
    if (bankName !== undefined) invoice.bankName = bankName;
    if (bankBranch !== undefined) invoice.bankBranch = bankBranch;
    if (paymentDate) invoice.paymentDate = paymentDate;
    if (paymentNote !== undefined) invoice.paymentNote = paymentNote;
  }

  if (!invoice.invoiceNo) {
    invoice.invoiceNo = generateInvoiceNo();
  }

  await hardware.save({ validateModifiedOnly: true });

  return { message: 'Invoice updated successfully', hardware };
};

const deleteInvoice = async (id, invoiceId) => {
  const hardware = await findOrFail(Hardware, id, 'Hardware supplier not found');

  const invoice = hardware.invoices.id(invoiceId);
  if (!invoice) throw new ApiError(404, 'Invoice not found');

  invoice.deleteOne();
  await hardware.save();

  return { message: 'Invoice deleted successfully', hardware };
};

module.exports = {
  getHardware,
  createHardware,
  updateHardware,
  deleteHardware,
  addItem,
  updateItem,
  deleteItem,
  placeOrder,
  addPayment,
  updatePayment,
  deletePayment,
  confirmPayment,
  getQuote,
  createInvoice,
  updateInvoice,
  payInvoice,
  deleteInvoice,
};