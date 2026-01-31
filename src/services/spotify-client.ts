import { loadSpotifyTokens, saveSpotifyTokens } from '../auth/token-storage.js';

export interface SpotifyTrack {
  name: string;
  artist: string;
  album: string;
  popularity: number;
  spotifyId: string;
}

export interface RecentlyPlayedTrack extends SpotifyTrack {
  playedAt: string;
}

export interface SpotifyArtist {
  name: string;
  genres: string[];
  popularity: number;
  followers: number;
  spotifyId: string;
}

export interface SavedAlbum {
  name: string;
  artist: string;
  releaseDate: string;
  totalTracks: number;
  addedAt: string;
  spotifyId: string;
}

export interface SavedTrack {
  name: string;
  artist: string;
  album: string;
  addedAt: string;
  spotifyId: string;
}

export interface UserPlaylist {
  name: string;
  id: string;
  trackCount: number;
  owner: string;
  isPublic: boolean;
  description: string | null;
}

interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
}

interface SpotifyConfig {
  clientId: string;
  clientSecret: string;
  tokens: SpotifyTokens;
}

export class SpotifyClient {
  private config: SpotifyConfig;
  private accessToken: string;
  private refreshToken: string;
  private expiresAt: number;
  private tokensLoaded: boolean = false;

  constructor() {
    this.config = {
      clientId: process.env.SPOTIFY_CLIENT_ID || "",
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET || "",
      tokens: {
        accessToken: "",
        refreshToken: "",
        expiresAt: 0,
      },
    };
    this.accessToken = "";
    this.refreshToken = "";
    this.expiresAt = 0;
  }

  private async loadTokens(): Promise<void> {
    if (this.tokensLoaded) return;

    // Try loading from keychain first
    const tokens = await loadSpotifyTokens();
    if (tokens) {
      this.accessToken = tokens.accessToken;
      this.refreshToken = tokens.refreshToken;
      this.expiresAt = tokens.expiresAt;
      this.tokensLoaded = true;
      return;
    }

    // Fallback to environment variables
    this.accessToken = process.env.SPOTIFY_ACCESS_TOKEN || "";
    this.refreshToken = process.env.SPOTIFY_REFRESH_TOKEN || "";
    this.expiresAt = 0;
    this.tokensLoaded = true;

    if (!this.accessToken || !this.refreshToken) {
      throw new Error(
        'No Spotify tokens found. Run: npm run auth:spotify'
      );
    }
  }

  private async refreshAccessToken(): Promise<void> {
    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString("base64");

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };
    this.accessToken = data.access_token;
    this.expiresAt = Date.now() + data.expires_in * 1000;
    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
    }

    // Save refreshed tokens back to keychain
    await saveSpotifyTokens({
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      expiresAt: this.expiresAt
    });
  }

  private isTokenExpired(): boolean {
    return this.expiresAt > 0 && Date.now() >= this.expiresAt - 60000;
  }

  private async ensureValidToken(): Promise<void> {
    await this.loadTokens();
    if (this.isTokenExpired()) {
      await this.refreshAccessToken();
    }
  }

  private async apiRequest<T>(endpoint: string): Promise<T> {
    await this.ensureValidToken();

    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (response.status === 401) {
      await this.refreshAccessToken();
      const retryResponse = await fetch(
        `https://api.spotify.com/v1${endpoint}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );
      if (!retryResponse.ok) {
        throw new Error(`Spotify API error: ${retryResponse.status}`);
      }
      return retryResponse.json() as Promise<T>;
    }

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  async getTopTracks(
    timeRange: "short_term" | "medium_term" | "long_term" = "short_term",
    limit: number = 20
  ): Promise<SpotifyTrack[]> {
    interface SpotifyApiTrack {
      id: string;
      name: string;
      album: { name: string };
      artists: Array<{ name: string }>;
      popularity: number;
    }

    const data = await this.apiRequest<{ items: SpotifyApiTrack[] }>(
      `/me/top/tracks?time_range=${timeRange}&limit=${limit}`
    );

    return data.items.map((track) => ({
      spotifyId: track.id,
      name: track.name,
      album: track.album.name,
      artist: track.artists[0]?.name || "Unknown",
      popularity: track.popularity,
    }));
  }

  async getRecentlyPlayed(limit: number = 50): Promise<RecentlyPlayedTrack[]> {
    interface SpotifyApiPlayHistory {
      track: {
        id: string;
        name: string;
        album: { name: string };
        artists: Array<{ name: string }>;
        popularity: number;
      };
      played_at: string;
    }

    const data = await this.apiRequest<{ items: SpotifyApiPlayHistory[] }>(
      `/me/player/recently-played?limit=${limit}`
    );

    return data.items.map((item) => ({
      spotifyId: item.track.id,
      name: item.track.name,
      album: item.track.album.name,
      artist: item.track.artists[0]?.name || "Unknown",
      popularity: item.track.popularity,
      playedAt: item.played_at,
    }));
  }

  async getTopArtists(
    timeRange: "short_term" | "medium_term" | "long_term" = "short_term",
    limit: number = 20
  ): Promise<SpotifyArtist[]> {
    interface SpotifyApiArtist {
      id: string;
      name: string;
      genres: string[];
      popularity: number;
      followers: { total: number };
    }

    const data = await this.apiRequest<{ items: SpotifyApiArtist[] }>(
      `/me/top/artists?time_range=${timeRange}&limit=${limit}`
    );

    return data.items.map((artist) => ({
      spotifyId: artist.id,
      name: artist.name,
      genres: artist.genres,
      popularity: artist.popularity,
      followers: artist.followers.total,
    }));
  }

  async getSavedAlbums(limit: number = 50, offset: number = 0): Promise<SavedAlbum[]> {
    interface SpotifyApiSavedAlbum {
      added_at: string;
      album: {
        id: string;
        name: string;
        artists: Array<{ name: string }>;
        release_date: string;
        total_tracks: number;
      };
    }

    const data = await this.apiRequest<{ items: SpotifyApiSavedAlbum[] }>(
      `/me/albums?limit=${limit}&offset=${offset}`
    );

    return data.items.map((item) => ({
      spotifyId: item.album.id,
      name: item.album.name,
      artist: item.album.artists[0]?.name || "Unknown",
      releaseDate: item.album.release_date,
      totalTracks: item.album.total_tracks,
      addedAt: item.added_at,
    }));
  }

  async getFollowedArtists(limit: number = 50, after?: string): Promise<{ artists: SpotifyArtist[]; nextCursor: string | null }> {
    interface SpotifyApiArtist {
      id: string;
      name: string;
      genres: string[];
      popularity: number;
      followers: { total: number };
    }

    interface FollowedArtistsResponse {
      artists: {
        items: SpotifyApiArtist[];
        cursors: { after: string | null };
      };
    }

    const endpoint = after
      ? `/me/following?type=artist&limit=${limit}&after=${after}`
      : `/me/following?type=artist&limit=${limit}`;

    const data = await this.apiRequest<FollowedArtistsResponse>(endpoint);

    return {
      artists: data.artists.items.map((artist) => ({
        spotifyId: artist.id,
        name: artist.name,
        genres: artist.genres,
        popularity: artist.popularity,
        followers: artist.followers.total,
      })),
      nextCursor: data.artists.cursors.after,
    };
  }

  async getSavedTracks(limit: number = 50, offset: number = 0): Promise<SavedTrack[]> {
    interface SpotifyApiSavedTrack {
      added_at: string;
      track: {
        id: string;
        name: string;
        album: { name: string };
        artists: Array<{ name: string }>;
      };
    }

    const data = await this.apiRequest<{ items: SpotifyApiSavedTrack[] }>(
      `/me/tracks?limit=${limit}&offset=${offset}`
    );

    return data.items.map((item) => ({
      spotifyId: item.track.id,
      name: item.track.name,
      album: item.track.album.name,
      artist: item.track.artists[0]?.name || "Unknown",
      addedAt: item.added_at,
    }));
  }

  async getUserPlaylists(limit: number = 50, offset: number = 0): Promise<UserPlaylist[]> {
    interface SpotifyApiPlaylist {
      id: string;
      name: string;
      tracks: { total: number };
      owner: { display_name: string };
      public: boolean;
      description: string | null;
    }

    const data = await this.apiRequest<{ items: SpotifyApiPlaylist[] }>(
      `/me/playlists?limit=${limit}&offset=${offset}`
    );

    return data.items.map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      trackCount: playlist.tracks.total,
      owner: playlist.owner.display_name,
      isPublic: playlist.public,
      description: playlist.description,
    }));
  }
}

// Singleton instance for reuse across tools
let spotifyClientInstance: SpotifyClient | null = null;

export function getSpotifyClient(): SpotifyClient {
  if (!spotifyClientInstance) {
    spotifyClientInstance = new SpotifyClient();
  }
  return spotifyClientInstance;
}
