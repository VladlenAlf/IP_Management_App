# We use the official Node.js image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy the remaining application files
COPY . .

# Create directories for uploads and database
RUN mkdir -p uploads data && \
    chown -R node:node /app

# Switch to the node user for security
USER node

# Set the database path variable
ENV DB_PATH=/app/data/ip_management.db

# Open port 3000
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Start the application
CMD ["npm", "start"]
