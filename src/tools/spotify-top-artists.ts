import { z } from "zod";
import { getSpotifyClient } from "../services/spotify-client.js";

export const spotifyTopArtistsSchema = {
  time_range: z
    .enum(["short_term", "medium_term", "long_term"])
    .optional()
    .default("short_term")
    .describe(
      "Time range for top artists: short_term (~4 weeks), medium_term (~6 months), long_term (years)"
    ),
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe("Number of artists to return (max 50)"),
};

export const spotifyTopArtistsTool = {
  name: "get_spotify_top_artists",
  description:
    "Fetch the user's top artists from Spotify based on listening history. Returns artist names, genres, popularity, and follower counts. Includes aggregated genre breakdown for visualization.",
  schema: spotifyTopArtistsSchema,

  async handler(args: { time_range?: string; limit?: number }) {
    const client = getSpotifyClient();
    const timeRange = (args.time_range || "short_term") as
      | "short_term"
      | "medium_term"
      | "long_term";
    const limit = Math.min(args.limit || 20, 50);

    const artists = await client.getTopArtists(timeRange, limit);

    // Aggregate genre breakdown for visualization
    const genreBreakdown: Record<string, number> = {};
    for (const artist of artists) {
      for (const genre of artist.genres) {
        genreBreakdown[genre] = (genreBreakdown[genre] || 0) + 1;
      }
    }

    // Sort genres by frequency
    const sortedGenres = Object.entries(genreBreakdown)
      .sort((a, b) => b[1] - a[1])
      .reduce((acc, [genre, count]) => {
        acc[genre] = count;
        return acc;
      }, {} as Record<string, number>);

    // Calculate aggregate stats
    const totalFollowers = artists.reduce((sum, a) => sum + a.followers, 0);
    const averagePopularity = artists.length > 0
      ? Math.round(artists.reduce((sum, a) => sum + a.popularity, 0) / artists.length)
      : 0;

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              time_range: timeRange,
              artists: artists.map((a) => ({
                name: a.name,
                genres: a.genres,
                popularity: a.popularity,
                followers: a.followers,
              })),
              // Aggregated stats for visualization
              genreBreakdown: sortedGenres,
              averagePopularity,
              totalFollowers,
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
