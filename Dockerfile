FROM node:20-alpine

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
