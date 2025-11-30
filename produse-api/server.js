// ===== Core & Env =====
require('dotenv').config();
const axios = require('axios');
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { DateTime } = require('luxon');
const { exec } = require('child_process');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();

// ===== Config dasar =====
const PORT = process.env.PORT || 3000;
const COOKIE_NAME = 'token';
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_SECRET';
const JWT_EXPIRES = '7d'; // masa berlaku token
const DELIVERY_MODE = (process.env.DELIVERY_MODE || 'termux').toLowerCase();

// (Kalau nanti butuh whitelisting origin spesifik, isi di sini)
const ALLOWED_ORIGINS = [
  'http://127.0.0.1:3000',
  'http://localhost:3000'
];

// CORS (karena FE & API sekarang satu origin/port 3000, ini aman)
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// ===== MySQL Pool =====
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'produse',
  waitForConnections: true,
  connectionLimit: 10
});

// ===== Util: JWT & Auth =====
function getTokenFromReq(req) {
  // Utama dari cookie httpOnly
  if (req.cookies && req.cookies[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  // Cadangan dari Authorization: Bearer <token> (kalau dipakai)
  const auth = req.headers.authorization || '';
  const parts = auth.split(' ');
  if (parts[0] === 'Bearer' && parts[1]) return parts[1];
  return null;
}

function verifyTokenFromReq(req) {
  const token = getTokenFromReq(req);
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET); // => { sub: userId, iat, exp }
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const payload = verifyTokenFromReq(req);
  if (!payload) return res.status(401).json({ message: 'Unauthorized' });
  req.userId = payload.sub;
  next();
}

// Update middleware gateStaticUser di server.js
function gateStaticUser(req, res, next) {
  // 1. Tambahkan Header No-Cache (PENTING!)
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  const payload = verifyTokenFromReq(req);
  if (!payload) {
    if (req.accepts('html')) return res.redirect('/login/');
    return res.status(401).send('Unauthorized');
  }
  req.userId = payload.sub;
  next();
}

// ===== Healthcheck DB =====
app.get('/health/db', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT 1 AS ok');
    res.json({ db: 'ok', rows });
  } catch (e) {
    console.error('DB health error:', e.message);
    res.status(500).json({ db: 'error', message: e.message });
  } finally {
    if (conn) conn.release();
  }
});

// ===== Nodemailer Config (Via Brevo Relay) =====
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: false, // Port 2525 tidak butuh SSL di awal (pakai STARTTLS otomatis)
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  },
  tls: {
    rejectUnauthorized: false // Membantu mencegah error sertifikat di beberapa VPS
  }
});

// ... (Kode koneksi DB di atas tetap sama) ...

// ===== DEBUGGING MIDDLEWARE (CCTV) =====
app.use((req, res, next) => {
  // Log setiap request yang masuk
  console.log(`[REQUEST] ${req.method} ${req.url} | IP: ${req.ip}`);
  next();
});

// ===== MIDDLEWARE PENJAGA (Gatekeeper) =====
// Kita definisikan fungsi ini tapi jangan dipasang dulu, nanti dipasang spesifik di route '/user'
const protectRoute = (req, res, next) => {
  console.log(`[AUTH-CHECK] Checking access for: ${req.url}`);
  
  // 1. Matikan Cache Browser (Wajib untuk fitur logout aman)
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');

  // 2. Cek Token
  const token = req.cookies[COOKIE_NAME];
  
  if (!token) {
    console.log('[AUTH-FAIL] No token found. Redirecting to login.');
    // Jika request API (json), kirim 401. Jika request halaman (html), redirect.
    if (req.accepts('html')) return res.redirect('/login/');
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    console.log(`[AUTH-OK] User ID: ${req.userId}`);
    next();
  } catch (err) {
    console.log('[AUTH-FAIL] Token invalid/expired.', err.message);
    res.clearCookie(COOKIE_NAME); // Hapus cookie yang rusak
    return res.redirect('/login/');
  }
};

// ===== STATIC FILE SERVING (PENTING: URUTAN INI JANGAN DITUKAR) =====

// 1. Serve folder '.well-known' (SSL) - Bebas akses
app.use('/.well-known', express.static(path.join(__dirname, '.well-known')));

// 2. Serve folder 'user' (DILINDUNGI)
// Apapun yang diawali /user/... AKAN dicek tokennya dulu baru dilayani statisnya
app.use('/user', protectRoute, express.static(path.join(__dirname, '..', 'public/user'), {
  index: 'index.html',
  etag: false, // Matikan ETag agar browser tidak cache
  lastModified: false
}));

// 3. Serve folder 'public' SISANYA (Bebas akses: login, image, css, js)
// Kita gunakan logika exclude agar url /user tidak bocor lewat sini
app.use(express.static(path.join(__dirname, '..', 'public'), {
  index: 'index.html',
  // Fungsi filter: Jangan layani request yang mengarah ke folder user lewat jalur ini
  setHeaders: (res, filePath) => {
    if (filePath.includes('/public/user')) {
      // Harusnya tidak sampai sini karena sudah dicegat middleware no 2, tapi buat jaga-jaga
      console.log('[SECURITY-WARN] Attempt to access protected file via public route:', filePath);
    }
  }
}));

// ===== AUTH ROUTE ENDPOINTS =====
// ... (Lanjutkan dengan kode app.post register, login dll seperti biasa) ...


// ===== AUTH =====

// Register dengan Verifikasi Email
app.post('/api/auth/register', async (req, res) => {
  try {
    let { name, email, username, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Data tidak lengkap' });
    }
    if (password.length < 8) return res.status(400).json({ message: 'Password min 8 karakter' });

    // Auto-generate username jika kosong
    if (!username || username.trim() === '') {
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      username = `user${randomNum}`;
    }

    const conn = await pool.getConnection();
    try {
      // Cek duplikasi
      const [exists] = await conn.execute(
        'SELECT id FROM users WHERE email = ? OR username = ?',
        [email, username]
      );
      if (exists.length) return res.status(409).json({ message: 'Email/Username sudah dipakai' });

      const hash = await bcrypt.hash(password, 12);
      
      // Generate Token Random
      const verifyToken = crypto.randomBytes(32).toString('hex');

      // INSERT dengan status 'disabled' dan simpan token
      await conn.execute(
        `INSERT INTO users (name, email, username, password_hash, status, verification_token) 
         VALUES (?, ?, ?, ?, 'disabled', ?)`,
        [name, email, username, hash, verifyToken]
      );

      // Kirim Email
      const verifyLink = `${process.env.BASE_URL || 'http://127.0.0.1:3000'}/api/auth/verify-email?token=${verifyToken}`;
      
      const mailOptions = {
        // Ganti 'alamat_email_kamu@gmail.com' dengan email Gmail asli kamu 
        // yang tadi sudah kamu daftarkan sebagai "Sender" di dashboard Brevo.
        from: `"Produse Team" <produsehub@gmail.com>`, 
        
        to: email, // Email tujuan (user yang daftar)
        subject: 'Verify your Produse Account',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #1976D2;">Welcome to Produse!</h2>
            <p>Hi ${name},</p>
            <p>Thanks for registering. Please click the button below to verify your account:</p>
            <br>
            <a href="${verifyLink}" style="background-color: #1976D2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verify Email Address</a>
            <br><br>
            <p style="font-size: 14px; color: #666;">Or copy this link to your browser:</p>
            <p style="font-size: 13px; color: #888; word-break: break-all;">${verifyLink}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999;">This link is valid for 24 hours.</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);

      // Jangan buat token login (JWT) disini, karena belum aktif
      return res.status(201).json({ message: 'Registrasi berhasil. Silakan cek email.', email: email });

    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('Register error', e);
    res.status(500).json({ message: 'Gagal mendaftar atau mengirim email' });
  }
});

// Endpoint Verifikasi Email (Diklik dari email)
app.get('/api/auth/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Token invalid');

  const conn = await pool.getConnection();
  try {
    // Cari user dengan token tersebut
    const [users] = await conn.execute(
      'SELECT id FROM users WHERE verification_token = ? LIMIT 1',
      [token]
    );

    if (users.length === 0) {
      return res.status(400).send('<h1>Invalid or Expired Token</h1><p>Link verifikasi salah atau sudah digunakan.</p>');
    }

    const userId = users[0].id;

    // Aktifkan user dan hapus token
    await conn.execute(
      "UPDATE users SET status = 'active', verification_token = NULL WHERE id = ?",
      [userId]
    );

    // Redirect ke halaman login dengan pesan sukses
    // Kita bisa tambahkan parameter query biar frontend tau verifikasi sukses
    res.redirect('/login/index.html?verified=true');

  } catch (e) {
    console.error('Verify error', e);
    res.status(500).send('Server Error');
  } finally {
    conn.release();
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { emailOrUsername, email, password } = req.body || {};
    const handle = (emailOrUsername || email || '').trim();

    if (!handle || !password) {
      return res.status(400).json({ message: 'email/username & password wajib' });
    }

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        'SELECT id, name, email, username, password_hash FROM users WHERE email = ? OR username = ? LIMIT 1',
        [handle, handle]
      );
      if (!rows.length) return res.status(401).json({ message: 'Email/username atau password salah' });

      const user = rows[0];
      if (user.status === 'disabled') {
    return res.status(403).json({ message: 'Akun belum diverifikasi. Cek email kamu.' });
}
      const ok = await bcrypt.compare(password, user.password_hash || '');
      if (!ok) return res.status(401).json({ message: 'Email/username atau password salah' });

      // Buat token & set cookie httpOnly
      const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000
        // secure: true // aktifkan saat sudah HTTPS
      });

      return res.json({ id: user.id, name: user.name, email: user.email, username: user.username });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Siapa saya (cek login)
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
       'SELECT id, name, email, username, phone, created_at FROM users WHERE id = ? LIMIT 1',
        [req.userId]
      );
      if (!rows.length) return res.status(404).json({ message: 'User tidak ditemukan' });
      return res.json(rows[0]);
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('me error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', path: '/' });
  // Opsional: bersihkan cookie site-wide di browser modern (hapus jika mengganggu)
  // res.setHeader('Clear-Site-Data', '"cookies"');
  res.json({ ok: true });
});

// ===== TASKS (To-Do List) =====

// Helper: parsing & validasi tanggal dari body (day, month, year, time)
function parseDateFromBody(body) {
  const {
    day,
    month,
    year,
    time
  } = body || {};

  const dNum = parseInt(day, 10);
  let mNum = parseInt(month, 10);
  const yNum = parseInt(year, 10);

  // Kalau month bukan angka (NaN), coba mapping nama bulan → angka (optional)
  if (Number.isNaN(mNum)) {
    const monthMap = {
      january: 1,
      february: 2,
      march: 3,
      april: 4,
      may: 5,
      june: 6,
      july: 7,
      august: 8,
      september: 9,
      october: 10,
      november: 11,
      december: 12
    };
    const key = String(month || '').toLowerCase();
    mNum = monthMap[key];
  }

  if (!dNum || !mNum || !yNum || !time) {
    return { error: 'Tanggal (dd/mm/yyyy) & waktu wajib diisi' };
  }

  const checkDate = new Date(yNum, mNum - 1, dNum);
  if (
    checkDate.getFullYear() !== yNum ||
    checkDate.getMonth() !== mNum - 1 ||
    checkDate.getDate() !== dNum
  ) {
    return { error: 'Tanggal tidak valid' };
  }

  if (!/^\d{2}:\d{2}$/.test(String(time))) {
    return { error: 'Format time harus HH:MM (24 jam)' };
  }

  const dueDate = `${yNum.toString().padStart(4, '0')}-${mNum
    .toString()
    .padStart(2, '0')}-${dNum.toString().padStart(2, '0')}`;
  const dueTime = String(time);

  return { dueDate, dueTime };
}

// GET semua task user (untuk halaman list)
app.get('/api/tasks', requireAuth, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.execute(
      `SELECT id, title, description, priority, category,
              DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date,
              TIME_FORMAT(due_time, '%H:%i') AS due_time,
              status
         FROM tasks
        WHERE user_id = ?
        ORDER BY due_date ASC, due_time ASC, id ASC`,
      [req.userId]
    );

    return res.json(rows);
  } catch (e) {
    console.error('GET /api/tasks error:', e);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    if (conn) conn.release();
  }
});

// GET satu task (untuk halaman edit /task/new/?id=...)
app.get('/api/tasks/:id', requireAuth, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;

    conn = await pool.getConnection();
    const [rows] = await conn.execute(
      `SELECT id, title, description, priority, category,
              DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date,
              TIME_FORMAT(due_time, '%H:%i') AS due_time,
              status
         FROM tasks
        WHERE id = ? AND user_id = ?`,
      [id, req.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Task tidak ditemukan' });
    }

    return res.json(rows[0]);
  } catch (e) {
    console.error('GET /api/tasks/:id error:', e);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    if (conn) conn.release();
  }
});

// POST buat task baru
app.post('/api/tasks', requireAuth, async (req, res) => {
  let conn;
  try {
    const {
      title,
      description,
      priority,
      category
    } = req.body || {};

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: 'Title wajib diisi' });
    }
    if (!category || !String(category).trim()) {
      return res.status(400).json({ message: 'Category wajib diisi' });
    }

    const allowedPriority = ['low', 'medium', 'high'];
    const priorityNorm = String(priority || 'low').toLowerCase();
    if (!allowedPriority.includes(priorityNorm)) {
      return res.status(400).json({ message: 'Priority tidak valid' });
    }

    const parsed = parseDateFromBody(req.body);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }
    const { dueDate, dueTime } = parsed;

    conn = await pool.getConnection();
    const [result] = await conn.execute(
      `INSERT INTO tasks
        (user_id, title, description, priority, category, due_date, due_time, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        req.userId,
        title,
        description || '',
        priorityNorm,
        category,
        dueDate,
        dueTime
      ]
    );

    return res.status(201).json({
      id: result.insertId,
      title,
      description: description || '',
      priority: priorityNorm,
      category,
      due_date: dueDate,
      due_time: dueTime,
      status: 'pending'
    });
  } catch (e) {
    console.error('POST /api/tasks error:', e);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    if (conn) conn.release();
  }
});

// PUT update task (edit)
app.put('/api/tasks/:id', requireAuth, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const {
      title,
      description,
      priority,
      category
    } = req.body || {};

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: 'Title wajib diisi' });
    }
    if (!category || !String(category).trim()) {
      return res.status(400).json({ message: 'Category wajib diisi' });
    }

    const allowedPriority = ['low', 'medium', 'high'];
    const priorityNorm = String(priority || 'low').toLowerCase();
    if (!allowedPriority.includes(priorityNorm)) {
      return res.status(400).json({ message: 'Priority tidak valid' });
    }

    const parsed = parseDateFromBody(req.body);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }
    const { dueDate, dueTime } = parsed;

    conn = await pool.getConnection();
    const [result] = await conn.execute(
      `UPDATE tasks
          SET title = ?,
              description = ?,
              priority = ?,
              category = ?,
              due_date = ?,
              due_time = ?
        WHERE id = ? AND user_id = ?`,
      [
        title,
        description || '',
        priorityNorm,
        category,
        dueDate,
        dueTime,
        id,
        req.userId
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Task tidak ditemukan' });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('PUT /api/tasks/:id error:', e);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    if (conn) conn.release();
  }
});

// PATCH ubah status (pending <-> completed) dari checkbox
app.patch('/api/tasks/:id/status', requireAuth, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    const newStatus = String(status || '').toLowerCase();
    if (!['pending', 'completed'].includes(newStatus)) {
      return res.status(400).json({ message: 'Status tidak valid' });
    }

    conn = await pool.getConnection();
    const [result] = await conn.execute(
      `UPDATE tasks
          SET status = ?
        WHERE id = ? AND user_id = ?`,
      [newStatus, id, req.userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Task tidak ditemukan' });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/tasks/:id/status error:', e);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    if (conn) conn.release();
  }
});

// DELETE hapus task (dari dropdown delete)
app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;

    conn = await pool.getConnection();
    const [result] = await conn.execute(
      `DELETE FROM tasks WHERE id = ? AND user_id = ?`,
      [id, req.userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Task tidak ditemukan' });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/tasks/:id error:', e);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    if (conn) conn.release();
  }
});

// ===== REMINDERS (Luxon + Termux-API) =====
const MONTH_MAP = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function sh(s) {
  return `'${String(s || '').replace(/'/g, `'\\''`)}'`;
}

// GET semua reminder milik user login (untuk halaman list /features/reminder/)
app.get('/api/reminders', requireAuth, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.execute(
      `SELECT
         id,
         title,
         description,
         tz,
         DATE_FORMAT(scheduled_local, '%Y-%m-%d %H:%i') AS scheduled_local,
         DATE_FORMAT(fire_at_utc, '%Y-%m-%d %H:%i') AS fire_at_utc,
         lead_minutes,
         channel,
         status,
         created_at,
         fired_at
       FROM reminders
       WHERE user_id = ?
       ORDER BY scheduled_local DESC`,
      [req.userId]
    );
    return res.json(rows);
  } catch (e) {
    console.error('GET /api/reminders error:', e);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    if (conn) conn.release();
  }
});

// GET satu reminder (untuk halaman edit /features/reminder/new/?id=...)
app.get('/api/reminders/:id', requireAuth, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    conn = await pool.getConnection();
    const [rows] = await conn.execute(
      `SELECT
         id,
         title,
         description,
         tz,
         DATE_FORMAT(scheduled_local, '%Y-%m-%d %H:%i') AS scheduled_local,
         DATE_FORMAT(fire_at_utc, '%Y-%m-%d %H:%i') AS fire_at_utc,
         lead_minutes,
         channel,
         status,
         created_at,
         fired_at
       FROM reminders
       WHERE id = ? AND user_id = ?`,
      [id, req.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Reminder tidak ditemukan' });
    }

    return res.json(rows[0]);
  } catch (e) {
    console.error('GET /api/reminders/:id error:', e);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    if (conn) conn.release();
  }
});



// Proteksi endpoint reminder: WAJIB login
app.post('/api/reminders', requireAuth, async (req, res) => {
  try {
    const {
      title, description,
      day, month, year,
      time,      // "HH:MM" 24 jam
      timezone,  // IANA TZ (ex: "Asia/Jakarta")
      leadMinutes,
      channel    // 'termux' (default) atau 'web'
    } = req.body || {};

    if (!title) return res.status(400).json({ message: 'title wajib diisi' });
    if (!day || !month || !year || !time) {
      return res.status(400).json({ message: 'Tanggal & waktu wajib diisi' });
    }

    // Fallback: timezone dari header kalau body kosong
    const tzEffective =
      (timezone && String(timezone).trim()) ||
      req.get('X-Timezone') ||
      '';

    if (!tzEffective) {
      return res.status(400).json({ message: 'Timezone tidak terdeteksi' });
    }

    // normalisasi bulan (angka / nama EN)
    let mNum = Number(month);
    if (Number.isNaN(mNum)) {
      const key = String(month).toLowerCase().trim();
      mNum = MONTH_MAP[key];
    }
    if (!mNum || mNum < 1 || mNum > 12) {
      return res.status(400).json({ message: 'Month tidak valid' });
    }

    const [hh, mm] = String(time).split(':').map(x => parseInt(x, 10));
    const yNum = parseInt(year, 10);
    const dNum = parseInt(day, 10);
    const lead = parseInt(leadMinutes || 0, 10) || 0;

    // Buat waktu lokal sesuai TZ
    const dtLocal = DateTime.fromObject(
      { year: yNum, month: mNum, day: dNum, hour: hh, minute: mm },
      { zone: tzEffective }
    );
    if (!dtLocal.isValid) {
      return res.status(400).json({ message: 'Tanggal/waktu atau timezone tidak valid' });
    }

    // Waktu eksekusi = (lokal) - lead → UTC
    const fireUtc = dtLocal.minus({ minutes: lead }).toUTC();

    const conn = await pool.getConnection();
    try {
      const [result] = await conn.execute(
        `INSERT INTO reminders
        (user_id, title, description, tz, scheduled_local, fire_at_utc, lead_minutes, channel)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.userId, // ← sekarang wajib & terisi user yang login
          title,
          description || '',
          tzEffective,
          dtLocal.toFormat('yyyy-LL-dd HH:mm:ss'),
          fireUtc.toFormat('yyyy-LL-dd HH:mm:ss'),
          lead,
          channel || DELIVERY_MODE
        ]
      );
      return res.json({
        id: result.insertId,
        fire_at_utc: fireUtc.toISO(),
        scheduled_local: dtLocal.toISO()
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('POST /api/reminders error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// PUT update reminder (dipakai saat edit dari /reminder/new/?id=...)
app.put('/api/reminders/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, description,
      day, month, year,
      time,
      timezone,
      leadMinutes,
      channel
    } = req.body || {};

    if (!title) return res.status(400).json({ message: 'title wajib diisi' });
    if (!day || !month || !year || !time) {
      return res.status(400).json({ message: 'Tanggal & waktu wajib diisi' });
    }

    const tzEffective =
      (timezone && String(timezone).trim()) ||
      req.get('X-Timezone') ||
      '';

    if (!tzEffective) {
      return res.status(400).json({ message: 'Timezone tidak terdeteksi' });
    }

    let mNum = Number(month);
    if (Number.isNaN(mNum)) {
      const key = String(month).toLowerCase().trim();
      mNum = MONTH_MAP[key];
    }
    if (!mNum || mNum < 1 || mNum > 12) {
      return res.status(400).json({ message: 'Month tidak valid' });
    }

    const [hh, mm] = String(time).split(':').map(x => parseInt(x, 10));
    const yNum = parseInt(year, 10);
    const dNum = parseInt(day, 10);
    const lead = parseInt(leadMinutes || 0, 10) || 0;

    const dtLocal = DateTime.fromObject(
      { year: yNum, month: mNum, day: dNum, hour: hh, minute: mm },
      { zone: tzEffective }
    );
    if (!dtLocal.isValid) {
      return res.status(400).json({ message: 'Tanggal/waktu atau timezone tidak valid' });
    }

    const fireUtc = dtLocal.minus({ minutes: lead }).toUTC();

    const conn = await pool.getConnection();
    try {
      const [result] = await conn.execute(
        `UPDATE reminders
            SET title = ?,
                description = ?,
                tz = ?,
                scheduled_local = ?,
                fire_at_utc = ?,
                lead_minutes = ?,
                channel = ?,
                status = 'scheduled',
                fired_at = NULL
          WHERE id = ? AND user_id = ?`,
        [
          title,
          description || '',
          tzEffective,
          dtLocal.toFormat('yyyy-LL-dd HH:mm:ss'),
          fireUtc.toFormat('yyyy-LL-dd HH:mm:ss'),
          lead,
          channel || DELIVERY_MODE,
          id,
          req.userId
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Reminder tidak ditemukan' });
      }

      return res.json({ ok: true });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('PUT /api/reminders/:id error:', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// DELETE reminder
app.delete('/api/reminders/:id', requireAuth, async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    conn = await pool.getConnection();
    const [result] = await conn.execute(
      `DELETE FROM reminders WHERE id = ? AND user_id = ?`,
      [id, req.userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Reminder tidak ditemukan' });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/reminders/:id error:', e);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    if (conn) conn.release();
  }
});

async function dispatchDue() {
  const mode = DELIVERY_MODE;
  const conn = await pool.getConnection();

  try {
    // Ambil reminder yang sudah waktunya
    // Kita JOIN dengan tabel users untuk ambil nomor HP pemilik reminder
    const [rows] = await conn.execute(
      `SELECT r.*, u.phone as user_phone
       FROM reminders r
       JOIN users u ON r.user_id = u.id
       WHERE r.status='scheduled' AND r.fire_at_utc <= UTC_TIMESTAMP()
       ORDER BY r.fire_at_utc ASC
       LIMIT 50`
    );

    for (const r of rows) {
      try {
        const title = r.title || 'Reminder';
        const content = (r.description && r.description.trim()) ? r.description : 'Waktunya!';
        const message = `🔔 *Reminder for you !!*\n\n_Title:_ ${title}\n\n_Detail:_ ${content}\n\nReady to run and crush it? 🔥\n— _Sent From Produse, stay organized_`;

        // 1. Cek Channel: WhatsApp
        // Kita kirim ke WA jika channelnya 'whatsapp' ATAU user memilih checkbox WA di frontend
        // (Di frontend kamu ada checkbox, asumsikan itu disimpan ke kolom 'channel')

        let sent = false;

        // LOGIC WHATSAPP
        if (r.channel === 'whatsapp' || r.channel.includes('whatsapp')) {
            if (r.user_phone) {
                try {
                    // Tembak API Bot Lokal di Port 8080
                    await axios.post('http://127.0.0.1:8080/send-message', {
                        target: r.user_phone,
                        message: message
                    });
                    console.log(`[Produse] WA dikirim ke ${r.user_phone}`);
                    sent = true;
                } catch (waErr) {
                    console.error('[Produse] Gagal kirim WA:', waErr.message);
                    // Jangan throw error agar code bisa lanjut update status
                }
            } else {
                console.log('[Produse] User tidak punya no HP di database');
            }
        }

        // LOGIC TERMUX (Default / Fallback)
        if (r.channel === 'termux' || mode === 'termux') {
             const cmd = `termux-notification --id ${r.id} --priority high --sound --title ${sh(title)} --content ${sh(content)}`;
             await new Promise((resolve) => exec(cmd, () => resolve()));
             sent = true;
        }

        // Update status jadi fired
        await conn.execute(
          `UPDATE reminders SET status='fired', fired_at=UTC_TIMESTAMP() WHERE id=?`,
          [r.id]
        );

      } catch (inner) {
        console.error('dispatchDue item error:', inner);
      }
    }

  } catch (e) {
    console.error('dispatchDue error:', e);
  } finally {
    conn.release();
  }
}

// Jalankan scheduler tiap 10 detik
setInterval(dispatchDue, 10_000);
console.log('Reminder dispatcher aktif (interval 10s). Mode:', DELIVERY_MODE);

// ===== RATE LIMITER SEDERHANA (In-Memory) =====
const resendCooldowns = new Map(); // Menyimpan timestamp request terakhir

const COOLDOWN_TIERS = [60, 120, 300, 600, 3600]; 

app.post('/api/auth/resend-verify', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email diperlukan' });

    const conn = await pool.getConnection();
    try {
      // 1. Ambil data user beserta history resend-nya
      const [users] = await conn.execute(
        'SELECT id, name, status, verification_token, resend_count, last_resend_time FROM users WHERE email = ? LIMIT 1',
        [email]
      );

      if (users.length === 0) return res.status(404).json({ message: 'Email tidak terdaftar' });
      const user = users[0];

      if (user.status === 'active') {
        return res.status(400).json({ message: 'Akun sudah aktif. Silakan login.' });
      }

      // 2. Cek apakah sudah melebih batas maksimal (Level 5)
      // Jika resend_count >= 5 (karena array index 0-4), maka blokir.
      if (user.resend_count >= COOLDOWN_TIERS.length) {
        return res.status(429).json({ 
          message: 'Terlalu banyak percobaan. Silakan hubungi support atau coba lagi besok.',
          blocked: true // Flag untuk frontend
        });
      }

      // 3. Hitung Waktu Cooldown
      const now = new Date(); // Waktu server sekarang
      const lastTime = new Date(user.last_resend_time || user.created_at); // Waktu terakhir kirim (atau waktu daftar)
      const diffSeconds = (now - lastTime) / 1000; // Selisih dalam detik
      
      // Ambil durasi cooldown berdasarkan level saat ini
      const requiredWait = COOLDOWN_TIERS[user.resend_count] || 60;

      // 4. Validasi Keamanan (Server-Side Guard)
      if (diffSeconds < requiredWait) {
        const remaining = Math.ceil(requiredWait - diffSeconds);
        return res.status(429).json({ 
          message: `Mohon tunggu ${remaining} detik lagi.`,
          remainingSeconds: remaining 
        });
      }

      // 5. Proses Kirim Email (Jika lolos validasi)
      let verifyToken = user.verification_token;
      // Jika token null (kasus langka), generate baru
      if (!verifyToken) {
        verifyToken = crypto.randomBytes(32).toString('hex');
      }

      // Update Database DULU sebelum kirim (untuk mengunci state)
      // Kita update token (jaga-jaga), naikkan resend_count, dan update waktu sekarang
      await conn.execute(
        `UPDATE users 
         SET verification_token = ?, 
             resend_count = resend_count + 1, 
             last_resend_time = NOW() 
         WHERE id = ?`,
        [verifyToken, user.id]
      );

      // Kirim Email via Brevo
      const verifyLink = `${process.env.BASE_URL || 'http://127.0.0.1:3000'}/api/auth/verify-email?token=${verifyToken}`;
      const mailOptions = {
        from: `"Produse Team" <produsehub@gmail.com>`,
        to: email,
        subject: 'Resend: Verify your Produse Account',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #1976D2;">Verify Your Email</h2>
            <p>Hi ${user.name},</p>
            <p>Here is your new verification link. Please click below to activate:</p>
            <br>
            <a href="${verifyLink}" style="background-color: #1976D2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verify Account</a>
            <br><br>
            <p style="font-size: 13px; color: #888;">This is attempt #${user.resend_count + 1}.</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);

      // Hitung cooldown untuk tahap SELANJUTNYA agar frontend bisa langsung update timer
      const nextLevel = user.resend_count + 1;
      const nextWait = (nextLevel < COOLDOWN_TIERS.length) ? COOLDOWN_TIERS[nextLevel] : -1;

      return res.json({ 
        message: 'Email berhasil dikirim ulang!',
        nextCooldown: nextWait // Beritahu frontend berapa lama harus nunggu berikutnya
      });

    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('Resend error:', e);
    return res.status(500).json({ message: 'Server error saat mengirim email.' });
  }
});

// ===== Start server =====
app.listen(PORT, () => {
  console.log(`API + Static ready at http://127.0.0.1:${PORT}`);
  console.log('Serving /public via Express (tanpa python http.server)');
});
