import { z } from "zod";
import { getSpotifyClient } from "../services/spotify-client.js";

export const spotifyPlaylistsSchema = {
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(50)
    .describe("Number of playlists to return (max 50)"),
  offset: z
    .number()
    .min(0)
    .optional()
    .default(0)
    .describe("Index of first playlist to return (for pagination)"),
};

export const spotifyPlaylistsTool = {
  name: "get_user_playlists",
  description:
    "Fetch the user's playlists from Spotify. Returns playlist names, track counts, and visibility status. Includes size distribution for visualization.",
  schema: spotifyPlaylistsSchema,

  async handler(args: { limit?: number; offset?: number }) {
    const client = getSpotifyClient();
    const limit = Math.min(args.limit || 50, 50);
    const offset = args.offset || 0;

    const playlists = await client.getUserPlaylists(limit, offset);

    // Calculate size distribution for visualization
    const sizeDistribution = {
      "1-10": 0,
      "11-25": 0,
      "26-50": 0,
      "51-100": 0,
      "100+": 0,
    };
    for (const playlist of playlists) {
      if (playlist.trackCount <= 10) sizeDistribution["1-10"]++;
      else if (playlist.trackCount <= 25) sizeDistribution["11-25"]++;
      else if (playlist.trackCount <= 50) sizeDistribution["26-50"]++;
      else if (playlist.trackCount <= 100) sizeDistribution["51-100"]++;
      else sizeDistribution["100+"]++;
    }

    // Count public vs private
    const publicCount = playlists.filter((p) => p.isPublic).length;
    const privateCount = playlists.length - publicCount;

    // Total tracks across all playlists
    const totalTracks = playlists.reduce((sum, p) => sum + p.trackCount, 0);
    const averageTracksPerPlaylist = playlists.length > 0
      ? Math.round(totalTracks / playlists.length)
      : 0;

    // Largest playlists
    const largestPlaylists = [...playlists]
      .sort((a, b) => b.trackCount - a.trackCount)
      .slice(0, 5)
      .map((p) => ({ name: p.name, trackCount: p.trackCount }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              playlists: playlists.map((p) => ({
                name: p.name,
                trackCount: p.trackCount,
                owner: p.owner,
                isPublic: p.isPublic,
                description: p.description,
              })),
              // Aggregated stats for visualization
              sizeDistribution,
              visibility: { public: publicCount, private: privateCount },
              largestPlaylists,
              totalPlaylists: playlists.length,
              totalTracks,
              averageTracksPerPlaylist,
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
