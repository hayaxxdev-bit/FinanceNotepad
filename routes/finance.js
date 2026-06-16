const express = require('express')
const { authMiddleware } = require('../middleware/auth')
const { calculateSummary } = require('../utils/calculator.js')
const { router } = express.Router()

// in-memory storage (replace with database production)
const financialData = new Map()

router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id

        if (!financialData.has(userId)) {
            financialData.set(userId, {
                transactions: [],
                categories: {
                    income: ['Gaji', 'Investasi', 'Bonus', 'Freelance', 'Bisnis', 'Royalti', 'Dividen'],
                    expense: ['Makanan', 'Transportasi', 'Belanja', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Utilities'],
                    fixed: ['Sewa', 'Listrik', 'Internet', 'Asuransi', 'Cicilan', 'Langganan'],
                    admin: ['Biaya Bank', 'Biaya Transfer', 'Biaya Platform', 'Pajak Transaksi'],
                    savings: ['Tabungan Requler', 'Dana darurat', 'Investasi'],
                    other: ['Donasi', 'Hadiah', 'Hibah', 'Lain-Lain']
                }
            })
        }

        const data = financialData.get(userId)
        const summary = calculateSummar(data.transactions)

        res.json({
            transactions: data.transactions,
            categories: data.categories,
            summary
        })
    } catch (error) {
        console.error('Get finance error', error);
        return res.status(500).json({ error: 'Failed to fetch financial data' })
    }
})

// add transaction
router.post('/transaction', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id
        const { type, category, amount, description, data } = req.body

        // validate
        if (!type || !category || !amount) {
            return res.status(400).json({ error: 'Type, Category and amount are required' })
        }

        const validTypes = ['income', 'expense', 'fixed', 'admin', 'saving', 'other']
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: 'Invalid transaction type' })
        }

        const parsedAmount = parseFloat(amount)
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: 'Amount has be a positive number' })
        }

        // if data user not exist
        if (!financialData.has(userId)) {
            financialData.set(userId, { transactions: [], categories: [] })
        }
        
        const transaction = {
            id: `tx_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
            type,
            category,
            amount: parsedAmount,
            description: description || '',
            date: date || new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updateAt: new Date().toISOString(),
        }

        // ---------------------------------------
        // ---------------------------------------
        // ---------------------------------------
        // ---------------------------------------
        // ---------------------------------------
        // ---------------------------------------
        // ---------------------------------------
        // ---------------------------------------
        // ---------------------------------------
        // ---------------------------------------
        // ---------------------------------------
        // ---------------------------------------
        // ---------------------------------------
        // ---------------------------------------
        financialData.get(userId).transactions.push(transaction);
    const summary = calculateSummary(financialData.get(userId).transactions);

    res.status(201).json({
      message: 'Transaction added successfully',
      transaction,
      summary
    });
  } catch (error) {
    console.error('Add transaction error:', error);
    res.status(500).json({ error: 'Failed to add transaction' });
  }
});

// Update transaction
router.put('/transaction/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updates = req.body;

    if (!financialData.has(userId)) {
      return res.status(404).json({ error: 'No financial data found' });
    }

    const userTransactions = financialData.get(userId).transactions;
    const index = userTransactions.findIndex(t => t.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Update allowed fields
    const allowedUpdates = ['type', 'category', 'amount', 'description', 'date'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        userTransactions[index][field] = updates[field];
      }
    });

    userTransactions[index].updatedAt = new Date().toISOString();
    const summary = calculateSummary(userTransactions);

    res.json({
      message: 'Transaction updated',
      transaction: userTransactions[index],
      summary
    });
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// Delete transaction
router.delete('/transaction/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!financialData.has(userId)) {
      return res.status(404).json({ error: 'No financial data found' });
    }

    const userData = financialData.get(userId);
    const initialLength = userData.transactions.length;
    userData.transactions = userData.transactions.filter(t => t.id !== id);

    if (userData.transactions.length === initialLength) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const summary = calculateSummary(userData.transactions);

    res.json({
      message: 'Transaction deleted',
      summary
    });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// Bulk import transactions
router.post('/transactions/bulk', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { transactions } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'Transactions array is required' });
    }

    if (!financialData.has(userId)) {
      financialData.set(userId, { transactions: [], categories: {} });
    }

    const imported = [];
    const errors = [];

    transactions.forEach((t, index) => {
      try {
        if (!t.type || !t.category || !t.amount) {
          throw new Error('Missing required fields');
        }

        const transaction = {
          id: `tx_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`,
          type: t.type,
          category: t.category,
          amount: parseFloat(t.amount),
          description: t.description || '',
          date: t.date || new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        financialData.get(userId).transactions.push(transaction);
        imported.push(transaction);
      } catch (error) {
        errors.push({ index, error: error.message });
      }
    });

    const summary = calculateSummary(financialData.get(userId).transactions);

    res.json({
      message: `Imported ${imported.length} transactions`,
      imported,
      errors: errors.length > 0 ? errors : undefined,
      summary
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: 'Failed to import transactions' });
  }
});

// Get summary and analytics
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { period } = req.query; // 'daily', 'weekly', 'monthly', 'yearly'

    if (!financialData.has(userId)) {
      return res.json({
        summary: calculateSummary([]),
        analytics: {}
      });
    }

    const transactions = financialData.get(userId).transactions;
    const summary = calculateSummary(transactions);

    // Analytics based on period
    let analytics = {};
    if (period) {
      const now = new Date();
      let filtered = transactions;

      switch (period) {
        case 'daily':
          filtered = transactions.filter(t => {
            const d = new Date(t.date);
            return d.toDateString() === now.toDateString();
          });
          break;
        case 'weekly':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          filtered = transactions.filter(t => new Date(t.date) >= weekAgo);
          break;
        case 'monthly':
          filtered = transactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          });
          break;
        case 'yearly':
          filtered = transactions.filter(t => new Date(t.date).getFullYear() === now.getFullYear());
          break;
      }

      analytics = calculateSummary(filtered);
    }

    // Category breakdown
    const categoryBreakdown = {};
    const types = ['income', 'expense', 'fixed', 'admin', 'savings', 'other'];
    types.forEach(type => {
      categoryBreakdown[type] = {};
      transactions
        .filter(t => t.type === type)
        .forEach(t => {
          categoryBreakdown[type][t.category] = (categoryBreakdown[type][t.category] || 0) + t.amount;
        });
    });

    res.json({
      summary,
      analytics: period ? analytics : undefined,
      categoryBreakdown,
      totalTransactions: transactions.length
    });
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// Export data
router.get('/export', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { format = 'json' } = req.query;

    if (!financialData.has(userId)) {
      return res.status(404).json({ error: 'No data to export' });
    }

    const data = financialData.get(userId);

    if (format === 'csv') {
      // Convert to CSV
      const headers = ['ID', 'Type', 'Category', 'Amount', 'Description', 'Date'];
      const rows = data.transactions.map(t => [
        t.id, t.type, t.category, t.amount, t.description, t.date
      ]);

      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=financial-data.csv');
      return res.send(csv);
    }

    res.json(data);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

module.exports = router;

