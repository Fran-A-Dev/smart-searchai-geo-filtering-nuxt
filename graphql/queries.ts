export const FIND_NEAR_CIRCLE = /* GraphQL */ `
  query FindNearCircle(
    $query: String!
    $centerLat: Float!
    $centerLon: Float!
    $maxDistance: Distance!
    $limit: Int = 20
    $searchAfter: [String!]
  ) {
    find(
      query: $query
      semanticSearch: {
        searchBias: 7
        fields: ["post_title", "post_content", "locationDetails.address"]
      }
      geoConstraints: {
        circles: [
          {
            center: { lat: $centerLat, lon: $centerLon }
            maxDistance: $maxDistance
          }
        ]
      }
      orderBy: [
        { field: "_score", direction: desc }
        { field: "post_date_gmt", direction: desc }
      ]
      limit: $limit
      searchAfter: $searchAfter
      options: {
        includeFields: [
          "post_title"
          "coordinates"
          "locationDetails.coordinates"
          "permalink"
          "locationDetails.address"
          "post_date_gmt"
        ]
      }
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

export const FIND_IN_BBOX = /* GraphQL */ `
  query FindInBoundingBox(
    $query: String!
    $swLat: Float!
    $swLon: Float!
    $neLat: Float!
    $neLon: Float!
    $limit: Int = 20
    $searchAfter: [String!]
  ) {
    find(
      query: $query
      semanticSearch: {
        searchBias: 7
        fields: ["post_title", "post_content", "locationDetails.address"]
      }
      geoConstraints: {
        boundingBoxes: [
          {
            southwest: { lat: $swLat, lon: $swLon }
            northeast: { lat: $neLat, lon: $neLon }
          }
        ]
      }
      orderBy: [
        { field: "_score", direction: desc }
        { field: "post_date_gmt", direction: desc }
      ]
      limit: $limit
      searchAfter: $searchAfter
      options: {
        includeFields: ["post_title", "coordinates", "locationDetails.coordinates", "permalink", "locationDetails.address"]
      }
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
