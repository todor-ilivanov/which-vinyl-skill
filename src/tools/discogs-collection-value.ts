import { z } from "zod";
import { getDiscogsClient } from "../services/discogs-client.js";

export const collectionValueSchema = {};

export const collectionValueTool = {
  name: "get_collection_value",
  description:
    "Get collection statistics: estimated value, format distribution, and decade breakdown.",
  schema: collectionValueSchema,

  async handler() {
    const client = getDiscogsClient();

    // Fetch value from Discogs API and collection for local computation
    const [value, { collection, totalCount }] = await Promise.all([
      client.getCollectionValue(),
      client.getCollection(),
    ]);

    // Compute format distribution from collection
    const formatCounts: Record<string, number> = {};
    for (const release of collection) {
      for (const format of release.formats) {
        // Only count main format types (LP, 7", 12", CD, etc.)
        const mainFormats = ["LP", "7\"", "12\"", "10\"", "CD", "Cassette", "Box Set"];
        if (mainFormats.includes(format)) {
          formatCounts[format] = (formatCounts[format] || 0) + 1;
        }
      }
    }

    // Compute decade breakdown from collection years
    const decadeCounts: Record<string, number> = {};
    for (const release of collection) {
      if (release.year) {
        const decade = Math.floor(release.year / 10) * 10;
        const decadeLabel = `${decade}s`;
        decadeCounts[decadeLabel] = (decadeCounts[decadeLabel] || 0) + 1;
      }
    }

    // Sort decades chronologically
    const sortedDecades = Object.fromEntries(
      Object.entries(decadeCounts).sort(([a], [b]) => {
        const yearA = parseInt(a);
        const yearB = parseInt(b);
        return yearA - yearB;
      })
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              value: {
                minimum: value.minimum,
                median: value.median,
                maximum: value.maximum,
              },
              format_distribution: formatCounts,
              decade_breakdown: sortedDecades,
              total_count: totalCount,
            },
            null,
            2
          ),
        },
      ],
    };
  },
};
