# Quick Start

Get the Which Vinyl MCP server running in 3 steps.

## Step 1: Create OAuth Apps

You can configure just Spotify, just Discogs, or both services. Create OAuth credentials for the service(s) you want to use:

### Spotify (optional)

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click **Create App**
3. Fill in app name and description (anything works)
4. Add this Redirect URI: `http://127.0.0.1:3000/auth/spotify/callback`
5. Check "Web API" under APIs used
6. Copy your **Client ID** and **Client Secret**

### Discogs (optional)

1. Go to [Discogs Developer Settings](https://www.discogs.com/settings/developers)
2. Click **Create an Application**
3. Fill in application name
4. Set Callback URL: `http://127.0.0.1:3000/auth/discogs/callback`
5. Copy your **Consumer Key** and **Consumer Secret**

## Step 2: Run Setup

From the `mcp-server` directory:

```bash
cd mcp-server
npm install
npm run setup
```

The setup wizard will:
- Ask which services you want to configure
- Prompt for your OAuth credentials
- Open your browser for authentication
- Build the MCP server
- Register the MCP server with Claude Code

## Step 3: Restart Claude Code

Restart Claude Code, then try: **"What vinyl should I play?"**

---

## Troubleshooting

**Port 3000 in use?** Stop the process using it, or wait a moment and try again.

**OAuth error?** Double-check your callback URLs match exactly:
- Spotify: `http://127.0.0.1:3000/auth/spotify/callback`
- Discogs: `http://127.0.0.1:3000/auth/discogs/callback`

**Need to re-authenticate?** Run `npm run auth:all`

---

## Adding a Service Later

Started with just Spotify or Discogs? You can add the other service anytime without re-running full setup.

**To add Discogs:**
```bash
npm run auth:discogs
```

**To add Spotify:**
```bash
npm run auth:spotify
```

The CLI will:
- Prompt for your OAuth credentials if they're missing from `.env`
- Open your browser for authentication
- Save the new tokens alongside your existing configuration

After adding a service, restart Claude Code to use the new tools.

---

See [README.md](./README.md) for full documentation.
