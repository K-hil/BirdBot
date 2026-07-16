FROM node:20-slim

WORKDIR /app

EXPOSE 8080

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

CMD ["sh", "-c", "npm run register && exec npm start"]