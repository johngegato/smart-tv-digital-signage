# Dockerfile for Digital Signage Desktop Manager Server
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy root package files
COPY package*.json ./
RUN npm install --only=production

# Copy server directory and package
COPY server/ ./server/
WORKDIR /app/server
RUN npm install --only=production

# Copy entire application static files
WORKDIR /app
COPY . .

# Expose server HTTP & WebSocket port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Run Desktop Manager server
CMD ["node", "server/server.js"]
