const fs = require("fs");
require("dotenv").config();
const envFile = fs.existsSync(".env.local") ? ".env.local" : ".env";
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const { error, timeStamp } = require("console");
const path = require("path");
const { uptime } = require("process");

const authRoutes = require('./routes/auth')
const financeRoutes = require('./routes/finance')

const app = express();
const PORT = process.env.PORT || 3000;
// exports.app = app;

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false, // jika sudah live vercel trues
            maxAge: 1000 * 60 * 60 * 24,
        },
    }),
);

app.get("/", (req, res) => {
    res.send("Session berhasil dipasang");
});

app.listen(PORT, () =>
    console.log(`Server berjalan di port ${PORT} (menggunakan ${envFile})`),
);

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://cdn.tailwindcss.com",
                    "https://cdn.jsdelivr.net",
                ],
                styletSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://font.googlelapis.com",
                    "https://cdn.jsdelivr.net",
                ],
                fontSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://font.gstatic.com",
                    "https://cdn.jsdelivr.net",
                ],
                imgSrc: ["'self'", "data:", "https:"],
            },
        },
    }),
);

app.use(
    cors({
        origin:
            process.env.NODE_ENV === 'production' ? false : 'https://localhost:3000',
        credentials: true,
    }),
);

app.use(morgan('dev'));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.SESSION_SECRET));

// Rate Limit
const limiter = rateLimit({
    windowMs: 15 * 60 * 100,
    max: 100,
    message: { error: 'To many requests, please try again later.' },
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 100,
    max: 20,
    message: { error: 'To many requests, please try again later.' },
});

app.use('/api/', limiter);
app.use('/api/auth', authLimiter);

// static File
app.use(express.static(path.join(__dirname, 'public')));

// make supabase accesible to route
app.use((req, res, next) => {
    ((req.supabase = supabase), next());
});

app.get('/api/auth', authRoutes);
app.get('/api/finance', financeRoutes);

// health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime,
    });
});

// serve frontend for all other routes
app.get('get', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// erro handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error:
            process.env.NODE_ENV === 'production'
                ? 'Internal server error'
                : err.message,
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'route not found' });
});

app.listen(PORT, () => {
    console.log(
        `╔══════════════════════════════════════════╗
║   💰 Pencatat Keuangan Pro Max v2.0     ║
║   🚀 Server running on port ${PORT}        ║
║   🌐 http://localhost:${PORT}              ║
╚══════════════════════════════════════════╝`,
    );
});

module.exports = app