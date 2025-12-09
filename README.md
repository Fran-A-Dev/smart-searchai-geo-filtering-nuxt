## Nuxt + Smart Search Geo Demo (Headless WP)

A Nuxt 4 demo that shows how to query a headless WordPress Smart Search index with geographic filters. Users can search by keyword, radius, their current location, map clicks, or address geocoding. Results render on a Google Map and as a list.

### Prerequisites

- Node 18+ and npm/yarn/pnpm
- A Smart Search GraphQL endpoint + access token for your WordPress index
- A Google Maps API key (Maps JS + Geocoding)
- Your indexed posts must include `coordinates` (lat/lon) and, optionally, `address`/`post_url` fields. The sample filter targets `post_type:location`.

### Environment

Create `.env` in the project root:

```bash
SEARCH_ENDPOINT=https://your-smart-search-endpoint/graphql
SEARCH_ACCESS_TOKEN=your-search-token
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### Install & Run

```bash
npm install
npm run dev
# open http://localhost:3000/geo-search
```

Production builds:

```bash
npm run build
npm run preview   # serve the built app locally
```

### Using the geo-search page

- Go to `/geo-search` to use the demo.
- Enter a keyword (e.g., `coffee`, `events`) and click **Search**.
- Adjust the **Radius** slider (miles) and re-run search; pagination uses **Load more**.
- Click **Use my location** to geolocate and search near you (browser permission required).
- Use **Search by address** to geocode an address; you can also click anywhere on the map to re-center and search.
- Results display as map markers and a list. Clicking a result opens its `post_url`/`permalink` in a new tab.

### How it works (files to explore)

- `graphql/queries.ts` — Geo-aware Smart Search queries (`FIND_NEAR_CIRCLE`, optional bbox).
- `server/api/search.post.ts` — Server proxy that attaches the access token to GraphQL requests.
- `pages/geo-search.vue` — UI logic: radius slider, address geocode, geolocation, pagination.
- `components/MapView.client.vue` — Google Maps loader, markers, map click/bounds handling.

### WordPress index tips

- Ensure your Smart Search documents include `coordinates` as `{ lat, lon }`.
- Keep the `filter` (`post_type:location`) aligned with your index taxonomy or adjust as needed.
- Add any extra fields you need to `DEFAULT_INCLUDE_FIELDS` in `graphql/queries.ts`.
