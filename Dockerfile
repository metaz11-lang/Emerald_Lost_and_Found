# Multi-stage build for Emerald Lost and Found
# 1. Base runtime image (slim) since app is static + lightweight API
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# Install only production deps (there are almost none besides express & middleware)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev || npm install --production

# Copy application source (only what we need)
COPY src ./src
COPY public ./public

# Expose the port (configurable via PORT env at runtime)
EXPOSE 3000

# Default environment variables (can be overridden)
ENV PORT=3000 \
    ADMIN_USERNAME=admin \
    ADMIN_PASSWORD=emerald2024

CMD ["node", "src/index.js"]
