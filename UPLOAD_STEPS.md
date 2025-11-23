# Upload to GitHub - 3 Steps

## Step 1: Install Git OR GitHub Desktop

**Option A: GitHub Desktop (Easiest)**
1. Download: https://desktop.github.com
2. Install and sign in

**Option B: Git Command Line**
1. Download: https://git-scm.com/download/win
2. Install and restart terminal

---

## Step 2: Create GitHub Repository

1. Go to: https://github.com
2. Click "+" → "New repository"
3. Name: `one-rupee-rapidfix`
4. Click "Create repository"
5. Copy the repository URL

---

## Step 3: Upload Project

**If using GitHub Desktop:**
1. Open GitHub Desktop
2. File → Add Local Repository
3. Choose: `C:\Users\mdrs\Downloads\one-rupee-roadside-main\one-rupee-roadside-main`
4. Click "Publish repository"
5. Done ✅

**If using Git:**
```bash
cd "C:\Users\mdrs\Downloads\one-rupee-roadside-main\one-rupee-roadside-main"
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USERNAME/one-rupee-rapidfix.git
git branch -M main
git push -u origin main
```

---

**Done! Your project is on GitHub.**

