---
name: which-vinyl
description: Generate personalized vinyl record recommendations by analyzing Spotify listening history and Discogs collection. Use when the user asks for vinyl recommendations, what vinyl to buy, which records to add to their collection, or wants to analyze their listening habits vs vinyl collection.
user-invocable: true
---

# Which Vinyl Should I Buy?

## MCP Tools

| Tool | Purpose |
|------|---------|
| `get_vinyl_recommendations` | Albums you stream but don't own. Params: `source` (top_tracks/recently_played/saved_albums/top_artists), `time_range`, `limit` |
| `get_collection_analysis` | Alignment score, overlap/gaps, most/least played owned albums. Params: `mode` (insights/comparison/full), `time_range` |
| `get_discogs_collection` | Raw collection data |
| `get_discogs_wantlist` | User's vinyl wishlist |
| `get_collection_value` | Collection stats: value, formats, decades |
| `get_spotify_top_tracks` | Top tracks with popularity |
| `get_spotify_recently_played` | Last 50 played tracks |

## Workflow

1. Call `get_vinyl_recommendations` - returns albums not owned with reasons
2. Present 5-7 top picks in format:
   ```
   **Artist - Album**
   Reason from tool + vinyl-specific note if relevant
   ```

For analysis requests, use `get_collection_analysis(mode: "full")` which returns `vennData`, `genreBreakdown`, `mostPlayedOwned`, `leastPlayedOwned`.

## Edge Cases

- **Limited Spotify data**: Use `get_collection_analysis` to surface unplayed vinyl
- **Empty Discogs**: Recommendations only, skip collection comparisons
