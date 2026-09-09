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
    const { supplierName, phone } = req.body;
    if (!supplierName || !phone) {
      return res.status(400).json({ message: 'supplierName and phone are required' });
    }
    const hardware = await Hardware.create({ supplierName, phone });
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
    const { projectName, amount, date, referenceNo, note } = req.body;

    if (!projectName || !amount) {
      return res.status(400).json({ message: 'projectName and amount are required' });
    }

    const hardware = await Hardware.findById(id);
    if (!hardware) {
      return res.status(404).json({ message: 'Hardware supplier not found' });
    }

    const billUrl = req.files?.bill?.[0]?.path;
    const slipUrl = req.files?.slip?.[0]?.path;

    hardware.payments.push({
      projectName,
      amount,
      date: date || Date.now(),
      billUrl,
      slipUrl,
      referenceNo,
      note,
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
    const { supplierName, phone } = req.body;

    const hardware = await Hardware.findByIdAndUpdate(
      id,
      { supplierName, phone },
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
  getQuote,
};