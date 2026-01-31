import { z } from "zod";
import { getSpotifyClient } from "../services/spotify-client.js";

export const spotifyTopTracksSchema = {
  time_range: z
    .enum(["short_term", "medium_term", "long_term"])
    .optional()
    .default("short_term")
    .describe(
      "Time range for top tracks: short_term (~4 weeks), medium_term (~6 months), long_term (years)"
    ),
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe("Number of tracks to return (max 50)"),
};

export const spotifyTopTracksTool = {
  name: "get_spotify_top_tracks",
  description:
    "Fetch the user's top tracks from Spotify based on listening history. Returns track names, artists, albums, and popularity scores.",
  schema: spotifyTopTracksSchema,

  async handler(args: { time_range?: string; limit?: number }) {
    const client = getSpotifyClient();
    const timeRange = (args.time_range || "short_term") as
      | "short_term"
      | "medium_term"
      | "long_term";
    const limit = Math.min(args.limit || 20, 50);

    const tracks = await client.getTopTracks(timeRange, limit);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              time_range: timeRange,
              tracks: tracks.map((t) => ({
                name: t.name,
                artist: t.artist,
                album: t.album,
                popularity: t.popularity,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
