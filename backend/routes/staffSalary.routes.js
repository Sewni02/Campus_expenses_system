const express = require('express');
const router = express.Router();
const { protect, requireApproved, requireRole } = require('../middleware/auth.middleware');
const c = require('../controllers/staffSalary.controller');

// Staff details (NIC, mobile, salaries) are sensitive, so this whole section is
// super admin only. (To let an accountant use it later, add a permission key the
// same way "lecturer_salary_manage" is done and swap requireRole for requirePermission.)
router.use(protect, requireApproved, requireRole('super_admin'));

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