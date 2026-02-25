import { toJsonSchema } from "./src/index.js";

const schema = toJsonSchema(`
  /** Input for the ad analysis tool */
  interface AnalyzeAdInput {
    /** URL of the ad to analyze */
    url: string;
    /** Platform the ad is from */
    platform: "instagram" | "facebook" | "tiktok";
    /** Whether to extract color palette */
    extractColors?: boolean;
    /** Max elements to identify
     * @minimum 1
     * @maximum 50
     * @default 10
     */
    maxElements?: number;
    tags: string[];
  }
`, { rootType: "AnalyzeAdInput" });

console.log(JSON.stringify(schema, null, 2));
