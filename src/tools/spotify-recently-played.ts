import { z } from "zod";
import { getSpotifyClient } from "../services/spotify-client.js";

export const spotifyRecentlyPlayedSchema = {
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(50)
    .describe("Number of tracks to return (max 50)"),
};

export const spotifyRecentlyPlayedTool = {
  name: "get_spotify_recently_played",
  description:
    "Fetch the user's recently played tracks from Spotify. Returns the last played tracks with timestamps.",
  schema: spotifyRecentlyPlayedSchema,

  async handler(args: { limit?: number }) {
    const client = getSpotifyClient();
    const limit = Math.min(args.limit || 50, 50);

    const tracks = await client.getRecentlyPlayed(limit);

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
                played_at: t.playedAt,
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
