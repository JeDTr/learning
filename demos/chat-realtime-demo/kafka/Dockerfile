FROM node:20-alpine

WORKDIR /app

# better-sqlite3 la native module, can build tools de compile luc npm install
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --omit=dev && apk del python3 make g++

COPY src ./src
COPY public ./public

EXPOSE 3000

CMD ["node", "src/index.js"]
