# Deploying IPO Pilot AI to Vercel

This guide covers deploying the full-stack IPO Pilot AI app to Vercel with live AWS DynamoDB and S3 storage.

## Prerequisites

1. **GitHub account** — the repo must be on GitHub for Vercel's auto-deploy to work
2. **Vercel account** — sign up at https://vercel.com (free tier works)
3. **AWS credentials** — the same DynamoDB table and S3 bucket used for local dev
4. **Gemini API key** — get one at https://aistudio.google.com/app/apikey (free tier works)

## 1. Push to GitHub

The remote points at `zwerty-afk/IPO_Pilot_AI` (private). Push the local commits:

```bash
cd "d:\IPO-Pilot-AI"
git push -u origin main
```

If you're starting from a fresh repo instead, create it empty (no README, no .gitignore) to avoid an unrelated-history merge, then:

```bash
git remote set-url origin https://github.com/zwerty-afk/<repo-name>.git
git push -u origin main
```

**Security note**: the commits contain zero secrets — all credentials live in `server/.env`, which is gitignored. The staged diff was scanned for AWS (`AKIA…`) and Gemini (`AIza…`) key patterns before each commit. `server/db.json` is also excluded: it's a runtime artifact holding a test user and scrypt password hashes.

## 2. Import to Vercel

1. Go to https://vercel.com and sign in
2. Click **Add New → Project**
3. Import your GitHub repo: `zwerty-afk/IPO_Pilot_AI`
4. Vercel auto-detects the Vite framework from `vercel.json`
5. **Do not deploy yet** — you need to set environment variables first

**Import your own repo — do not start from a template.** If you create the project from a Vercel/v0 template, Vercel generates a repo named like `ipo-pilot-ai-6c229c0d` containing the *template's* code, and every build compiles that instead of yours. The build log's `Cloning github.com/…` line tells you which repo is actually being built — check it matches.

## 3. Environment Variables

In the Vercel project settings (Project → Settings → Environment Variables), add these for **Production**:

| Variable | Value | Notes |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | `AKIA...` | Same key from your local `server/.env` |
| `AWS_SECRET_ACCESS_KEY` | `<secret>` | Same secret from your local `server/.env` |
| `AWS_REGION` | `ap-south-1` | Must match your DynamoDB table region |
| `DYNAMO_TABLE` | `ipo_pilot_data` | Your DynamoDB table name |
| `S3_BUCKET` | `ipo-pilot-ai-docs-2026` | Your S3 bucket name |
| `GEMINI_API_KEY` | `AIza...` or `AQ.Ab...` | Get from https://aistudio.google.com/app/apikey |
| `AUTH_SECRET` | `<64-char-hex>` | Signs session tokens. **Set this** — see below |
| `CRON_SECRET` | `<64-char-hex>` | Generate with `openssl rand -hex 32` |

**Set `AUTH_SECRET`.** Session tokens are HMAC-signed with it. If it's unset, the server derives a fallback from your deployment configuration (AWS keys, table name, project URL). That fallback is *stable* — identical across instances and across restarts — so sessions do keep working. But it is derived from values you may rotate:

- Rotating an AWS key, changing the Dynamo table, or moving the deploy URL changes the derived secret and logs everyone out
- An explicit `AUTH_SECRET` decouples sessions from infrastructure config, which is what you want in production

Generate it with `openssl rand -hex 32`, or:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Changing it later logs everyone out once, which is the intended way to revoke all sessions. Session lifetime defaults to 7 days; override with `AUTH_TOKEN_TTL_MS`.

**Optional overrides** (only if needed):

| Variable | Default | When to set |
|---|---|---|
| `GEMINI_MODEL` | `gemini-flash-latest` | Pin a specific model if you have a paid project with quota for `gemini-2.0-flash` or another version |
| `USE_DYNAMO` | `true` | Set to `false` to force the local `db.json` fallback (not recommended for production) |
| `PORT` | `3001` | Vercel ignores this, but you can set it for consistency |

Click **Save** after entering each variable.

## 4. Deploy

Back in the **Deployments** tab, click **Deploy** (or just push a new commit to `main` — Vercel auto-deploys on every push).

Vercel will:
1. Install dependencies from the root `package.json` (which includes all server deps)
2. Run `npm --prefix client install && npm --prefix client run build` to build the Vite frontend
3. Deploy the built `client/dist/` as static assets
4. Deploy `api/index.js` as a serverless function (which re-exports `server/server.js`)
5. Set up the cron job to hit `/api/cron/sebi-refresh` every 6 hours

The deploy takes ~90 seconds. When it finishes, you'll get a URL like `https://ipo-pilot-ai-xyz123.vercel.app`.

## 5. Verify

Open the deployment URL and test:

1. **Sign up** — create a new test user at `/login` → Sign Up tab
2. **Upload a document** — go to Documents, upload a PDF (e.g., incorporation certificate), and wait ~10 seconds for OCR to complete
3. **Check the intake form** — navigate to Intake and confirm the completeness heatmap appears at the top
4. **Invite a reviewer** — go to Invitations, send an invite to a test email, and confirm it appears in the list (not as a revoked stub)

If any step fails, check the **Functions** tab in Vercel's dashboard for runtime logs.

**Start with `/api/health`.** Open `https://<your-deploy>.vercel.app/api/health` — it needs no login (deliberately: when storage is down, nobody can log in) and reports which settings actually resolved, without ever echoing a key or secret:

```json
{
  "ok": true,
  "storage": {
    "dynamoConfigured": true,
    "dynamoReady": true,
    "table": "ipo_pilot_data",
    "region": "ap-south-1",
    "s3BucketResolved": true,
    "s3Uploads": true,
    "awsKeyPresent": true,
    "awsSecretPresent": true,
    "geminiKeyPresent": true,
    "geminiModel": "gemini-flash-latest",
    "serverless": true
  },
  "error": null
}
```

Read it like this:

| Field | If false | Fix |
|---|---|---|
| `dynamoConfigured` | AWS key/secret missing, or `USE_DYNAMO=false` | Set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in Vercel; remove `USE_DYNAMO` |
| `dynamoReady` | Credentials present but the Scan failed — see `error.reason` | `ResourceNotFoundException` → wrong `DYNAMO_TABLE` or wrong `AWS_REGION`. `AccessDeniedException` → IAM user lacks `dynamodb:Scan`/`PutItem` |
| `s3BucketResolved` | No bucket env var set | Set `S3_BUCKET` |
| `s3Uploads` | Bucket set but credentials missing/placeholder | Check the key isn't still `your_access_key_here` |
| `geminiKeyPresent` | OCR will report `failed` | Set `GEMINI_API_KEY` |

Common issues:

- **`Storage unavailable. Please retry.` on every API call** → DynamoDB hydration is failing. The response now carries `reason` and `detail` (the AWS error name and message) — check those first, then `/api/health`
- **500 on every API call** → AWS credentials are wrong or the DynamoDB table doesn't exist in `ap-south-1`
- **OCR stuck at "processing"** → Gemini key is missing or invalid; check the function logs for a 403 or 429
- **404 on `/api/*` routes** → the serverless function didn't deploy; check that `api/index.js` exists in the repo

## 6. Custom Domain (Optional)

To use your own domain instead of `*.vercel.app`:

1. Go to Project → Settings → Domains
2. Add your domain (e.g., `ipo-pilot.example.com`)
3. Follow Vercel's DNS instructions to point an `A` or `CNAME` record at their servers
4. Vercel auto-provisions a free SSL certificate via Let's Encrypt

## 7. SEBI Cron Job

The `/api/cron/sebi-refresh` endpoint fetches the latest SME IPO notices from SEBI every 6 hours. Vercel sends a `Bearer <CRON_SECRET>` token with each request. The route returns 401 if the token doesn't match, so no one else can trigger expensive fetches.

The cron schedule is defined in `vercel.json`:

```json
"crons": [
  { "path": "/api/cron/sebi-refresh", "schedule": "0 3 * * *" }
]
```

Daily at 03:00 UTC, because **Vercel's Hobby plan allows at most one cron run per day** — asking for `0 */6 * * *` (every 6 hours) triggers an upgrade prompt. On Pro you can raise the frequency.

Daily is enough here because the cron isn't the only refresh path:

- On cold start the server checks whether the cached notices are older than 6 hours and refetches if so ([server/server.js](server/server.js) `SEBI` startup block)
- The SEBI Updates page has a manual **Refresh** button wired to `POST /api/sebi-notices/refresh`

So even with a once-daily cron, notices stay current in practice. If you'd rather drop the cron entirely, delete the `crons` block — the startup check and manual refresh keep working.

## 8. Monitoring

Vercel's free tier includes:

- **Function logs** — see every request and console.log in the Functions tab
- **Analytics** — page views, Web Vitals, and top paths in the Analytics tab
- **Error tracking** — unhandled exceptions show up in the Functions log with stack traces

For deeper observability (APM, custom metrics, alerting), integrate a service like Sentry or Datadog via environment variables.

## 9. Cost Estimate

With the free tiers:

- **Vercel**: 100 GB bandwidth/month, 100 GB-hours compute, unlimited deploys (hobby plan)
- **DynamoDB**: 25 GB storage, 25 WCU/RCU provisioned or 200M requests/month on-demand (free tier)
- **S3**: 5 GB storage, 20k GET requests, 2k PUT requests/month (free tier)
- **Gemini**: varies by model; `gemini-flash-latest` has a free-tier allowance (15 RPM as of Aug 2026)

For a pilot with 2–3 merchant bankers and 10–20 issuers, you'll stay within free tiers. Once you exceed them:

- **Vercel Pro**: $20/month (1 TB bandwidth, 1000 GB-hours)
- **DynamoDB on-demand**: $1.25/M write requests, $0.25/M reads, $0.25/GB-month storage
- **S3**: $0.023/GB-month, $0.0004/1k GETs, $0.005/1k PUTs (ap-south-1 pricing)
- **Gemini Paid**: see https://ai.google.dev/pricing — `gemini-2.0-flash` costs ~$0.30/M input tokens, $1.25/M output tokens

## 10. Local Development After Deploy

Your local dev setup is unchanged. The backend still boots with `npm start` from the `server/` directory and connects to the same live DynamoDB + S3. The client dev server (`npm run dev` in `client/`) proxies `/api` to `localhost:3001` via the Vite config.

To test the serverless path locally before deploying:

```bash
cd server
VERCEL=1 node server.js
```

This skips `app.listen()`, exports a request handler, and flushes the DynamoDB write buffer synchronously before responding (the same behavior that runs on Vercel).

## 11. Rollback

Every deploy is immutable. To roll back:

1. Go to Deployments in the Vercel dashboard
2. Find the last known-good deploy
3. Click the three-dot menu → **Promote to Production**

Vercel instantly switches traffic back to that deploy. The main branch stays at the newer commit, so you'll want to `git revert` or fix-forward and push to keep the repo and production in sync.

## 12. CI/CD

Vercel auto-deploys on every push to `main`. For a staging workflow:

1. Create a `staging` branch: `git checkout -b staging`
2. Push it: `git push -u origin staging`
3. In Vercel, go to Settings → Git and set **Production Branch** to `main`
4. Every push to `staging` now deploys to a preview URL (not production)
5. When you're ready to promote, merge `staging` into `main` and push

Preview deployments get their own URLs (e.g., `ipo-pilot-ai-git-staging-zwerty-afk.vercel.app`) and can have separate environment variables.

## 13. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Storage unavailable. Please retry.` on every call | DynamoDB hydration failed on cold start | Read `reason`/`detail` in the response, then open `/api/health`. Usually a wrong `DYNAMO_TABLE`, a wrong `AWS_REGION`, or an IAM policy missing `dynamodb:Scan` |
| Build fails on a `.ts`/`.tsx` file, or mentions TanStack, Next.js, or `vite v8` | Vercel is building a **different repo** — usually a template project like `ipo-pilot-ai-<hash>` | Check the `Cloning github.com/…` line in the build log. This project is plain JS on Vite 5 and has no `.ts` files. Delete the template project and re-import `zwerty-afk/IPO_Pilot_AI` |
| "Upgrade your plan" prompt on cron | Hobby allows one cron run per day; `vercel.json` asked for more | Already set to `0 3 * * *` (daily). Raise it only on Pro |
| Build fails with "vite: not found" | `client/package.json` missing or bad lockfile | Run `npm --prefix client install` locally, commit `client/package-lock.json`, push |
| 500 on first API call, then 200 | DynamoDB hydration failed on cold start | Check function logs; usually a wrong table name or region |
| OCR never completes | Gemini key wrong, or model quota exhausted | Verify `GEMINI_API_KEY` in Vercel env vars; check function logs for 429 or 403 |
| Cron job returns 401 | `CRON_SECRET` mismatch | Regenerate with `openssl rand -hex 32`, set it in Vercel, redeploy |
| Upload works but file is missing after refresh | S3 bucket wrong or IAM permissions insufficient | Verify `S3_BUCKET` and that the IAM user has `s3:PutObject`, `s3:GetObject` on that bucket |
| Users logged out on every redeploy, or randomly mid-session | `AUTH_SECRET` unset, so each instance signs tokens with its own random per-boot secret | Set `AUTH_SECRET` in Vercel and redeploy |
| `Session expired or invalid. Please sign in again.` right after signing in | `AUTH_SECRET` differs between the instance that issued the token and the one serving the next request | Same fix — set `AUTH_SECRET`. Check it's set for the **Production** environment, not just Preview |

If a deploy is completely broken and you can't roll back, delete the Vercel project, fix the issue locally, and re-import the repo.

---

**You're done.** The app is live at your Vercel URL with the same DynamoDB + S3 backend you've been using locally. Every push to `main` auto-deploys in ~90 seconds.
