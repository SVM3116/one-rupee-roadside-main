@echo off
echo ========================================
echo   Generating HTTPS Certificate
echo ========================================
echo.

REM Check if OpenSSL is installed
where openssl >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: OpenSSL is not installed!
    echo.
    echo Please install OpenSSL:
    echo 1. Download from: https://slproweb.com/products/Win32OpenSSL.html
    echo 2. Install it
    echo 3. Add to PATH or restart terminal
    echo.
    pause
    exit /b 1
)

REM Create certs directory
if not exist "certs" mkdir certs

REM Check if certificates already exist
if exist "certs\localhost.key" if exist "certs\localhost.crt" (
    echo Certificates already exist!
    echo.
    pause
    exit /b 0
)

REM Create minimal OpenSSL config
echo Creating OpenSSL configuration...
(
echo [req]
echo distinguished_name = req_distinguished_name
echo x509_extensions = v3_req
echo prompt = no
echo.
echo [req_distinguished_name]
echo C = IN
echo ST = State
echo L = City
echo O = OneRupeeRapidFix
echo CN = localhost
echo.
echo [v3_req]
echo keyUsage = keyEncipherment, dataEncipherment
echo extendedKeyUsage = serverAuth
echo subjectAltName = @alt_names
echo.
echo [alt_names]
echo DNS.1 = localhost
echo IP.1 = 127.0.0.1
) > certs\openssl.conf

echo Generating self-signed certificate...
echo.

openssl req -x509 -newkey rsa:2048 -keyout certs\localhost.key -out certs\localhost.crt -days 365 -nodes -config certs\openssl.conf

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   Certificate Generated Successfully!
    echo ========================================
    echo.
    echo Files created:
    echo   - certs\localhost.key
    echo   - certs\localhost.crt
    echo.
    echo Next steps:
    echo 1. Trust the certificate (see SIMPLE_HTTPS_STEPS.md)
    echo 2. Start server: npm run dev
    echo 3. Access via https://localhost:8080
    echo.
) else (
    echo.
    echo ERROR: Failed to generate certificate
    echo Try running as Administrator
    echo.
)

pause

