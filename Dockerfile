# PulseChat - Container Deployment
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Run demo seeding during build/startup if database not present
RUN node server/seed.js

# Expose Render PORT
ENV PORT=3000
EXPOSE 3000

# Start server
CMD ["node", "server/index.js"]
