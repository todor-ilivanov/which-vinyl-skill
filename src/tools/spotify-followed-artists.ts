import { z } from "zod";
import { getSpotifyClient } from "../services/spotify-client.js";

export const spotifyFollowedArtistsSchema = {
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(50)
    .describe("Number of artists to return (max 50)"),
  after: z
    .string()
    .optional()
    .describe("Cursor for pagination (artist ID to start after)"),
};

export const spotifyFollowedArtistsTool = {
  name: "get_followed_artists",
  description:
    "Fetch the artists the user follows on Spotify. Returns artist names, genres, popularity, and follower counts. Includes genre breakdown and pagination cursor for fetching more.",
  schema: spotifyFollowedArtistsSchema,

  async handler(args: { limit?: number; after?: string }) {
    const client = getSpotifyClient();
    const limit = Math.min(args.limit || 50, 50);

    const result = await client.getFollowedArtists(limit, args.after);

    // Aggregate genre breakdown for visualization
    const genreBreakdown: Record<string, number> = {};
    for (const artist of result.artists) {
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
    const totalFollowers = result.artists.reduce((sum, a) => sum + a.followers, 0);
    const averagePopularity = result.artists.length > 0
      ? Math.round(result.artists.reduce((sum, a) => sum + a.popularity, 0) / result.artists.length)
      : 0;

    // Group by popularity ranges for visualization
    const popularityDistribution = {
      "0-25": 0,
      "26-50": 0,
      "51-75": 0,
      "76-100": 0,
    };
    for (const artist of result.artists) {
      if (artist.popularity <= 25) popularityDistribution["0-25"]++;
      else if (artist.popularity <= 50) popularityDistribution["26-50"]++;
      else if (artist.popularity <= 75) popularityDistribution["51-75"]++;
      else popularityDistribution["76-100"]++;
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              artists: result.artists.map((a) => ({
                name: a.name,
                genres: a.genres,
                popularity: a.popularity,
                followers: a.followers,
              })),
              // Pagination
              nextCursor: result.nextCursor,
              hasMore: result.nextCursor !== null,
              // Aggregated stats for visualization
              genreBreakdown: sortedGenres,
              popularityDistribution,
              averagePopularity,
              totalFollowers,
              totalArtists: result.artists.length,
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
