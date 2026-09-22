const Contractor = require('../models/contractor.model');
const Hardware = require('../models/hardware.model');
const ConstructionPayment = require('../models/constructionPayment.model');

// Every project name that exists anywhere in the system (an estimation
// plan, a contractor payment, a hardware payment/invoice, or a general/other
// payment), deduplicated case-insensitively and sorted A-Z. Used to power
// the project dropdowns everywhere a payment or plan is recorded.
const listProjectNames = async (req, res) => {
  try {
    const [contractors, hardwareList, otherPayments] = await Promise.all([
      Contractor.find({}, 'estimationPlans.projectName payments.projectName'),
      Hardware.find({}, 'payments.projectName invoices.projectName'),
      ConstructionPayment.find({}, 'projectName'),
    ]);

    const namesByLowerCase = new Map();
    const addName = (raw) => {
      if (!raw || !raw.trim()) return;
      const trimmed = raw.trim();
      const key = trimmed.toLowerCase();
      if (!namesByLowerCase.has(key)) {
        namesByLowerCase.set(key, trimmed);
      }
    };

    contractors.forEach((c) => {
      c.estimationPlans.forEach((p) => addName(p.projectName));
      c.payments.forEach((p) => addName(p.projectName));
    });
    hardwareList.forEach((hw) => {
      hw.payments.forEach((p) => addName(p.projectName));
      (hw.invoices || []).forEach((inv) => addName(inv.projectName));
    });
    otherPayments.forEach((p) => addName(p.projectName));

    const projectNames = Array.from(namesByLowerCase.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );

    res.json({ projectNames });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Given a project name, pull together:
// - every contractor's estimation plan(s) for that project + what's actually
//   been PAID against each (pending invoices are shown but never counted
//   toward the paid total)
// - every hardware supplier's bill/payments AND raised invoices recorded for
//   that project, so a hardware invoice that has been marked "paid" shows up
//   here too, not just entries from the old bill/slip log
// so the admin can see full estimated cost vs amount actually paid, in one place.
const getProjectSummary = async (req, res) => {
  try {
    const { name } = req.params;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Project name is required' });
    }

    const search = name.trim().toLowerCase();

    const contractors = await Contractor.find({
      $or: [
        { 'estimationPlans.projectName': new RegExp(search, 'i') },
        { 'payments.projectName': new RegExp(search, 'i') },
      ],
    });

    const contractorBreakdown = contractors
      .map((c) => {
        const plans = c.estimationPlans.filter(
          (p) => p.projectName.trim().toLowerCase() === search
        );
        // Keep pending AND paid invoices here so the summary table can still
        // show a "Pending" badge for unpaid ones - only the total below is
        // restricted to what has actually been paid.
        const payments = c.payments.filter(
          (p) => p.projectName && p.projectName.trim().toLowerCase() === search
        );

        const totalEstimate = plans.reduce((sum, p) => sum + p.totalEstimate, 0);
        const totalPaid = payments
          .filter((p) => p.status === 'paid')
          .reduce((sum, p) => sum + p.amount, 0);

        return {
          contractorId: c._id,
          name: c.name,
          phone: c.phone,
          plans,
          payments,
          totalEstimate,
          totalPaid,
          remaining: totalEstimate - totalPaid,
        };
      })
      .filter((c) => c.plans.length > 0 || c.payments.length > 0);

    const hardwareList = await Hardware.find({
      $or: [
        { 'payments.projectName': new RegExp(search, 'i') },
        { 'invoices.projectName': new RegExp(search, 'i') },
      ],
    });

    const otherPaymentsList = await ConstructionPayment.find({
      projectName: new RegExp(search, 'i'),
    })
      .sort({ date: -1 })
      .then((rows) => rows.filter((p) => p.projectName.trim().toLowerCase() === search));

    const hardwareBreakdown = hardwareList
      .map((hw) => {
        // The supplier's own bill/slip log. A missing status means it's an
        // old record from before invoices existed and counts as already
        // paid (same rule the Hardware tab uses); an explicit 'pending'
        // status means it hasn't actually been paid yet, so it's excluded.
        const logPayments = hw.payments.filter(
          (p) =>
            p.projectName.trim().toLowerCase() === search &&
            p.status !== 'pending'
        );

        // Invoices raised via "+ Raise Invoice" only count once they've
        // actually been marked paid.
        const invoicePayments = (hw.invoices || [])
          .filter(
            (inv) =>
              inv.projectName &&
              inv.projectName.trim().toLowerCase() === search &&
              inv.status === 'paid'
          )
          .map((inv) => ({
            amount: inv.amount,
            date: inv.paymentDate || inv.invoiceDate,
            referenceNo: inv.referenceNo,
            billUrl: inv.billUrl,
            slipUrl: inv.slipUrl,
          }));

        const payments = [...logPayments, ...invoicePayments];
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

        return {
          hardwareId: hw._id,
          supplierName: hw.supplierName,
          phone: hw.phone,
          payments,
          totalPaid,
        };
      })
      .filter((hw) => hw.payments.length > 0)
      .sort((a, b) => b.totalPaid - a.totalPaid);

    const totalEstimate = contractorBreakdown.reduce((sum, c) => sum + c.totalEstimate, 0);
    const totalContractorPaid = contractorBreakdown.reduce((sum, c) => sum + c.totalPaid, 0);
    const totalHardwarePaid = hardwareBreakdown.reduce((sum, h) => sum + h.totalPaid, 0);
    // A missing status is legacy data from before the invoice flow existed
    // and is treated as already paid, same rule used everywhere else.
    const totalOtherPaid = otherPaymentsList
      .filter((p) => p.status !== 'pending')
      .reduce((sum, p) => sum + p.amount, 0);

    res.json({
      projectName: name,
      contractors: contractorBreakdown,
      hardware: hardwareBreakdown,
      otherPayments: otherPaymentsList,
      summary: {
        totalEstimate,
        totalContractorPaid,
        totalHardwarePaid,
        totalOtherPaid,
        totalPaidOverall: totalContractorPaid + totalHardwarePaid + totalOtherPaid,
        remaining: totalEstimate - totalContractorPaid,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getProjectSummary, listProjectNames };