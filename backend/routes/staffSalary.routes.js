const express = require('express');
const router = express.Router();
const { protect, requireApproved } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/permission.middleware');
const c = require('../controllers/staffSalary.controller');

// Staff details (NIC, mobile, salaries) are sensitive: only super admins, and users the
// super admin ticked "Manage Staff Salary (Accountant)" for in User Management, can use this.
router.use(protect, requireApproved, requirePermission('staff_salary_manage'));

// Allowance types (Skill Allowance, Performance, ATT ...) - one list shared by every employee
router.get('/allowance-types', c.getAllowanceTypes);
router.post('/allowance-types', c.addAllowanceType);

// Locations (Head Office, Kelani Hostel ...)
router.get('/locations', c.getLocations);
router.post('/locations', c.addLocation);
router.delete('/locations/:id', c.deleteLocation);

// Staff members (profile + basic salary)
router.get('/staff', c.getStaff);
router.post('/staff', c.addStaff);
router.put('/staff/:id', c.updateStaff);
router.delete('/staff/:id', c.deleteStaff);

// Monthly salaries (basic + allowances - deductions)
router.get('/salaries', c.getSalaries);
router.post('/salaries', c.createSalary);
router.put('/salaries/:id', c.updateSalary);
router.delete('/salaries/:id', c.deleteSalary);

module.exports = router;