# Geographic Constraints

The Find API supports geographic filtering to find documents within specific geographic areas. This is useful for location-based searches such as finding nearby stores, events, or services.

Geographic constraints can be applied using:

- **Circle constraints** - Find documents within a specified distance from a center point.
- **Bounding box constraints** - Find documents within a rectangular geographic area.
- **Multiple constraints** - Combine multiple circles and/or bounding boxes with `OR` logic.

> **Note:** Documents must have geographic coordinates stored in the `coordinates` field to be filtered by geographic constraints.

---

## Circle Constraints

Find documents within a specified distance from a center point.

```graphql
query FindWithCircleConstraint {
  find(
    query: "coffee shop"
    geoConstraint: {
      circle: { center: { lat: 37.7749, lon: -122.4194 }, maxDistance: "5km" }
    }
  ) {
    total
    documents {
      id
      score
      data
    }
  }
}
```

## Bounding Box Constraints

Find documents within a rectangular geographic area.

```graphql
query FindWithBoundingBoxConstraint {
  find(
    query: "restaurants"
    geoConstraint: {
      boundingBox: {
        southwest: { lat: 37.7749, lon: -122.4494 }
        northeast: { lat: 37.8049, lon: -122.3894 }
      }
    }
  ) {
    total
    documents {
      id
      score
      data
    }
  }
}
```

## Multiple Geographic Constraints

You can combine multiple circles and bounding boxes using OR logic. Results will match if they fall within any of the specified areas.

```graphql
query FindWithMultipleGeoConstraints {
  find(
    query: "events"
    geoConstraints: {
      circles: [
        { center: { lat: 37.7749, lon: -122.4194 }, maxDistance: "3km" }
        { center: { lat: 37.8044, lon: -122.2711 }, maxDistance: "2mi" }
      ]
      boundingBoxes: [
        {
          southwest: { lat: 37.7849, lon: -122.4094 }
          northeast: { lat: 37.7949, lon: -122.3994 }
        }
      ]
    }
  ) {
    total
    documents {
      id
      score
      data
    }
  }
}
```

## Geographic Field Configuration

Coordinate format: Geographic coordinates must be stored as latitude/longitude pairs in the coordinates field.

Distance units: Supported distance units include:

- **km** (kilometers) - e.g., "5km"

- **mi** (miles) - e.g., "10.5mi"

- **m** (meters) - e.g., "1000m"

- **ft** (feet) - e.g., "500ft"

- **yd** (yards) - e.g., "100yd"

## Coordinate Validation

Geographic coordinates must fall within valid ranges:

**Latitude:** -90.0 to 90.0 degrees

**Longitude:** -180.0 to 180.0 degrees

For bounding boxes, the southwest corner must have lower latitude and longitude values than the northeast corner.
