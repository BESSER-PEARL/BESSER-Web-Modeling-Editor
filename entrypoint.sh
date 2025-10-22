#!/bin/bash

echo "Docker container has been started"

cd /var/apollon_standalone/build/server
node server.js
