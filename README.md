# Which Vinyl MCP Server

MCP (Model Context Protocol) server for vinyl recommendations using Spotify and Discogs data.

> **Quick Start:** See [QUICK_START.md](./QUICK_START.md) for a streamlined 3-step setup guide.

## Features

- **Spotify Integration**: Access top tracks and recently played songs
- **Discogs Integration**: Query your vinyl collection
- **Secure Token Storage**: OAuth tokens stored in system keychain (macOS Keychain, Linux libsecret, Windows Credential Manager)
- **Automatic Token Refresh**: Spotify tokens refresh automatically when expired

## Optional Services

You can use this MCP server with just Spotify, just Discogs, or both:

- **Spotify only**: Get recommendations based on your listening history
- **Discogs only**: Query your vinyl collection
- **Both**: Get personalized recommendations that match your collection

The setup wizard will ask which services you want to configure.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure OAuth Apps

#### Spotify OAuth App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add redirect URI: `http://127.0.0.1:3000/auth/spotify/callback`
4. Copy Client ID and Client Secret

#### Discogs OAuth App

1. Go to [Discogs Developer Settings](https://www.discogs.com/settings/developers)
2. Create a new app
3. Add callback URL: `http://127.0.0.1:3000/auth/discogs/callback`
4. Copy Consumer Key and Consumer Secret

### 3. Set Environment Variables

Create a `.env` file:

```bash
# Spotify credentials
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# Discogs credentials
DISCOGS_CONSUMER_KEY=your_discogs_consumer_key
DISCOGS_CONSUMER_SECRET=your_discogs_consumer_secret
```

### 4. Authenticate

Run the OAuth authentication flow to obtain and store access tokens:

```bash
# Authenticate with both services
npm run auth:all

# Or authenticate individually
npm run auth:spotify
npm run auth:discogs
```

This will:
1. Open your browser for Spotify login
2. Open your browser for Discogs authorization
3. Store tokens securely in your system keychain

**Note:** Tokens are stored in your system's secure credential storage, not in files. You only need to authenticate once (or when tokens are revoked).

### 5. Build and Run

```bash
npm run build
npm start
```

## Usage with Claude Code

Add to your Claude Code settings (`~/.claude.json` or `.claude/settings.json`):

```json
{
  "mcpServers": {
    "which-vinyl": {
      "command": "node",
      "args": ["/absolute/path/to/vinyl-vibe/mcp-server/dist/index.js"],
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

**Important:** Only client credentials are needed in the config. Access tokens are loaded automatically from the system keychain.

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

## Token Management

### Where are tokens stored?

Tokens are stored in your operating system's secure credential storage:

- **macOS**: Keychain Access (service: `vinyl-vibe-mcp`)
- **Linux**: libsecret (GNOME Keyring / KDE Wallet)
- **Windows**: Credential Manager

### Token refresh

- **Spotify**: Access tokens expire after 1 hour and are automatically refreshed using the refresh token
- **Discogs**: OAuth 1.0a tokens never expire

### Re-authenticate

If you need to re-authenticate (e.g., revoked tokens):

```bash
npm run auth:all
```

### Add a service later

Started with just one service? Add the other anytime:

```bash
npm run auth:discogs  # Add Discogs
npm run auth:spotify  # Add Spotify
```

The CLI will prompt for missing credentials and save them to `.env`.

### Clear tokens

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

## Troubleshooting

### "No Spotify tokens found"

Run `npm run auth:spotify` to authenticate.

### "Port 3000 already in use"

Another process is using port 3000. Stop it or modify the `REDIRECT_URI` in the OAuth files.

### "Failed to get request token"

Check that your OAuth app credentials are correct and the callback URL `http://127.0.0.1:3000/auth/spotify/callback` (or `http://127.0.0.1:3000/auth/discogs/callback` for Discogs) is registered in your OAuth app settings.

### Token refresh fails

Your refresh token may have been revoked. Re-authenticate with `npm run auth:spotify`.

## Security

- Tokens are stored encrypted in the system keychain
- OAuth flows use PKCE (Proof Key for Code Exchange) for Spotify
- Callback server binds to localhost only (127.0.0.1)
- No tokens are written to files or logs
