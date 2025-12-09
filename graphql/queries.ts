// graphql/queries.ts

/** Fields we want back from Smart Search documents. Adjust to your index shape. */
export const DEFAULT_INCLUDE_FIELDS = [
  "post_title",
  "address", // top-level if you mapped it during indexing
  "coordinates", // top-level geo field that Smart Search uses
  "post_url", // or "permalink" if your index uses that key
] as const;

/** Compose an optional semanticSearch block only if enabled. */
export const SEMANTIC_BLOCK = `
  $semanticBias: Int = 0
  $semanticFields: [String!] = []
` as const;

export const SEMANTIC_ARG = `
  semanticSearch: { searchBias: $semanticBias, fields: $semanticFields }
` as const;

/** ---------- 1) Circle (nearby) search with optional semantic & pagination ---------- */
export const FIND_NEAR_CIRCLE = /* GraphQL */ `
  query FindNearCircle(
    $query: String!
    $centerLat: Float!
    $centerLon: Float!
    $maxDistance: Distance!
    $limit: Int = 20
    $searchAfter: [String!]
    $filter: String
    $includeFields: [String!] = []
    ${SEMANTIC_BLOCK}
  ) {
    find(
      query: $query
      ${SEMANTIC_ARG}
      filter: $filter
      geoConstraints: {
        circles: [
          { center: { lat: $centerLat, lon: $centerLon }, maxDistance: $maxDistance }
        ]
      }
      orderBy: [
        { field: "_score", direction: desc }
        { field: "post_date_gmt", direction: desc }
      ]
      limit: $limit
      searchAfter: $searchAfter
      options: { includeFields: $includeFields }
    ) {
      total
      documents {
        id
        score
        sort
        data
      }
    }
  }
`;

/** ---------- 2) Bounding-box search with optional semantic & pagination ---------- */
export const FIND_IN_BBOX = /* GraphQL */ `
  query FindInBoundingBox(
    $query: String!
    $swLat: Float!
    $swLon: Float!
    $neLat: Float!
    $neLon: Float!
    $limit: Int = 20
    $searchAfter: [String!]
    $filter: String
    $includeFields: [String!] = []
    ${SEMANTIC_BLOCK}
  ) {
    find(
      query: $query
      ${SEMANTIC_ARG}
      filter: $filter
      geoConstraints: {
        boundingBoxes: [
          { southwest: { lat: $swLat, lon: $swLon }, northeast: { lat: $neLat, lon: $neLon } }
        ]
      }
      orderBy: [
        { field: "_score", direction: desc }
        { field: "post_date_gmt", direction: desc }
      ]
      limit: $limit
      searchAfter: $searchAfter
      options: { includeFields: $includeFields }
    ) {
      total
      documents {
        id
        score
        sort
        data
      }
    }
  }
`;

/** ---------- Helper types for DX ---------- */
export interface FindNearCircleVars {
  query: string;
  centerLat: number;
  centerLon: number;
  maxDistance: string; // Distance! scalar, e.g. "5mi", "2km"
  limit?: number;
  searchAfter?: string[];
  filter?: string; // e.g., "post_type:location"
  includeFields?: string[];
  semanticBias?: number; // 0..10
  semanticFields?: string[]; // ["post_title", "post_content"] etc., if configured
}

export interface FindInBBoxVars
  extends Omit<FindNearCircleVars, "centerLat" | "centerLon" | "maxDistance"> {
  swLat: number;
  swLon: number;
  neLat: number;
  neLon: number;
}

/** Normalize coordinates to an array of points for mapping. */
export type Point = { lat: number; lon: number };
export function normalizeCoordinates(raw: unknown): Point[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((p) => (p && typeof p === "object" ? (p as any) : null))
      .filter(Boolean)
      .filter((p) => typeof p.lat === "number" && typeof p.lon === "number");
  }
  if (typeof raw === "object" && raw !== null) {
    const p = raw as any;
    if (typeof p.lat === "number" && typeof p.lon === "number") {
      return [p as Point];
    }
  }
  return [];
}
