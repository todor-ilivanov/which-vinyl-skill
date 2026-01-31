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

### Spotify Tools

**`get_spotify_top_tracks`** - Get user's top tracks
Params: `time_range` (short_term|medium_term|long_term), `limit` (default: 20)

**`get_spotify_recently_played`** - Get recently played tracks
Params: `limit` (default: 50)

### Discogs Tools

**`get_discogs_collection`** - Get user's vinyl collection with full metadata
Params: `limit`
Returns: Artist(s), album, year, date added, thumbnail, genres, styles, formats

**`get_discogs_wantlist`** - Get albums user wants to add to collection
Params: `limit`
Returns: Artist(s), album, year, date added, user notes, rating

**`get_collection_value`** - Get collection statistics and estimated value
Params: none
Returns: Estimated value (min/median/max), format distribution, decade breakdown

### Cross-Service Tools

*Require both Spotify and Discogs to be configured.*

**`get_vinyl_recommendations`** - Find albums you listen to but don't own on vinyl
Params: `source` (top_tracks|top_artists|saved_albums|recently_played), `time_range`, `limit`
Returns: Recommendations with reasons, aggregated by artist for visualization

**`get_collection_analysis`** - Analyze collection vs listening habits
Params: `mode` (insights|comparison|full), `time_range` (short_term|medium_term|long_term)
Returns: Alignment scores, overlap/gaps, most/least played owned albums, Venn diagram data

---

## Example Use Cases

### Getting Recommendations

| What to Ask | What Happens |
|-------------|--------------|
| "What vinyl should I buy next?" | Analyzes top tracks → recommends albums not in your collection |
| "Recommend records based on what I've been playing lately" | Uses recently played → suggests current obsessions to own |
| "What albums from my favorite artists am I missing?" | Uses top artists → finds gaps in your collection |

### Collection Analysis

| What to Ask | What Happens |
|-------------|--------------|
| "How well does my vinyl collection match my taste?" | Returns alignment score (0-100%) with detailed breakdown |
| "What records am I not playing?" | Shows owned albums with low/no Spotify plays |
| "Which albums do I listen to most that I actually own?" | Lists top played records from your collection |

### Collection Stats

| What to Ask | What Happens |
|-------------|--------------|
| "What's my vinyl collection worth?" | Returns min/median/max value estimates |
| "Show me my collection by decade" | Decade breakdown (60s, 70s, 80s, etc.) |
| "What formats do I own?" | Distribution of LPs, 7", 12", CDs, etc. |

### Listening Insights

| What to Ask | What Happens |
|-------------|--------------|
| "What have I been listening to?" | Shows recent plays with timestamps |
| "What are my all-time favorite tracks?" | Top tracks over long term |
| "What's on my Discogs wantlist?" | Albums you've marked to buy |

### Visualization Examples

The analysis tools return data structured for visualization:
- **Venn diagrams**: Owned vs. listened overlap
- **Timeline charts**: When you added records to your collection
- **Genre breakdowns**: What styles dominate your collection

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
