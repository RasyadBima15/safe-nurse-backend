import { createLogger, transports, format } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    // Hanya sisakan transport Console. Ini sudah cukup untuk Vercel.
    new transports.Console()
  ]
});

export default logger;