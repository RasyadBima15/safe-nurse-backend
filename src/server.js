import app from './app.js';
import './cron/notifikasiLaporanOverdue.js'

const PORT = process.env.PORT

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// export default app;