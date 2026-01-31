import { DiscogsRelease } from "../services/discogs-client.js";

export interface SpotifyAlbum {
  name: string;
  artist: string;
}

export interface MatchResult {
  spotifyAlbum: SpotifyAlbum;
  discogsRelease: DiscogsRelease | null;
  matchScore: number;
  matchType: "exact" | "fuzzy" | "artist_only" | "no_match";
}

/**
 * Normalize artist name for comparison.
 * Removes "The", special characters, and converts to lowercase.
 */
export function normalizeArtist(name: string): string {
  return name
    .toLowerCase()
    .replace(/^the\s+/i, "") // Remove leading "The"
    .replace(/[^\w\s]/g, "") // Remove special characters
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Normalize album title for comparison.
 * Removes edition markers, brackets, parentheses content, and special characters.
 */
export function normalizeAlbum(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, "") // Remove parentheses content (Deluxe Edition)
    .replace(/\s*\[.*?\]\s*/g, "") // Remove bracket content [Remastered]
    .replace(/\s*-\s*\d{4}\s*(deluxe|remaster|remastered|expanded|anniversary|edition|special|bonus|mono|stereo).*$/i, "") // "- 2011 Remastered"
    .replace(/\s*-\s*(deluxe|remaster|remastered|expanded|anniversary|edition|special|bonus|mono|stereo).*$/i, "") // "- Remastered"
    .replace(/[^\w\s]/g, "") // Remove special characters
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate string similarity using Levenshtein distance.
 * Returns a value between 0 and 1, where 1 is a perfect match.
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);

  return 1 - distance / maxLength;
}

/**
 * Calculate weighted match score for an album.
 * Artist weight: 40%, Album weight: 60% (album title is more distinctive)
 */
function calculateMatchScore(
  spotifyArtist: string,
  spotifyAlbum: string,
  discogsArtist: string,
  discogsAlbum: string
): number {
  const normalizedSpotifyArtist = normalizeArtist(spotifyArtist);
  const normalizedSpotifyAlbum = normalizeAlbum(spotifyAlbum);
  const normalizedDiscogsArtist = normalizeArtist(discogsArtist);
  const normalizedDiscogsAlbum = normalizeAlbum(discogsAlbum);

  const artistScore = stringSimilarity(normalizedSpotifyArtist, normalizedDiscogsArtist);
  const albumScore = stringSimilarity(normalizedSpotifyAlbum, normalizedDiscogsAlbum);

  // 40% artist weight, 60% album weight
  return artistScore * 0.4 + albumScore * 0.6;
}

/**
 * Determine match type based on score thresholds.
 */
function determineMatchType(
  score: number,
  artistScore: number
): "exact" | "fuzzy" | "artist_only" | "no_match" {
  if (score >= 0.95) return "exact";
  if (score >= 0.75) return "fuzzy";
  if (artistScore >= 0.9) return "artist_only";
  return "no_match";
}

/**
 * Match a single Spotify album to the best matching release in a Discogs collection.
 */
export function matchAlbumToCollection(
  album: SpotifyAlbum,
  collection: DiscogsRelease[]
): MatchResult {
  let bestMatch: DiscogsRelease | null = null;
  let bestScore = 0;
  let bestArtistScore = 0;

  const normalizedSpotifyArtist = normalizeArtist(album.artist);
  const normalizedSpotifyAlbum = normalizeAlbum(album.name);

  for (const release of collection) {
    const normalizedDiscogsArtist = normalizeArtist(release.artist);
    const normalizedDiscogsAlbum = normalizeAlbum(release.album);

    const artistScore = stringSimilarity(normalizedSpotifyArtist, normalizedDiscogsArtist);
    const albumScore = stringSimilarity(normalizedSpotifyAlbum, normalizedDiscogsAlbum);
    const score = artistScore * 0.4 + albumScore * 0.6;

    if (score > bestScore) {
      bestScore = score;
      bestArtistScore = artistScore;
      bestMatch = release;
    }
  }

  const matchType = determineMatchType(bestScore, bestArtistScore);

  // Only return a match if it's at least artist_only level
  if (matchType === "no_match") {
    return {
      spotifyAlbum: album,
      discogsRelease: null,
      matchScore: bestScore,
      matchType: "no_match",
    };
  }

  return {
    spotifyAlbum: album,
    discogsRelease: bestMatch,
    matchScore: bestScore,
    matchType,
  };
}

/**
 * Match multiple Spotify albums to a Discogs collection.
 * Returns all match results including non-matches.
 */
export function matchAlbumsToCollection(
  albums: SpotifyAlbum[],
  collection: DiscogsRelease[]
): MatchResult[] {
  return albums.map((album) => matchAlbumToCollection(album, collection));
}

/**
 * Extract unique albums from a list of tracks.
 */
export function extractUniqueAlbums(
  tracks: Array<{ album: string; artist: string }>
): SpotifyAlbum[] {
  const seen = new Set<string>();
  const albums: SpotifyAlbum[] = [];

  for (const track of tracks) {
    const key = `${normalizeArtist(track.artist)}|${normalizeAlbum(track.album)}`;
    if (!seen.has(key)) {
      seen.add(key);
      albums.push({ name: track.album, artist: track.artist });
    }
  }

  return albums;
}

/**
 * Check if a match represents ownership (exact or fuzzy match).
 */
export function isOwned(result: MatchResult): boolean {
  return result.matchType === "exact" || result.matchType === "fuzzy";
}
