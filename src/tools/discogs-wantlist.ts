import { z } from "zod";
import { getDiscogsClient } from "../services/discogs-client.js";

export const discogsWantlistSchema = {
  limit: z
    .number()
    .min(1)
    .optional()
    .describe("Maximum number of items to return. Omit for full wantlist."),
};

export const discogsWantlistTool = {
  name: "get_discogs_wantlist",
  description:
    "Fetch the user's Discogs wantlist - albums they want to add to their vinyl collection.",
  schema: discogsWantlistSchema,

  async handler(args: { limit?: number }) {
    const client = getDiscogsClient();
    const { wantlist, totalCount } = await client.getWantlist(args.limit);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              total_count: totalCount,
              returned_count: wantlist.length,
              wantlist: wantlist.map((w) => ({
                artist: w.artist,
                artists: w.artists,
                album: w.album,
                year: w.year,
                date_added: w.dateAdded,
                notes: w.notes,
                rating: w.rating,
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
