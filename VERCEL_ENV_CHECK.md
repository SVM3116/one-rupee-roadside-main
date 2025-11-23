# ✅ Quick Check: Vercel Environment Variables

## 🔍 What to Check Right Now:

Go to: https://vercel.com/your-account/onerupeerapidfix/settings/environment-variables

### Required Variables:

1. **VITE_SUPABASE_URL**
   - Should be: `https://hdmqlewslxfksjhfsvpv.supabase.co` (or your Supabase URL)
   - ✅ Must exist
   - ✅ Must be correct

2. **VITE_SUPABASE_PUBLISHABLE_KEY**
   - Should start with: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - ✅ Must exist
   - ✅ Must be the **anon public** key (not service_role)

3. **VITE_GOOGLE_MAPS_API_KEY**
   - Your Google Maps API key
   - ✅ Must exist

4. **VITE_API_BASE**
   - Should be: `https://dside-main-production-b7e7.up.railway.app`
   - ✅ Must exist
   - ✅ Must match your Railway backend URL

---

## ⚠️ Common Mistakes:

1. **Missing "VITE_" prefix** - All frontend variables MUST start with `VITE_`
2. **Wrong key** - Using service_role instead of anon public key
3. **Not redeploying** - Variables only apply after redeployment
4. **Wrong environment** - Make sure all checkboxes are selected (Production, Preview, Development)

---

## 🚀 Quick Fix:

1. Go to Vercel → Settings → Environment Variables
2. Verify all 4 variables are there with correct values
3. If any are missing/wrong → Update them
4. Go to Deployments → Redeploy
5. Wait 2-3 minutes
6. Test again!

---

**This should fix the "invalid api key" error!** ✅

