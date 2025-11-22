/**
 * HTTPS Setup Script for Local Network Access
 * Generates self-signed certificate for HTTPS
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const certDir = path.join(__dirname, 'certs');
const keyPath = path.join(certDir, 'localhost.key');
const certPath = path.join(certDir, 'localhost.crt');

// Create certs directory if it doesn't exist
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir, { recursive: true });
}

// Check if certificates already exist
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  console.log('✅ HTTPS certificates already exist');
  console.log(`   Key: ${keyPath}`);
  console.log(`   Cert: ${certPath}`);
  process.exit(0);
}

console.log('🔐 Generating HTTPS certificates...');
console.log('');

try {
  // Generate self-signed certificate
  // This creates a certificate valid for 365 days
  const command = `openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/C=IN/ST=State/L=City/O=OneRupeeRapidFix/CN=localhost"`;
  
  execSync(command, { stdio: 'inherit' });
  
  console.log('');
  console.log('✅ HTTPS certificates generated successfully!');
  console.log(`   Key: ${keyPath}`);
  console.log(`   Cert: ${certPath}`);
  console.log('');
  console.log('📝 Next steps:');
  console.log('   1. Trust the certificate (see HTTPS_SETUP.md)');
  console.log('   2. Restart your dev server');
  console.log('   3. Access via https://localhost:8080 or https://YOUR_IP:8080');
} catch (error) {
  console.error('❌ Error generating certificates:', error.message);
  console.log('');
  console.log('💡 Alternative: Install OpenSSL:');
  console.log('   Windows: https://slproweb.com/products/Win32OpenSSL.html');
  console.log('   Mac: brew install openssl');
  console.log('   Linux: sudo apt-get install openssl');
  process.exit(1);
}

