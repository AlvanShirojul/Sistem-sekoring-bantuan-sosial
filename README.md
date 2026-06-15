<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/45d29392-b136-46db-9397-062f47de8790

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy Backend & Configure Frontend on Vercel

If you host the frontend on Vercel and the backend separately, set the frontend environment variable `VITE_API_URL` to point to your backend (no trailing slash).

Recommended quick option: Render

- Create a Web Service on Render connected to this GitHub repo.
- Build Command: `npm install`
- Start Command: `npx tsx server/index.ts`
- Set environment variables on Render: `PORT=3000`, `NODE_ENV=production`, `JWT_SECRET=<your-secret>`
- After deploy, note the backend URL (e.g. `https://my-backend.onrender.com`).

Set `VITE_API_URL` in Vercel (Project → Settings → Environment Variables) to your backend URL, then redeploy the frontend. If you prefer CLI:

```bash
vercel env add VITE_API_URL production
```

Verify:

```bash
curl -i https://my-backend.onrender.com/api/health
curl -i -X POST https://my-backend.onrender.com/api/register -H "Content-Type: application/json" -d '{"username":"test","password":"pass"}'
```

Notes:
- Vercel does not run a long-lived Express server by default — to run Express on Vercel you'd need to convert routes into Serverless Functions under `/api`.
- For production persistence, use a managed database instead of local SQLite (ephemeral storage).

