# 🚀 Hosting GrilledS on Render.com

This guide explains how to deploy **GrilledS** to [Render.com](https://render.com) with WebSockets, WebRTC calling, and the custom logo.

---

## Prerequisites
1. A free [Render.com](https://render.com) account.
2. A [GitHub](https://github.com) account.

---

## Step 1: Push Your Code to GitHub

Your project is located at:
`C:\Users\7yf57\.gemini\antigravity\scratch\pulsechat`

### Option A: Using Git CLI (if installed)
Open your terminal in the project directory:
```bash
git init
git add .
git commit -m "Deploy GrilledS to Render"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/grilleds.git
git push -u origin main
```

### Option B: Using GitHub Desktop
1. Download & open [GitHub Desktop](https://desktop.github.com/).
2. Click **File** > **Add Local Repository...**
3. Select `C:\Users\7yf57\.gemini\antigravity\scratch\pulsechat`.
4. Click **Publish repository** to push it to your GitHub profile.

### Option C: Drag & Drop on GitHub.com
1. Go to [GitHub.com/new](https://github.com/new) and create a new repository called `grilleds`.
2. Click **"uploading an existing file"**.
3. Drag the project files and folders into GitHub (exclude `node_modules`).
4. Commit the changes.

---

## Step 2: Create a Web Service on Render

1. Log into your dashboard at [dashboard.render.com](https://dashboard.render.com/).
2. Click the blue **"New +"** button in the top right.
3. Select **"Web Service"**.
4. Choose **"Build and deploy from a Git repository"** and connect your GitHub account.
5. Select your `grilleds` repository.

---

## Step 3: Configure Web Service Settings

Fill in the settings form with the following values:

| Setting | Value |
| :--- | :--- |
| **Name** | `grilleds` *(or any unique name you prefer)* |
| **Region** | Choose the one closest to you (e.g. *Oregon (US West)* or *Frankfurt (EU)*) |
| **Branch** | `main` |
| **Root Directory** | *(Leave empty)* |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` ($0/month) |

---

## Step 4: Environment Variables

Scroll down to the **"Environment Variables"** section and click **"Add Environment Variable"**:

| Key | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production optimizations |
| `JWT_SECRET` | *(Click "Generate" or type a secret key)* | Secure token signing |

### (Optional) OAuth Logins (Google & GitHub)
If you want Google or GitHub 1-click sign-in on your live site:
1. Copy your live Render URL (e.g. `https://grilleds.onrender.com`).
2. Add these variables on Render:
   * `GOOGLE_CLIENT_ID`: `your_client_id`
   * `GOOGLE_CLIENT_SECRET`: `your_client_secret`
   * `GITHUB_CLIENT_ID`: `your_github_client_id`
   * `GITHUB_CLIENT_SECRET`: `your_github_client_secret`
3. In **Google Cloud Console** > **Credentials** > your OAuth 2.0 Client ID:
   * Add to **Authorized JavaScript origins**: `https://grilleds.onrender.com`
   * Add to **Authorized redirect URIs**: `https://grilleds.onrender.com/auth/google/callback`
4. In **GitHub Developer Settings** > **OAuth Apps**:
   * Set **Homepage URL**: `https://grilleds.onrender.com`
   * Set **Authorization callback URL**: `https://grilleds.onrender.com/auth/github/callback`

---

## Step 5: Deploy!

1. Click **"Create Web Service"** at the bottom of the page.
2. Render will automatically:
   * Clone your repo.
   * Run `npm install` (fast, no native compilation dependencies).
   * Run `node server/index.js`.
   * Bind to the assigned port via `process.env.PORT`.
3. In 1–2 minutes, your deployment will show **"Live"** with a green badge and your public HTTPS URL (e.g. `https://grilleds.onrender.com`)!

---

## Important Tips for Render Free Tier

1. **Auto-Sleep**: On the free tier, Render automatically spins down services after 15 minutes of inactivity. When someone visits the link, it takes ~30–45 seconds to wake up on the first request.
2. **WebSockets & WebRTC**: Socket.io and WebRTC peer calling work out of the box with zero extra configuration over Render's free SSL (`https://` & `wss://`).
3. **Continuous Deployment**: Every time you push a commit to your `main` branch on GitHub, Render will automatically rebuild and deploy your changes.
