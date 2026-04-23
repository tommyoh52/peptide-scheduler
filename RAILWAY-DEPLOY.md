# Deploying Peptide App to Railway

All web dashboard — no terminal needed. Total time: ~10 minutes.

---

## Step 0: Upload this version to GitHub first

Open [github.com/tommyoh52/peptide-app](https://github.com/tommyoh52/peptide-app).

You want to make sure these files are in the repo:
- `Dockerfile`
- `railway.json`
- `RAILWAY-DEPLOY.md` (this file)

And this file is REMOVED (or it's fine if it stays, just ignored):
- `render.yaml`

Upload the new zip contents the same way you've been doing. Commit.

(Easiest: delete the whole repo and re-upload from scratch to make sure it's clean.)

---

## Step 1: Sign in to Railway

1. Go to [railway.com](https://railway.com)
2. Click **Login** (top right)
3. Sign in with your **GitHub account** — click "Login with GitHub"

---

## Step 2: Create a new project from your GitHub repo

1. On the Railway dashboard, click **"+ New Project"**
2. Choose **"Deploy from GitHub repo"**
3. If prompted, authorize Railway to access your GitHub (grant access to at least `peptide-app`)
4. Find and click **`tommyoh52/peptide-app`**
5. Click **"Deploy Now"**

Railway will start building. Because we included a `Dockerfile` and `railway.json`, it will skip auto-detection (this is the thing that broke last time).

The first build takes ~4–6 minutes. Watch it from the "Deployments" tab.

---

## Step 3: Add a persistent volume (so data survives redeploys)

1. In your project, click on the **peptide-app** service (the box on the canvas)
2. Click the **"Settings"** tab
3. Scroll down to **"Volumes"**
4. Click **"+ New Volume"**
5. **Mount path:** `/data`
6. **Size:** 1 GB (default is fine)
7. Click **Create**

Railway will redeploy automatically with the volume attached.

---

## Step 4: Set environment variables

1. In the same service, click the **"Variables"** tab
2. Click **"+ New Variable"** and add each of these one by one:

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATA_DIR` | `/data` |
| `PORT` | `8080` |
| `VAPID_SUBJECT` | `mailto:tommyoh52@gmail.com` |

If you later get Resend/Twilio keys, add:
- `RESEND_API_KEY` — your Resend key
- `FROM_EMAIL` — email you verified with Resend
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` — your Twilio info

Railway will redeploy after you save variables. Wait ~3 minutes.

---

## Step 5: Generate a public URL

1. Go back to the **"Settings"** tab
2. Scroll to **"Networking"**
3. Click **"Generate Domain"**

Railway gives you a URL like `peptide-app-production-xxxx.up.railway.app`.

Click it — your app is live.

---

## Step 6: (Optional) Use a custom domain

If you buy a domain (Namecheap, Cloudflare, etc.) and want `app.yourdomain.com`:

1. Settings → Networking → **Custom Domain**
2. Enter your domain
3. Railway tells you a CNAME to add at your domain registrar
4. Add the CNAME. Wait ~5 min for DNS. Done.

---

## Ongoing: How updates work

Every time I send you a new zip:

1. Upload to GitHub as usual (or delete repo + re-upload — cleanest)
2. Railway **auto-deploys on every push** — no extra steps
3. Your data is safe on the volume

---

## Costs

Railway's Hobby plan is **$5/month** and includes $5 of compute credit. Your app will use only a fraction of that. Effectively ~$5/mo total for always-on, never-sleeping, data-persistent hosting.

They also have a **free trial** ($5 one-time credit) — use it to test without committing. Check your billing page at any time: [railway.com/account/billing](https://railway.com/account/billing).

---

## If something goes wrong

- **Build fails:** Click the failed deployment → "View Logs" → send me the error
- **App starts but site is blank:** Check you set all 4 environment variables; check logs for errors
- **Lost data after redeploy:** The volume isn't attached — verify under Settings → Volumes that it's mounted at `/data`
- **Can't click "Deploy Now"** (grayed out): Railway may need you to add a payment method first — Settings → Billing on your account

---

## Why this will work this time (unlike last Railway attempt)

Last time we hit these issues:
- ❌ Railway couldn't auto-detect the Node+Vite build → this time we give it a **Dockerfile** it'll use directly
- ❌ Conflicting `railway.json` + `railpack.json` → only one config file now
- ❌ Nested folder in the GitHub upload → make sure files are at the repo ROOT

If the build still fails, it's a logs issue, not a config issue — send me the error and I'll fix it fast.
