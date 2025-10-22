# Multistage Docker build

# Define build directory as an absolute path
ARG build_dir=/build_application

# First stage: Builds the application
FROM node:20.18.0 as builder

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
FROM node:20.18.0

# Install cron for scheduling
RUN apt-get update && apt-get -y install cron

# Expose the application's default port
EXPOSE 8080

# Create a user and set up necessary directories and permissions
RUN useradd -r -s /bin/false apollon_standalone \
    && mkdir /opt/apollon_standalone \
    && touch /var/log/cron.log \
    && chmod 622 /var/log/cron.log

# Start cron service
RUN service cron start
RUN chown -R apollon_standalone /opt/apollon_standalone

# Switch to non-root user for security
USER apollon_standalone
WORKDIR /opt/apollon_standalone

# Create a directory for storing diagrams
RUN mkdir diagrams

# Copy build results from the first stage
COPY --chown=apollon_standalone:apollon_standalone --from=builder $build_dir .

# Add cron job for deleting stale diagrams
RUN crontab delete-stale-diagrams.cronjob.txt

# Set the working directory for the server
WORKDIR /opt/apollon_standalone/build/server

# Start the application
CMD [ "node", "./src/main/server.js" ]
