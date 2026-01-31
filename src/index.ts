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
  discogsCollectionTool,
  discogsCollectionSchema,
} from "./tools/discogs-collection.js";
import {
  discogsWantlistTool,
  discogsWantlistSchema,
} from "./tools/discogs-wantlist.js";
import {
  collectionValueTool,
  collectionValueSchema,
} from "./tools/discogs-collection-value.js";
import {
  vinylRecommendationsTool,
  vinylRecommendationsSchema,
} from "./tools/vinyl-recommendations.js";
import {
  collectionAnalysisTool,
  collectionAnalysisSchema,
} from "./tools/collection-analysis.js";

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
}

if (hasDiscogsCredentials) {
  server.tool(
    discogsCollectionTool.name,
    discogsCollectionTool.description,
    discogsCollectionSchema,
    discogsCollectionTool.handler
  );

  server.tool(
    discogsWantlistTool.name,
    discogsWantlistTool.description,
    discogsWantlistSchema,
    discogsWantlistTool.handler
  );

  server.tool(
    collectionValueTool.name,
    collectionValueTool.description,
    collectionValueSchema,
    collectionValueTool.handler
  );
}

// Cross-service tools - only available when both Spotify and Discogs are configured
const hasBothServices = hasSpotifyCredentials && hasDiscogsCredentials;

if (hasBothServices) {
  server.tool(
    vinylRecommendationsTool.name,
    vinylRecommendationsTool.description,
    vinylRecommendationsSchema,
    vinylRecommendationsTool.handler
  );

  server.tool(
    collectionAnalysisTool.name,
    collectionAnalysisTool.description,
    collectionAnalysisSchema,
    collectionAnalysisTool.handler
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
