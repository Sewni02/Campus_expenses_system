const express = require('express');
const router = express.Router();
const { protect, requireApproved, requireRole } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/permission.middleware');
const c = require('../controllers/lecturerSalary.controller');
const upload = require('../middleware/upload');

router.use(protect, requireApproved);

// Accountant = a user with the "Manage Lecturer Salary" permission (super admins always pass).
// They add lecturers (+ bank details), enter salaries and submit them for verification.
const staff = requirePermission('lecturer_salary_manage');
// Only the super admin creates batches / changes the formula, and verifies + pays salaries
// (the verify / return / pay / unpay rule is enforced inside the service).
const superAdminOnly = requireRole('super_admin');

// Formulas: everyone with access can pick one, only the super admin writes them
router.get('/formulas', staff, c.getFormulas);
router.post('/formulas', superAdminOnly, c.createFormula);
router.put('/formulas/:id', superAdminOnly, c.updateFormula);
router.delete('/formulas/:id', superAdminOnly, c.deleteFormula);

// Courses (Management, Art, Law ...): everyone with access can read, only the super admin changes them
router.get('/courses', staff, c.getCourses);
router.post('/courses', superAdminOnly, c.createCourse);
router.put('/courses/:id', superAdminOnly, c.renameCourse);
router.delete('/courses/:id', superAdminOnly, c.deleteCourse);

// Every distinct lecturer over all batches (name suggestions when adding a lecturer)
router.get('/people', staff, c.getPeople);

// Payment slip: ONE bank slip per degree and month (upload / replace / remove = super admin, viewing = staff)
router.get('/slips', staff, c.getSlips);
router.post('/slips', superAdminOnly, upload.single('slip'), c.uploadSlip);
router.get('/slips/:id/file', staff, c.streamSlip);
router.delete('/slips/:id', superAdminOnly, c.deleteSlip);

// Payments: what each lecturer is owed in a month (all batches added together), and paying it in ONE payment
router.get('/payments', staff, c.getPayments);
router.post('/payments', superAdminOnly, c.payLecturer);

// Batches (Management / Art  ->  2023, 2024, 2025 ...)
router.get('/batches', staff, c.getBatches);
router.post('/batches', superAdminOnly, c.createBatch);
router.get('/batches/:id', staff, c.getBatch);
router.get('/batches/:id/summary', staff, c.getBatchSummary);
router.patch('/batches/:id/settings', superAdminOnly, c.updateBatchSettings);
router.delete('/batches/:id', superAdminOnly, c.deleteBatch);

// Lecturers inside a batch (bank details are part of the lecturer, so PUT also changes them)
router.post('/batches/:id/lecturers', staff, c.addLecturer);
router.put('/batches/:id/lecturers/:lecturerId', staff, c.updateLecturer);
router.delete('/batches/:id/lecturers/:lecturerId', staff, c.deleteLecturer);

// Salary entries: one form per entry (batch + month + lecturer), then submit -> verify -> pay.
// A lecturer can have more than one entry in a month.
router.get('/salaries', staff, c.getSalaries);
router.post('/salaries', staff, c.createSalary);
router.post('/salaries/bulk', staff, c.bulkAction);
router.put('/salaries/:salaryId', staff, c.updateSalary);
router.delete('/salaries/:salaryId', staff, c.deleteSalary);
router.patch('/salaries/:salaryId/action', staff, c.salaryAction);

module.exports = router;