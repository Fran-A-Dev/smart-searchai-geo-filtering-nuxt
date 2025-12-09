<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, toRefs, nextTick } from "vue";

type LatLon = { lat: number; lon: number };
type Marker = LatLon;

const props = defineProps<{
  center: LatLon; // { lat, lon }
  markers: Marker[]; // search results
  userLocation: LatLon | null; // optional blue dot
}>();

const emit = defineEmits<{
  (
    e: "boundsChanged",
    bbox: { swLat: number; swLon: number; neLat: number; neLon: number },
    userInitiated: boolean
  ): void;
  (e: "mapClick", location: LatLon): void;
}>();

const { center, markers, userLocation } = toRefs(props);
const mapDiv = ref<HTMLDivElement | null>(null);
const config = useRuntimeConfig();

let map: google.maps.Map | null = null;
let resultMarkers: google.maps.Marker[] = [];
let userMarker: google.maps.Marker | null = null;
let userInitiatedMove = false;
let idleListener: google.maps.MapsEventListener | null = null;
let dragListener: google.maps.MapsEventListener | null = null;
let zoomListener: google.maps.MapsEventListener | null = null;
let clickListener: google.maps.MapsEventListener | null = null;

/** Simple debounce to quiet idle emissions */
function debounce<T extends (...args: any[]) => void>(fn: T, ms = 150) {
  let t: number | undefined;
  return (...args: Parameters<T>) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
}

/** Load Google Maps JS once */
function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((globalThis as any).google?.maps) return resolve();

    const key = config.public.googleMapsApiKey;
    if (!key) return reject(new Error("Missing GOOGLE_MAPS_API_KEY"));

    const script = document.createElement("script");
    // v=weekly per Google guidance; only `places` is a recognized library here
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key
    )}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps JS"));
    document.head.appendChild(script);
  });
}

function clearResultMarkers() {
  for (const m of resultMarkers) m.setMap(null);
  resultMarkers = [];
}

function setResultMarkers(list: Marker[]) {
  if (!map) return;
  clearResultMarkers();

  const bounds = new google.maps.LatLngBounds();
  let hasAny = false;

  for (const m of list) {
    if (typeof m.lat !== "number" || typeof m.lon !== "number") continue;
    const marker = new google.maps.Marker({
      position: { lat: m.lat, lng: m.lon },
      title: "Search result",
      map,
    });
    resultMarkers.push(marker);
    bounds.extend(new google.maps.LatLng(m.lat, m.lon));
    hasAny = true;
  }

  // If no user-initiated move, fit the map to the results on fresh updates
  if (hasAny && !userInitiatedMove) {
    // If a single result, ensure a sensible zoom
    if (resultMarkers.length === 1) {
      map.setCenter({ lat: list[0].lat, lng: list[0].lon });
      map.setZoom(Math.max(map.getZoom() || 11, 13));
    } else {
      map.fitBounds(bounds, 40); // 40px padding
    }
  }
}

function setUserLocationMarker(loc: LatLon | null) {
  if (!map) return;
  if (userMarker) {
    userMarker.setMap(null);
    userMarker = null;
  }
  if (!loc) return;

  userMarker = new google.maps.Marker({
    position: { lat: loc.lat, lng: loc.lon },
    map,
    title: "Your location",
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: "#4285F4",
      fillOpacity: 1,
      strokeColor: "#FFFFFF",
      strokeWeight: 3,
    },
  });
}

const emitBoundsChanged = debounce(() => {
  if (!map) return;
  const b = map.getBounds();
  if (!b) return;
  const sw = b.getSouthWest();
  const ne = b.getNorthEast();
  emit(
    "boundsChanged",
    { swLat: sw.lat(), swLon: sw.lng(), neLat: ne.lat(), neLon: ne.lng() },
    userInitiatedMove
  );
  userInitiatedMove = false;
}, 150);

async function initMap() {
  await nextTick();
  const el = mapDiv.value;
  if (!el) return;

  await loadGoogleMaps();

  map = new google.maps.Map(el, {
    center: { lat: center.value.lat, lng: center.value.lon },
    zoom: 11,
    mapTypeControl: true,
    streetViewControl: false,
    fullscreenControl: true,
  });

  clickListener = map.addListener("click", (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    emit("mapClick", { lat: e.latLng.lat(), lon: e.latLng.lng() });
  });

  dragListener = map.addListener("dragstart", () => {
    userInitiatedMove = true;
  });
  zoomListener = map.addListener("zoom_changed", () => {
    userInitiatedMove = true;
  });

  idleListener = map.addListener("idle", emitBoundsChanged);

  // Initial render
  setResultMarkers(markers.value);
  setUserLocationMarker(userLocation.value);
}

onMounted(initMap);

onBeforeUnmount(() => {
  if (idleListener) idleListener.remove();
  if (dragListener) dragListener.remove();
  if (zoomListener) zoomListener.remove();
  if (clickListener) clickListener.remove();
  clearResultMarkers();
  if (userMarker) userMarker.setMap(null);
  map = null;
});

watch(center, (c) => {
  if (!map || !c) return;
  map.setCenter({ lat: c.lat, lng: c.lon });
});

watch(
  markers,
  (list) => {
    setResultMarkers(list);
  },
  { deep: true }
);

watch(userLocation, (loc) => {
  setUserLocationMarker(loc);
});
</script>

<template>
  <div
    ref="mapDiv"
    class="h-80 w-full rounded-xl border"
    role="region"
    aria-label="Results map"
  />
</template>
