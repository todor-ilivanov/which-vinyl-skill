# Which Vinyl MCP Server

MCP (Model Context Protocol) server for vinyl recommendations using Spotify and Discogs data.

## Quick Start

Get the Which Vinyl MCP server running in 3 steps.

### Step 1: Create OAuth Apps

Create OAuth credentials for the service(s) you want to use (Spotify, Discogs, or both):

**Spotify:**
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click **Create App**, fill in name/description
3. Add Redirect URI: `http://127.0.0.1:3000/auth/spotify/callback`
4. Check "Web API" under APIs used
5. Copy your **Client ID** and **Client Secret**

**Discogs:**
1. Go to [Discogs Developer Settings](https://www.discogs.com/settings/developers)
2. Click **Create an Application**
3. Set Callback URL: `http://127.0.0.1:3000/auth/discogs/callback`
4. Copy your **Consumer Key** and **Consumer Secret**

### Step 2: Run Setup

```bash
npm install
npm run setup
```

The setup wizard will:
- Ask which services you want to configure
- Prompt for your OAuth credentials
- Open your browser for authentication
- Build the MCP server
- Register the MCP server with Claude Code

### Step 3: Restart Claude Code

Restart Claude Code, then try: **"What vinyl should I play?"**

---

## Credentials & Secrets Management

### What credentials are needed

| Credential Type | Purpose | Example |
|-----------------|---------|---------|
| Client credentials | Identify your OAuth app | `SPOTIFY_CLIENT_ID`, `DISCOGS_CONSUMER_KEY` |
| Access tokens | Authorize API requests on your behalf | OAuth tokens from login flow |

### Where credentials are stored

**Client credentials** are stored in `.env`:
```bash
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
DISCOGS_CONSUMER_KEY=your_discogs_consumer_key
DISCOGS_CONSUMER_SECRET=your_discogs_consumer_secret
```

**Access tokens** are stored in your system keychain:
- **macOS**: Keychain Access (service: `vinyl-vibe-mcp`)
- **Linux**: libsecret (GNOME Keyring / KDE Wallet)
- **Windows**: Credential Manager

### Security model

- OAuth flows use **PKCE** (Proof Key for Code Exchange) for Spotify
- Callback server binds to **localhost only** (127.0.0.1)
- **No tokens are written to files** - all access tokens stay in the secure keychain
- Tokens are encrypted by the system credential manager

---

## Available Tools

### `get_spotify_top_tracks`

Get user's top tracks from Spotify.

**Parameters:**
- `time_range` (optional): `short_term` (4 weeks), `medium_term` (6 months), or `long_term` (years)
- `limit` (optional): Number of tracks to return (default: 20)

### `get_spotify_recently_played`

Get user's recently played tracks.

**Parameters:**
- `limit` (optional): Number of tracks to return (default: 50)

### `get_discogs_collection`

Get user's vinyl collection from Discogs.

**Parameters:**
- `limit` (optional): Maximum number of releases to return

---

## Manual Setup

For advanced users who prefer manual configuration over the setup wizard.

### Individual auth commands

```bash
# Authenticate with both services
npm run auth:all

# Or authenticate individually
npm run auth:spotify
npm run auth:discogs
```

### Environment variables

Create a `.env` file manually:

```bash
# Spotify credentials
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# Discogs credentials
DISCOGS_CONSUMER_KEY=your_discogs_consumer_key
DISCOGS_CONSUMER_SECRET=your_discogs_consumer_secret
```

### Claude Code configuration

Add to your Claude Code settings (`~/.claude.json` or `.claude/settings.json`):

```json
{
  "mcpServers": {
    "which-vinyl": {
      "command": "node",
      "args": ["/absolute/path/to/which-vinyl-skill/dist/index.js"],
      "env": {
        "SPOTIFY_CLIENT_ID": "your_client_id",
        "SPOTIFY_CLIENT_SECRET": "your_client_secret",
        "DISCOGS_CONSUMER_KEY": "your_consumer_key",
        "DISCOGS_CONSUMER_SECRET": "your_consumer_secret"
      }
    }
  }
}
```

**Note:** Only client credentials are needed in the config. Access tokens are loaded automatically from the system keychain.

---

## Token Management

### Token refresh behavior

- **Spotify**: Access tokens expire after 1 hour and are automatically refreshed using the refresh token
- **Discogs**: OAuth 1.0a tokens never expire

### Re-authentication

If you need to re-authenticate (e.g., revoked tokens):

```bash
npm run auth:all
```

### Adding services later

Started with just one service? Add the other anytime:

```bash
npm run auth:discogs  # Add Discogs
npm run auth:spotify  # Add Spotify
```

The CLI will prompt for missing credentials and save them to `.env`. After adding a service, restart Claude Code to use the new tools.

### Clearing tokens

To manually clear stored tokens, use your system's credential manager:

**macOS:**
```bash
# Search for "vinyl-vibe-mcp" in Keychain Access app
open -a "Keychain Access"
```

**Linux:**
```bash
secret-tool search service vinyl-vibe-mcp
```

---

## Development

### Watch mode

```bash
npm run dev
```

### Project structure

```
src/
├── auth/
│   ├── token-storage.ts      # Keychain operations
│   ├── spotify-oauth.ts      # Spotify OAuth flow
│   └── discogs-oauth.ts      # Discogs OAuth flow
├── cli/
│   └── authenticate.ts       # CLI authentication tool
├── services/
│   ├── spotify-client.ts     # Spotify API client
│   └── discogs-client.ts     # Discogs API client
└── index.ts                  # MCP server entry point
```

---

## Troubleshooting

### "No Spotify tokens found"

Run `npm run auth:spotify` to authenticate.

### "Port 3000 already in use"

Another process is using port 3000. Stop it or wait a moment and try again.

### "Failed to get request token" / OAuth error

Check that:
1. Your OAuth app credentials are correct
2. The callback URLs match exactly:
   - Spotify: `http://127.0.0.1:3000/auth/spotify/callback`
   - Discogs: `http://127.0.0.1:3000/auth/discogs/callback`

### Token refresh fails

Your refresh token may have been revoked. Re-authenticate with `npm run auth:spotify`.

### Need to re-authenticate?

Run `npm run auth:all` to re-authenticate all services.
