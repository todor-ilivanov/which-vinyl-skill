import keytar from 'keytar';

const SERVICE_NAME = 'vinyl-vibe-mcp';
const ALL_TOKENS_KEY = 'all_tokens';

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface DiscogsTokens {
  accessToken: string;
  accessSecret: string;
  username: string;
}

interface AllTokens {
  version: 1;
  spotify?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
  discogs?: {
    accessToken: string;
    accessSecret: string;
    username: string;
  };
}

// Legacy keychain account names (for migration)
const LEGACY_ACCOUNTS = [
  'spotify_access_token',
  'spotify_refresh_token',
  'spotify_expires_at',
  'discogs_access_token',
  'discogs_access_secret',
  'discogs_username'
];

// Singleton promise for loading tokens - ensures only one keychain access
let loadPromise: Promise<AllTokens> | null = null;

async function loadAllTokens(): Promise<AllTokens> {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    // Try loading from consolidated entry first
    const allTokensJson = await keytar.getPassword(SERVICE_NAME, ALL_TOKENS_KEY);

    if (allTokensJson) {
      try {
        return JSON.parse(allTokensJson) as AllTokens;
      } catch {
        // Corrupted JSON, fall through to migration
      }
    }

    // No consolidated entry - try migrating from legacy entries
    return migrateFromLegacyEntries();
  })();

  return loadPromise;
}

async function migrateFromLegacyEntries(): Promise<AllTokens> {
  const credentials = await keytar.findCredentials(SERVICE_NAME);
  const credMap = new Map(credentials.map(c => [c.account, c.password]));

  const tokens: AllTokens = { version: 1 };

  // Check for legacy Spotify tokens
  const spotifyAccess = credMap.get('spotify_access_token');
  const spotifyRefresh = credMap.get('spotify_refresh_token');
  const spotifyExpires = credMap.get('spotify_expires_at');

  if (spotifyAccess && spotifyRefresh) {
    tokens.spotify = {
      accessToken: spotifyAccess,
      refreshToken: spotifyRefresh,
      expiresAt: spotifyExpires ? parseInt(spotifyExpires, 10) : 0
    };
  }

  // Check for legacy Discogs tokens
  const discogsAccess = credMap.get('discogs_access_token');
  const discogsSecret = credMap.get('discogs_access_secret');
  const discogsUsername = credMap.get('discogs_username');

  if (discogsAccess && discogsSecret && discogsUsername) {
    tokens.discogs = {
      accessToken: discogsAccess,
      accessSecret: discogsSecret,
      username: discogsUsername
    };
  }

  // Save migrated tokens to consolidated entry if we have any
  if (tokens.spotify || tokens.discogs) {
    await keytar.setPassword(SERVICE_NAME, ALL_TOKENS_KEY, JSON.stringify(tokens));

    // Delete legacy entries (fire-and-forget)
    deleteLegacyEntries().catch(() => {
      // Ignore errors - not critical
    });
  }

  return tokens;
}

async function deleteLegacyEntries(): Promise<void> {
  await Promise.all(
    LEGACY_ACCOUNTS.map(account =>
      keytar.deletePassword(SERVICE_NAME, account).catch(() => {
        // Ignore - entry may not exist
      })
    )
  );
}

async function saveAllTokens(tokens: AllTokens): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, ALL_TOKENS_KEY, JSON.stringify(tokens));
  // Update the cached promise to return the new tokens
  loadPromise = Promise.resolve(tokens);
}

// Clear cache (call after external changes to keychain)
export function clearCredentialsCache(): void {
  loadPromise = null;
}

// Spotify tokens
export async function saveSpotifyTokens(tokens: SpotifyTokens): Promise<void> {
  const allTokens = await loadAllTokens();
  allTokens.spotify = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt
  };
  await saveAllTokens(allTokens);
}

export async function loadSpotifyTokens(): Promise<SpotifyTokens | null> {
  const allTokens = await loadAllTokens();

  if (!allTokens.spotify) return null;

  return {
    accessToken: allTokens.spotify.accessToken,
    refreshToken: allTokens.spotify.refreshToken,
    expiresAt: allTokens.spotify.expiresAt
  };
}

// Discogs tokens
export async function saveDiscogsTokens(tokens: DiscogsTokens): Promise<void> {
  const allTokens = await loadAllTokens();
  allTokens.discogs = {
    accessToken: tokens.accessToken,
    accessSecret: tokens.accessSecret,
    username: tokens.username
  };
  await saveAllTokens(allTokens);
}

export async function loadDiscogsTokens(): Promise<DiscogsTokens | null> {
  const allTokens = await loadAllTokens();

  if (!allTokens.discogs) return null;

  return {
    accessToken: allTokens.discogs.accessToken,
    accessSecret: allTokens.discogs.accessSecret,
    username: allTokens.discogs.username
  };
}

// Clear tokens
export async function clearSpotifyTokens(): Promise<void> {
  const allTokens = await loadAllTokens();
  delete allTokens.spotify;
  await saveAllTokens(allTokens);
}

export async function clearDiscogsTokens(): Promise<void> {
  const allTokens = await loadAllTokens();
  delete allTokens.discogs;
  await saveAllTokens(allTokens);
}
