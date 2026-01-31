import { z } from "zod";
import { getDiscogsClient } from "../services/discogs-client.js";

export const discogsCollectionSchema = {
  limit: z
    .number()
    .min(1)
    .optional()
    .describe("Maximum number of records to return. Omit for full collection."),
};

export const discogsCollectionTool = {
  name: "get_discogs_collection",
  description:
    "Fetch the user's vinyl/record collection from Discogs. Returns album titles, artists, release years, and date added to collection.",
  schema: discogsCollectionSchema,

  async handler(args: { limit?: number }) {
    const client = getDiscogsClient();
    const { collection, totalCount } = await client.getCollection(args.limit);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              total_count: totalCount,
              returned_count: collection.length,
              collection: collection.map((r) => ({
                artist: r.artist,
                album: r.album,
                year: r.year,
                date_added: r.dateAdded,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
