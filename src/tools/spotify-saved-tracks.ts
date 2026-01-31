import { z } from "zod";
import { getSpotifyClient } from "../services/spotify-client.js";

export const spotifySavedTracksSchema = {
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(50)
    .describe("Number of tracks to return (max 50)"),
  offset: z
    .number()
    .min(0)
    .optional()
    .default(0)
    .describe("Index of first track to return (for pagination)"),
};

export const spotifySavedTracksTool = {
  name: "get_saved_tracks",
  description:
    "Fetch the user's saved (liked) tracks from Spotify library. Returns track names, artists, albums, and when they were saved. Includes artist frequency counts and timeline for visualization.",
  schema: spotifySavedTracksSchema,

  async handler(args: { limit?: number; offset?: number }) {
    const client = getSpotifyClient();
    const limit = Math.min(args.limit || 50, 50);
    const offset = args.offset || 0;

    const tracks = await client.getSavedTracks(limit, offset);

    // Count tracks by artist for visualization
    const artistCounts: Record<string, number> = {};
    for (const track of tracks) {
      artistCounts[track.artist] = (artistCounts[track.artist] || 0) + 1;
    }

    // Sort by frequency and take top artists
    const topArtists = Object.entries(artistCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .reduce((acc, [artist, count]) => {
        acc[artist] = count;
        return acc;
      }, {} as Record<string, number>);

    // Group by month/year for timeline visualization
    const timelineByMonth: Record<string, number> = {};
    for (const track of tracks) {
      const date = new Date(track.addedAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      timelineByMonth[monthKey] = (timelineByMonth[monthKey] || 0) + 1;
    }

    // Sort timeline chronologically
    const sortedTimeline = Object.entries(timelineByMonth)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .reduce((acc, [month, count]) => {
        acc[month] = count;
        return acc;
      }, {} as Record<string, number>);

    // Group by album for album distribution
    const albumCounts: Record<string, number> = {};
    for (const track of tracks) {
      albumCounts[track.album] = (albumCounts[track.album] || 0) + 1;
    }
    const topAlbums = Object.entries(albumCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .reduce((acc, [album, count]) => {
        acc[album] = count;
        return acc;
      }, {} as Record<string, number>);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              tracks: tracks.map((t) => ({
                name: t.name,
                artist: t.artist,
                album: t.album,
                addedAt: t.addedAt,
              })),
              // Aggregated stats for visualization
              topArtists,
              topAlbums,
              timelineByMonth: sortedTimeline,
              totalTracks: tracks.length,
              uniqueArtists: Object.keys(artistCounts).length,
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
