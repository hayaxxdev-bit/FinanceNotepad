/**
 * Calculate financial summary from transactions
 */
function calculateSummary(transactions) {
  const summary = {
    pemasukan: 0,
    pengeluaran: 0,
    biayaAdmin: 0,
    tabungan: 0,
    biayaTetap: 0,
    danaDarurat: 0,
    investasi: 0,
    donasi: 0,
    lainnya: 0,
    saldoBersih: 0,
    totalTransaksi: transactions.length
  };

  transactions.forEach(t => {
    const amount = parseFloat(t.amount) || 0;

    switch (t.type) {
      case 'income':
        summary.pemasukan += amount;
        break;
      case 'expense':
        summary.pengeluaran += amount;
        break;
      case 'admin':
        summary.biayaAdmin += amount;
        break;
      case 'savings':
        summary.tabungan += amount;
        // Check for specific savings categories
        if (t.category.toLowerCase().includes('darurat')) {
          summary.danaDarurat += amount;
        }
        if (t.category.toLowerCase().includes('investasi')) {
          summary.investasi += amount;
        }
        break;
      case 'fixed':
        summary.biayaTetap += amount;
        break;
      case 'other':
        if (t.category.toLowerCase().includes('donasi') || t.category.toLowerCase().includes('hibah')) {
          summary.donasi += amount;
        } else if (t.category.toLowerCase().includes('investasi')) {
          summary.investasi += amount;
        } else {
          summary.lainnya += amount;
        }
        break;
    }
  });

  // Calculate net balance
  summary.saldoBersih = summary.pemasukan - (
    summary.pengeluaran + 
    summary.biayaAdmin + 
    summary.tabungan + 
    summary.biayaTetap + 
    summary.donasi + 
    summary.lainnya
  );

  // Calculate ratios
  summary.rasioTabungan = summary.pemasukan > 0 
    ? ((summary.tabungan / summary.pemasukan) * 100).toFixed(2)
    : 0;

  summary.rasioPengeluaran = summary.pemasukan > 0
    ? ((summary.pengeluaran / summary.pemasukan) * 100).toFixed(2)
    : 0;

  // Financial health indicators
  summary.statusKeuangan = determineFinancialHealth(summary);

  return summary;
}

/**
 * Determine financial health status
 */
function determineFinancialHealth(summary) {
  if (summary.saldoBersih < 0) {
    return {
      status: 'Kritis',
      color: 'red',
      message: 'Pengeluaran melebihi pemasukan! Perlu evaluasi keuangan segera.',
      recommendations: [
        'Kurangi pengeluaran tidak penting',
        'Cari sumber pemasukan tambahan',
        'Buat anggaran yang lebih ketat'
      ]
    };
  }

  const savingsRatio = parseFloat(summary.rasioTabungan);
  
  if (savingsRatio >= 20 && summary.saldoBersih > 0) {
    return {
      status: 'Sangat Baik',
      color: 'green',
      message: 'Keuangan Anda sehat dengan tabungan yang baik!',
      recommendations: [
        'Pertimbangkan investasi untuk masa depan',
        'Tingkatkan dana darurat',
        'Rencanakan tujuan keuangan jangka panjang'
      ]
    };
  }

  if (savingsRatio >= 10) {
    return {
      status: 'Baik',
      color: 'blue',
      message: 'Keuangan dalam kondisi baik, bisa ditingkatkan.',
      recommendations: [
        'Tingkatkan tabungan menjadi 20%',
        'Evaluasi pengeluaran tetap',
        'Mulai investasi kecil-kecilan'
      ]
    };
  }

  return {
    status: 'Perlu Perbaikan',
    color: 'yellow',
    message: 'Ada ruang untuk perbaikan dalam keuangan Anda.',
    recommendations: [
      'Catat semua pengeluaran dengan detail',
      'Tentukan prioritas pengeluaran',
      'Targetkan tabungan minimal 10% dari pemasukan'
    ]
  };
}

/**
 * Calculate projected savings
 */
function calculateProjection(summary, months = 12) {
  const monthlySavings = summary.tabungan;
  const projection = [];

  for (let i = 1; i <= months; i++) {
    projection.push({
      month: i,
      savings: monthlySavings * i,
      totalWithInterest: (monthlySavings * i) * 1.05 // 5% annual interest
    });
  }

  return projection;
}

/**
 * Budget analysis
 */
function analyzeBudget(transactions, budgetLimits = {}) {
  const analysis = {
    overBudget: [],
    underBudget: [],
    recommendations: []
  };

  Object.entries(budgetLimits).forEach(([category, limit]) => {
    const spent = transactions
      .filter(t => t.category === category)
      .reduce((sum, t) => sum + t.amount, 0);

    if (spent > limit) {
      analysis.overBudget.push({
        category,
        spent,
        limit,
        difference: spent - limit,
        percentage: ((spent - limit) / limit * 100).toFixed(2)
      });
    } else {
      analysis.underBudget.push({
        category,
        spent,
        limit,
        remaining: limit - spent
      });
    }
  });

  // Generate recommendations
  if (analysis.overBudget.length > 0) {
    analysis.recommendations.push(
      'Beberapa kategori melebihi budget, perlu evaluasi pengeluaran.',
      ...analysis.overBudget.map(item => 
        `Kurangi pengeluaran ${item.category} sebesar ${formatCurrency(item.difference)}`
      )
    );
  }

  return analysis;
}

/**
 * Format currency
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

module.exports = {
  calculateSummary,
  calculateProjection,
  analyzeBudget,
  formatCurrency
};