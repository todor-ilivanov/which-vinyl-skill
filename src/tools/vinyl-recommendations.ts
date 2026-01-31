import { z } from "zod";
import { getSpotifyClient } from "../services/spotify-client.js";
import { getDiscogsClient } from "../services/discogs-client.js";
import {
  matchAlbumsToCollection,
  extractUniqueAlbums,
  isOwned,
  SpotifyAlbum,
} from "../utils/album-matcher.js";

export const vinylRecommendationsSchema = {
  source: z
    .enum(["top_tracks", "top_artists", "saved_albums", "recently_played"])
    .optional()
    .default("top_tracks")
    .describe(
      "Source of listening data: top_tracks, top_artists, saved_albums, or recently_played"
    ),
  time_range: z
    .enum(["short_term", "medium_term", "long_term"])
    .optional()
    .default("medium_term")
    .describe(
      "Time range for top data: short_term (~4 weeks), medium_term (~6 months), long_term (years)"
    ),
  limit: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe("Maximum number of recommendations to return (max 50)"),
};

interface Recommendation {
  album: string;
  artist: string;
  reason: string;
  spotifyPopularity?: number;
}

export const vinylRecommendationsTool = {
  name: "get_vinyl_recommendations",
  description:
    "Find albums you listen to on Spotify but don't own on vinyl. Compares your Spotify listening history with your Discogs collection to suggest vinyl purchases. Includes aggregated data for visualization.",
  schema: vinylRecommendationsSchema,

  async handler(args: {
    source?: string;
    time_range?: string;
    limit?: number;
  }) {
    const spotifyClient = getSpotifyClient();
    const discogsClient = getDiscogsClient();

    const source = args.source || "top_tracks";
    const timeRange = (args.time_range || "medium_term") as
      | "short_term"
      | "medium_term"
      | "long_term";
    const limit = Math.min(args.limit || 20, 50);

    // Fetch Discogs collection
    const { collection } = await discogsClient.getCollection();

    // Fetch Spotify data based on source
    let albums: SpotifyAlbum[] = [];
    let trackPopularity: Map<string, number> = new Map();

    switch (source) {
      case "top_tracks": {
        const tracks = await spotifyClient.getTopTracks(timeRange, 50);
        albums = extractUniqueAlbums(tracks);
        // Store popularity for recommendations
        for (const track of tracks) {
          const key = `${track.artist}|${track.album}`;
          if (!trackPopularity.has(key)) {
            trackPopularity.set(key, track.popularity);
          }
        }
        break;
      }
      case "top_artists": {
        const artists = await spotifyClient.getTopArtists(timeRange, 50);
        // Get saved albums from top artists
        const savedAlbums = await spotifyClient.getSavedAlbums(50, 0);
        const topArtistNames = new Set(
          artists.map((a) => a.name.toLowerCase())
        );
        albums = savedAlbums
          .filter((a) => topArtistNames.has(a.artist.toLowerCase()))
          .map((a) => ({ name: a.name, artist: a.artist }));
        break;
      }
      case "saved_albums": {
        const savedAlbums = await spotifyClient.getSavedAlbums(50, 0);
        albums = savedAlbums.map((a) => ({ name: a.name, artist: a.artist }));
        break;
      }
      case "recently_played": {
        const tracks = await spotifyClient.getRecentlyPlayed(50);
        albums = extractUniqueAlbums(tracks);
        for (const track of tracks) {
          const key = `${track.artist}|${track.album}`;
          if (!trackPopularity.has(key)) {
            trackPopularity.set(key, track.popularity);
          }
        }
        break;
      }
    }

    // Match albums to collection
    const matchResults = matchAlbumsToCollection(albums, collection);

    // Filter to albums not owned
    const notOwned = matchResults.filter((r) => !isOwned(r));

    // Build recommendations with reasons
    const recommendations: Recommendation[] = [];
    const byArtist: Record<string, number> = {};
    const byDecade: Record<string, number> = {};

    for (let i = 0; i < notOwned.length && recommendations.length < limit; i++) {
      const result = notOwned[i];
      const album = result.spotifyAlbum;
      const key = `${album.artist}|${album.name}`;
      const popularity = trackPopularity.get(key);

      let reason: string;
      const rank = albums.findIndex(
        (a) => a.name === album.name && a.artist === album.artist
      );

      switch (source) {
        case "top_tracks":
          reason =
            rank >= 0
              ? `Your #${rank + 1} most played album`
              : "Frequently played";
          break;
        case "top_artists":
          reason = `From one of your top artists`;
          break;
        case "saved_albums":
          reason = `Saved in your Spotify library`;
          break;
        case "recently_played":
          reason =
            rank >= 0 ? `Recently played (#${rank + 1})` : "Recently played";
          break;
        default:
          reason = "Based on your listening";
      }

      recommendations.push({
        album: album.name,
        artist: album.artist,
        reason,
        spotifyPopularity: popularity,
      });

      // Aggregate by artist
      byArtist[album.artist] = (byArtist[album.artist] || 0) + 1;
    }

    // Calculate owned count
    const alreadyOwned = matchResults.filter((r) => isOwned(r)).length;

    // Sort byArtist by count
    const sortedByArtist = Object.entries(byArtist)
      .sort((a, b) => b[1] - a[1])
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
              recommendations,
              summary: {
                analyzed: albums.length,
                alreadyOwned,
                recommended: recommendations.length,
                source,
                timeRange: source === "top_tracks" || source === "top_artists" ? timeRange : undefined,
              },
              byArtist: sortedByArtist,
              byDecade,
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
