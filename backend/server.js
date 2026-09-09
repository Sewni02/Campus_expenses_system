const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');
const expenseRoutes = require('./routes/expense.routes');
const contractorRoutes = require('./routes/contractor.routes');
const constructionPaymentRoutes = require('./routes/constructionPayment.routes');
const hardwareRoutes = require('./routes/hardware.routes');
const projectRoutes = require('./routes/Project.routes');

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.use('/api/expenses', expenseRoutes);
app.use('/api/contractors', contractorRoutes);
app.use('/api/construction-payments', constructionPaymentRoutes);
app.use('/api/hardware', hardwareRoutes);
app.use('/api/projects', projectRoutes);

app.get('/', (req, res) => {
  res.send('Campus Expense System API is running!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});