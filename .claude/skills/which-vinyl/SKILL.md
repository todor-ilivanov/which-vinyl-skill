---
name: which-vinyl
description: Generate personalized vinyl record recommendations by analyzing Spotify listening history and Discogs collection. Use when the user asks for vinyl recommendations, what vinyl to buy, which records to add to their collection, or wants music suggestions based on their listening habits and existing vinyl collection.
user-invocable: true
---

# Which Vinyl Should I Buy?

## Workflow

1. **Fetch data** via MCP tools:
   - `get_spotify_top_tracks(time_range: "short_term")` - Recent listening preferences
   - `get_spotify_recently_played()` - Active listening patterns
   - `get_discogs_collection()` - Existing vinyl collection

2. **Analyze patterns**: Identify favorite artists, genres (rock/jazz/electronic), eras (60s/80s/modern), and listening style (deep cuts vs. hits)

3. **Generate 5-7 recommendations** that:
   - Match Spotify listening patterns
   - Exclude albums already in Discogs collection
   - Prioritize albums with strong vinyl pressings or audiophile editions
   - Mix: Artists they love + similar discoveries + genre classics

4. **Format each recommendation**:
   ```
   Artist - Album (Year)
   Why: [1-2 sentences connecting to their listening habits]
   Vinyl notes: [Pressing quality, availability, or special editions]
   ```

## Example

Based on your recent Spotify listening (Radiohead, Portishead, Massive Attack) and your 47-record Discogs collection:

**1. Boards of Canada - Music Has the Right to Children** (1998)
Your love of atmospheric, electronic-tinged music makes this essential. Excellent vinyl pressing with deep bass response.

**2. Talk Talk - Spirit of Eden** (1988)
Given your Radiohead affinity, this pioneering post-rock album is a must. The 2012 vinyl remaster is definitive.

## Edge Cases

- **Limited Spotify data**: Weight toward Discogs collection analysis (identify gaps in their collection)
- **Empty Discogs collection**: Focus purely on Spotify-based recommendations
- **Duplicate ownership**: Acknowledge when recommended albums relate to ones they already own
