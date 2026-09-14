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
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const expenseRoutes = require('./routes/expense.routes');
const contractorRoutes = require('./routes/contractor.routes');
const constructionPaymentRoutes = require('./routes/constructionPayment.routes');
const hardwareRoutes = require('./routes/hardware.routes');
const projectRoutes = require('./routes/Project.routes');

const app = express();

connectDB();

// --- Security & core middleware ---
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '2mb' }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Slow down brute-force attempts against login/signup specifically.
// 20 requests per 15 minutes per IP is plenty for a real user, but blocks
// automated password guessing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', authLimiter);

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/contractors', contractorRoutes);
app.use('/api/construction-payments', constructionPaymentRoutes);
app.use('/api/hardware', hardwareRoutes);
app.use('/api/projects', projectRoutes);

app.get('/', (req, res) => {
  res.send('Campus Expense System API is running!');
});

// --- 404 handler (must come after all routes) ---
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// --- Centralized error handler (must be last, 4 args so Express treats it as an error handler) ---
app.use((err, req, res, next) => {
  console.error(err);

  if (err.name === 'MulterError') {
    return res.status(400).json({ message: `File upload error: ${err.message}` });
  }

  res.status(err.status || 500).json({
    message: err.message || 'Server error',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});