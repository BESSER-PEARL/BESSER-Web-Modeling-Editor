# Dockerfile for BESSER Modeling Agent
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the modeling agent code
COPY . .

# Expose the websocket port
EXPOSE 8765

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Create entrypoint script that generates config.ini from environment variables
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Generate config.ini from environment variables\n\
cat > /app/config.ini << EOF\n\
[agent]\n\
name = uml_modeling_agent\n\
\n\
[nlp]\n\
openai.api_key = ${OPENAI_API_KEY:-}\n\
\n\
[websocket]\n\
host = 0.0.0.0\n\
port = 8765\n\
EOF\n\
\n\
echo "✅ config.ini created successfully"\n\
cat /app/config.ini\n\
\n\
# CRITICAL FIX: Patch BESSER framework to use 0.0.0.0 instead of localhost default\n\
echo "🔧 Patching BESSER framework WebSocket host default..."\n\
WEBSOCKET_INIT="/usr/local/lib/python3.11/site-packages/besser/agent/platforms/websocket/__init__.py"\n\
if [ -f "$WEBSOCKET_INIT" ]; then\n\
    sed -i "s/,  *str,  *. *localhost. *)/,  str,  '\''0.0.0.0'\'')/g" "$WEBSOCKET_INIT"\n\
    echo "✅ BESSER framework patched: WebSocket will bind to 0.0.0.0"\n\
else\n\
    echo "⚠️  Warning: Could not find BESSER WebSocket init file to patch"\n\
fi\n\
\n\
# Run the modeling agent\n\
exec python modeling_agent.py\n\
' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import socket; s=socket.socket(); s.connect(('localhost', 8765)); s.close()" || exit 1

# Run the entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]
