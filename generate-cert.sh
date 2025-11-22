#!/bin/bash

echo "========================================"
echo "  Generating HTTPS Certificate"
echo "========================================"
echo ""

# Check if OpenSSL is installed
if ! command -v openssl &> /dev/null; then
    echo "ERROR: OpenSSL is not installed!"
    echo ""
    echo "Please install OpenSSL:"
    echo "  Mac: brew install openssl"
    echo "  Linux: sudo apt-get install openssl"
    echo ""
    exit 1
fi

# Create certs directory
mkdir -p certs

# Check if certificates already exist
if [ -f "certs/localhost.key" ] && [ -f "certs/localhost.crt" ]; then
    echo "✅ Certificates already exist!"
    echo ""
    exit 0
fi

echo "Generating self-signed certificate..."
echo ""

openssl req -x509 -newkey rsa:4096 \
    -keyout certs/localhost.key \
    -out certs/localhost.crt \
    -days 365 \
    -nodes \
    -subj "/C=IN/ST=State/L=City/O=OneRupeeRapidFix/CN=localhost"

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "  Certificate Generated Successfully!"
    echo "========================================"
    echo ""
    echo "Next steps:"
    echo "1. Trust the certificate (see HTTPS_SETUP.md)"
    echo "2. Restart your dev server"
    echo "3. Access via https://localhost:8080"
    echo ""
    
    # Make key readable only by owner
    chmod 600 certs/localhost.key
    chmod 644 certs/localhost.crt
else
    echo ""
    echo "ERROR: Failed to generate certificate"
    echo ""
    exit 1
fi

