# Which Vinyl MCP Server

MCP server for vinyl recommendations using Spotify and Discogs data.

## Quick Start

### 1. Create OAuth Apps

| Service | Dashboard | Callback URL |
|---------|-----------|--------------|
| Spotify | [Developer Dashboard](https://developer.spotify.com/dashboard) | `http://127.0.0.1:3000/auth/spotify/callback` |
| Discogs | [Developer Settings](https://www.discogs.com/settings/developers) | `http://127.0.0.1:3000/auth/discogs/callback` |

Create an app, copy your credentials (Client ID/Secret for Spotify, Consumer Key/Secret for Discogs).

### 2. Run Setup

```bash
npm install && npm run setup
```

The wizard prompts for credentials, opens browser for auth, builds and registers the MCP server.

### 3. Restart Claude Code

Try: **"What vinyl should I play?"**

---

## Available Tools

**`get_spotify_top_tracks`** - Get user's top tracks
Params: `time_range` (short_term|medium_term|long_term), `limit` (default: 20)

**`get_spotify_recently_played`** - Get recently played tracks
Params: `limit` (default: 50)

**`get_discogs_collection`** - Get user's vinyl collection
Params: `limit`

---

## How Authentication Works

| Credential Type | What It Is | Where Stored |
|-----------------|------------|--------------|
| Client credentials | OAuth app identity (`SPOTIFY_CLIENT_ID`, etc.) | `.env` + Claude config |
| Access tokens | API authorization | System keychain |

Security: Uses PKCE for Spotify, localhost-only callbacks, tokens stored in encrypted system keychain (never in files).

---

## Manual Setup

<details>
<summary>Manual configuration (alternative to setup wizard)</summary>

**.env file:**
```bash
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
DISCOGS_CONSUMER_KEY=your_discogs_consumer_key
DISCOGS_CONSUMER_SECRET=your_discogs_consumer_secret
```

**Authenticate:** `npm run auth:all`

**Claude Code config** (`~/.claude.json` or `.claude/settings.json`):
```json
{
  "mcpServers": {
    "which-vinyl": {
      "command": "node",
      "args": ["/absolute/path/to/which-vinyl-skill/dist/index.js"],
      "env": {
        "SPOTIFY_CLIENT_ID": "...",
        "SPOTIFY_CLIENT_SECRET": "...",
        "DISCOGS_CONSUMER_KEY": "...",
        "DISCOGS_CONSUMER_SECRET": "..."
      }
    }
  }
}
```

</details>

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run setup` | Full setup wizard |
| `npm run auth:all` | Authenticate all services |
| `npm run auth:spotify` | Authenticate Spotify only |
| `npm run auth:discogs` | Authenticate Discogs only |
| `npm run dev` | Development watch mode |

---

## Troubleshooting

**"No Spotify/Discogs tokens found"** → Run `npm run auth:spotify` or `npm run auth:discogs`

**"Port 3000 already in use"** → Stop the process using port 3000, or wait and retry

**OAuth errors** → Verify credentials and callback URLs match exactly (see Quick Start table)

**Token refresh fails** → Re-authenticate with `npm run auth:spotify`

**Clear tokens manually:**
- macOS: Open Keychain Access, search "vinyl-vibe-mcp"
- Linux: `secret-tool search service vinyl-vibe-mcp`

---

## License

MIT
