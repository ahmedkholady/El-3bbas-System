# Use a Node.js base image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install dependencies (only production dependencies to keep the image small)
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on (Back4app usually uses PORT env var)
# We'll default to 5000 as per the app's server.js
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
