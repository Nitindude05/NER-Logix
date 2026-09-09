import React, { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";

import {
  Truck,
  MapPin,
  Navigation,
  Activity,
  Clock,
  Route,
  Gauge,
  Wifi,
  WifiOff,
  RefreshCw,
  CircleDot,
  Flag,
} from "lucide-react";

import "leaflet/dist/leaflet.css";

/* =========================================================
   BACKEND CONFIGURATION
   ========================================================= */

const API_URL = "https://ner-logix-vgvp.onrender.com";

const TRUCK_ID = "TRUCK-001";

/* =========================================================
   API HELPER
   ========================================================= */

async function callApi(url, options = {}) {
  const response = await fetch(`${API_URL}${url}`, options);

  if (!response.ok) {
    throw new Error(
      `${API_URL}${url} returned ${response.status}`
    );
  }

  return response.json();
}

/* =========================================================
   SEVEN SISTERS ROUTE
   ========================================================= */

const ROUTE_STOPS = [
  {
    name: "Guwahati",
    state: "Assam",
    lat: 26.1445,
    lng: 91.7362,
  },
  {
    name: "Shillong",
    state: "Meghalaya",
    lat: 25.5788,
    lng: 91.8933,
  },
  {
    name: "Agartala",
    state: "Tripura",
    lat: 23.8315,
    lng: 91.2868,
  },
  {
    name: "Aizawl",
    state: "Mizoram",
    lat: 23.7271,
    lng: 92.7176,
  },
  {
    name: "Imphal",
    state: "Manipur",
    lat: 24.817,
    lng: 93.9368,
  },
  {
    name: "Kohima",
    state: "Nagaland",
    lat: 25.6751,
    lng: 94.1086,
  },
  {
    name: "Itanagar",
    state: "Arunachal Pradesh",
    lat: 27.0844,
    lng: 93.6053,
  },
];

const DESTINATION = ROUTE_STOPS[ROUTE_STOPS.length - 1];

/* =========================================================
   MAP ICONS
   ========================================================= */

const createIcon = (color, symbol, size = 42) =>
  L.divIcon({
    className: "custom-map-icon",
    html: `
      <div
        style="
          width:${size}px;
          height:${size}px;
          border-radius:50%;
          background:${color};
          display:flex;
          align-items:center;
          justify-content:center;
          color:white;
          font-size:${size * 0.42}px;
          font-weight:bold;
          border:3px solid white;
          box-shadow:0 4px 12px rgba(0,0,0,0.3);
        "
      >
        ${symbol}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const truckIcon = createIcon("#2563eb", "🚛", 46);

const startIcon = createIcon("#16a34a", "●", 38);

const destinationIcon = createIcon("#dc2626", "⚑", 42);

const stopIcon = createIcon("#7c3aed", "•", 32);

/* =========================================================
   MAP FOLLOW COMPONENT
   ========================================================= */

function MapFollow({ position, enabled }) {
  const map = useMap();

  useEffect(() => {
    if (!position || !enabled) return;

    map.flyTo(position, Math.max(map.getZoom(), 10), {
      duration: 1,
    });
  }, [position, enabled, map]);

  return null;
}

/* =========================================================
   DISTANCE CALCULATION
   ========================================================= */

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  const c =
    2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function calculatePathDistance(points) {
  if (!points || points.length < 2) return 0;

  let distance = 0;

  for (let i = 1; i < points.length; i++) {
    distance += calculateDistance(
      points[i - 1].lat,
      points[i - 1].lng,
      points[i].lat,
      points[i].lng
    );
  }

  return distance;
}

/* =========================================================
   FORMATTERS
   ========================================================= */

function formatDistance(distance) {
  if (!Number.isFinite(distance)) return "0 km";

  if (distance < 1) {
    return `${Math.round(distance * 1000)} m`;
  }

  return `${distance.toFixed(1)} km`;
}

function formatTime(timestamp) {
  if (!timestamp) return "Never";

  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(timestamp) {
  if (!timestamp) return "—";

  return new Date(timestamp).toLocaleString();
}

/* =========================================================
   STAT CARD
   ========================================================= */

function StatCard({
  icon,
  title,
  value,
  subtitle,
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 rounded-xl bg-gray-100">
          {icon}
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-1">
        {title}
      </p>

      <h3 className="text-2xl font-bold text-gray-900">
        {value}
      </h3>

      {subtitle && (
        <p className="text-xs text-gray-500 mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
   ========================================================= */

export default function GpsTracker() {
  const [currentLocation, setCurrentLocation] = useState(null);

  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [lastUpdated, setLastUpdated] = useState(null);

  const [isFollowing, setIsFollowing] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  /* =======================================================
     FETCH CURRENT LOCATION
     ======================================================= */

  const fetchCurrentLocation = async () => {
    try {
      const response = await callApi("/get");

      if (
        response &&
        Array.isArray(response.data)
      ) {
        const truck = response.data.find(
          (item) => item.id === TRUCK_ID
        );

        if (truck) {
          const location = {
            lat: Number(truck.lat),
            lng: Number(truck.lng),
            timestamp: truck.updatedAt,
            id: truck.id,
          };

          setCurrentLocation(location);
          setLastUpdated(truck.updatedAt);
        }
      }

      setError("");
    } catch (err) {
      console.error(
        "Current location error:",
        err
      );

      setError(
        "Unable to connect to GPS server."
      );
    }
  };

  /* =======================================================
     FETCH LOCATION HISTORY
     ======================================================= */

  const fetchHistory = async () => {
    try {
      const response = await callApi(
        `/history/${TRUCK_ID}`
      );

      if (
        response &&
        Array.isArray(response.data)
      ) {
        const points = response.data
          .map((point) => ({
            lat: Number(point.lat),
            lng: Number(point.lng),
            timestamp: point.timestamp,
          }))
          .filter(
            (point) =>
              Number.isFinite(point.lat) &&
              Number.isFinite(point.lng)
          );

        setHistory(points);

        if (points.length > 0) {
          const latest = points[points.length - 1];

          setCurrentLocation((previous) => ({
            ...(previous || {}),
            lat: latest.lat,
            lng: latest.lng,
            timestamp: latest.timestamp,
            id: TRUCK_ID,
          }));

          setLastUpdated(latest.timestamp);
        }
      }

      setError("");
    } catch (err) {
      console.error(
        "History error:",
        err
      );

      setError(
        "Unable to load location history."
      );
    }
  };

  /* =======================================================
     FETCH ALL GPS DATA
     ======================================================= */

  const fetchGpsData = async () => {
    try {
      setRefreshing(true);

      await Promise.all([
        fetchCurrentLocation(),
        fetchHistory(),
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /* =======================================================
     INITIAL LOAD + POLLING
     ======================================================= */

  useEffect(() => {
    fetchGpsData();

    const interval = setInterval(() => {
      fetchGpsData();
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  /* =======================================================
     START POSITION
     ======================================================= */

  const startPosition = useMemo(() => {
    if (history.length > 0) {
      return [
        history[0].lat,
        history[0].lng,
      ];
    }

    if (currentLocation) {
      return [
        currentLocation.lat,
        currentLocation.lng,
      ];
    }

    return [
      ROUTE_STOPS[0].lat,
      ROUTE_STOPS[0].lng,
    ];
  }, [history, currentLocation]);

  /* =======================================================
     CURRENT POSITION
     ======================================================= */

  const currentPosition = useMemo(() => {
    if (!currentLocation) return null;

    return [
      currentLocation.lat,
      currentLocation.lng,
    ];
  }, [currentLocation]);

  /* =======================================================
     ACTUAL TRAVELLED ROUTE
     ======================================================= */

  const travelledRoute = useMemo(() => {
    return history.map((point) => [
      point.lat,
      point.lng,
    ]);
  }, [history]);

  /* =======================================================
     PLANNED ROUTE
     ======================================================= */

  const plannedRoute = useMemo(() => {
    return ROUTE_STOPS.map((stop) => [
      stop.lat,
      stop.lng,
    ]);
  }, []);

  /* =======================================================
     TRAVELLED DISTANCE
     ======================================================= */

  const travelledDistance = useMemo(() => {
    return calculatePathDistance(history);
  }, [history]);

  /* =======================================================
     REMAINING DISTANCE
     ======================================================= */

  const remainingDistance = useMemo(() => {
    if (!currentLocation) {
      return 0;
    }

    return calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      DESTINATION.lat,
      DESTINATION.lng
    );
  }, [currentLocation]);

  /* =======================================================
     MAP CENTER
     ======================================================= */

  const mapCenter = currentPosition || [
    ROUTE_STOPS[0].lat,
    ROUTE_STOPS[0].lng,
  ];

  /* =======================================================
     STATUS
     ======================================================= */

  const isOnline =
    currentLocation !== null &&
    !error;

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">

      {/* ===================================================
          HEADER
          =================================================== */}

      <header className="bg-white border-b border-gray-200 sticky top-0 z-[1000]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-20 flex items-center justify-between">

            <div className="flex items-center gap-3">

              <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center">
                <Truck
                  size={24}
                  className="text-white"
                />
              </div>

              <div>
                <h1 className="text-xl font-bold">
                  GPS Truck Tracker
                </h1>

                <p className="text-sm text-gray-500">
                  Live vehicle tracking system
                </p>
              </div>

            </div>

            <div className="flex items-center gap-4">

              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium ${
                  isOnline
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {isOnline ? (
                  <>
                    <Wifi size={16} />
                    Online
                  </>
                ) : (
                  <>
                    <WifiOff size={16} />
                    Offline
                  </>
                )}
              </div>

              <button
                onClick={fetchGpsData}
                disabled={refreshing}
                className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-100 transition disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw
                  size={20}
                  className={
                    refreshing
                      ? "animate-spin"
                      : ""
                  }
                />
              </button>

            </div>
          </div>
        </div>
      </header>

      {/* ===================================================
          MAIN
          =================================================== */}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-center gap-3">
            <WifiOff size={20} />

            <div>
              <p className="font-semibold">
                Connection problem
              </p>

              <p className="text-sm">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* =================================================
            TRUCK INFO
            ================================================= */}

        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 shadow-sm">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <div>
              <p className="text-sm text-gray-500">
                Tracking vehicle
              </p>

              <div className="flex items-center gap-3 mt-1">

                <h2 className="text-2xl font-bold">
                  {TRUCK_ID}
                </h2>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    isOnline
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {isOnline
                    ? "LIVE"
                    : "WAITING"}
                </span>

              </div>
            </div>

            <div className="text-left md:text-right">

              <p className="text-sm text-gray-500">
                Last update
              </p>

              <p className="font-semibold">
                {formatDate(lastUpdated)}
              </p>

            </div>

          </div>
        </div>

        {/* =================================================
            STATISTICS
            ================================================= */}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

          <StatCard
            icon={
              <Navigation
                size={22}
                className="text-blue-600"
              />
            }
            title="Current Location"
            value={
              currentLocation
                ? `${currentLocation.lat.toFixed(
                    4
                  )}, ${currentLocation.lng.toFixed(
                    4
                  )}`
                : "Waiting..."
            }
            subtitle="Latitude / Longitude"
          />

          <StatCard
            icon={
              <Route
                size={22}
                className="text-green-600"
              />
            }
            title="Travelled Distance"
            value={formatDistance(
              travelledDistance
            )}
            subtitle={`${history.length} GPS points`}
          />

          <StatCard
            icon={
              <Flag
                size={22}
                className="text-red-600"
              />
            }
            title="Remaining Distance"
            value={formatDistance(
              remainingDistance
            )}
            subtitle={`To ${DESTINATION.name}`}
          />

          <StatCard
            icon={
              <Clock
                size={22}
                className="text-purple-600"
              />
            }
            title="Last GPS Update"
            value={formatTime(lastUpdated)}
            subtitle="Live server data"
          />

        </div>

        {/* =================================================
            MAP
            ================================================= */}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">

          <div className="px-5 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <MapPin
                  size={20}
                  className="text-blue-600"
                />
                Live Truck Location
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Seven Sisters Route
              </p>
            </div>

            <button
              onClick={() =>
                setIsFollowing(
                  (previous) => !previous
                )
              }
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                isFollowing
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {isFollowing
                ? "Auto Follow: ON"
                : "Auto Follow: OFF"}
            </button>

          </div>

          <div className="h-[600px] w-full">

            <MapContainer
              center={mapCenter}
              zoom={7}
              scrollWheelZoom={true}
              className="h-full w-full"
            >

              {/* OpenStreetMap */}
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Auto follow */}
              <MapFollow
                position={currentPosition}
                enabled={isFollowing}
              />

              {/* =================================================
                  PLANNED ROUTE
                  ================================================= */}

              <Polyline
                positions={plannedRoute}
                pathOptions={{
                  color: "#64748b",
                  weight: 4,
                  opacity: 0.6,
                  dashArray: "10 10",
                }}
              />

              {/* =================================================
                  ACTUAL TRAVELLED ROUTE
                  ================================================= */}

              {travelledRoute.length >= 2 && (
                <Polyline
                  positions={travelledRoute}
                  pathOptions={{
                    color: "#2563eb",
                    weight: 6,
                    opacity: 0.9,
                  }}
                />
              )}

              {/* =================================================
                  START MARKER
                  ================================================= */}

              {startPosition && (
                <Marker
                  position={startPosition}
                  icon={startIcon}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong>
                        Tracking Start
                      </strong>

                      <br />

                      {startPosition[0].toFixed(5)},
                      {" "}
                      {startPosition[1].toFixed(5)}
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* =================================================
                  ROUTE STOPS
                  ================================================= */}

              {ROUTE_STOPS.map(
                (stop, index) => (
                  <Marker
                    key={stop.name}
                    position={[
                      stop.lat,
                      stop.lng,
                    ]}
                    icon={
                      index ===
                      ROUTE_STOPS.length - 1
                        ? destinationIcon
                        : stopIcon
                    }
                  >
                    <Popup>
                      <div className="text-sm min-w-[150px]">

                        <strong>
                          {stop.name}
                        </strong>

                        <br />

                        <span className="text-gray-500">
                          {stop.state}
                        </span>

                        <br />

                        <span className="text-xs">
                          Stop {index + 1} of{" "}
                          {ROUTE_STOPS.length}
                        </span>

                      </div>
                    </Popup>
                  </Marker>
                )
              )}

              {/* =================================================
                  DESTINATION MARKER
                  ================================================= */}

              <Marker
                position={[
                  DESTINATION.lat,
                  DESTINATION.lng,
                ]}
                icon={destinationIcon}
              >
                <Popup>
                  <div className="text-sm">
                    <strong>
                      Destination
                    </strong>

                    <br />

                    {DESTINATION.name},{" "}
                    {DESTINATION.state}

                    <br />

                    <span className="text-xs text-gray-500">
                      Final destination
                    </span>
                  </div>
                </Popup>
              </Marker>

              {/* =================================================
                  LIVE TRUCK MARKER
                  ================================================= */}

              {currentPosition && (
                <Marker
                  position={currentPosition}
                  icon={truckIcon}
                >
                  <Popup>
                    <div className="text-sm min-w-[180px]">

                      <div className="font-bold text-base mb-2">
                        🚛 {TRUCK_ID}
                      </div>

                      <div className="space-y-1">

                        <div>
                          <span className="text-gray-500">
                            Latitude:
                          </span>{" "}
                          {currentLocation.lat.toFixed(
                            6
                          )}
                        </div>

                        <div>
                          <span className="text-gray-500">
                            Longitude:
                          </span>{" "}
                          {currentLocation.lng.toFixed(
                            6
                          )}
                        </div>

                        <div>
                          <span className="text-gray-500">
                            Updated:
                          </span>{" "}
                          {formatTime(
                            currentLocation.timestamp
                          )}
                        </div>

                      </div>

                    </div>
                  </Popup>
                </Marker>
              )}

            </MapContainer>
          </div>

          {/* =================================================
              MAP LEGEND
              ================================================= */}

          <div className="px-5 py-4 border-t border-gray-200 flex flex-wrap gap-5 text-sm">

            <div className="flex items-center gap-2">
              <span className="w-4 h-1 bg-blue-600 rounded" />
              Actual travelled route
            </div>

            <div className="flex items-center gap-2">
              <span className="w-4 h-1 border-t-2 border-dashed border-gray-500" />
              Planned route
            </div>

            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-green-600 rounded-full border-2 border-white shadow" />
              Start
            </div>

            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-600 rounded-full border-2 border-white shadow" />
              Destination
            </div>

            <div className="flex items-center gap-2">
              <span className="text-base">
                🚛
              </span>
              Live truck
            </div>

          </div>

        </div>

        {/* =================================================
            LIVE LOCATION DETAILS
            ================================================= */}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Current coordinates */}

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">

            <div className="flex items-center gap-3 mb-5">

              <div className="p-3 bg-blue-50 rounded-xl">
                <Navigation
                  size={22}
                  className="text-blue-600"
                />
              </div>

              <div>
                <h3 className="font-bold text-lg">
                  Current Coordinates
                </h3>

                <p className="text-sm text-gray-500">
                  Latest GPS position
                </p>
              </div>

            </div>

            {currentLocation ? (
              <div className="space-y-4">

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <span className="text-gray-500">
                    Latitude
                  </span>

                  <span className="font-mono font-semibold">
                    {currentLocation.lat.toFixed(
                      6
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <span className="text-gray-500">
                    Longitude
                  </span>

                  <span className="font-mono font-semibold">
                    {currentLocation.lng.toFixed(
                      6
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <span className="text-gray-500">
                    Last update
                  </span>

                  <span className="font-semibold">
                    {formatDate(
                      currentLocation.timestamp
                    )}
                  </span>
                </div>

              </div>
            ) : (
              <div className="py-10 text-center text-gray-500">
                <CircleDot
                  size={40}
                  className="mx-auto mb-3 opacity-50"
                />

                <p>
                  Waiting for GPS location...
                </p>
              </div>
            )}

          </div>

          {/* Route information */}

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">

            <div className="flex items-center gap-3 mb-5">

              <div className="p-3 bg-purple-50 rounded-xl">
                <Route
                  size={22}
                  className="text-purple-600"
                />
              </div>

              <div>
                <h3 className="font-bold text-lg">
                  Route Information
                </h3>

                <p className="text-sm text-gray-500">
                  Seven Sisters journey
                </p>
              </div>

            </div>

            <div className="space-y-4">

              <div className="flex items-center justify-between">
                <span className="text-gray-500">
                  Start
                </span>

                <span className="font-semibold">
                  {ROUTE_STOPS[0].name},{" "}
                  {ROUTE_STOPS[0].state}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500">
                  Destination
                </span>

                <span className="font-semibold">
                  {DESTINATION.name},{" "}
                  {DESTINATION.state}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500">
                  Route stops
                </span>

                <span className="font-semibold">
                  {ROUTE_STOPS.length}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500">
                  GPS points
                </span>

                <span className="font-semibold">
                  {history.length}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500">
                  Travelled
                </span>

                <span className="font-semibold text-blue-600">
                  {formatDistance(
                    travelledDistance
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500">
                  Remaining
                </span>

                <span className="font-semibold text-red-600">
                  {formatDistance(
                    remainingDistance
                  )}
                </span>
              </div>

            </div>

          </div>

        </div>

        {/* =================================================
            GPS POINT HISTORY
            ================================================= */}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mt-6 overflow-hidden">

          <div className="px-6 py-5 border-b border-gray-200">

            <div className="flex items-center gap-3">

              <div className="p-3 bg-green-50 rounded-xl">
                <Activity
                  size={22}
                  className="text-green-600"
                />
              </div>

              <div>
                <h3 className="font-bold text-lg">
                  GPS Tracking History
                </h3>

                <p className="text-sm text-gray-500">
                  Recorded location points for{" "}
                  {TRUCK_ID}
                </p>
              </div>

            </div>

          </div>

          {loading ? (
            <div className="p-10 text-center">

              <RefreshCw
                size={32}
                className="animate-spin mx-auto mb-3 text-blue-600"
              />

              <p className="text-gray-500">
                Loading GPS data...
              </p>

            </div>
          ) : history.length === 0 ? (
            <div className="p-10 text-center">

              <MapPin
                size={40}
                className="mx-auto mb-3 text-gray-300"
              />

              <p className="font-medium text-gray-600">
                No GPS history available
              </p>

              <p className="text-sm text-gray-400 mt-1">
                Start the driver tracker to
                send GPS coordinates.
              </p>

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="bg-gray-50 border-b border-gray-200">

                  <tr>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      #
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Latitude
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Longitude
                    </th>

                    <th className="text-left px-6 py-4 font-semibold text-gray-600">
                      Timestamp
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {[...history]
                    .reverse()
                    .slice(0, 20)
                    .map(
                      (point, index) => (
                        <tr
                          key={`${point.timestamp}-${index}`}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >

                          <td className="px-6 py-4 text-gray-500">
                            {index + 1}
                          </td>

                          <td className="px-6 py-4 font-mono">
                            {point.lat.toFixed(
                              6
                            )}
                          </td>

                          <td className="px-6 py-4 font-mono">
                            {point.lng.toFixed(
                              6
                            )}
                          </td>

                          <td className="px-6 py-4 text-gray-600">
                            {formatDate(
                              point.timestamp
                            )}
                          </td>

                        </tr>
                      )
                    )}

                </tbody>

              </table>

              {history.length > 20 && (
                <div className="px-6 py-4 text-center text-sm text-gray-500 border-t">
                  Showing latest 20 of{" "}
                  {history.length} GPS points
                </div>
              )}

            </div>
          )}

        </div>

        {/* =================================================
            FOOTER STATUS
            ================================================= */}

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500">

          <div className="flex items-center gap-2">
            <Gauge size={16} />
            Polling GPS data every 3 seconds
          </div>

          <div>
            Backend:{" "}
            <span className="font-mono text-gray-700">
              ner-logix-vgvp.onrender.com
            </span>
          </div>

        </div>

      </main>
    </div>
  );
}