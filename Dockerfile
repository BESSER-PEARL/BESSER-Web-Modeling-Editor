# Multistage Docker build

# Define build directory as an absolute path
ARG build_dir=/build_application

# First stage: Builds the application
FROM node:22-alpine as builder

ARG build_dir
ENV DEPLOYMENT_URL="http://localhost:8080"

# Set up the build directory
WORKDIR $build_dir

# Copy all project files into the build directory
COPY . .

# Install dependencies and build the application
RUN npm install
RUN npm run build

# Second stage: Sets up the container to run the application
FROM node:22-alpine

# Expose the application's default port
EXPOSE 8080

# Create a user and set up necessary directories and permissions
RUN adduser -D -s /bin/sh besser_standalone \
    && mkdir /opt/besser

RUN chown -R besser_standalone /opt/besser

# Switch to non-root user for security
USER besser_standalone
WORKDIR /opt/besser

# Copy build results from the first stage
COPY --chown=besser_standalone:besser_standalone --from=builder /build_application/build ./build

# Set the working directory for the server
WORKDIR /opt/besser/build/server

# Start the application
CMD [ "node", "bundle.js" ]
