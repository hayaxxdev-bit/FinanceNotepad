// Charts module for financial visualization
class FinanceCharts {
  constructor() {
    this.charts = {};
  }

  init() {
    this.initIncomeExpenseChart();
    this.initSavingsChart();
    this.initCategoryPieChart();
  }

  initIncomeExpenseChart() {
    const ctx = document.getElementById('incomeExpenseChart');
    if (!ctx) return;

    // Simple canvas-based chart
    const canvas = document.createElement('canvas');
    canvas.width = ctx.offsetWidth;
    canvas.height = 250;
    ctx.appendChild(canvas);

    this.charts.incomeExpense = canvas;
  }

  initSavingsChart() {
    const ctx = document.getElementById('savingsChart');
    if (!ctx) return;

    const canvas = document.createElement('canvas');
    canvas.width = ctx.offsetWidth;
    canvas.height = 250;
    ctx.appendChild(canvas);

    this.charts.savings = canvas;
  }

  initCategoryPieChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    const canvas = document.createElement('canvas');
    canvas.width = ctx.offsetWidth;
    canvas.height = 250;
    ctx.appendChild(canvas);

    this.charts.category = canvas;
  }

  updateCharts(summary, transactions) {
    this.drawIncomeExpenseChart(summary);
    this.drawSavingsChart(summary);
    this.drawCategoryChart(transactions);
  }

  drawIncomeExpenseChart(summary) {
    const canvas = this.charts.incomeExpense;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Draw simple bar chart
    const data = {
      'Pemasukan': summary.pemasukan,
      'Pengeluaran': summary.pengeluaran,
      'Tabungan': summary.tabungan,
      'Biaya Tetap': summary.biayaTetap
    };

    const max = Math.max(...Object.values(data), 1);
    const barWidth = w / Object.keys(data).length - 20;
    const colors = ['#22c55e', '#ef4444', '#3b82f6', '#f97316'];

    Object.entries(data).forEach(([label, value], i) => {
      const barHeight = (value / max) * (h - 50);
      const x = (i * (barWidth + 20)) + 10;
      const y = h - barHeight - 30;

      // Bar
      ctx.fillStyle = colors[i];
      ctx.fillRect(x, y, barWidth, barHeight);

      // Label
      ctx.fillStyle = '#B76E79';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + barWidth / 2, h - 10);

      // Value
      ctx.fillStyle = '#fff';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(this.formatShort(value), x + barWidth / 2, y - 5);
    });
  }

  drawSavingsChart(summary) {
    const canvas = this.charts.savings;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Draw line chart for savings projection
    const months = 12;
    const monthlySavings = summary.tabungan;
    
    ctx.beginPath();
    ctx.strokeStyle = '#A020F0';
    ctx.lineWidth = 2;
    
    for (let i = 0; i < months; i++) {
      const x = (i / (months - 1)) * (w - 40) + 20;
      const y = h - (i + 1) * (monthlySavings / (monthlySavings * months)) * (h - 60) - 30;
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    
    ctx.stroke();
  }

  drawCategoryChart(transactions) {
    const canvas = this.charts.category;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Group by category
    const categories = {};
    transactions.forEach(t => {
      if (t.type !== 'income') {
        categories[t.category] = (categories[t.category] || 0) + t.amount;
      }
    });

    const total = Object.values(categories).reduce((a, b) => a + b, 0);
    const colors = ['#B76E79', '#A020F0', '#1A237E', '#6C3082', '#ef4444', '#f97316'];

    let startAngle = 0;
    const centerX = w / 2;
    const centerY = h / 2;
    const radius = Math.min(w, h) / 2 - 40;

    Object.entries(categories).forEach(([category, amount], i) => {
      const sliceAngle = (amount / total) * 2 * Math.PI;
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();

      // Label
      const labelAngle = startAngle + sliceAngle / 2;
      const labelX = centerX + Math.cos(labelAngle) * (radius + 20);
      const labelY = centerY + Math.sin(labelAngle) * (radius + 20);
      
      ctx.fillStyle = '#B76E79';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(category, labelX, labelY);

      startAngle += sliceAngle;
    });
  }

  formatShort(num) {
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toString();
  }
}

window.financeCharts = new FinanceCharts();