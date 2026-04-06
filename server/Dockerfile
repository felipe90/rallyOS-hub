FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Generate SSL certs if they don't exist (safety measure)
RUN apk add --no-cache openssl && \
    openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=AR/ST=BA/L=City/O=RallyOS/OU=Dev/CN=localhost" || true

# Compile TypeScript
RUN npx tsc

# Expose HTTPS port
EXPOSE 3000

CMD ["npx", "tsx", "src/index.ts"]
