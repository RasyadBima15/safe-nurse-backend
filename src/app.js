import express from 'express';
import cors from 'cors';
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

const allowedOrigins = [
  'https://safe-nurse-lzam.vercel.app',
  'https://www.safenurse.site',
  'http://localhost:3000'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  credentials: true
}));


app.options('*', cors()); 
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