const Hardware = require('../models/hardware.model');

const getHardware = async (req, res) => {
  try {
    const hardware = await Hardware.find().sort({ createdAt: -1 });
    res.json(hardware);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createHardware = async (req, res) => {
  try {
    const { supplierName, phone, accountNumber, bankName, bankBranch } = req.body;
    if (!supplierName || !phone) {
      return res.status(400).json({ message: 'supplierName and phone are required' });
    }
    const hardware = await Hardware.create({ supplierName, phone, accountNumber, bankName, bankBranch });
    res.status(201).json({ message: 'Hardware supplier added successfully', hardware });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const addItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, unitPrice, quantity } = req.body;

    if (!name || !unitPrice || quantity === undefined) {
      return res.status(400).json({ message: 'name, unitPrice, and quantity are required' });
    }

    const hardware = await Hardware.findById(id);
    if (!hardware) {
      return res.status(404).json({ message: 'Hardware supplier not found' });
    }

    hardware.items.push({ name, unitPrice, quantity });
    await hardware.save();

    res.json({ message: 'Item added successfully', hardware });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Full item edit: name, unitPrice, quantity - any subset of these can be sent
const updateItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { name, unitPrice, quantity } = req.body;

    const hardware = await Hardware.findById(id);
    if (!hardware) {
      return res.status(404).json({ message: 'Hardware supplier not found' });
    }

    const item = hardware.items.id(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (name !== undefined) item.name = name;
    if (unitPrice !== undefined) item.unitPrice = unitPrice;
    if (quantity !== undefined) item.quantity = quantity;

    await hardware.save();

    res.json({ message: 'Item updated successfully', hardware });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;

    const hardware = await Hardware.findById(id);
    if (!hardware) {
      return res.status(404).json({ message: 'Hardware supplier not found' });
    }

    const item = hardware.items.id(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    item.deleteOne();
    await hardware.save();

    res.json({ message: 'Item deleted successfully', hardware });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const placeOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one item with quantity is required' });
    }

    const hardware = await Hardware.findById(id);
    if (!hardware) {
      return res.status(404).json({ message: 'Hardware supplier not found' });
    }

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
      return res.status(400).json({ message: 'No valid items selected' });
    }

    hardware.orders.push({ items: orderItems, total });
    await hardware.save();

    const newOrder = hardware.orders[hardware.orders.length - 1];

    res.json({ message: 'Order placed successfully', hardware, order: newOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Record a bill received from this hardware supplier + the bank payment made
// against it, tagged with the project it was bought for.
const addPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { projectName, amount, date, referenceNo, accountNumber, bankName, bankBranch, note } = req.body;

    if (!projectName || !amount) {
      return res.status(400).json({ message: 'projectName and amount are required' });
    }
    const hardware = await Hardware.findById(id);
    if (!hardware) {
      return res.status(404).json({ message: 'Hardware supplier not found' });
    }

    const billFiles = req.files?.bills || req.files?.bill || [];
    const bills = billFiles.map((file) => ({ url: file.path, name: file.originalname }));
    const billUrl = bills[0]?.url;
    const slipUrl = req.files?.slip?.[0]?.path;

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

    res.json({ message: 'Payment added successfully', hardware });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Best-price finder: given a wishlist of { name, quantity }, work out what each
// hardware supplier would charge for the items they actually stock, and which
// items they don't have at all. Matching is by item name (case-insensitive).
const getQuote = async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required' });
    }

    const cleanedRequest = items
      .map((i) => ({ name: (i.name || '').trim(), quantity: Number(i.quantity) || 0 }))
      .filter((i) => i.name && i.quantity > 0);

    if (cleanedRequest.length === 0) {
      return res.status(400).json({ message: 'At least one valid item with quantity is required' });
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

    res.json({ requestedItems: cleanedRequest, results: usableResults });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateHardware = async (req, res) => {
  try {
    const { id } = req.params;
    const { supplierName, phone, accountNumber, bankName, bankBranch } = req.body;

    const hardware = await Hardware.findByIdAndUpdate(
      id,
      { supplierName, phone, accountNumber, bankName, bankBranch },
      { new: true, runValidators: true }
    );

    if (!hardware) {
      return res.status(404).json({ message: 'Hardware supplier not found' });
    }

    res.json({ message: 'Hardware supplier updated successfully', hardware });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteHardware = async (req, res) => {
  try {
    const { id } = req.params;
    const hardware = await Hardware.findByIdAndDelete(id);

    if (!hardware) {
      return res.status(404).json({ message: 'Hardware supplier not found' });
    }

    res.json({ message: 'Hardware supplier deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deletePayment = async (req, res) => {
  try {
    const { id, paymentId } = req.params;

    const hardware = await Hardware.findById(id);
    if (!hardware) {
      return res.status(404).json({ message: 'Hardware supplier not found' });
    }

    const payment = hardware.payments.id(paymentId);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    payment.deleteOne();
    await hardware.save();

    res.json({ message: 'Payment deleted successfully', hardware });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Confirm a recorded bill+payment (flip it from 'pending' to 'paid'). This is
// separate from the invoice flow above - it's for the direct "Record
// Payment" form, which already collects the bill and bank slip up front, so
// confirming just means finance has checked and signed off on it.
const confirmPayment = async (req, res) => {
  try {
    const { id, paymentId } = req.params;

    const hardware = await Hardware.findById(id);
    if (!hardware) {
      return res.status(404).json({ message: 'Hardware supplier not found' });
    }

    const payment = hardware.payments.id(paymentId);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    payment.status = 'paid';
    await hardware.save();

    res.json({ message: 'Payment confirmed as paid', hardware });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Generates a short, human-readable invoice number, e.g. HINV-482913-57
const generateInvoiceNo = () => {
  const timePart = Date.now().toString().slice(-6);
  const randPart = Math.floor(100 + Math.random() * 900);
  return `HINV-${timePart}-${randPart}`;
};

// STEP 1 of the invoice flow: raise an invoice against a hardware supplier
// for a project. Created with status 'pending' and only carries
// invoice-side details (amount, reason, the bill file received from the
// supplier). No payment/bank info exists yet - that only gets attached
// once finance actually pays it (see payInvoice below).
const createInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, date, reason, note, projectName } = req.body;

    if (!amount) {
      return res.status(400).json({ message: 'amount is required' });
    }
    if (!projectName || !projectName.trim()) {
      return res.status(400).json({ message: 'projectName is required' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'reason is required' });
    }

    const hardware = await Hardware.findById(id);
    if (!hardware) {
      return res.status(404).json({ message: 'Hardware supplier not found' });
    }

    const billUrl = req.files?.bill?.[0]?.path;

    hardware.invoices.push({
      invoiceNo: generateInvoiceNo(),
      amount,
      invoiceDate: date || Date.now(),
      reason,
      note,
      billUrl,
      status: 'pending',
      projectName,
    });
    await hardware.save();

    res.status(201).json({ message: 'Invoice created successfully. Send it to finance to record the payment once it is settled.', hardware });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// STEP 2 of the invoice flow: record the actual bank payment made against a
// pending invoice. This attaches the payment/bank details to the SAME
// invoice record and flips its status to 'paid'.
const payInvoice = async (req, res) => {
  try {
    const { id, invoiceId } = req.params;
    const { date, referenceNo, accountNumber, bankName, bankBranch, note } = req.body;

    const hardware = await Hardware.findById(id);
    if (!hardware) {
      return res.status(404).json({ message: 'Hardware supplier not found' });
    }

    const invoice = hardware.invoices.id(invoiceId);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ message: 'This invoice has already been paid' });
    }

    if (!referenceNo || !referenceNo.trim()) {
      return res.status(400).json({ message: 'referenceNo is required to record the payment' });
    }

    const slipUrl = req.files?.slip?.[0]?.path;

    invoice.status = 'paid';
    invoice.paymentDate = date || Date.now();
    invoice.referenceNo = referenceNo;
    invoice.accountNumber = accountNumber || hardware.accountNumber;
    invoice.bankName = bankName || hardware.bankName;
    invoice.bankBranch = bankBranch || hardware.bankBranch;
    if (slipUrl) invoice.slipUrl = slipUrl;
    invoice.paymentNote = note;

    await hardware.save();

    res.json({ message: 'Payment recorded - invoice marked as paid', hardware });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// EDIT an existing invoice — works for both pending and paid invoices.
// Lets you correct invoice-side details (amount, reason, invoice date,
// note) and, if the invoice has already been paid, also correct the
// payment-side details (reference no, bank info, payment date, note).
const updateInvoice = async (req, res) => {
  try {
    const { id, invoiceId } = req.params;
    const {
      amount, reason, date, note, projectName,
      referenceNo, accountNumber, bankName, bankBranch, paymentDate, paymentNote,
    } = req.body;

    const hardware = await Hardware.findById(id);
    if (!hardware) {
      return res.status(404).json({ message: 'Hardware supplier not found' });
    }

    const invoice = hardware.invoices.id(invoiceId);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (amount !== undefined && amount !== '') invoice.amount = amount;
    if (reason !== undefined) invoice.reason = reason;
    if (date) invoice.invoiceDate = date;
    if (note !== undefined) invoice.note = note;
    if (projectName !== undefined && projectName !== '') invoice.projectName = projectName;

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

    res.json({ message: 'Invoice updated successfully', hardware });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteInvoice = async (req, res) => {
  try {
    const { id, invoiceId } = req.params;

    const hardware = await Hardware.findById(id);
    if (!hardware) {
      return res.status(404).json({ message: 'Hardware supplier not found' });
    }

    const invoice = hardware.invoices.id(invoiceId);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    invoice.deleteOne();
    await hardware.save();

    res.json({ message: 'Invoice deleted successfully', hardware });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
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
  deletePayment,
  confirmPayment,
  getQuote,
  createInvoice,
  updateInvoice,
  payInvoice,
  deleteInvoice,
};