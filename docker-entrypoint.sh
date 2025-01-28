#!/bin/sh
# Replace API URL in all JS files
find /app/dist -type f -name "*.js" -exec sed -i "s|http://localhost:8000|${REACT_APP_API_URL}|g" {} +
# Execute the original command
exec "$@"