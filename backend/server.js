const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Fail fast with a clear message instead of crashing deep inside some
// unrelated module if a required .env value is missing.
const REQUIRED_ENV_VARS = ['MONGO_URI', 'JWT_SECRET', 'FRONTEND_URL'];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(`❌ Missing required environment variable(s): ${missingEnvVars.join(', ')}`);
  console.error('   Copy backend/.env.example to backend/.env and fill in real values.');
  process.exit(1);
}

const connectDB = require('./config/db');
const { removeUploadedFiles } = require('./utils/cleanupUploads');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const expenseRoutes = require('./routes/expense.routes');
const contractorRoutes = require('./routes/contractor.routes');
const constructionPaymentRoutes = require('./routes/constructionPayment.routes');
const hardwareRoutes = require('./routes/hardware.routes');
const projectRoutes = require('./routes/Project.routes');
const officeExpenseRoutes = require('./routes/officeExpense.routes');
const pettyCashRoutes = require('./routes/pettyCash.routes');
const lecturerSalaryRoutes = require('./routes/lecturerSalary.routes');

const app = express();

// Behind a reverse proxy (cPanel/Passenger, nginx, Render, ...) every request
// appears to come from the proxy's IP, so the rate limiter would treat ALL users
// as one person. TRUST_PROXY = number of proxies in front of the app (usually 1).
// Leave it unset on localhost. Do NOT use `true` - clients could then fake their
// IP with an X-Forwarded-For header and bypass the limiter.
const trustProxyHops = Number(process.env.TRUST_PROXY);
if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) {
  app.set('trust proxy', trustProxyHops);
}


// --- Security & core middleware ---
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '2mb' }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Slow down brute-force attempts, but ONLY on the endpoints an attacker would
// hammer. /api/auth/me is called on every dashboard load by logged-in users,
// so it must NOT share this limit (shared campus WiFi = one IP for many users).
// 20 requests per 15 minutes per IP is plenty for a real user.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Forgot-password sends an email every time, so it gets a stricter limit
// (stops someone spamming a user's inbox / burning the Gmail sending quota).
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many reset requests. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth/forgot-password', forgotPasswordLimiter);

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/contractors', contractorRoutes);
app.use('/api/construction-payments', constructionPaymentRoutes);
app.use('/api/hardware', hardwareRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/office-expenses', officeExpenseRoutes);
app.use('/api/petty-cash', pettyCashRoutes);
app.use('/api/lecturer-salary', lecturerSalaryRoutes);

app.get('/', (req, res) => {
  res.send('Campus Expense System API is running!');
});

// --- 404 handler (must come after all routes) ---
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// --- Centralized error handler (must be last, 4 args so Express treats it as an error handler) ---
// Every controller now uses asyncHandler (see utils/asyncHandler.js), which
// forwards any thrown error here via next(err) instead of each controller
// handling its own try/catch. Controllers throw ApiError(statusCode, message)
// for expected cases (400/404/etc); anything else falls through as a 500.
app.use(async (err, req, res, next) => {
  console.error(err);

  // If the request failed, delete any files it already uploaded to Cloudinary
  // so no orphan files are left behind without a database record.
  // (removeUploadedFiles never throws.)
  await removeUploadedFiles(req);

  if (err.name === 'MulterError') {
    return res.status(400).json({ message: `File upload error: ${err.message}` });
  }

  // Invalid ObjectId passed as a route param (e.g. GET /api/hardware/not-an-id)
  if (err.name === 'CastError') {
    return res.status(404).json({ message: 'Resource not found' });
  }

  // Mongoose schema validation failure
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join(', ');
    return res.status(400).json({ message });
  }

  // Duplicate unique field (e.g. signing up with an email that's already registered)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({ message: `${field} already in use` });
  }

  res.status(err.statusCode || err.status || 500).json({
    message: err.message || 'Server error',
  });
});

// Connect to MongoDB first, and only start listening once that worked.
// (connectDB exits the process with a clear message if the connection fails.)
const PORT = process.env.PORT || 5000;
connectDB().then(async () => {
  // An older version of the lecturer salary page made "one salary per lecturer per month" a
  // database rule (a unique index). That rule is gone from the code but stays inside MongoDB,
  // and it is what gives "batch already in use" when a 2nd entry is saved. Drop it (safe to repeat).
  try {
    const LecturerSalary = require('./models/lecturerSalary.model');
    const indexes = await LecturerSalary.collection.indexes();
    for (const idx of indexes) {
      if (idx.unique && idx.name !== '_id_') {
        await LecturerSalary.collection.dropIndex(idx.name);
        console.log(`Dropped old unique index "${idx.name}" on lecturer salaries`);
      }
    }
  } catch (err) {
    if (err.codeName !== 'NamespaceNotFound') console.warn('Could not check lecturer salary indexes:', err.message);
  }
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});