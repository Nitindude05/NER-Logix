import React, { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMap,
} from "react-leaflet";

import {
  Truck,
  MapPin,
  Navigation,
  Activity,
  Route,
  Clock,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";

import L from "leaflet";

// =====================================================
// CONFIG
// =====================================================

const API_URL = "https://ner-logix-vgvp.onrender.com";
const TRUCK_ID = "TRUCK-001";

const POLLING_INTERVAL = 3000;

// =====================================================
// TRUCK ICON
// =====================================================

const truckIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: #2563eb;
      border: 4px solid white;
      box-shadow: 0 3px 12px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 20px;
    ">
      🚛
    </div>
  `,
  iconSize: [42, 42],
  iconAnchor: [21, 21],
  popupAnchor: [0, -21],
});

// =====================================================
// START POINT ICON
// =====================================================

const startIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: #16a34a;
      border: 4px solid white;
      box-shadow: 0 3px 10px rgba(0,0,0,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 16px;
    ">
      S
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

// =====================================================
// MAP AUTO CENTER
// =====================================================

function MapUpdater({ location }) {
  const map = useMap();

  useEffect(() => {
    if (!location) return;

    map.setView(
      [location.lat, location.lng],
      Math.max(map.getZoom(), 14),
      {
        animate: true,
      }
    );
  }, [location, map]);

  return null;
}

// =====================================================
// FORMAT TIME
// =====================================================

function formatTime(timestamp) {
  if (!timestamp) return "--";

  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// =====================================================
// DISTANCE BETWEEN TWO GPS POINTS
// =====================================================

function calculateDistance(point1, point2) {
  if (!point1 || !point2) return 0;

  const R = 6371;

  const lat1 = (point1.lat * Math.PI) / 180;
  const lat2 = (point2.lat * Math.PI) / 180;

  const deltaLat =
    ((point2.lat - point1.lat) * Math.PI) / 180;

  const deltaLng =
    ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) *
      Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function GpsTracker() {
  const [currentLocation, setCurrentLocation] =
    useState(null);

  const [history, setHistory] = useState([]);

  const [serverStatus, setServerStatus] =
    useState("Checking...");

  const [lastUpdate, setLastUpdate] =
    useState(null);

  const [error, setError] = useState("");

  const [loading, setLoading] =
    useState(true);

  // ===================================================
  // FETCH LATEST GPS LOCATION
  // ===================================================

  const fetchLiveLocation = async () => {
    try {
      const response = await fetch(
        `${API_URL}/get`
      );

      if (!response.ok) {
        throw new Error(
          `Server returned ${response.status}`
        );
      }

      const result = await response.json();

      console.log("LIVE GPS DATA:", result);

      if (
        result.data &&
        Array.isArray(result.data)
      ) {
        const truck = result.data.find(
          (item) =>
            item.id === TRUCK_ID
        );

        if (truck) {
          const location = {
            lat: Number(truck.lat),
            lng: Number(truck.lng),
            timestamp: Number(
              truck.updatedAt
            ),
          };

          console.log(
            "TRUCK LOCATION:",
            location
          );

          setCurrentLocation(location);
          setLastUpdate(
            Number(truck.updatedAt)
          );

          setServerStatus("Connected");
          setError("");
          setLoading(false);
        } else {
          setServerStatus("Connected");
          setLoading(false);

          console.log(
            `No location found for ${TRUCK_ID}`
          );
        }
      }
    } catch (err) {
      console.error(
        "Failed to fetch live GPS:",
        err
      );

      setServerStatus("Offline");

      setError(
        "Unable to connect to GPS server."
      );

      setLoading(false);
    }
  };

  // ===================================================
  // FETCH TRAVEL HISTORY
  // ===================================================

  const fetchHistory = async () => {
    try {
      const response = await fetch(
        `${API_URL}/history/${TRUCK_ID}`
      );

      if (!response.ok) {
        throw new Error(
          `History server returned ${response.status}`
        );
      }

      const result =
        await response.json();

      console.log(
        "GPS HISTORY:",
        result
      );

      if (
        result.data &&
        Array.isArray(result.data)
      ) {
        const points = result.data
          .map((item) => ({
            lat: Number(item.lat),
            lng: Number(item.lng),
            timestamp: Number(
              item.timestamp
            ),
          }))
          .filter(
            (point) =>
              Number.isFinite(point.lat) &&
              Number.isFinite(point.lng)
          );

        setHistory(points);
      }
    } catch (err) {
      console.error(
        "Failed to fetch history:",
        err
      );
    }
  };

  // ===================================================
  // POLLING
  // ===================================================

  useEffect(() => {
    fetchLiveLocation();
    fetchHistory();

    const locationInterval =
      setInterval(
        fetchLiveLocation,
        POLLING_INTERVAL
      );

    const historyInterval =
      setInterval(
        fetchHistory,
        POLLING_INTERVAL
      );

    return () => {
      clearInterval(
        locationInterval
      );

      clearInterval(
        historyInterval
      );
    };
  }, []);

  // ===================================================
  // CALCULATE TRAVELLED DISTANCE
  // ===================================================

  const travelledDistance =
    useMemo(() => {
      if (history.length < 2) {
        return 0;
      }

      let total = 0;

      for (
        let i = 1;
        i < history.length;
        i++
      ) {
        total += calculateDistance(
          history[i - 1],
          history[i]
        );
      }

      return total;
    }, [history]);

  // ===================================================
  // START POINT
  // ===================================================

  const startPoint =
    history.length > 0
      ? history[0]
      : null;

  // ===================================================
  // MAP CENTER
  // ===================================================

  const mapCenter =
    currentLocation
      ? [
          currentLocation.lat,
          currentLocation.lng,
        ]
      : startPoint
      ? [
          startPoint.lat,
          startPoint.lng,
        ]
      : [23.2599, 77.4126];

  // ===================================================
  // REFRESH
  // ===================================================

  const handleRefresh = () => {
    setLoading(true);

    fetchLiveLocation();
    fetchHistory();
  };

  // ===================================================
  // UI
  // ===================================================

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">

      {/* ============================================= */}
      {/* HEADER */}
      {/* ============================================= */}

      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-5">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <div className="flex items-center gap-4">

              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center">
                <Truck
                  size={25}
                  className="text-white"
                />
              </div>

              <div>
                <h1 className="text-xl font-bold">
                  GPS Tracking Console
                </h1>

                <p className="text-sm text-gray-500">
                  Live Vehicle Monitoring
                </p>
              </div>

            </div>

            <div className="flex items-center gap-3">

              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
                  serverStatus ===
                  "Connected"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {serverStatus ===
                "Connected" ? (
                  <Wifi size={16} />
                ) : (
                  <WifiOff size={16} />
                )}

                {serverStatus}
              </div>

              <button
                onClick={handleRefresh}
                className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                title="Refresh"
              >
                <RefreshCw
                  size={18}
                  className={
                    loading
                      ? "animate-spin"
                      : ""
                  }
                />
              </button>

            </div>

          </div>

        </div>
      </header>

      {/* ============================================= */}
      {/* MAIN */}
      {/* ============================================= */}

      <main className="max-w-7xl mx-auto px-6 py-6">

        {/* =========================================== */}
        {/* TRUCK INFO */}
        {/* =========================================== */}

        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <div>

              <p className="text-sm text-gray-500">
                Tracking Vehicle
              </p>

              <div className="flex items-center gap-3 mt-1">

                <h2 className="text-2xl font-bold">
                  {TRUCK_ID}
                </h2>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    currentLocation
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {currentLocation
                    ? "LIVE"
                    : "WAITING"}
                </span>

              </div>

            </div>

            <div className="text-sm text-gray-500">

              Last update:

              <span className="font-semibold text-gray-800 ml-2">
                {formatTime(
                  lastUpdate
                )}
              </span>

            </div>

          </div>

        </div>

        {/* =========================================== */}
        {/* STATS */}
        {/* =========================================== */}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

          {/* Current Location */}

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">

            <div className="flex items-center gap-3">

              <div className="p-3 bg-blue-50 rounded-xl">
                <MapPin
                  size={21}
                  className="text-blue-600"
                />
              </div>

              <div>
                <p className="text-sm text-gray-500">
                  Current Location
                </p>

                <p className="font-bold">
                  {currentLocation
                    ? `${currentLocation.lat.toFixed(
                        4
                      )}, ${currentLocation.lng.toFixed(
                        4
                      )}`
                    : "--"}
                </p>
              </div>

            </div>

          </div>

          {/* Distance */}

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">

            <div className="flex items-center gap-3">

              <div className="p-3 bg-green-50 rounded-xl">
                <Route
                  size={21}
                  className="text-green-600"
                />
              </div>

              <div>

                <p className="text-sm text-gray-500">
                  Distance Travelled
                </p>

                <p className="text-2xl font-bold">
                  {travelledDistance.toFixed(
                    2
                  )}{" "}
                  <span className="text-sm font-medium">
                    km
                  </span>
                </p>

              </div>

            </div>

          </div>

          {/* GPS Points */}

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">

            <div className="flex items-center gap-3">

              <div className="p-3 bg-purple-50 rounded-xl">
                <Activity
                  size={21}
                  className="text-purple-600"
                />
              </div>

              <div>

                <p className="text-sm text-gray-500">
                  GPS Points
                </p>

                <p className="text-2xl font-bold">
                  {history.length}
                </p>

              </div>

            </div>

          </div>

          {/* Last Update */}

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">

            <div className="flex items-center gap-3">

              <div className="p-3 bg-orange-50 rounded-xl">
                <Clock
                  size={21}
                  className="text-orange-600"
                />
              </div>

              <div>

                <p className="text-sm text-gray-500">
                  Last GPS Update
                </p>

                <p className="font-bold">
                  {lastUpdate
                    ? formatTime(
                        lastUpdate
                      )
                    : "--"}
                </p>

              </div>

            </div>

          </div>

        </div>

        {/* =========================================== */}
        {/* ERROR */}
        {/* =========================================== */}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2">
              <WifiOff size={18} />
              <span className="font-medium">
                {error}
              </span>
            </div>
          </div>
        )}

        {/* =========================================== */}
        {/* MAP */}
        {/* =========================================== */}

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-6">

          <div className="p-5 border-b border-gray-200">

            <div className="flex items-center justify-between">

              <div className="flex items-center gap-3">

                <div className="p-2.5 bg-blue-50 rounded-xl">
                  <Navigation
                    size={21}
                    className="text-blue-600"
                  />
                </div>

                <div>

                  <h2 className="font-bold text-lg">
                    Live Vehicle Map
                  </h2>

                  <p className="text-sm text-gray-500">
                    Real-time mobile GPS tracking
                  </p>

                </div>

              </div>

              {currentLocation && (
                <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">
                  <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                  Live
                </div>
              )}

            </div>

          </div>

          <div className="h-[500px]">

            <MapContainer
              center={mapCenter}
              zoom={13}
              scrollWheelZoom={true}
              className="w-full h-full"
            >

              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Auto move map to truck */}

              <MapUpdater
                location={
                  currentLocation
                }
              />

              {/* ================================= */}
              {/* TRAVELLED ROUTE */}
              {/* ================================= */}

              {history.length > 1 && (
                <Polyline
                  positions={history.map(
                    (point) => [
                      point.lat,
                      point.lng,
                    ]
                  )}
                  pathOptions={{
                    color: "#2563eb",
                    weight: 5,
                    opacity: 0.85,
                  }}
                />
              )}

              {/* ================================= */}
              {/* START POINT */}
              {/* ================================= */}

              {startPoint && (
                <Marker
                  position={[
                    startPoint.lat,
                    startPoint.lng,
                  ]}
                  icon={startIcon}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong>
                        Tracking Start
                      </strong>

                      <br />

                      {startPoint.lat.toFixed(
                        6
                      )}
                      ,{" "}
                      {startPoint.lng.toFixed(
                        6
                      )}
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* ================================= */}
              {/* GPS HISTORY POINTS */}
              {/* ================================= */}

              {history.map(
                (point, index) => (
                  <CircleMarker
                    key={`${point.timestamp}-${index}`}
                    center={[
                      point.lat,
                      point.lng,
                    ]}
                    radius={3}
                    pathOptions={{
                      color: "#2563eb",
                      fillColor:
                        "#2563eb",
                      fillOpacity: 0.8,
                    }}
                  />
                )
              )}

              {/* ================================= */}
              {/* CURRENT TRUCK */}
              {/* ================================= */}

              {currentLocation && (
                <Marker
                  position={[
                    currentLocation.lat,
                    currentLocation.lng,
                  ]}
                  icon={truckIcon}
                >
                  <Popup>

                    <div className="min-w-[180px]">

                      <h3 className="font-bold text-base mb-2">
                        🚛 {TRUCK_ID}
                      </h3>

                      <div className="text-sm space-y-1">

                        <p>
                          <strong>
                            Latitude:
                          </strong>{" "}
                          {currentLocation.lat.toFixed(
                            6
                          )}
                        </p>

                        <p>
                          <strong>
                            Longitude:
                          </strong>{" "}
                          {currentLocation.lng.toFixed(
                            6
                          )}
                        </p>

                        <p>
                          <strong>
                            Updated:
                          </strong>{" "}
                          {formatTime(
                            currentLocation.timestamp
                          )}
                        </p>

                      </div>

                    </div>

                  </Popup>
                </Marker>
              )}

            </MapContainer>

          </div>

        </div>

        {/* =========================================== */}
        {/* CURRENT GPS INFORMATION */}
        {/* =========================================== */}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Current Position */}

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">

            <div className="flex items-center gap-3 mb-5">

              <div className="p-3 bg-blue-50 rounded-xl">
                <MapPin
                  size={22}
                  className="text-blue-600"
                />
              </div>

              <div>

                <h3 className="font-bold text-lg">
                  Current GPS Position
                </h3>

                <p className="text-sm text-gray-500">
                  Location received from driver phone
                </p>

              </div>

            </div>

            {currentLocation ? (
              <div className="space-y-3">

                <div className="flex justify-between bg-gray-50 rounded-xl p-4">

                  <span className="text-gray-500">
                    Latitude
                  </span>

                  <span className="font-mono font-semibold">
                    {currentLocation.lat.toFixed(
                      6
                    )}
                  </span>

                </div>

                <div className="flex justify-between bg-gray-50 rounded-xl p-4">

                  <span className="text-gray-500">
                    Longitude
                  </span>

                  <span className="font-mono font-semibold">
                    {currentLocation.lng.toFixed(
                      6
                    )}
                  </span>

                </div>

                <div className="flex justify-between bg-gray-50 rounded-xl p-4">

                  <span className="text-gray-500">
                    Last Updated
                  </span>

                  <span className="font-semibold">
                    {formatTime(
                      currentLocation.timestamp
                    )}
                  </span>

                </div>

              </div>
            ) : (
              <div className="py-12 text-center text-gray-400">

                <Navigation
                  size={40}
                  className="mx-auto mb-3"
                />

                <p>
                  Waiting for TRUCK-001
                </p>

                <p className="text-sm mt-1">
                  Start tracking from the driver phone
                </p>

              </div>
            )}

          </div>

          {/* Tracking Status */}

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">

            <div className="flex items-center gap-3 mb-5">

              <div className="p-3 bg-green-50 rounded-xl">
                <Activity
                  size={22}
                  className="text-green-600"
                />
              </div>

              <div>

                <h3 className="font-bold text-lg">
                  Tracking Status
                </h3>

                <p className="text-sm text-gray-500">
                  Live connection information
                </p>

              </div>

            </div>

            <div className="space-y-4">

              <div className="flex justify-between items-center">

                <span className="text-gray-500">
                  Vehicle
                </span>

                <span className="font-semibold">
                  {TRUCK_ID}
                </span>

              </div>

              <div className="flex justify-between items-center">

                <span className="text-gray-500">
                  Server
                </span>

                <span
                  className={`font-semibold ${
                    serverStatus ===
                    "Connected"
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {serverStatus}
                </span>

              </div>

              <div className="flex justify-between items-center">

                <span className="text-gray-500">
                  GPS Status
                </span>

                <span
                  className={`font-semibold ${
                    currentLocation
                      ? "text-green-600"
                      : "text-gray-500"
                  }`}
                >
                  {currentLocation
                    ? "Receiving GPS"
                    : "No GPS data"}
                </span>

              </div>

              <div className="flex justify-between items-center">

                <span className="text-gray-500">
                  Points Recorded
                </span>

                <span className="font-semibold">
                  {history.length}
                </span>

              </div>

              <div className="flex justify-between items-center">

                <span className="text-gray-500">
                  Update Frequency
                </span>

                <span className="font-semibold">
                  3 seconds
                </span>

              </div>

            </div>

          </div>

        </div>

        {/* =========================================== */}
        {/* GPS HISTORY */}
        {/* =========================================== */}

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm mt-6 overflow-hidden">

          <div className="p-5 border-b border-gray-200">

            <div className="flex items-center gap-3">

              <div className="p-2.5 bg-purple-50 rounded-xl">
                <Route
                  size={21}
                  className="text-purple-600"
                />
              </div>

              <div>

                <h2 className="font-bold text-lg">
                  GPS Movement History
                </h2>

                <p className="text-sm text-gray-500">
                  Recorded positions from driver phone
                </p>

              </div>

            </div>

          </div>

          {history.length > 0 ? (

            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="bg-gray-50">

                  <tr>

                    <th className="text-left px-5 py-3 font-semibold text-gray-500">
                      #
                    </th>

                    <th className="text-left px-5 py-3 font-semibold text-gray-500">
                      Latitude
                    </th>

                    <th className="text-left px-5 py-3 font-semibold text-gray-500">
                      Longitude
                    </th>

                    <th className="text-left px-5 py-3 font-semibold text-gray-500">
                      Time
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {[...history]
                    .reverse()
                    .slice(0, 20)
                    .map(
                      (
                        point,
                        index
                      ) => (
                        <tr
                          key={`${point.timestamp}-${index}`}
                          className="border-t border-gray-100"
                        >

                          <td className="px-5 py-3 font-medium">
                            {index + 1}
                          </td>

                          <td className="px-5 py-3 font-mono">
                            {point.lat.toFixed(
                              6
                            )}
                          </td>

                          <td className="px-5 py-3 font-mono">
                            {point.lng.toFixed(
                              6
                            )}
                          </td>

                          <td className="px-5 py-3 text-gray-500">
                            {formatTime(
                              point.timestamp
                            )}
                          </td>

                        </tr>
                      )
                    )}

                </tbody>

              </table>

            </div>

          ) : (

            <div className="py-12 text-center text-gray-400">

              <MapPin
                size={38}
                className="mx-auto mb-3"
              />

              <p className="font-medium">
                No GPS data
              </p>

              <p className="text-sm mt-1">
                Start tracking from the driver phone
              </p>

            </div>

          )}

        </div>

        {/* =========================================== */}
        {/* FOOTER */}
        {/* =========================================== */}

        <div className="text-center text-xs text-gray-400 py-8">

          <p>
            NER-Logix • Live GPS Vehicle Tracking
          </p>

          <p className="mt-1">
            Monitoring {TRUCK_ID}
          </p>

        </div>

      </main>

    </div>
  );
}