import { z } from "zod";
import { getSpotifyClient } from "../services/spotify-client.js";
import { getDiscogsClient } from "../services/discogs-client.js";
import {
  matchAlbumsToCollection,
  extractUniqueAlbums,
  isOwned,
  normalizeArtist,
  normalizeAlbum,
} from "../utils/album-matcher.js";

export const collectionAnalysisSchema = {
  mode: z
    .enum(["insights", "comparison", "full"])
    .optional()
    .default("full")
    .describe("Analysis mode: insights (collection stats), comparison (overlap/gaps), or full (both)"),
  time_range: z
    .enum(["short_term", "medium_term", "long_term"])
    .optional()
    .default("medium_term")
    .describe("Time range for listening data: short_term (~4 weeks), medium_term (~6 months), long_term (years)"),
};

interface CollectionAlbumWithListening {
  album: string;
  artist: string;
  year: number | null;
  dateAdded: string | null;
  recentPlayCount: number;
  isInTopTracks: boolean;
  spotifyGenres: string[];
}

interface OverlapAlbum {
  album: string;
  artist: string;
  matchScore: number;
}

interface OverlapArtist {
  name: string;
  ownedAlbums: number;
  spotifyRank: number;
}

interface MissingAlbum {
  album: string;
  artist: string;
  listeningRank: number;
}

interface UnplayedAlbum {
  album: string;
  artist: string;
  daysSinceAdded: number | null;
}

export const collectionAnalysisTool = {
  name: "get_collection_analysis",
  description:
    "Analyze your vinyl collection against Spotify listening habits. Returns alignment scores, overlap/gap analysis, most/least played owned albums, and Venn diagram data for visualization.",
  schema: collectionAnalysisSchema,

  async handler(args: { mode?: string; time_range?: string }) {
    const spotifyClient = getSpotifyClient();
    const discogsClient = getDiscogsClient();

    const mode = args.mode || "full";
    const timeRange = (args.time_range || "medium_term") as
      | "short_term"
      | "medium_term"
      | "long_term";

    const includeInsights = mode === "insights" || mode === "full";
    const includeComparison = mode === "comparison" || mode === "full";

    // Fetch all data in parallel
    const [{ collection }, topTracks, topArtists, recentTracks] =
      await Promise.all([
        discogsClient.getCollection(),
        spotifyClient.getTopTracks(timeRange, 50),
        spotifyClient.getTopArtists(timeRange, 50),
        spotifyClient.getRecentlyPlayed(50),
      ]);

    // Build play count map from recently played
    const playCountMap = new Map<string, number>();
    for (const track of recentTracks) {
      const key = `${normalizeArtist(track.artist)}|${normalizeAlbum(track.album)}`;
      playCountMap.set(key, (playCountMap.get(key) || 0) + 1);
    }

    // Build top tracks set for quick lookup
    const topTrackAlbums = new Set<string>();
    for (const track of topTracks) {
      const key = `${normalizeArtist(track.artist)}|${normalizeAlbum(track.album)}`;
      topTrackAlbums.add(key);
    }

    // Build artist genre map
    const artistGenreMap = new Map<string, string[]>();
    for (const artist of topArtists) {
      artistGenreMap.set(normalizeArtist(artist.name), artist.genres);
    }

    // Analyze collection with listening data
    const collectionWithListening: CollectionAlbumWithListening[] = [];
    let ownedAndListened = 0;
    let ownedNotListened = 0;
    const genreBreakdown: Record<string, number> = {};

    for (const release of collection) {
      const key = `${normalizeArtist(release.artist)}|${normalizeAlbum(release.album)}`;
      const playCount = playCountMap.get(key) || 0;
      const isInTop = topTrackAlbums.has(key);

      // Get genres from artist
      const artistKey = normalizeArtist(release.artist);
      const genres = artistGenreMap.get(artistKey) || [];

      // Track genre breakdown
      for (const genre of genres) {
        genreBreakdown[genre] = (genreBreakdown[genre] || 0) + 1;
      }

      // Track alignment
      if (playCount > 0 || isInTop) {
        ownedAndListened++;
      } else {
        ownedNotListened++;
      }

      collectionWithListening.push({
        album: release.album,
        artist: release.artist,
        year: release.year,
        dateAdded: release.dateAdded,
        recentPlayCount: playCount,
        isInTopTracks: isInTop,
        spotifyGenres: genres,
      });
    }

    // Calculate listened but not owned
    const uniqueListenedAlbums = new Set<string>();
    for (const track of [...recentTracks, ...topTracks]) {
      uniqueListenedAlbums.add(
        `${normalizeArtist(track.artist)}|${normalizeAlbum(track.album)}`
      );
    }

    // Extract unique albums from listening for comparison
    const listenedAlbums = extractUniqueAlbums([...topTracks, ...recentTracks]);
    const matchResults = matchAlbumsToCollection(listenedAlbums, collection);

    let listenedNotOwned = 0;
    for (const result of matchResults) {
      if (!isOwned(result)) {
        listenedNotOwned++;
      }
    }

    // Calculate alignment score (0-100)
    const totalAnalyzed = ownedAndListened + ownedNotListened + listenedNotOwned;
    const alignmentScore =
      totalAnalyzed > 0
        ? Math.round((ownedAndListened / totalAnalyzed) * 100)
        : 0;

    // Calculate Venn diagram data
    const overlapAlbums: OverlapAlbum[] = [];
    const missingFromCollection: MissingAlbum[] = [];

    for (let i = 0; i < matchResults.length; i++) {
      const result = matchResults[i];
      if (isOwned(result)) {
        overlapAlbums.push({
          album: result.spotifyAlbum.name,
          artist: result.spotifyAlbum.artist,
          matchScore: Math.round(result.matchScore * 100) / 100,
        });
      } else {
        missingFromCollection.push({
          album: result.spotifyAlbum.name,
          artist: result.spotifyAlbum.artist,
          listeningRank: i + 1,
        });
      }
    }

    const onlyOwned = collection.length - overlapAlbums.length;
    const onlyListened = listenedAlbums.length - overlapAlbums.length;
    const both = overlapAlbums.length;

    const totalUnique = onlyOwned + onlyListened + both;
    const overlapPercentage =
      totalUnique > 0 ? Math.round((both / totalUnique) * 100) : 0;

    // Build summary (always included)
    const response: Record<string, unknown> = {
      summary: {
        alignmentScore,
        overlapPercentage,
        ownedAndListened,
        ownedNotListened,
        listenedNotOwned,
        totalInCollection: collection.length,
        timeRange,
      },
      vennData: { onlyOwned, onlyListened, both },
    };

    // Insights mode data
    if (includeInsights) {
      // Sort by play count for most/least played
      const sortedByPlay = [...collectionWithListening].sort(
        (a, b) => b.recentPlayCount - a.recentPlayCount
      );

      const mostPlayedOwned = sortedByPlay
        .filter((a) => a.recentPlayCount > 0)
        .slice(0, 10)
        .map((a) => ({
          album: a.album,
          artist: a.artist,
          recentPlayCount: a.recentPlayCount,
        }));

      const leastPlayedOwned = sortedByPlay
        .filter((a) => a.recentPlayCount === 0 && !a.isInTopTracks)
        .slice(-10)
        .reverse()
        .map((a) => ({
          album: a.album,
          artist: a.artist,
          dateAdded: a.dateAdded,
        }));

      // Sort genre breakdown
      const sortedGenres = Object.entries(genreBreakdown)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .reduce((acc, [genre, count]) => {
          acc[genre] = count;
          return acc;
        }, {} as Record<string, number>);

      // Build collection timeline
      const timelineByMonth: Record<string, number> = {};
      for (const release of collection) {
        if (release.dateAdded) {
          const date = new Date(release.dateAdded);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          timelineByMonth[monthKey] = (timelineByMonth[monthKey] || 0) + 1;
        }
      }

      const sortedMonths = Object.keys(timelineByMonth).sort();
      let cumulative = 0;
      const collectionTimeline = sortedMonths.map((month) => {
        cumulative += timelineByMonth[month];
        return {
          month,
          addedCount: timelineByMonth[month],
          cumulativeTotal: cumulative,
        };
      });

      response.mostPlayedOwned = mostPlayedOwned;
      response.leastPlayedOwned = leastPlayedOwned;
      response.genreBreakdown = sortedGenres;
      response.collectionTimeline = collectionTimeline;
    }

    // Comparison mode data
    if (includeComparison) {
      // Build artist overlap
      const overlapArtists: OverlapArtist[] = [];
      const collectionArtists = new Map<string, number>();

      for (const release of collection) {
        const normalizedArtist = normalizeArtist(release.artist);
        collectionArtists.set(
          normalizedArtist,
          (collectionArtists.get(normalizedArtist) || 0) + 1
        );
      }

      for (let i = 0; i < topArtists.length; i++) {
        const artist = topArtists[i];
        const normalizedName = normalizeArtist(artist.name);
        const ownedCount = collectionArtists.get(normalizedName) || 0;

        if (ownedCount > 0) {
          overlapArtists.push({
            name: artist.name,
            ownedAlbums: ownedCount,
            spotifyRank: i + 1,
          });
        }
      }

      // Find unplayed albums in collection
      const unplayedInCollection: UnplayedAlbum[] = [];
      const now = Date.now();

      for (const release of collection) {
        let isListened = false;
        for (const result of matchResults) {
          if (
            isOwned(result) &&
            result.discogsRelease?.releaseId === release.releaseId
          ) {
            isListened = true;
            break;
          }
        }

        if (!isListened) {
          const daysSinceAdded = release.dateAdded
            ? Math.floor(
                (now - new Date(release.dateAdded).getTime()) / (1000 * 60 * 60 * 24)
              )
            : null;

          unplayedInCollection.push({
            album: release.album,
            artist: release.artist,
            daysSinceAdded,
          });
        }
      }

      // Sort unplayed by days since added (oldest first)
      unplayedInCollection.sort((a, b) => {
        if (a.daysSinceAdded === null) return 1;
        if (b.daysSinceAdded === null) return -1;
        return b.daysSinceAdded - a.daysSinceAdded;
      });

      // Find top missing artists
      const missingByArtist: Record<string, number> = {};
      for (const album of missingFromCollection) {
        missingByArtist[album.artist] = (missingByArtist[album.artist] || 0) + 1;
      }
      const topMissingArtists = Object.entries(missingByArtist)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);

      // Find top unplayed artists
      const unplayedByArtist: Record<string, number> = {};
      for (const album of unplayedInCollection) {
        unplayedByArtist[album.artist] =
          (unplayedByArtist[album.artist] || 0) + 1;
      }
      const topUnplayedArtists = Object.entries(unplayedByArtist)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);

      response.overlap = {
        albums: overlapAlbums.slice(0, 25),
        artists: overlapArtists,
      };
      response.gaps = {
        missingFromCollection: missingFromCollection.slice(0, 25),
        unplayedInCollection: unplayedInCollection.slice(0, 25),
      };
      response.topMissingArtists = topMissingArtists;
      response.topUnplayedArtists = topUnplayedArtists;
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  },
};
