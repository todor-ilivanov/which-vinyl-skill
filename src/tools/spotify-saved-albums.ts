import { z } from "zod";
import { getSpotifyClient } from "../services/spotify-client.js";

export const spotifySavedAlbumsSchema = {
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(50)
    .describe("Number of albums to return (max 50)"),
  offset: z
    .number()
    .min(0)
    .optional()
    .default(0)
    .describe("Index of first album to return (for pagination)"),
};

export const spotifySavedAlbumsTool = {
  name: "get_saved_albums",
  description:
    "Fetch the user's saved albums from Spotify library. Returns album names, artists, release dates, and when they were added. Includes timeline data grouped by month for visualization.",
  schema: spotifySavedAlbumsSchema,

  async handler(args: { limit?: number; offset?: number }) {
    const client = getSpotifyClient();
    const limit = Math.min(args.limit || 50, 50);
    const offset = args.offset || 0;

    const albums = await client.getSavedAlbums(limit, offset);

    // Group albums by month/year added for timeline visualization
    const timelineByMonth: Record<string, number> = {};
    for (const album of albums) {
      const date = new Date(album.addedAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      timelineByMonth[monthKey] = (timelineByMonth[monthKey] || 0) + 1;
    }

    // Group albums by release decade
    const byDecade: Record<string, number> = {};
    for (const album of albums) {
      const year = parseInt(album.releaseDate.split("-")[0], 10);
      const decade = `${Math.floor(year / 10) * 10}s`;
      byDecade[decade] = (byDecade[decade] || 0) + 1;
    }

    // Sort timeline chronologically
    const sortedTimeline = Object.entries(timelineByMonth)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .reduce((acc, [month, count]) => {
        acc[month] = count;
        return acc;
      }, {} as Record<string, number>);

    // Artist frequency in saved albums
    const artistCounts: Record<string, number> = {};
    for (const album of albums) {
      artistCounts[album.artist] = (artistCounts[album.artist] || 0) + 1;
    }
    const topArtists = Object.entries(artistCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .reduce((acc, [artist, count]) => {
        acc[artist] = count;
        return acc;
      }, {} as Record<string, number>);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              albums: albums.map((a) => ({
                name: a.name,
                artist: a.artist,
                releaseDate: a.releaseDate,
                totalTracks: a.totalTracks,
                addedAt: a.addedAt,
              })),
              // Aggregated stats for visualization
              timelineByMonth: sortedTimeline,
              byDecade,
              topArtists,
              totalAlbums: albums.length,
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
