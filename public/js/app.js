// Main application module
class FinanceApp {
  constructor() {
    this.data = null;
    this.transactions = [];
    this.summary = null;
    this.categories = {};
    this.charts = {};
    this.currentFilter = 'all';
    this.currentPeriod = 'monthly';
  }

  async init() {
    // Check authentication
    const isAuth = await window.auth.checkAuth();
    
    if (!isAuth) {
      this.showAuthModal();
      return;
    }

    // Hide auth modal and show app
    document.getElementById('authModal').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    
    // Load user info
    const user = window.auth.getUser();
    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('userName').textContent = user.fullName || 'User';

    // Load financial data
    await this.loadData();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Update UI
    this.updateDashboard();
  }

  async loadData() {
    try {
      const response = await fetch('/api/finance', {
        credentials: 'include'
      });

      if (response.ok) {
        this.data = await response.json();
        this.transactions = this.data.transactions || [];
        this.summary = this.data.summary;
        this.categories = this.data.categories;
        this.updateDashboard();
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      this.showToast('Gagal memuat data keuangan', 'error');
    }
  }

  setupEventListeners() {
    // Add transaction form
    document.getElementById('txForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.addTransaction();
    });

    // Transaction type change
    document.getElementById('txType')?.addEventListener('change', (e) => {
      this.updateCategoryDropdown(e.target.value);
    });

    // Filter change
    document.getElementById('filterType')?.addEventListener('change', (e) => {
      this.currentFilter = e.target.value;
      this.renderTransactions();
    });

    // Period change
    document.getElementById('periodSelect')?.addEventListener('change', async (e) => {
      this.currentPeriod = e.target.value;
      await this.loadAnalytics();
    });

    // Export button
    document.getElementById('exportBtn')?.addEventListener('click', () => {
      this.exportData();
    });

    // Refresh button
    document.getElementById('refreshBtn')?.addEventListener('click', async () => {
      await this.loadData();
      this.showToast('Data berhasil diperbarui', 'success');
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'n':
            e.preventDefault();
            document.getElementById('txAmount')?.focus();
            break;
          case 'r':
            e.preventDefault();
            this.loadData();
            break;
        }
      }
    });
  }

  async addTransaction() {
    const type = document.getElementById('txType').value;
    const category = document.getElementById('txCategory').value;
    const amount = document.getElementById('txAmount').value;
    const description = document.getElementById('txDescription').value;
    const date = document.getElementById('txDate').value || new Date().toISOString().split('T')[0];

    if (!amount || amount <= 0) {
      this.showToast('Masukkan jumlah yang valid', 'error');
      return;
    }

    const btn = document.querySelector('#txForm button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Menyimpan...';

    try {
      const response = await fetch('/api/finance/transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type,
          category,
          amount: parseFloat(amount),
          description,
          date
        }),
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        this.transactions.unshift(result.transaction);
        this.summary = result.summary;
        
        // Reset form
        document.getElementById('txForm').reset();
        document.getElementById('txAmount').value = '';
        document.getElementById('txDescription').value = '';
        
        // Update UI
        this.updateDashboard();
        this.renderTransactions();
        this.showToast('Transaksi berhasil ditambahkan', 'success');
      } else {
        const error = await response.json();
        this.showToast(error.error || 'Gagal menambah transaksi', 'error');
      }
    } catch (error) {
      console.error('Add transaction error:', error);
      this.showToast('Gagal menambah transaksi', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="ri-add-line"></i> Tambah Transaksi';
    }
  }

  async deleteTransaction(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) {
      return;
    }

    try {
      const response = await fetch(`/api/finance/transaction/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        this.transactions = this.transactions.filter(t => t.id !== id);
        this.summary = result.summary;
        
        this.updateDashboard();
        this.renderTransactions();
        this.showToast('Transaksi berhasil dihapus', 'success');
      }
    } catch (error) {
      console.error('Delete error:', error);
      this.showToast('Gagal menghapus transaksi', 'error');
    }
  }

  updateDashboard() {
    if (!this.summary) return;

    const format = (num) => {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(num);
    };

    // Update stats cards
    const elements = {
      'statIncome': this.summary.pemasukan,
      'statExpense': this.summary.pengeluaran + this.summary.biayaAdmin + this.summary.biayaTetap,
      'statSavings': this.summary.tabungan,
      'statNet': this.summary.saldoBersih,
      'statFixed': this.summary.biayaTetap,
      'statEmergency': this.summary.danaDarurat,
      'statInvestment': this.summary.investasi,
      'statDonation': this.summary.donasi
    };

    Object.entries(elements).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = format(value || 0);
        
        // Add color based on value
        if (id === 'statNet') {
          el.className = value >= 0 ? 'text-green-400' : 'text-red-400';
        }
      }
    });

    // Update financial health status
    this.updateHealthStatus();
    
    // Update charts
    this.updateCharts();
  }

  updateHealthStatus() {
    const status = this.summary?.statusKeuangan;
    if (!status) return;

    const statusEl = document.getElementById('financialStatus');
    const messageEl = document.getElementById('financialMessage');
    const recommendationsEl = document.getElementById('financialRecommendations');

    if (statusEl) {
      statusEl.textContent = status.status;
      statusEl.className = `badge-${status.color}`;
    }

    if (messageEl) {
      messageEl.textContent = status.message;
    }

    if (recommendationsEl && status.recommendations) {
      recommendationsEl.innerHTML = status.recommendations
        .map(rec => `<li class="flex items-start gap-2">
          <i class="ri-checkbox-circle-line text-green-400 mt-0.5"></i>
          <span>${rec}</span>
        </li>`)
        .join('');
    }
  }

  renderTransactions() {
    const list = document.getElementById('transactionList');
    if (!list) return;

    let filtered = this.transactions;
    
    if (this.currentFilter !== 'all') {
      filtered = filtered.filter(t => t.type === this.currentFilter);
    }

    if (filtered.length === 0) {
      list.innerHTML = `
        <div class="text-center py-12">
          <i class="ri-inbox-line text-5xl text-rose-gold/30 mb-4 block"></i>
          <p class="text-rose-gold">Belum ada transaksi</p>
          <p class="text-sm text-rose-gold/50 mt-1">Tambahkan transaksi pertama Anda</p>
        </div>
      `;
      return;
    }

    const typeLabels = {
      income: 'Pemasukan',
      expense: 'Pengeluaran',
      fixed: 'Biaya Tetap',
      admin: 'Biaya Admin',
      savings: 'Tabungan',
      other: 'Lainnya'
    };

    const typeClasses = {
      income: 'badge-income',
      expense: 'badge-expense',
      fixed: 'badge-fixed',
      admin: 'badge-admin',
      savings: 'badge-savings',
      other: 'badge-savings'
    };

    list.innerHTML = filtered.map(t => `
      <div class="glass-card p-4 animate-fade-in hover:border-rose-gold/30 transition-all duration-300">
        <div class="flex justify-between items-start">
          <div class="flex items-start gap-3">
            <span class="${typeClasses[t.type] || 'badge-savings'}">
              ${typeLabels[t.type] || t.type}
            </span>
            <div>
              <p class="font-medium">${t.category}</p>
              <p class="text-sm text-rose-gold/70">${t.description || '-'}</p>
              <p class="text-xs text-rose-gold/50 mt-1">
                ${new Date(t.date).toLocaleDateString('id-ID', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="font-bold ${t.type === 'income' ? 'text-green-400' : 'text-red-400'}">
              ${new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0
              }).format(t.amount)}
            </span>
            <button 
              onclick="app.deleteTransaction('${t.id}')"
              class="text-rose-gold/50 hover:text-red-400 transition-colors"
              title="Hapus transaksi"
            >
              <i class="ri-delete-bin-line"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  updateCategoryDropdown(type) {
    const select = document.getElementById('txCategory');
    if (!select || !this.categories) return;

    const categories = this.categories[type] || [];
    select.innerHTML = categories
      .map(cat => `<option value="${cat}">${cat}</option>`)
      .join('');
  }

  updateCharts() {
    // Simple chart using canvas (if available)
    const chartCanvas = document.getElementById('financeChart');
    if (!chartCanvas || !this.summary) return;

    // This is a placeholder for chart integration
    // You can integrate Chart.js or similar library here
    console.log('Chart data ready:', {
      income: this.summary.pemasukan,
      expense: this.summary.pengeluaran,
      savings: this.summary.tabungan,
      net: this.summary.saldoBersih
    });
  }

  async loadAnalytics() {
    try {
      const response = await fetch(`/api/finance/summary?period=${this.currentPeriod}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const analytics = await response.json();
        this.updateAnalyticsDashboard(analytics);
      }
    } catch (error) {
      console.error('Analytics error:', error);
    }
  }

  updateAnalyticsDashboard(analytics) {
    // Update analytics cards
    const format = (num) => new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(num);

    if (analytics.analytics) {
      const a = analytics.analytics;
      document.getElementById('analyticsIncome').textContent = format(a.pemasukan || 0);
      document.getElementById('analyticsExpense').textContent = format(a.pengeluaran || 0);
      document.getElementById('analyticsSavings').textContent = format(a.tabungan || 0);
    }

    // Update category breakdown
    this.renderCategoryBreakdown(analytics.categoryBreakdown);
  }

  renderCategoryBreakdown(breakdown) {
    const container = document.getElementById('categoryBreakdown');
    if (!container || !breakdown) return;

    let html = '';
    Object.entries(breakdown).forEach(([type, categories]) => {
      if (Object.keys(categories).length === 0) return;
      
      html += `<div class="mb-4">
        <h4 class="text-sm font-semibold text-rose-gold mb-2">${type.toUpperCase()}</h4>`;
      
      Object.entries(categories).forEach(([category, amount]) => {
        const percentage = this.summary ? 
          ((amount / (this.summary.pemasukan || 1)) * 100).toFixed(1) : 0;
        
        html += `
          <div class="flex justify-between items-center mb-1">
            <span class="text-sm">${category}</span>
            <span class="text-sm font-medium">${new Intl.NumberFormat('id-ID', {
              style: 'currency',
              currency: 'IDR',
              minimumFractionDigits: 0
            }).format(amount)}</span>
          </div>
          <div class="w-full bg-medium-plum/20 rounded-full h-2 mb-2">
            <div class="bg-gradient-to-r from-rose-gold to-magenta-tua h-2 rounded-full" 
                 style="width: ${Math.min(percentage, 100)}%"></div>
          </div>`;
      });
      
      html += '</div>';
    });

    container.innerHTML = html || '<p class="text-rose-gold">Tidak ada data kategori</p>';
  }

  async exportData() {
    const format = confirm('Klik OK untuk JSON, Cancel untuk CSV') ? 'json' : 'csv';
    
    try {
      window.open(`/api/finance/export?format=${format}`, '_blank');
      this.showToast('Data berhasil diexport', 'success');
    } catch (error) {
      console.error('Export error:', error);
      this.showToast('Gagal mengexport data', 'error');
    }
  }

  showAuthModal() {
    document.getElementById('authModal').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} animate-slide-in`;
    toast.innerHTML = `
      <div class="flex items-center gap-2">
        <i class="ri-${type === 'success' ? 'checkbox-circle' : type === 'error' ? 'error-warning' : 'information'}-line"></i>
        <span>${message}</span>
      </div>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Initialize app
window.app = new FinanceApp();

// Auth form handlers
document.addEventListener('DOMContentLoaded', () => {
  const authForm = document.getElementById('authForm');
  const toggleBtn = document.getElementById('authToggleBtn');
  let isLogin = true;

  toggleBtn?.addEventListener('click', () => {
    isLogin = !isLogin;
    document.getElementById('authTitle').textContent = isLogin ? 'Welcome Back' : 'Create Account';
    toggleBtn.textContent = isLogin ? 'Sign Up' : 'Sign In';
    document.getElementById('authSubmitBtn').textContent = isLogin ? 'Sign In' : 'Create Account';
  });

  authForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const submitBtn = document.getElementById('authSubmitBtn');
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Processing...';

    let result;
    if (isLogin) {
      result = await window.auth.login(email, password);
    } else {
      const fullName = document.getElementById('fullName')?.value || '';
      result = await window.auth.signup(email, password, fullName);
    }

    if (result.success) {
      await window.app.init();
    } else {
      alert(result.error || 'Authentication failed');
      submitBtn.disabled = false;
      submitBtn.textContent = isLogin ? 'Sign In' : 'Create Account';
    }
  });

  // Initialize app
  window.app.init();
});