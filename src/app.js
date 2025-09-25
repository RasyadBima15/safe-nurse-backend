import express from 'express';
import cors from 'cors';
// import helmet from 'helmet';
// import morgan from 'morgan';
import dotenv from 'dotenv';

import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/user.routes.js';
import ruanganRoutes from './modules/ruangan/ruangan.routes.js';
import perawatRoutes from './modules/perawat/perawat.routes.js';
import kepalaRuanganRoutes from './modules/kepala_ruangan/kepala_ruangan.routes.js';
import verifikatorRoutes from './modules/verifikator/verifikator.routes.js';
import ipcnRoutes from './modules/chief_nursing/chief_nursing.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import forgotPasswordRoutes from './modules/forgot-password/forgot_password.routes.js';
import laporanRoutes from './modules/laporan/laporan.routes.js';
import notifikasiRoutes from './modules/notifikasi/notifikasi.routes.js';

dotenv.config();
const app = express();

app.use((req, res, next) => {
  console.log("👉 Request masuk:", req.method, req.path, "Origin:", req.headers.origin);
  next();
});

// ✅ Konfigurasi CORS
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  // kalau frontend kamu deploy, tambahkan di sini:
  // "https://safenurse.site"
];

const corsOptions = {
  origin: function (origin, callback) {
    console.log("🔥 Request dari origin:", origin);
    if (!origin || allowedOrigins.includes(origin)) {
      console.log("✅ Origin diizinkan:", origin);
      callback(null, true);
    } else {
      console.log("❌ Origin ditolak:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
// app.use(helmet());
app.use(express.json());
// app.use(morgan('dev'));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ruangan', ruanganRoutes);
app.use('/api/perawat', perawatRoutes);
app.use('/api/kepala_ruangan', kepalaRuanganRoutes);
app.use('/api/verifikator', verifikatorRoutes);
app.use('/api/chief_nursing', ipcnRoutes);
app.use('/api/super_admin', adminRoutes);
app.use('/api/forgot_password', forgotPasswordRoutes);
app.use('/api/laporan', laporanRoutes);
app.use('/api/notifikasi', notifikasiRoutes);

export default app;