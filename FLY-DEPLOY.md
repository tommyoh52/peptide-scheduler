# Deploying Peptide App to Fly.io

Total time: ~15 min. You'll need a computer (not phone) for this.

---

## 1. Install the Fly CLI (`flyctl`)

Open a terminal.

**Mac:**
```
brew install flyctl
```
If you don't have Homebrew:
```
curl -L https://fly.io/install.sh | sh
```

**Windows (PowerShell):**
```
iwr https://fly.io/install.ps1 -useb | iex
```

After install, restart your terminal so `flyctl` is on your PATH. Verify:
```
fly version
```

---

## 2. Sign up / log in

```
fly auth signup
```
or if you already have an account:
```
fly auth login
```
Opens a browser, approve, come back.

You'll be asked for a credit card. **Fly.io won't charge you if you stay in the free allowance**, but they require a card to prevent abuse. Your app will be well under the free limit.

---

## 3. Unzip the project and `cd` into it

Wherever you unzipped `peptide-app.zip`:
```
cd peptide-app
```

Make sure you see `Dockerfile`, `fly.toml`, and `package.json` in the folder:
```
ls
```

---

## 4. Launch the app

```
fly launch --no-deploy
```

**Answers when it prompts:**

| Prompt | Answer |
|---|---|
| "Would you like to copy configuration to the new app?" | **Yes** |
| "Choose an app name" | `peptide-app` (or `peptide-app-tom` if taken) |
| "Choose a region" | **sea** (Seattle) — closest to Hawaii |
| "Would you like to set up a Postgresql database?" | **No** |
| "Would you like to set up an Upstash Redis database?" | **No** |
| "Would you like to deploy now?" | **No** (we need to create the volume first) |

This writes your app info to `fly.toml`. If the CLI rewrote your `app =` or `primary_region =` lines, that's fine — keep its values.

---

## 5. Create the persistent volume

This is where your SQLite database lives so it survives redeploys:

```
fly volumes create peptide_data --region sea --size 1
```

When asked "Do you still want to use volumes?" say **yes**.

(`peptide_data` must match the `source` in `fly.toml`. 1 GB is plenty and is inside the free allowance.)

---

## 6. Set your secrets

VAPID keys (for desktop push notifications):
```
fly secrets set VAPID_SUBJECT="mailto:tommyoh52@gmail.com"
```

If you later want email + SMS reminders:
```
fly secrets set RESEND_API_KEY="re_xxx" FROM_EMAIL="notifications@yourdomain.com"
fly secrets set TWILIO_ACCOUNT_SID="ACxxx" TWILIO_AUTH_TOKEN="xxx" TWILIO_FROM_NUMBER="+1xxx"
```

(Skip any you don't have keys for yet. VAPID keys auto-generate on first boot if missing.)

---

## 7. Deploy

```
fly deploy
```

Takes 3–5 min the first time (builds Docker image, pushes, starts machine).
Later deploys are faster.

When it's done, it prints your URL, something like:
```
https://peptide-app.fly.dev
```

Open it. Data persists now. No sleep. Done.

---

## 8. Updating later (when I send new zips)

After unzipping a new version over the old folder:
```
cd peptide-app
fly deploy
```

That's it — one command. Your volume (and all data) stays put.

---

## Useful commands

| Command | What it does |
|---|---|
| `fly status` | Is it running? |
| `fly logs` | Live log stream |
| `fly ssh console` | SSH into the running machine |
| `fly apps open` | Opens your app URL in browser |
| `fly secrets list` | Shows which secrets you've set (values hidden) |
| `fly volumes list` | Confirms volume is attached |

---

## If something goes wrong

- **Deploy fails with a build error** → copy the error message and send it to me.
- **App won't start** → `fly logs` and send the output.
- **Want to switch region** → `fly regions set <code>` (e.g., `lax`, `sjc`, `sea`).

---

## About the free tier

Fly.io's current free allowance covers:
- 3 shared-CPU VMs with 256 MB each (you're using one with 512 MB — still well under)
- 3 GB of persistent volumes (you're using 1 GB)
- 160 GB outbound data transfer per month

If you stay single-region + this VM size, your monthly cost stays **$0**. You can always check usage at [fly.io/dashboard](https://fly.io/dashboard).
