FROM node:20-alpine

# System Chromium (musl-compatible) + wrapper that adds the flags needed when running as root
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont font-noto-emoji \
 && printf '#!/bin/sh\nexec /usr/bin/chromium --no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu "$@"\n' > /usr/local/bin/chromium-nosandbox \
 && chmod +x /usr/local/bin/chromium-nosandbox

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/local/bin/chromium-nosandbox

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000

RUN npm run build

EXPOSE 3000

VOLUME ["/app/data"]

CMD ["npm", "start"]