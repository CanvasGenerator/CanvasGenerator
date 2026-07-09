FROM node:20-alpine
WORKDIR /app

# Dépendances d'abord (cache Docker)
COPY package*.json ./
RUN npm install --omit=dev

# Code de l'app
COPY . .

ENV PORT=8000
EXPOSE 8000
CMD ["node", "server.js"]