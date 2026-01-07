# Next.js frontend for Archon - development mode
FROM node:18-alpine

WORKDIR /app

# Install system dependencies needed for some npm packages
RUN apk add --no-cache python3 make g++ git curl

# Copy package files
COPY package*.json ./

# Install dependencies including dev dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose port 3738 (configured in package.json)
EXPOSE 3738

# Environment variables
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# Start Next.js dev server (port 3738 configured in package.json)
CMD ["npm", "run", "dev"]
