FROM node:18.20.4

WORKDIR /app

# Install dos2unix first
RUN apt-get update && apt-get install -y dos2unix

# Copy package files
COPY package*.json ./

# Disable husky completely
ENV HUSKY=0
ENV DISABLE_HUSKY=1
ENV CI=true

# Copy the rest of the application code
COPY . .

# Install dependencies without running scripts
RUN npm install --ignore-scripts

# Build the production version with the API URL
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
RUN npm run build

# Install a simple HTTP server for serving static files
RUN npm install -g http-server

# Fix line endings and permissions for entrypoint script
COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh && \
    dos2unix /docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["http-server", "dist", "-p", "8080"]