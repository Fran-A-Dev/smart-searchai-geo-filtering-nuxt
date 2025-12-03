<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { FIND_NEAR_CIRCLE, FIND_IN_BBOX } from "~/graphql/queries";

type Doc = { id: string; score?: number; sort?: string[]; data: any };

const query = ref("");
const addressQuery = ref("");
const miles = ref(10);
const center = ref<{ lat: number; lon: number }>({
  lat: 30.2672,
  lon: -97.7431,
}); // Austin
const userLocation = ref<{ lat: number; lon: number } | null>(null);
const docs = ref<Doc[]>([]);
const total = ref(0);
const cursor = ref<string[] | null>(null);
const loading = ref(false);
const geocoding = ref(false);
const hasSearched = ref(false);
let searchToken = 0;

const maxDistance = computed(() => `${miles.value}mi`);
const markers = computed(() =>
  docs.value
    .map((d) => docCoordinates(d))
    .filter(
      (c): c is { lat: number; lon: number } =>
        !!c && typeof c.lat === "number" && typeof c.lon === "number"
    )
    .map((c) => ({ lon: c.lon, lat: c.lat }))
);

function normalizeCoordinates(coord: any): { lat: number; lon: number } | null {
  if (!coord) return null;
  const value = Array.isArray(coord) ? coord[0] : coord;
  if (
    !value ||
    typeof value.lat !== "number" ||
    typeof value.lon !== "number"
  ) {
    return null;
  }
  return { lat: value.lat, lon: value.lon };
}

function docCoordinates(d: Doc): { lat: number; lon: number } | null {
  return (
    normalizeCoordinates(d?.data?.coordinates) ||
    normalizeCoordinates(d?.data?.locationDetails?.coordinates) ||
    null
  );
}

function distanceMiles(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
) {
  const R = 3958.8; // Earth radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

async function callSearch(body: any) {
  const response = await $fetch("/api/search", {
    method: "POST",
    body,
  });
  if ((response as any)?.errors) {
    throw new Error("Search returned errors");
  }
  return (response as any)?.data?.find;
}

async function runCircle(append = false) {
  const token = ++searchToken;
  // Clear current results immediately so stale docs are not shown while new search resolves
  docs.value = append ? docs.value : [];
  if (!append) {
    total.value = 0;
    cursor.value = null;
  }
  loading.value = true;
  hasSearched.value = true;
  try {
    const f = await callSearch({
      query: FIND_NEAR_CIRCLE,
      variables: {
        query: query.value || "*",
        centerLat: center.value.lat,
        centerLon: center.value.lon,
        maxDistance: maxDistance.value,
        limit: 20,
        searchAfter: append ? cursor.value : null,
      },
    });
    const page: Doc[] = (f?.documents ?? [])
      .filter((d) => docCoordinates(d))
      .filter((d) => {
        const coords = docCoordinates(d);
        if (!coords) return false;
        return distanceMiles(center.value, coords) <= miles.value;
      });
    if (token !== searchToken) {
      return;
    }
    docs.value = append ? [...docs.value, ...page] : page;
    total.value = page.length;
    cursor.value = page.length ? page[page.length - 1]?.sort ?? null : null;
  } catch (error) {
    alert(`Search failed: ${error}`);
  } finally {
    if (token === searchToken) {
      loading.value = false;
    }
  }
}

async function runBBox(
  bbox: {
    swLat: number;
    swLon: number;
    neLat: number;
    neLon: number;
  },
  key?: string
) {
  // Bounding-box search disabled/unused; keep signature to avoid breaking MapView emission contract
  return;
}

function useMyLocation() {
  if (!navigator.geolocation) {
    return alert("Geolocation is not supported by your browser");
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const location = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      center.value = location;
      userLocation.value = location;
      hasSearched.value = true;
      docs.value = [];
      total.value = 0;
      cursor.value = null;
      // Let runCircle manage the loading state
      runCircle(false);
    },
    (err) => {
      loading.value = false;
      if (err.code === 1) {
        // PERMISSION_DENIED
        alert(
          "Location access was denied. To use this feature:\n\n" +
            "1. Click the location icon in your browser's address bar\n" +
            "2. Allow location access for this site\n" +
            "3. Click 'Use my location' again"
        );
      } else if (err.code === 2) {
        // POSITION_UNAVAILABLE
        alert("Unable to determine your location. Please try again.");
      } else if (err.code === 3) {
        // TIMEOUT
        alert("Location request timed out. Please try again.");
      } else {
        alert(`Error getting location: ${err.message}`);
      }
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function handleMapClick(location: { lat: number; lon: number }) {
  center.value = location;
  userLocation.value = location;
  hasSearched.value = true;
  // Clear prior results immediately to avoid stale display when searching a new center
  docs.value = [];
  total.value = 0;
  cursor.value = null;
  runCircle(false);
}

async function searchAddress() {
  if (!addressQuery.value.trim()) return;

  geocoding.value = true;
  try {
    const config = useRuntimeConfig();
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        addressQuery.value
      )}&key=${config.public.googleMapsApiKey}`
    );
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      center.value = { lat: location.lat, lon: location.lng };
      userLocation.value = { lat: location.lat, lon: location.lng };
      runCircle(false);
    } else {
      alert("Address not found. Please try a different address.");
    }
  } catch (error) {
    alert("Failed to geocode address. Please try again.");
  } finally {
    geocoding.value = false;
  }
}

// Do not fetch on mount; wait for explicit user action
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
          <span class="rounded-lg border px-3 py-1">{{
            loading ? "Loading…" : `${total} result${total === 1 ? "" : "s"}`
          }}</span>
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
              :href="d?.data?.permalink || '#'"
              target="_blank"
              class="font-medium hover:underline"
            >
              {{ d?.data?.post_title || "Untitled" }}
            </a>
            <div v-if="d?.data?.locationDetails?.address" class="text-sm">
              {{ d.data.locationDetails.address }}
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
