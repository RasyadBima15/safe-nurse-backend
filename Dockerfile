# Gunakan base image Node.js
FROM node:20-alpine

# Set working directory di dalam container
WORKDIR /app

# Copy package.json dan package-lock.json terlebih dahulu
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy semua file project
COPY . .

# Expose port (misal Express jalan di 3000)
EXPOSE 3000

# Jalankan aplikasi
CMD ["npm", "start"]