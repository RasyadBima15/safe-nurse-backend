import express from "express";
import cors from "cors";
import dotenv from "dotenv";

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

// Middleware lain
app.use(express.json());

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