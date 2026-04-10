FROM node:20-slim

# Instalar dependencias de Chromium para Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-freefont-ttf \
    python3 \
    make \
    g++ \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Configurar Puppeteer para usar Chromium del sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Instalar dependencias del servidor
COPY package*.json ./
RUN npm ci --omit=dev

# Instalar dependencias y buildear el frontend
COPY client/package*.json ./client/
RUN cd client && npm ci
COPY client/ ./client/
RUN cd client && npm run build

# Copiar el resto del código
COPY . .

# Directorio para datos persistentes (montar volumen aquí en Railway)
RUN mkdir -p /data/uploads
RUN mkdir -p /app/.wwebjs_auth

ENV DATA_DIR=/data

EXPOSE 3000

CMD ["npm", "start"]
