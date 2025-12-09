<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { FIND_NEAR_CIRCLE, DEFAULT_INCLUDE_FIELDS } from "~/graphql/queries";

type LatLon = { lat: number; lon: number };
type Doc = { id: string; score?: number; sort?: string[]; data: any };

const query = ref("");
const addressQuery = ref("");
const miles = ref(10);

const center = ref<LatLon>({ lat: 30.2672, lon: -97.7431 }); // Austin
const userLocation = ref<LatLon | null>(null);

const docs = ref<Doc[]>([]);
const total = ref(0);
const cursor = ref<string[] | null>(null);
const loading = ref(false);
const geocoding = ref(false);
const hasSearched = ref(false);
let searchToken = 0;

/** Smart Search variables */
const maxDistance = computed(() => `${miles.value}mi`);
const FILTER = "post_type:location";

/** Normalize coordinates field that may be object or array */
function normalizeCoordinates(raw: unknown): LatLon | null {
  if (!raw) return null;
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (
    v &&
    typeof v === "object" &&
    typeof (v as any).lat === "number" &&
    typeof (v as any).lon === "number"
  ) {
    const { lat, lon } = v as any;
    return { lat, lon };
  }
  return null;
}

/** Resolve doc -> LatLon for markers */
function docCoordinates(d: Doc): LatLon | null {
  // Prefer top-level "coordinates" that Smart Search uses for geo filters
  return (
    normalizeCoordinates(d?.data?.coordinates) ??
    // fallback if you still return nested shape (not required)
    normalizeCoordinates(d?.data?.locationDetails?.coordinates) ??
    null
  );
}

/** Markers for the map */
const markers = computed(() =>
  docs.value
    .map(docCoordinates)
    .filter((c): c is LatLon => !!c)
    .map((c) => ({ lat: c.lat, lon: c.lon }))
);

/** Minimal API caller; bubbles GraphQL errors via /api/search handler */
async function callSearch(body: any) {
  const resp = await $fetch("/api/search", { method: "POST", body });
  if ((resp as any)?.errors) throw new Error("Search returned errors");
  return (resp as any)?.data?.find as { total: number; documents: Doc[] };
}

/** Circle geo search (with cursor pagination) */
async function runCircle(append = false) {
  const token = ++searchToken;

  if (!append) {
    docs.value = [];
    total.value = 0;
    cursor.value = null;
  }
  loading.value = true;
  hasSearched.value = true;

  try {
    const find = await callSearch({
      query: FIND_NEAR_CIRCLE,
      variables: {
        query: query.value || "*",
        centerLat: center.value.lat,
        centerLon: center.value.lon,
        maxDistance: maxDistance.value, // Distance! scalar, e.g. "10mi"
        limit: 20,
        searchAfter: append ? cursor.value : null,
        filter: FILTER,
        includeFields: [...DEFAULT_INCLUDE_FIELDS],
        // semantic optional; keep off by default unless configured server-side
        semanticBias: 0,
        semanticFields: [],
      },
    });

    if (token !== searchToken) return; // drop stale page

    // Trust server geo filter; no client-side distance filter needed
    const page = (find?.documents ?? []).filter((d) => docCoordinates(d));

    docs.value = append ? [...docs.value, ...page] : page;
    total.value = find?.total ?? docs.value.length;
    cursor.value = page.length ? page[page.length - 1]?.sort ?? null : null;
  } catch (err) {
    alert(`Search failed: ${(err as Error).message || err}`);
  } finally {
    if (token === searchToken) loading.value = false;
  }
}

/** BBox search: keep signature for MapView contract (optional to implement later) */
async function runBBox(
  _bbox: { swLat: number; swLon: number; neLat: number; neLon: number },
  _userInitiated: boolean
) {
  // You can wire FIND_IN_BBOX here later if you want "map bounds" search.
  return;
}

/** Geolocate user and search from there */
function useMyLocation() {
  if (!navigator.geolocation)
    return alert("Geolocation is not supported by your browser");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      center.value = loc;
      userLocation.value = loc;
      docs.value = [];
      total.value = 0;
      cursor.value = null;
      runCircle(false);
    },
    (err) => {
      loading.value = false;
      if (err.code === 1)
        alert(
          "Location access was denied. Allow location access and try again."
        );
      else if (err.code === 2)
        alert("Unable to determine your location. Please try again.");
      else if (err.code === 3)
        alert("Location request timed out. Please try again.");
      else alert(`Error getting location: ${err.message}`);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

/** Map click: set center & search */
function handleMapClick(loc: LatLon) {
  center.value = loc;
  userLocation.value = loc;
  docs.value = [];
  total.value = 0;
  cursor.value = null;
  runCircle(false);
}

/** Address → center via Google Geocoding */
async function searchAddress() {
  if (!addressQuery.value.trim()) return;
  geocoding.value = true;
  try {
    const config = useRuntimeConfig();
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        addressQuery.value
      )}&key=${config.public.googleMapsApiKey}`
    );
    const data = await res.json();
    const first = data?.results?.[0];
    if (!first) return alert("Address not found. Try a different address.");

    const { lat, lng } = first.geometry.location;
    center.value = { lat, lon: lng };
    userLocation.value = { lat, lon: lng };
    runCircle(false);
  } catch {
    alert("Failed to geocode address. Please try again.");
  } finally {
    geocoding.value = false;
  }
}

onMounted(() => {
  docs.value = [];
  total.value = 0;
  cursor.value = null;
});
</script>

<template>
  <main class="mx-auto max-w-6xl p-6 space-y-6">
    <h1 class="text-2xl font-semibold">
      Geo Filter Smart Search AI Demo with Nuxt.js
    </h1>

    <div class="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
      <!-- Controls -->
      <aside class="space-y-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">Search query</label>
          <input
            v-model="query"
            class="w-full rounded-xl border px-3 py-2"
            placeholder="bbq joints, events…"
          />
          <div class="flex gap-2">
            <button
              class="rounded-lg border px-3 py-2"
              @click="runCircle(false)"
            >
              Search
            </button>
            <button class="rounded-lg border px-3 py-2" @click="useMyLocation">
              Use my location
            </button>
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Search by address</label>
          <input
            v-model="addressQuery"
            class="w-full rounded-xl border px-3 py-2"
            placeholder="123 Main St, Austin, TX"
            @keyup.enter="searchAddress"
          />
          <button
            class="w-full rounded-lg border px-3 py-2"
            @click="searchAddress"
            :disabled="geocoding || !addressQuery.trim()"
          >
            {{ geocoding ? "Searching..." : "Search Address" }}
          </button>
          <p class="text-xs text-gray-500">Or click anywhere on the map</p>
        </div>

        <div class="space-y-1">
          <label class="block text-sm font-medium"
            >Radius: {{ miles }} mi</label
          >
          <input
            type="range"
            min="1"
            max="50"
            step="1"
            v-model="miles"
            class="w-full"
            @change="runCircle(false)"
          />
        </div>
      </aside>

      <!-- Map + Results -->
      <section class="space-y-4">
        <MapView
          :center="{ lon: center.lon, lat: center.lat }"
          :markers="markers"
          :userLocation="userLocation"
          @boundsChanged="runBBox"
          @mapClick="handleMapClick"
        />

        <div class="flex items-center gap-3 text-sm text-gray-600">
          <span class="rounded-lg border px-3 py-1">
            {{
              loading ? "Loading…" : `${total} result${total === 1 ? "" : "s"}`
            }}
          </span>
          <button
            class="rounded-lg border px-3 py-2"
            @click="runCircle(true)"
            :disabled="loading || !cursor"
          >
            Load more
          </button>
        </div>

        <ul class="rounded-xl border divide-y">
          <li v-for="d in docs" :key="d.id" class="p-3">
            <a
              :href="d?.data?.post_url || d?.data?.permalink || '#'"
              target="_blank"
              class="font-medium hover:underline"
            >
              {{ d?.data?.post_title || "Untitled" }}
            </a>
            <div class="text-sm">
              {{ d?.data?.address || d?.data?.locationDetails?.address || "" }}
            </div>
            <div v-if="docCoordinates(d)" class="text-xs text-gray-500">
              ({{ docCoordinates(d)?.lat }}, {{ docCoordinates(d)?.lon }})
            </div>
          </li>
        </ul>
      </section>
    </div>
  </main>
</template>
