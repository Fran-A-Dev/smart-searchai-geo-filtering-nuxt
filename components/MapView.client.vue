<script setup lang="ts">
import { onMounted, ref, watch, toRefs, nextTick } from "vue";

type Marker = { lon: number; lat: number };

const props = defineProps<{
  center: { lon: number; lat: number };
  markers: Marker[];
  userLocation: { lat: number; lon: number } | null;
}>();

const emit = defineEmits<{
  (
    e: "boundsChanged",
    bbox: { swLat: number; swLon: number; neLat: number; neLon: number },
    userInitiated: boolean
  ): void;
  (e: "mapClick", location: { lat: number; lon: number }): void;
}>();

const { center, markers, userLocation } = toRefs(props);
const mapDiv = ref<HTMLDivElement | null>(null);
const config = useRuntimeConfig();

let map: google.maps.Map | null = null;
let markerObjs: google.maps.Marker[] = [];
let userMarker: google.maps.Marker | null = null;
let userInitiatedMove = false;

async function loadGoogleMaps() {
  return new Promise<void>((resolve) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${config.public.googleMapsApiKey}&libraries=places,geocoding`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

async function initMap() {
  await nextTick();
  const el = mapDiv.value;
  if (!el) return;

  // Load Google Maps
  await loadGoogleMaps();

  map = new google.maps.Map(el, {
    center: { lat: center.value.lat, lng: center.value.lon },
    zoom: 11,
    mapTypeControl: true,
    streetViewControl: false,
    fullscreenControl: true,
  });

  // Add click listener for selecting location
  map.addListener("click", (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      emit("mapClick", {
        lat: e.latLng.lat(),
        lon: e.latLng.lng(),
      });
    }
  });

  map.addListener("dragstart", () => {
    userInitiatedMove = true;
  });
  map.addListener("zoom_changed", () => {
    userInitiatedMove = true;
  });

  // Emit bounds changed
  map.addListener("idle", () => {
    if (!map) return;
    const bounds = map.getBounds();
    if (bounds) {
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      emit(
        "boundsChanged",
        {
          swLat: sw.lat(),
          swLon: sw.lng(),
          neLat: ne.lat(),
          neLon: ne.lng(),
        },
        userInitiatedMove
      );
    }
    userInitiatedMove = false;
  });

  setMarkers(markers.value);
  setUserLocationMarker(userLocation.value);
}

function setMarkers(list: Marker[]) {
  if (!map) return;

  // Remove existing markers
  markerObjs.forEach((m) => m.setMap(null));
  markerObjs = [];

  // Add new markers
  list.forEach((m) => {
    const marker = new google.maps.Marker({
      position: { lat: m.lat, lng: m.lon },
      map: map,
      title: "Result",
    });
    markerObjs.push(marker);
  });
}

function setUserLocationMarker(location: { lat: number; lon: number } | null) {
  if (!map) return;

  // Remove existing user marker
  if (userMarker) {
    userMarker.setMap(null);
    userMarker = null;
  }

  // Add new user marker with blue color
  if (location) {
    userMarker = new google.maps.Marker({
      position: { lat: location.lat, lng: location.lon },
      map: map,
      title: "Your Location",
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
}

onMounted(initMap);

watch(center, (c) => {
  if (map && c) {
    map.setCenter({ lat: c.lat, lng: c.lon });
  }
});

watch(
  markers,
  (list) => {
    setMarkers(list);
  },
  { deep: true }
);

watch(userLocation, (location) => {
  setUserLocationMarker(location);
});
</script>

<template>
  <div ref="mapDiv" class="h-80 w-full rounded-xl border" />
</template>
