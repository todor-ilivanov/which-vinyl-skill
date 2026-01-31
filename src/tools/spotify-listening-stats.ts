import { z } from "zod";
import { getSpotifyClient } from "../services/spotify-client.js";

export const spotifyListeningStatsSchema = {};

export const spotifyListeningStatsTool = {
  name: "get_listening_history_stats",
  description:
    "Get comprehensive listening statistics by aggregating data from multiple Spotify endpoints. Returns genre breakdown, taste evolution comparison (short-term vs long-term preferences), and unique artist counts. Ideal for creating visualizations of listening habits over time.",
  schema: spotifyListeningStatsSchema,

  async handler() {
    const client = getSpotifyClient();

    // Fetch data from multiple endpoints in parallel
    const [
      shortTermArtists,
      longTermArtists,
      recentlyPlayed,
      shortTermTracks,
      longTermTracks,
    ] = await Promise.all([
      client.getTopArtists("short_term", 50),
      client.getTopArtists("long_term", 50),
      client.getRecentlyPlayed(50),
      client.getTopTracks("short_term", 50),
      client.getTopTracks("long_term", 50),
    ]);

    // Genre breakdown from short-term listening
    const shortTermGenres: Record<string, number> = {};
    for (const artist of shortTermArtists) {
      for (const genre of artist.genres) {
        shortTermGenres[genre] = (shortTermGenres[genre] || 0) + 1;
      }
    }

    // Genre breakdown from long-term listening
    const longTermGenres: Record<string, number> = {};
    for (const artist of longTermArtists) {
      for (const genre of artist.genres) {
        longTermGenres[genre] = (longTermGenres[genre] || 0) + 1;
      }
    }

    // Sort genres by frequency
    const sortGenres = (genres: Record<string, number>) =>
      Object.entries(genres)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .reduce((acc, [genre, count]) => {
          acc[genre] = count;
          return acc;
        }, {} as Record<string, number>);

    // Unique artists from recently played
    const recentUniqueArtists = new Set(recentlyPlayed.map((t) => t.artist));

    // Taste evolution: which artists are in short-term but not long-term (new obsessions)
    const shortTermArtistNames = new Set(shortTermArtists.map((a) => a.name));
    const longTermArtistNames = new Set(longTermArtists.map((a) => a.name));

    const newObsessions = shortTermArtists
      .filter((a) => !longTermArtistNames.has(a.name))
      .slice(0, 10)
      .map((a) => a.name);

    const consistentFavorites = shortTermArtists
      .filter((a) => longTermArtistNames.has(a.name))
      .slice(0, 10)
      .map((a) => a.name);

    const fadedFavorites = longTermArtists
      .filter((a) => !shortTermArtistNames.has(a.name))
      .slice(0, 10)
      .map((a) => a.name);

    // Genre shifts: compare short vs long term
    const allGenres = new Set([
      ...Object.keys(shortTermGenres),
      ...Object.keys(longTermGenres),
    ]);
    const genreShifts: Array<{ genre: string; shortTerm: number; longTerm: number; change: number }> = [];
    for (const genre of allGenres) {
      const short = shortTermGenres[genre] || 0;
      const long = longTermGenres[genre] || 0;
      if (short > 0 || long > 0) {
        genreShifts.push({
          genre,
          shortTerm: short,
          longTerm: long,
          change: short - long,
        });
      }
    }
    genreShifts.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    // Average popularity comparison
    const shortTermAvgPopularity = shortTermArtists.length > 0
      ? Math.round(shortTermArtists.reduce((s, a) => s + a.popularity, 0) / shortTermArtists.length)
      : 0;
    const longTermAvgPopularity = longTermArtists.length > 0
      ? Math.round(longTermArtists.reduce((s, a) => s + a.popularity, 0) / longTermArtists.length)
      : 0;

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              // Current listening snapshot
              recentlyPlayedUniqueArtists: recentUniqueArtists.size,
              recentlyPlayedTotalTracks: recentlyPlayed.length,

              // Genre breakdown for visualization
              shortTermGenres: sortGenres(shortTermGenres),
              longTermGenres: sortGenres(longTermGenres),

              // Taste evolution (great for side-by-side or Sankey diagrams)
              tasteEvolution: {
                newObsessions,      // Artists you're into now but weren't before
                consistentFavorites, // Artists you've always loved
                fadedFavorites,     // Artists you used to listen to more
              },

              // Genre shifts for stacked/grouped bar chart
              genreShifts: genreShifts.slice(0, 15),

              // Popularity trends
              popularityTrend: {
                shortTerm: shortTermAvgPopularity,
                longTerm: longTermAvgPopularity,
                goingMainstream: shortTermAvgPopularity > longTermAvgPopularity,
              },

              // Top artists comparison
              topArtistsComparison: {
                shortTerm: shortTermArtists.slice(0, 10).map((a) => a.name),
                longTerm: longTermArtists.slice(0, 10).map((a) => a.name),
              },

              // Top tracks comparison
              topTracksComparison: {
                shortTerm: shortTermTracks.slice(0, 10).map((t) => ({
                  name: t.name,
                  artist: t.artist,
                })),
                longTerm: longTermTracks.slice(0, 10).map((t) => ({
                  name: t.name,
                  artist: t.artist,
                })),
              },
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
