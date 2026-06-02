# Telegram → Obsidian Bot

A serverless bot that turns Telegram messages into Obsidian notes — instantly committed to your GitHub vault.

## How it works

```
Telegram message
      ↓ webhook (POST)
Cloudflare Worker
      ↓ builds .md file
GitHub REST API
      ↓ commits to repo
obsidian-vault (GitHub repo)
      ↓ Obsidian Git plugin syncs
Obsidian
```

## Features

- Send any text message to the bot → note created in your vault
- Send a URL → note created with the link as slug and full URL in body
- Non-text messages (photos, audio, stickers) → bot replies with a warning
- Duplicate filenames are handled automatically with a timestamp suffix
- Fully serverless — runs on Cloudflare Workers free tier, no server required

## Generated note format

**Filename:** `YYYY-MM-DD-first-two-words.md`
For URLs: `YYYY-MM-DD-domain-path-slug.md`

**Content:**
```markdown
---
Tipo: Nota rápida
---

Your message here...
```

## Stack

| Component | Technology | Reason |
|---|---|---|
| Trigger | Telegram Bot | Simple webhook integration |
| Hosting | Cloudflare Workers | Serverless, free tier, zero maintenance |
| Storage | GitHub REST API | Vault already lives on GitHub |
| Sync | Obsidian Git plugin | Auto-pull into the vault |

## Prerequisites

- [Node.js 20+](https://nodejs.org)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) — `npm install -g wrangler`
- Cloudflare account (free tier)
- GitHub account with an Obsidian vault in a private repository
- Telegram account

## Setup

### 1. Create a Telegram bot

1. Open Telegram and talk to `@BotFather`
2. Send `/newbot` and follow the instructions
3. Save the token → this is your `TELEGRAM_BOT_TOKEN`

### 2. Create a GitHub Personal Access Token

1. Go to: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Click **Generate new token**
3. Under **Repository access**, select your vault repository
4. Under **Repository permissions → Contents**, set to **Read and write**
5. Generate and save the token → this is your `GITHUB_TOKEN`

### 3. Install Wrangler and log in

```bash
npm install -g wrangler
wrangler login
```

### 4. Clone this repo and configure

```bash
git clone https://github.com/your-username/telegram-obsidian-bot
cd telegram-obsidian-bot
```

Edit `wrangler.toml` to set your vault folder:

```toml
[vars]
GITHUB_VAULT_PATH = "your-folder"  # e.g. "Quick Notes"
```

### 5. Set secrets

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_SECRET      # any random string you create
wrangler secret put GITHUB_TOKEN
wrangler secret put GITHUB_OWNER         # your GitHub username
wrangler secret put GITHUB_REPO          # your vault repo name
```

> `TELEGRAM_SECRET` is a random string you create yourself (e.g. run `openssl rand -hex 16`). Telegram will include it in every webhook request so your Worker can verify the request is legitimate.

### 6. Deploy

```bash
wrangler deploy
```

Note the generated URL: `https://telegram-obsidian-bot.<your-subdomain>.workers.dev`

### 7. Register the webhook

```bash
curl "https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/setWebhook?url={WORKER_URL}&secret_token={TELEGRAM_SECRET}"
```

Expected response:
```json
{"ok": true, "result": true, "description": "Webhook was set"}
```

### 8. Configure Obsidian Git

1. Install the **Obsidian Git** plugin in your vault
2. Enable auto-pull (e.g. every 5 minutes)
3. Make sure the vault points to the same GitHub repository

## Testing locally

### 1. Create a `.dev.vars` file

```
TELEGRAM_SECRET=your-secret
TELEGRAM_BOT_TOKEN=your-token
GITHUB_TOKEN=your-github-token
GITHUB_OWNER=your-github-username
GITHUB_REPO=your-vault-repo
```

> Never commit `.dev.vars` — it contains secrets.

### 2. Start the local server

```bash
wrangler dev
```

Runs on `http://localhost:8787`.

### 3. Expose localhost with ngrok

```bash
ngrok http 8787
```

Copy the `Forwarding` URL (e.g. `https://abc123.ngrok-free.app`).

### 4. Register the webhook pointing to ngrok

```bash
curl "https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/setWebhook?url={NGROK_URL}&secret_token={TELEGRAM_SECRET}"
```

Now send a message to your bot and the note will be created in your GitHub vault.

## Environment variables

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token from BotFather |
| `TELEGRAM_SECRET` | Random string for webhook validation |
| `GITHUB_TOKEN` | Personal Access Token (Contents: read and write) |
| `GITHUB_OWNER` | Your GitHub username or org |
| `GITHUB_REPO` | Vault repository name |
| `GITHUB_VAULT_PATH` | Destination folder inside the vault (set in `wrangler.toml`) |

## Message behavior

| Message type | Result |
|---|---|
| Free text | Note created with first-two-words slug |
| Plain URL (`https://...`) | Note created with URL-based slug |
| Photo, audio, sticker | Error reply sent back in Telegram |
| GitHub API failure | Error reply sent back + logged in Workers Logs |

## View production logs

```bash
wrangler tail
```

## Roadmap

- AI enrichment — summarize notes, suggest tags, extract tasks (Cloudflare Workers AI or Claude Haiku)
