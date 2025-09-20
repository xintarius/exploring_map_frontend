import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';

const COUNTRY_BOUNDS = [
  { latitude: 55.0, longitude: 14.0 },
  { latitude: 55.0, longitude: 24.0 },
  { latitude: 49.0, longitude: 24.0 },
  { latitude: 49.0, longitude: 14.0 },
];

// Promień odkrytego obszaru wokół lokalizacji (50 m)
const VISIBLE_RADIUS = 50;
// Promień do pobierania danych w tle (10 km)
const FETCH_RADIUS = 10000;
// Odległość przesunięcia do pobrania nowych danych (1 km)
const FETCH_DISTANCE_DELTA = 1000;

function createCircle(lat: number, lon: number, radiusInMeters: number, points = 40) {
  const coords = [];
  const earthRadius = 6371000;
  for (let i = 0; i < points; i++) {
    const angle = (i * 360) / points;
    const angleRad = (angle * Math.PI) / 180;

    const latRad = (lat * Math.PI) / 180;
    const lonRad = (lon * Math.PI) / 180;

    const newLatRad = Math.asin(
      Math.sin(latRad) * Math.cos(radiusInMeters / earthRadius) +
      Math.cos(latRad) * Math.sin(radiusInMeters / earthRadius) * Math.cos(angleRad)
    );
    const newLonRad =
      lonRad +
      Math.atan2(
        Math.sin(angleRad) * Math.sin(radiusInMeters / earthRadius) * Math.cos(latRad),
        Math.cos(radiusInMeters / earthRadius) - Math.sin(latRad) * Math.sin(newLatRad)
      );

    coords.push({ latitude: (newLatRad * 180) / Math.PI, longitude: (newLonRad * 180) / Math.PI });
  }
  coords.push(coords[0]);
  return coords;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default function MapScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [discoveredHoles, setDiscoveredHoles] = useState<{latitude:number,longitude:number}[][]>([]);
  const discoveredAreasData = useRef<{latitude:number, longitude:number}[]>([]);
  const lastFetchLocation = useRef<{latitude:number, longitude:number} | null>(null);

  useEffect(() => {
  let sub: Location.LocationSubscription | null = null;

  (async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setErrorMsg('Brak pozwolenia na lokalizację');
      return;
    }

    const loc = await Location.getCurrentPositionAsync({});
    setLocation(loc);
    setDiscoveredHoles([createCircle(loc.coords.latitude, loc.coords.longitude, VISIBLE_RADIUS)]);
    lastFetchLocation.current = loc.coords;
    fetchDiscoveredAreas(loc.coords.latitude, loc.coords.longitude);

    sub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 10 },
      (newLoc) => {
        setLocation(newLoc);

        if (!lastFetchLocation.current || haversineDistance(
          newLoc.coords.latitude, newLoc.coords.longitude,
          lastFetchLocation.current.latitude, lastFetchLocation.current.longitude
        ) > FETCH_DISTANCE_DELTA) {
          lastFetchLocation.current = newLoc.coords;
          fetchDiscoveredAreas(newLoc.coords.latitude, newLoc.coords.longitude);
        }

        setDiscoveredHoles((prev) => {
          const existsNearby = prev.some(hole => {
            const center = hole[0];
            return haversineDistance(center.latitude, center.longitude, newLoc.coords.latitude, newLoc.coords.longitude) < VISIBLE_RADIUS;
          });
          if (!existsNearby) {
            return [...prev, createCircle(newLoc.coords.latitude, newLoc.coords.longitude, VISIBLE_RADIUS)];
          }
          return prev;
        });
      }
    );
  })();

  return () => {
    if (sub) sub.remove();
  };
}, []);


  async function fetchDiscoveredAreas(lat: number, lon: number) {
    try {
      const data: {latitude:number,longitude:number}[] = []; 
      discoveredAreasData.current = data;
    } catch(e) {
      console.warn('Błąd pobierania danych z backendu', e);
    }
  }

  if (errorMsg) return <Text>{errorMsg}</Text>;
  if (!location) return <Text>Ładowanie lokalizacji...</Text>;

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        customMapStyle={customMapStyle} // 🔹 Styl ukrywający szczegóły mapy
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        minZoomLevel={12}
        maxZoomLevel={18}
      >
        <Marker
          coordinate={{ latitude: location.coords.latitude, longitude: location.coords.longitude }}
          title="Jesteś tutaj"
        />

        <Polygon
          coordinates={COUNTRY_BOUNDS}
          holes={discoveredHoles}
          fillColor="rgba(0,0,0,0.7)"
          strokeColor="transparent"
        />
      </MapView>
    </View>
  );
}

// 🔹 Styl pustej mapy
const customMapStyle = [
  {
    featureType: "all",
    elementType: "labels",
    stylers: [{ visibility: "off" }]
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ visibility: "off" }]
  },
  {
    featureType: "poi",
    stylers: [{ visibility: "off" }]
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }]
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#000000" }]
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#222222" }]
  }
];

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
});
