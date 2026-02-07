# Notify Me

Self-notification web app using the Web Push API. Register your browser, get a unique ID, and send yourself push notifications via `curl`.

## How It Works

1. Open the app in your browser and click **Register for notifications**
2. A unique GUID is generated — this is your ID and API key
3. Use the displayed `curl` command to send yourself notifications
4. Clicking a notification opens the target URL (or a redirect page)
5. Unregister at any time to delete all your data

## Setup

```bash
npm install
```

### Generate VAPID Keys

```bash
npx web-push generate-vapid-keys
```

### Configure Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable            | Required | Default               | Description                                    |
| ------------------- | -------- | --------------------- | ---------------------------------------------- |
| `PORT`              | No       | `3000`                | Server listening port                          |
| `DB_PATH`           | No       | `./data/notify-me.db` | SQLite database file path                      |
| `VAPID_PUBLIC_KEY`  | Yes      | —                     | VAPID public key for Web Push                  |
| `VAPID_PRIVATE_KEY` | Yes      | —                     | VAPID private key for Web Push                 |
| `VAPID_SUBJECT`     | Yes      | —                     | VAPID subject (e.g., `mailto:you@example.com`) |

### Run

```bash
node server.js
```

## API Usage

### Send a plain text notification

```bash
curl -X POST http://localhost:3000/ \
  -H "Authorization: Bearer YOUR_GUID" \
  -H "Content-Type: text/plain" \
  -d "Hello from curl!"
```

### Send a notification with a URL

```bash
curl -X POST http://localhost:3000/ \
  -H "Authorization: Bearer YOUR_GUID" \
  -H "Content-Type: application/json" \
  -d '{"text": "Check this out", "url": "https://example.com"}'
```

### Send a notification with custom images

```bash
curl -X POST http://localhost:3000/ \
  -H "Authorization: Bearer YOUR_GUID" \
  -H "Content-Type: application/json" \
  -d '{"text": "New message", "url": "https://example.com", "icon": "/images/android-chrome-192x192.png", "image": "/images/android-chrome-512x512.png"}'
```

**Note**: The `icon` property defaults to `/images/android-chrome-192x192.png`. You can customize both `icon` (small icon) and `image` (large preview image) using URLs accessible from your server.

## Azure App Service Deployment

Azure sets the `PORT` environment variable automatically. Configure the following in **App Service → Configuration → Application settings**:

1. **DB_PATH**: `/home/data/notify-me.db` (ensures SQLite database persists in `/home` directory)
2. **VAPID_PUBLIC_KEY**: Your VAPID public key
3. **VAPID_PRIVATE_KEY**: Your VAPID private key
4. **VAPID_SUBJECT**: Your VAPID subject (e.g., `mailto:you@example.com`)

The `/home` directory in Azure App Service is persistent across restarts and deployments.

## Architecture

- **Runtime**: Node.js with plain `http` module (no framework)
- **Database**: SQLite via `better-sqlite3`
- **Push**: Web Push API with service workers
- **Auth**: GUID as Bearer token
