// src/middleware/auth.js (Kode yang Sudah Diperbaiki)

// UBAH BAGIAN INI: dari require menjadi import
import jwt from "jsonwebtoken";

// UBAH BAGIAN INI: tambahkan 'export' di depan fungsi
export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Token tidak ada" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Token tidak valid" });
    req.user = user;
    next();
  });
}

// UBAH BAGIAN INI: tambahkan 'export' di depan fungsi
export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Akses ditolak" });
    }
    next();
  };
}

// HAPUS BAGIAN INI
// module.exports = { authenticateToken, authorizeRoles };