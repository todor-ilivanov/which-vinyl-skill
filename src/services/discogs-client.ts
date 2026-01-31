import { createRequire } from "module";
import crypto from "crypto";
import { loadDiscogsTokens } from '../auth/token-storage.js';

const require = createRequire(import.meta.url);
const OAuth = require("oauth-1.0a");

export interface DiscogsRelease {
  releaseId: string;
  artist: string;         // Primary artist
  artists: string[];      // All artists (for collaborations)
  album: string;
  year: number | null;
  dateAdded: string | null;
  thumb: string | null;   // Thumbnail URL
  genres: string[];       // e.g., ["Rock", "Pop"]
  styles: string[];       // e.g., ["Indie Rock", "Shoegaze"]
  formats: string[];      // e.g., ["LP", "Album"]
}

export interface DiscogsWant {
  releaseId: string;
  artist: string;
  artists: string[];
  album: string;
  year: number | null;
  dateAdded: string | null;
  notes: string | null;    // User's notes about why they want it
  rating: number | null;   // User's desired rating
}

export interface CollectionValue {
  minimum: string;   // "$1,234.56"
  median: string;
  maximum: string;
}

interface DiscogsConfig {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessSecret: string;
  username: string;
}

export class DiscogsClient {
  private config: DiscogsConfig;
  private oauth: any;
  private tokensLoaded: boolean = false;

  constructor() {
    this.config = {
      consumerKey: process.env.DISCOGS_CONSUMER_KEY || "",
      consumerSecret: process.env.DISCOGS_CONSUMER_SECRET || "",
      accessToken: "",
      accessSecret: "",
      username: "",
    };

    this.oauth = new OAuth({
      consumer: {
        key: this.config.consumerKey,
        secret: this.config.consumerSecret,
      },
      signature_method: "HMAC-SHA1",
      hash_function(baseString: string, key: string) {
        return crypto
          .createHmac("sha1", key)
          .update(baseString)
          .digest("base64");
      },
    });
  }

  private async loadTokens(): Promise<void> {
    if (this.tokensLoaded) return;

    // Try loading from keychain first
    const tokens = await loadDiscogsTokens();
    if (tokens) {
      this.config.accessToken = tokens.accessToken;
      this.config.accessSecret = tokens.accessSecret;
      this.config.username = tokens.username;
      this.tokensLoaded = true;
      return;
    }

    // Fallback to environment variables
    this.config.accessToken = process.env.DISCOGS_ACCESS_TOKEN || "";
    this.config.accessSecret = process.env.DISCOGS_ACCESS_SECRET || "";
    this.config.username = process.env.DISCOGS_USERNAME || "";
    this.tokensLoaded = true;

    if (!this.config.accessToken || !this.config.accessSecret || !this.config.username) {
      throw new Error(
        'No Discogs tokens found. Run: npm run auth:discogs'
      );
    }
  }

  private getAuthorizationHeader(url: string, method: string): string {
    const token = {
      key: this.config.accessToken,
      secret: this.config.accessSecret,
    };

    const requestData = {
      url,
      method,
    };

    return this.oauth.toHeader(this.oauth.authorize(requestData, token))[
      "Authorization"
    ];
  }

  private async apiRequest<T>(path: string): Promise<T> {
    const url = `https://api.discogs.com${path}`;
    const authHeader = this.getAuthorizationHeader(url, "GET");

    const response = await fetch(url, {
      headers: {
        Authorization: authHeader,
        "User-Agent": "WhichVinyl/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Discogs API error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  async getCollection(
    limit?: number
  ): Promise<{ collection: DiscogsRelease[]; totalCount: number }> {
    await this.loadTokens();

    const username = this.config.username;
    if (!username) {
      throw new Error("DISCOGS_USERNAME is required");
    }

    interface DiscogsApiRelease {
      date_added: string;
      basic_information: {
        id: number;
        title: string;
        year: number;
        artists: Array<{ name: string }>;
        thumb: string;
        genres: string[];
        styles: string[];
        formats: Array<{ name: string; descriptions?: string[] }>;
      };
    }

    interface DiscogsApiResponse {
      pagination: {
        pages: number;
        items: number;
      };
      releases: DiscogsApiRelease[];
    }

    const allReleases: DiscogsRelease[] = [];
    let page = 1;
    let totalCount = 0;

    while (true) {
      const data = await this.apiRequest<DiscogsApiResponse>(
        `/users/${username}/collection/folders/0/releases?page=${page}&per_page=100`
      );

      totalCount = data.pagination.items;

      for (const release of data.releases) {
        const info = release.basic_information;
        const formatNames = info.formats?.flatMap(f => {
          const names = [f.name];
          if (f.descriptions) names.push(...f.descriptions);
          return names;
        }) || [];

        allReleases.push({
          releaseId: String(info.id),
          artist: info.artists[0]?.name || "Unknown",
          artists: info.artists.map(a => a.name),
          album: info.title,
          year: info.year || null,
          dateAdded: release.date_added || null,
          thumb: info.thumb || null,
          genres: info.genres || [],
          styles: info.styles || [],
          formats: formatNames,
        });

        if (limit && allReleases.length >= limit) {
          return { collection: allReleases.slice(0, limit), totalCount };
        }
      }

      if (page >= data.pagination.pages) {
        break;
      }
      page++;
    }

    return { collection: allReleases, totalCount };
  }

  async getWantlist(
    limit?: number
  ): Promise<{ wantlist: DiscogsWant[]; totalCount: number }> {
    await this.loadTokens();

    const username = this.config.username;
    if (!username) {
      throw new Error("DISCOGS_USERNAME is required");
    }

    interface DiscogsApiWant {
      id: number;
      date_added: string;
      notes: string;
      rating: number;
      basic_information: {
        id: number;
        title: string;
        year: number;
        artists: Array<{ name: string }>;
      };
    }

    interface DiscogsApiResponse {
      pagination: {
        pages: number;
        items: number;
      };
      wants: DiscogsApiWant[];
    }

    const allWants: DiscogsWant[] = [];
    let page = 1;
    let totalCount = 0;

    while (true) {
      const data = await this.apiRequest<DiscogsApiResponse>(
        `/users/${username}/wants?page=${page}&per_page=100`
      );

      totalCount = data.pagination.items;

      for (const want of data.wants) {
        const info = want.basic_information;
        allWants.push({
          releaseId: String(info.id),
          artist: info.artists[0]?.name || "Unknown",
          artists: info.artists.map(a => a.name),
          album: info.title,
          year: info.year || null,
          dateAdded: want.date_added || null,
          notes: want.notes || null,
          rating: want.rating || null,
        });

        if (limit && allWants.length >= limit) {
          return { wantlist: allWants.slice(0, limit), totalCount };
        }
      }

      if (page >= data.pagination.pages) {
        break;
      }
      page++;
    }

    return { wantlist: allWants, totalCount };
  }

  async getCollectionValue(): Promise<CollectionValue> {
    await this.loadTokens();

    const username = this.config.username;
    if (!username) {
      throw new Error("DISCOGS_USERNAME is required");
    }

    interface DiscogsValueResponse {
      minimum: string;
      median: string;
      maximum: string;
    }

    const data = await this.apiRequest<DiscogsValueResponse>(
      `/users/${username}/collection/value`
    );

    return {
      minimum: data.minimum,
      median: data.median,
      maximum: data.maximum,
    };
  }
}

// Singleton instance for reuse across tools
let discogsClientInstance: DiscogsClient | null = null;

export function getDiscogsClient(): DiscogsClient {
  if (!discogsClientInstance) {
    discogsClientInstance = new DiscogsClient();
  }
  return discogsClientInstance;
}
