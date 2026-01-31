#!/usr/bin/env node

import 'dotenv/config';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  spotifyTopTracksTool,
  spotifyTopTracksSchema,
} from "./tools/spotify-top-tracks.js";
import {
  spotifyRecentlyPlayedTool,
  spotifyRecentlyPlayedSchema,
} from "./tools/spotify-recently-played.js";
import {
  spotifyTopArtistsTool,
  spotifyTopArtistsSchema,
} from "./tools/spotify-top-artists.js";
import {
  spotifySavedAlbumsTool,
  spotifySavedAlbumsSchema,
} from "./tools/spotify-saved-albums.js";
import {
  spotifySavedTracksTool,
  spotifySavedTracksSchema,
} from "./tools/spotify-saved-tracks.js";
import {
  spotifyFollowedArtistsTool,
  spotifyFollowedArtistsSchema,
} from "./tools/spotify-followed-artists.js";
import {
  spotifyPlaylistsTool,
  spotifyPlaylistsSchema,
} from "./tools/spotify-playlists.js";
import {
  spotifyListeningStatsTool,
  spotifyListeningStatsSchema,
} from "./tools/spotify-listening-stats.js";
import {
  discogsCollectionTool,
  discogsCollectionSchema,
} from "./tools/discogs-collection.js";

const server = new McpServer({
  name: "which-vinyl",
  version: "1.0.0",
});

// Check for credentials and only register tools for available services
const hasSpotifyCredentials = process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET;
const hasDiscogsCredentials = process.env.DISCOGS_CONSUMER_KEY && process.env.DISCOGS_CONSUMER_SECRET;

if (hasSpotifyCredentials) {
  server.tool(
    spotifyTopTracksTool.name,
    spotifyTopTracksTool.description,
    spotifyTopTracksSchema,
    spotifyTopTracksTool.handler
  );

  server.tool(
    spotifyRecentlyPlayedTool.name,
    spotifyRecentlyPlayedTool.description,
    spotifyRecentlyPlayedSchema,
    spotifyRecentlyPlayedTool.handler
  );

  server.tool(
    spotifyTopArtistsTool.name,
    spotifyTopArtistsTool.description,
    spotifyTopArtistsSchema,
    spotifyTopArtistsTool.handler
  );

  server.tool(
    spotifySavedAlbumsTool.name,
    spotifySavedAlbumsTool.description,
    spotifySavedAlbumsSchema,
    spotifySavedAlbumsTool.handler
  );

  server.tool(
    spotifySavedTracksTool.name,
    spotifySavedTracksTool.description,
    spotifySavedTracksSchema,
    spotifySavedTracksTool.handler
  );

  server.tool(
    spotifyFollowedArtistsTool.name,
    spotifyFollowedArtistsTool.description,
    spotifyFollowedArtistsSchema,
    spotifyFollowedArtistsTool.handler
  );

  server.tool(
    spotifyPlaylistsTool.name,
    spotifyPlaylistsTool.description,
    spotifyPlaylistsSchema,
    spotifyPlaylistsTool.handler
  );

  server.tool(
    spotifyListeningStatsTool.name,
    spotifyListeningStatsTool.description,
    spotifyListeningStatsSchema,
    spotifyListeningStatsTool.handler
  );
}

if (hasDiscogsCredentials) {
  server.tool(
    discogsCollectionTool.name,
    discogsCollectionTool.description,
    discogsCollectionSchema,
    discogsCollectionTool.handler
  );
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
