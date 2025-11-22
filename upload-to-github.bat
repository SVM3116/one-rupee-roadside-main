@echo off
echo ========================================
echo  Upload Project to GitHub
echo ========================================
echo.

REM Check if git is installed
git --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git is not installed!
    echo Please install Git from: https://git-scm.com/download/win
    pause
    exit /b 1
)

echo Step 1: Checking if git is initialized...
if exist .git (
    echo Git is already initialized.
) else (
    echo Initializing git...
    git init
)

echo.
echo Step 2: Checking git configuration...
git config user.name >nul 2>&1
if errorlevel 1 (
    echo Git user name not set. Please enter your name:
    set /p GIT_NAME="Your name: "
    git config --global user.name "%GIT_NAME%"
)

git config user.email >nul 2>&1
if errorlevel 1 (
    echo Git email not set. Please enter your email:
    set /p GIT_EMAIL="Your email: "
    git config --global user.email "%GIT_EMAIL%"
)

echo.
echo Step 3: Adding all files...
git add .

echo.
echo Step 4: Creating commit...
git commit -m "Initial commit: ONE RUPEE RAPIDFIX - Roadside Mechanic Assistance System"

echo.
echo ========================================
echo  Next Steps:
echo ========================================
echo.
echo 1. Create a repository on GitHub:
echo    - Go to: https://github.com
echo    - Click "+" ^> "New repository"
echo    - Name it: one-rupee-rapidfix
echo    - Click "Create repository"
echo.
echo 2. Copy your repository URL (looks like):
echo    https://github.com/your-username/one-rupee-rapidfix.git
echo.
echo 3. Run these commands:
echo    git remote add origin YOUR_REPOSITORY_URL
echo    git branch -M main
echo    git push -u origin main
echo.
echo Or use GitHub Desktop for easier upload!
echo.
pause

