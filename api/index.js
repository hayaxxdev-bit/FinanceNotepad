'use strict';

// ============================================================
//  Pencatat Keuangan Pro Max — Express API Backend
//  Kompatibel: Local Dev & Vercel Serverless
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ── Validasi Environment Variables ────────────────────────
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
REQUIRED_ENV.forEach((key) => {
  if (!process.env[key]) {
    console.error(`[FATAL] Environment variable ${key} belum diset!`);
    if (process.env.NODE_ENV !== 'production') process.exit(1);
  }
});

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

// ── Supabase Clients ───────────────────────────────────────
/**
 * Admin Client — Gunakan Service Role Key.
 * Dipakai untuk: validasi JWT, update user metadata, admin ops.
 * ⚠️ JANGAN ekspose ke frontend!
 */
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * User Client — Buat instance baru per-request dengan token user.
 * RLS (Row Level Security) akan aktif secara otomatis.
 */
const createUserClient = (accessToken) => {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
};

// ── Middleware Autentikasi (Proteksi Route) ────────────────
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Akses ditolak. Token autentikasi tidak ditemukan.',
      });
    }

    const token = authHeader.slice(7); // Hapus "Bearer "

    // Validasi token dengan Supabase Admin
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
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
    return res.status(500).json({ success: false, message: 'Kesalahan server saat autentikasi.' });
  }
};

// ── Helper Response ────────────────────────────────────────
const ok = (res, data, message = 'Berhasil', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

const fail = (res, message, statusCode = 400) =>
  res.status(statusCode).json({ success: false, message });

// ── Helper: Hitung Ringkasan Keuangan ─────────────────────
const hitungRingkasan = (transactions) => {
  const summary = {
    pemasukan: 0,
    pengeluaran: 0,
    biaya_admin: 0,
    tabungan: 0,
    biaya_tetap: 0,
    dana_darurat: 0,
  };

  transactions.forEach((t) => {
    if (Object.prototype.hasOwnProperty.call(summary, t.type)) {
      summary[t.type] += parseFloat(t.amount) || 0;
    }
  });

  // Rumus: Saldo Bersih = Pemasukan - (Pengeluaran + Biaya Admin + Tabungan + Biaya Tetap + Dana Darurat)
  const totalKeluar =
    summary.pengeluaran +
    summary.biaya_admin +
    summary.tabungan +
    summary.biaya_tetap +
    summary.dana_darurat;

  const saldoBersih = summary.pemasukan - totalKeluar;

  return { ...summary, total_keluar: totalKeluar, saldo_bersih: saldoBersih };
};

// ============================================================
//  ROUTES: AUTENTIKASI
// ============================================================

/**
 * POST /api/auth/register
 * Daftarkan pengguna baru via Supabase signUp.
 */
app.post('/api/auth/register', async (req, res) => {
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
    // Terjemahkan pesan error Supabase ke Bahasa Indonesia
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
});

/**
 * POST /api/auth/login
 * Login dengan email & password, kembalikan JWT ke client.
 */
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return fail(res, 'Email dan password wajib diisi.');
  }

  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    return fail(res, 'Email atau password salah. Silakan coba lagi.', 401);
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
});

/**
 * PUT /api/auth/profile  [PROTECTED]
 * Perbarui nama lengkap pengguna yang sedang login.
 */
app.put('/api/auth/profile', authenticate, async (req, res) => {
  const { fullName } = req.body;

  if (!fullName || !fullName.trim()) {
    return fail(res, 'Nama lengkap tidak boleh kosong.');
  }

  // Gunakan admin client untuk update metadata (lebih reliable)
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
    return fail(res, `Gagal memperbarui profil: ${error.message}`);
  }

  return ok(res, {
    user: {
      id: data.user.id,
      email: data.user.email,
      full_name: data.user.user_metadata?.full_name,
    },
  }, 'Profil berhasil diperbarui.');
});

// ============================================================
//  ROUTES: TRANSAKSI  [Semua PROTECTED]
// ============================================================

const VALID_TYPES = ['pemasukan', 'pengeluaran', 'biaya_admin', 'tabungan', 'biaya_tetap', 'dana_darurat'];

/**
 * GET /api/transactions  [PROTECTED]
 * Ambil semua transaksi milik user yang login.
 * Query params: ?month=1-12&year=2024
 */
app.get('/api/transactions', authenticate, async (req, res) => {
  const supabase = createUserClient(req.accessToken);
  const { month, year, type, limit = 100 } = req.query;

  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', req.user.id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  // Filter berdasarkan bulan & tahun
  if (month && year) {
    const m = String(month).padStart(2, '0');
    const y = String(year);
    const startDate = `${y}-${m}-01`;
    const lastDay = new Date(parseInt(y), parseInt(month), 0).getDate();
    const endDate = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    query = query.gte('date', startDate).lte('date', endDate);
  }

  // Filter berdasarkan tipe
  if (type && VALID_TYPES.includes(type)) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;

  if (error) {
    return fail(res, `Gagal mengambil data transaksi: ${error.message}`);
  }

  return ok(res, data);
});

/**
 * POST /api/transactions  [PROTECTED]
 * Tambah transaksi baru ke database Supabase.
 */
app.post('/api/transactions', authenticate, async (req, res) => {
  const { type, amount, description, date } = req.body;

  // Validasi input
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
    return fail(res, `Gagal menyimpan transaksi: ${error.message}`);
  }

  return ok(res, data, 'Transaksi berhasil ditambahkan.', 201);
});

/**
 * PUT /api/transactions/:id  [PROTECTED]
 * Edit transaksi yang sudah ada (hanya milik user sendiri via RLS).
 */
app.put('/api/transactions/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { type, amount, description, date } = req.body;

  if (!type || amount === undefined || amount === null || amount === '') {
    return fail(res, 'Tipe dan jumlah transaksi wajib diisi.');
  }
  if (!VALID_TYPES.includes(type)) {
    return fail(res, `Tipe tidak valid.`);
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
    .eq('user_id', req.user.id) // Double-check ownership (defence in depth)
    .select()
    .single();

  if (error) {
    return fail(res, `Gagal memperbarui transaksi: ${error.message}`);
  }

  if (!data) {
    return fail(res, 'Transaksi tidak ditemukan atau bukan milik Anda.', 404);
  }

  return ok(res, data, 'Transaksi berhasil diperbarui.');
});

/**
 * DELETE /api/transactions/:id  [PROTECTED]
 * Hapus transaksi (hanya milik user sendiri via RLS).
 */
app.delete('/api/transactions/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const supabase = createUserClient(req.accessToken);

  const { error, count } = await supabase
    .from('transactions')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('user_id', req.user.id);

  if (error) {
    return fail(res, `Gagal menghapus transaksi: ${error.message}`);
  }

  if (count === 0) {
    return fail(res, 'Transaksi tidak ditemukan atau bukan milik Anda.', 404);
  }

  return ok(res, null, 'Transaksi berhasil dihapus.');
});

// ============================================================
//  ROUTES: RINGKASAN KEUANGAN  [PROTECTED]
// ============================================================

/**
 * GET /api/summary  [PROTECTED]
 * Hitung ringkasan keuangan: total per kategori & saldo bersih.
 * Query params: ?month=1-12&year=2024
 */
app.get('/api/summary', authenticate, async (req, res) => {
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
    return fail(res, `Gagal menghitung ringkasan: ${error.message}`);
  }

  const ringkasan = hitungRingkasan(data);
  return ok(res, ringkasan);
});

// ── Health Check ───────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '✅ Pencatat Keuangan Pro Max API is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ── Serve Static Frontend (Local Dev) ─────────────────────
// Di Vercel, folder public/ dilayani secara otomatis oleh CDN.
// Di lokal, Express yang melayaninya.
app.use(express.static(path.join(__dirname, '..', 'public')));

// Catch-all: Kembalikan index.html untuk semua route non-API
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

// ── Start Server (Local Dev Only) ─────────────────────────
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log('\n🚀 Pencatat Keuangan Pro Max - Server Started');
    console.log(`   Local:  http://localhost:${PORT}`);
    console.log(`   API:    http://localhost:${PORT}/api/health`);
    console.log('\n📋 Pastikan file .env sudah terisi dengan benar!\n');
  });
}

// Export untuk Vercel Serverless
module.exports = app;
