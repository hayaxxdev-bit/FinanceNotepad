'use strict';

// ============================================================
//  Finance Notepad Pro — Express API Backend
//  Kompatibel: Local Dev & Vercel Serverless
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ── Validasi Environment Variables ────────────────────────
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`[ERROR] Environment variable yang belum diset: ${missingEnv.join(', ')}`);
  console.error('[INFO] Buat file .env berdasarkan .env.example');
}

const app = express();

// ── Middleware Global ──────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Handle CORS preflight
app.options('*', cors());

// ── Request Logger (Development) ──────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ── Supabase Clients ───────────────────────────────────────
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const createUserClient = (accessToken) => {
  return createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || '',
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
};

// ── Middleware Autentikasi ────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Akses ditolak. Token autentikasi tidak ditemukan.',
      });
    }

    const token = authHeader.slice(7);
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      console.error('Auth error:', error?.message);
      return res.status(403).json({
        success: false,
        message: 'Token tidak valid atau sudah kedaluwarsa. Silakan login ulang.',
      });
    }

    req.user = user;
    req.accessToken = token;
    next();
  } catch (err) {
    console.error('[Auth Middleware Error]', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Kesalahan server saat autentikasi.' 
    });
  }
};

// ── Helper Functions ──────────────────────────────────────
const ok = (res, data, message = 'Berhasil', statusCode = 200) => {
  return res.status(statusCode).json({ 
    success: true, 
    message, 
    data,
    timestamp: new Date().toISOString()
  });
};

const fail = (res, message, statusCode = 400) => {
  return res.status(statusCode).json({ 
    success: false, 
    message,
    timestamp: new Date().toISOString()
  });
};

const hitungRingkasan = (transactions) => {
  const summary = {
    pemasukan: 0,
    pengeluaran: 0,
    biaya_admin: 0,
    tabungan: 0,
    biaya_tetap: 0,
    dana_darurat: 0,
  };

  if (!transactions || transactions.length === 0) {
    return { 
      ...summary, 
      total_keluar: 0, 
      saldo_bersih: 0 
    };
  }

  transactions.forEach((t) => {
    if (Object.prototype.hasOwnProperty.call(summary, t.type)) {
      summary[t.type] += parseFloat(t.amount) || 0;
    }
  });

  const totalKeluar =
    summary.pengeluaran +
    summary.biaya_admin +
    summary.tabungan +
    summary.biaya_tetap +
    summary.dana_darurat;

  const saldoBersih = summary.pemasukan - totalKeluar;

  return { ...summary, total_keluar: totalKeluar, saldo_bersih: saldoBersih };
};

const VALID_TYPES = ['pemasukan', 'pengeluaran', 'biaya_admin', 'tabungan', 'biaya_tetap', 'dana_darurat'];

// ============================================================
//  API ENDPOINTS
// ============================================================

// ── Health Check ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '✅ Finance Notepad Pro API is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    supabase_configured: !!process.env.SUPABASE_URL
  });
});

// ── AUTH: Register ───────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password) {
      return fail(res, 'Email dan password wajib diisi.');
    }
    if (password.length < 6) {
      return fail(res, 'Password minimal 6 karakter.');
    }

    const { data, error } = await supabaseAdmin.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: (fullName || '').trim(),
        },
      },
    });

    if (error) {
      const msg = error.message.includes('already registered')
        ? 'Email ini sudah terdaftar. Silakan login.'
        : error.message;
      return fail(res, msg);
    }

    return ok(
      res,
      {
        user: {
          id: data.user?.id,
          email: data.user?.email,
          full_name: data.user?.user_metadata?.full_name,
        },
      },
      'Registrasi berhasil! Silakan login dengan akun Anda.',
      201
    );
  } catch (error) {
    console.error('Register error:', error);
    return fail(res, 'Terjadi kesalahan server.', 500);
  }
});

// ── AUTH: Login ──────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return fail(res, 'Email dan password wajib diisi.');
    }

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      console.error('Login error:', error.message);
      return fail(res, 'Email atau password salah. Silakan coba lagi.', 401);
    }

    if (!data.session?.access_token) {
      return fail(res, 'Gagal mendapatkan token akses.', 500);
    }

    return ok(res, {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name || '',
      },
    }, 'Login berhasil! Selamat datang.');
  } catch (error) {
    console.error('Login error:', error);
    return fail(res, 'Terjadi kesalahan server.', 500);
  }
});

// ── AUTH: Update Profile ─────────────────────────────────
app.put('/api/auth/profile', authenticate, async (req, res) => {
  try {
    const { fullName } = req.body;

    if (!fullName || !fullName.trim()) {
      return fail(res, 'Nama lengkap tidak boleh kosong.');
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      req.user.id,
      {
        user_metadata: {
          ...req.user.user_metadata,
          full_name: fullName.trim(),
        },
      }
    );

    if (error) {
      console.error('Update profile error:', error.message);
      return fail(res, `Gagal memperbarui profil: ${error.message}`);
    }

    return ok(res, {
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name,
      },
    }, 'Profil berhasil diperbarui.');
  } catch (error) {
    console.error('Update profile error:', error);
    return fail(res, 'Terjadi kesalahan server.', 500);
  }
});

// ── TRANSACTIONS: Get All ────────────────────────────────
app.get('/api/transactions', authenticate, async (req, res) => {
  try {
    const supabase = createUserClient(req.accessToken);
    const { month, year, type, limit = 100 } = req.query;

    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (month && year) {
      const m = String(month).padStart(2, '0');
      const y = String(year);
      const startDate = `${y}-${m}-01`;
      const lastDay = new Date(parseInt(y), parseInt(month), 0).getDate();
      const endDate = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
      query = query.gte('date', startDate).lte('date', endDate);
    }

    if (type && VALID_TYPES.includes(type)) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Get transactions error:', error.message);
      return fail(res, `Gagal mengambil data: ${error.message}`);
    }

    return ok(res, data || []);
  } catch (error) {
    console.error('Get transactions error:', error);
    return fail(res, 'Terjadi kesalahan server.', 500);
  }
});

// ── TRANSACTIONS: Create ─────────────────────────────────
app.post('/api/transactions', authenticate, async (req, res) => {
  try {
    const { type, amount, description, date } = req.body;

    if (!type || amount === undefined || amount === null || amount === '') {
      return fail(res, 'Tipe dan jumlah transaksi wajib diisi.');
    }
    if (!VALID_TYPES.includes(type)) {
      return fail(res, `Tipe tidak valid. Pilihan: ${VALID_TYPES.join(', ')}`);
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return fail(res, 'Jumlah harus berupa angka positif.');
    }

    const supabase = createUserClient(req.accessToken);

    const { data, error } = await supabase
      .from('transactions')
      .insert([
        {
          user_id: req.user.id,
          type,
          amount: parsedAmount,
          description: (description || '').trim(),
          date: date || new Date().toISOString().split('T')[0],
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Create transaction error:', error.message);
      return fail(res, `Gagal menyimpan transaksi: ${error.message}`);
    }

    return ok(res, data, 'Transaksi berhasil ditambahkan.', 201);
  } catch (error) {
    console.error('Create transaction error:', error);
    return fail(res, 'Terjadi kesalahan server.', 500);
  }
});

// ── TRANSACTIONS: Update ─────────────────────────────────
app.put('/api/transactions/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, description, date } = req.body;

    if (!type || amount === undefined || amount === null || amount === '') {
      return fail(res, 'Tipe dan jumlah transaksi wajib diisi.');
    }
    if (!VALID_TYPES.includes(type)) {
      return fail(res, 'Tipe tidak valid.');
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return fail(res, 'Jumlah harus berupa angka positif.');
    }

    const supabase = createUserClient(req.accessToken);

    const { data, error } = await supabase
      .from('transactions')
      .update({
        type,
        amount: parsedAmount,
        description: (description || '').trim(),
        date: date || new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      console.error('Update transaction error:', error.message);
      return fail(res, `Gagal memperbarui transaksi: ${error.message}`);
    }

    if (!data) {
      return fail(res, 'Transaksi tidak ditemukan atau bukan milik Anda.', 404);
    }

    return ok(res, data, 'Transaksi berhasil diperbarui.');
  } catch (error) {
    console.error('Update transaction error:', error);
    return fail(res, 'Terjadi kesalahan server.', 500);
  }
});

// ── TRANSACTIONS: Delete ─────────────────────────────────
app.delete('/api/transactions/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = createUserClient(req.accessToken);

    const { error, count } = await supabase
      .from('transactions')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) {
      console.error('Delete transaction error:', error.message);
      return fail(res, `Gagal menghapus transaksi: ${error.message}`);
    }

    if (count === 0) {
      return fail(res, 'Transaksi tidak ditemukan atau bukan milik Anda.', 404);
    }

    return ok(res, null, 'Transaksi berhasil dihapus.');
  } catch (error) {
    console.error('Delete transaction error:', error);
    return fail(res, 'Terjadi kesalahan server.', 500);
  }
});

// ── SUMMARY ──────────────────────────────────────────────
app.get('/api/summary', authenticate, async (req, res) => {
  try {
    const supabase = createUserClient(req.accessToken);
    const { month, year } = req.query;

    let query = supabase
      .from('transactions')
      .select('type, amount')
      .eq('user_id', req.user.id);

    if (month && year) {
      const m = String(month).padStart(2, '0');
      const y = String(year);
      const startDate = `${y}-${m}-01`;
      const lastDay = new Date(parseInt(y), parseInt(month), 0).getDate();
      const endDate = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
      query = query.gte('date', startDate).lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Summary error:', error.message);
      return fail(res, `Gagal menghitung ringkasan: ${error.message}`);
    }

    const ringkasan = hitungRingkasan(data || []);
    return ok(res, ringkasan);
  } catch (error) {
    console.error('Summary error:', error);
    return fail(res, 'Terjadi kesalahan server.', 500);
  }
});

// ── 404 Handler untuk API ────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.path} tidak ditemukan`,
    timestamp: new Date().toISOString()
  });
});

// ── Serve Static Files (Production) ──────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Catch-all untuk SPA ──────────────────────────────────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

// ── Global Error Handler ──────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan server internal.',
    timestamp: new Date().toISOString()
  });
});

// ── Start Server (Local Dev Only) ─────────────────────────
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log('\n🚀 Finance Notepad Pro - Server Started');
    console.log(`📍 Local:  http://localhost:${PORT}`);
    console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
    console.log(`📡 API:    http://localhost:${PORT}/api`);
    console.log('\n📋 Pastikan file .env sudah terisi dengan benar!\n');
  });
}

// Export untuk Vercel Serverless
module.exports = app;