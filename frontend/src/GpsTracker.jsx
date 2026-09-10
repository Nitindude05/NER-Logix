import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  Clock3,
  MapPin,
  Navigation,
  Radio,
  RefreshCw,
  Satellite,
  Truck,
  Wifi,
  WifiOff,
  Route,
  CircleDot,
} from "lucide-react";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  useMap,
} from "react-leaflet";

import L from "leaflet";

// ============================================================
// CONFIG
// ============================================================

const API_URL = "https://ner-logix-vgvp.onrender.com";

const REFRESH_INTERVAL = 3000;

// Consider a truck offline if no update for this long.
const OFFLINE_AFTER = 15000;

// Different colors for different trucks.
const TRUCK_COLORS = [
  "#2563EB",
  "#DC2626",
  "#16A34A",
  "#9333EA",
  "#EA580C",
  "#0891B2",
  "#CA8A04",
  "#DB2777",
];

// ============================================================
// HELPERS
// ============================================================

function getTruckColor(index) {
  return TRUCK_COLORS[index % TRUCK_COLORS.length];
}

function isTruckLive(updatedAt) {
  if (!updatedAt) return false;

  return Date.now() - Number(updatedAt) < OFFLINE_AFTER;
}

function formatTime(timestamp) {
  if (!timestamp) return "--";

  return new Date(Number(timestamp)).toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }
  );
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return "--";

  const seconds = Math.floor(
    (Date.now() - Number(timestamp)) / 1000
  );

  if (seconds < 5) return "Just now";

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  return `${Math.floor(minutes / 60)}h ago`;
}

function calculateDistance(points) {
  if (!points || points.length < 2) return 0;

  const R = 6371;

  let total = 0;

  for (let i = 1; i < points.length; i++) {
    const lat1 = (points[i - 1].lat * Math.PI) / 180;
    const lat2 = (points[i].lat * Math.PI) / 180;

    const dLat =
      ((points[i].lat - points[i - 1].lat) *
        Math.PI) /
      180;

    const dLng =
      ((points[i].lng - points[i - 1].lng) *
        Math.PI) /
      180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(dLng / 2) ** 2;

    const c =
      2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    total += R * c;
  }

  return total;
}

// ============================================================
// TRUCK ICON
// ============================================================

function createTruckIcon(color, truckId, live) {
  return L.divIcon({
    className: "ner-truck-marker",

    html: `
      <div style="
        display:flex;
        flex-direction:column;
        align-items:center;
        transform:translateY(-8px);
      ">

        <div style="
          background:${color};
          width:48px;
          height:48px;
          border-radius:50%;
          border:4px solid white;
          box-shadow:0 4px 14px rgba(0,0,0,0.35);
          display:flex;
          align-items:center;
          justify-content:center;
          position:relative;
        ">

          <span style="
            font-size:22px;
            line-height:1;
          ">
            🚚
          </span>

          ${
            live
              ? `
                <span style="
                  position:absolute;
                  right:-3px;
                  top:-3px;
                  width:13px;
                  height:13px;
                  border-radius:50%;
                  background:#22c55e;
                  border:2px solid white;
                "></span>
              `
              : ""
          }

        </div>

        <div style="
          margin-top:4px;
          background:white;
          color:#111827;
          padding:3px 8px;
          border-radius:6px;
          font-size:11px;
          font-weight:700;
          white-space:nowrap;
          box-shadow:0 2px 8px rgba(0,0,0,0.25);
          border:1px solid #e5e7eb;
        ">
          ${truckId}
        </div>

      </div>
    `,

    iconSize: [100, 75],
    iconAnchor: [50, 67],
    popupAnchor: [0, -65],
  });
}

// ============================================================
// MAP AUTO FIT
// ============================================================

function MapAutoFit({ trucks }) {
  const map = useMap();

  useEffect(() => {
    if (!trucks || trucks.length === 0) return;

    const validTrucks = trucks.filter(
      (truck) =>
        Number.isFinite(Number(truck.lat)) &&
        Number.isFinite(Number(truck.lng))
    );

    if (validTrucks.length === 0) return;

    const bounds = L.latLngBounds(
      validTrucks.map((truck) => [
        Number(truck.lat),
        Number(truck.lng),
      ])
    );

    if (validTrucks.length === 1) {
      map.setView(
        [
          Number(validTrucks[0].lat),
          Number(validTrucks[0].lng),
        ],
        14
      );
    } else {
      map.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 14,
      });
    }
  }, [map, trucks]);

  return null;
}

// ============================================================
// STAT CARD
// ============================================================

function StatCard({
  icon: Icon,
  label,
  value,
  description,
}) {
  return (
    <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#172033] flex items-center justify-center">
          <Icon
            size={18}
            className="text-cyan-400"
          />
        </div>

        <div className="min-w-0">
          <p className="text-xs text-gray-500">
            {label}
          </p>

          <p className="text-xl font-bold text-white">
            {value}
          </p>

          {description && (
            <p className="text-[10px] text-gray-600 mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// STATUS BADGE
// ============================================================

function StatusBadge({ live }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
        live
          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          : "bg-red-500/10 text-red-400 border border-red-500/20"
      }`}
    >
      {live ? (
        <Wifi size={11} />
      ) : (
        <WifiOff size={11} />
      )}

      {live ? "LIVE" : "OFFLINE"}
    </span>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function GpsTracker() {
  const [trucks, setTrucks] = useState([]);

  const [histories, setHistories] = useState({});

  const [serverOnline, setServerOnline] =
    useState(false);

  const [loading, setLoading] = useState(true);

  const [lastRefresh, setLastRefresh] =
    useState(Date.now());

  const [selectedTruck, setSelectedTruck] =
    useState(null);

  // ----------------------------------------------------------
  // GET CURRENT TRUCKS
  // ----------------------------------------------------------

  const fetchTrucks = useCallback(async () => {
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

      const data = Array.isArray(result.data)
        ? result.data
        : [];

      const normalized = data
        .filter(
          (truck) =>
            truck &&
            truck.id &&
            Number.isFinite(Number(truck.lat)) &&
            Number.isFinite(Number(truck.lng))
        )
        .map((truck, index) => ({
          ...truck,
          lat: Number(truck.lat),
          lng: Number(truck.lng),
          color: getTruckColor(index),
        }));

      setTrucks(normalized);

      setServerOnline(true);

      setLastRefresh(Date.now());

      setLoading(false);

      return normalized;
    } catch (error) {
      console.error(
        "Unable to fetch trucks:",
        error
      );

      setServerOnline(false);

      setLoading(false);

      return [];
    }
  }, []);

  // ----------------------------------------------------------
  // FETCH HISTORY FOR EVERY TRUCK
  // ----------------------------------------------------------

  const fetchHistories = useCallback(
    async (truckList) => {
      if (!truckList || truckList.length === 0) {
        return;
      }

      const results = await Promise.all(
        truckList.map(async (truck) => {
          try {
            const response = await fetch(
              `${API_URL}/history/${encodeURIComponent(
                truck.id
              )}`
            );

            if (!response.ok) {
              throw new Error(
                `History returned ${response.status}`
              );
            }

            const result = await response.json();

            return {
              id: truck.id,
              points: Array.isArray(result.data)
                ? result.data.map((point) => ({
                    lat: Number(point.lat),
                    lng: Number(point.lng),
                    timestamp: Number(
                      point.timestamp
                    ),
                  }))
                : [],
            };
          } catch (error) {
            console.error(
              `History error for ${truck.id}:`,
              error
            );

            return {
              id: truck.id,
              points: [],
            };
          }
        })
      );

      const historyMap = {};

      results.forEach((item) => {
        historyMap[item.id] = item.points;
      });

      setHistories(historyMap);
    },
    []
  );

  // ----------------------------------------------------------
  // INITIAL + AUTO REFRESH
  // ----------------------------------------------------------

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      const currentTrucks =
        await fetchTrucks();

      if (mounted) {
        await fetchHistories(
          currentTrucks
        );
      }
    };

    refresh();

    const interval = setInterval(
      refresh,
      REFRESH_INTERVAL
    );

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [
    fetchTrucks,
    fetchHistories,
  ]);

  // ----------------------------------------------------------
  // LIVE TRUCK COUNT
  // ----------------------------------------------------------

  const liveTrucks = useMemo(() => {
    return trucks.filter((truck) =>
      isTruckLive(truck.updatedAt)
    );
  }, [trucks, lastRefresh]);

  // ----------------------------------------------------------
  // TOTAL GPS POINTS
  // ----------------------------------------------------------

  const totalPoints = useMemo(() => {
    return Object.values(histories).reduce(
      (total, points) =>
        total + points.length,
      0
    );
  }, [histories]);

  // ----------------------------------------------------------
  // TOTAL DISTANCE
  // ----------------------------------------------------------

  const totalDistance = useMemo(() => {
    return Object.values(histories).reduce(
      (total, points) =>
        total + calculateDistance(points),
      0
    );
  }, [histories]);

  // ----------------------------------------------------------
  // LAST UPDATE
  // ----------------------------------------------------------

  const latestUpdate = useMemo(() => {
    if (trucks.length === 0) return null;

    return Math.max(
      ...trucks.map((truck) =>
        Number(truck.updatedAt || 0)
      )
    );
  }, [trucks]);

  // ----------------------------------------------------------
  // MANUAL REFRESH
  // ----------------------------------------------------------

  const handleRefresh = async () => {
    setLoading(true);

    const currentTrucks =
      await fetchTrucks();

    await fetchHistories(
      currentTrucks
    );
  };

  // ----------------------------------------------------------
  // MAP CENTER
  // ----------------------------------------------------------

  const mapCenter =
    trucks.length > 0
      ? [trucks[0].lat, trucks[0].lng]
      : [23.5134, 77.8187];

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="min-h-screen bg-[#070b14] text-white">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="border-b border-[#1f2937] bg-[#0b1220] sticky top-0 z-[1000]">

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">

          <div className="flex items-center justify-between gap-4">

            <div className="flex items-center gap-3">

              <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <Satellite
                  size={22}
                  className="text-cyan-400"
                />
              </div>

              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                  NER-Logix Control Center
                </h1>

                <p className="text-xs text-gray-500">
                  Smart Logistics & Live Vehicle Intelligence
                </p>
              </div>

            </div>

            <div className="flex items-center gap-2">

              <div
                className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                  serverOnline
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}
              >

                <span
                  className={`w-2 h-2 rounded-full ${
                    serverOnline
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-red-400"
                  }`}
                />

                {serverOnline
                  ? "SYSTEM ONLINE"
                  : "SERVER OFFLINE"}
              </div>

              <button
                onClick={handleRefresh}
                className="w-9 h-9 rounded-lg border border-[#263244] bg-[#111827] hover:bg-[#172033] flex items-center justify-center transition"
                title="Refresh"
              >
                <RefreshCw
                  size={16}
                  className={
                    loading
                      ? "animate-spin text-cyan-400"
                      : "text-gray-400"
                  }
                />
              </button>

            </div>

          </div>

        </div>

      </header>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* ===================================================
            OVERVIEW
        =================================================== */}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">

          <StatCard
            icon={Truck}
            label="Active Trucks"
            value={liveTrucks.length}
            description={`${trucks.length} connected devices`}
          />

          <StatCard
            icon={Activity}
            label="GPS Points"
            value={totalPoints.toLocaleString()}
            description="Recorded locations"
          />

          <StatCard
            icon={Route}
            label="Travel Distance"
            value={`${totalDistance.toFixed(2)} km`}
            description="Across all trucks"
          />

          <StatCard
            icon={Clock3}
            label="Last Update"
            value={
              latestUpdate
                ? formatTime(latestUpdate)
                : "--"
            }
            description={
              latestUpdate
                ? formatTimeAgo(latestUpdate)
                : "Waiting for data"
            }
          />

        </div>

        {/* ===================================================
            MAP
        =================================================== */}

        <section className="bg-[#0b1220] border border-[#1f2937] rounded-2xl overflow-hidden mb-5">

          {/* MAP HEADER */}

          <div className="px-5 py-4 border-b border-[#1f2937] flex items-center justify-between">

            <div className="flex items-center gap-3">

              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <Navigation
                  size={19}
                  className="text-cyan-400"
                />
              </div>

              <div>
                <h2 className="font-bold">
                  Live Fleet Map
                </h2>

                <p className="text-xs text-gray-500">
                  Real-time location of all connected vehicles
                </p>
              </div>

            </div>

            <div className="flex items-center gap-2 text-xs text-emerald-400">

              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />

              {liveTrucks.length} TRUCK
              {liveTrucks.length !== 1
                ? "S"
                : ""}{" "}
              LIVE

            </div>

          </div>

          {/* MAP */}

          <div className="h-[500px] sm:h-[600px]">

            <MapContainer
              center={mapCenter}
              zoom={13}
              scrollWheelZoom={true}
              className="w-full h-full"
            >

              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapAutoFit
                trucks={trucks}
              />

              {/* ==========================================
                  TRUCKS
              ========================================== */}

              {trucks.map((truck, index) => {

                const live = isTruckLive(
                  truck.updatedAt
                );

                const history =
                  histories[truck.id] || [];

                const color =
                  getTruckColor(index);

                const markerIcon =
                  createTruckIcon(
                    color,
                    truck.id,
                    live
                  );

                return (
                  <React.Fragment
                    key={truck.id}
                  >

                    {/* TRAVELLED ROUTE */}

                    {/* {history.length >= 2 && (
                      <Polyline
                        positions={history.map(
                          (point) => [
                            point.lat,
                            point.lng,
                          ]
                        )}
                        pathOptions={{
                          color,
                          weight: 4,
                          opacity: 0.8,
                        }}
                      />
                    )} */}

                    {/* START POINT */}

                    {history.length > 0 && (
                      <CircleMarker
                        center={[
                          history[0].lat,
                          history[0].lng,
                        ]}
                        radius={7}
                        pathOptions={{
                          color: "#ffffff",
                          weight: 2,
                          fillColor: "#16a34a",
                          fillOpacity: 1,
                        }}
                      >

                        <Popup>
                          <div className="text-sm">
                            <strong>
                              {truck.id}
                            </strong>

                            <br />

                            <span>
                              Tracking Start
                            </span>

                            <br />

                            {history[0].lat.toFixed(
                              6
                            )}
                            ,{" "}
                            {history[0].lng.toFixed(
                              6
                            )}
                          </div>
                        </Popup>

                      </CircleMarker>
                    )}

                    {/* CURRENT TRUCK */}

                    <Marker
                      position={[
                        truck.lat,
                        truck.lng,
                      ]}
                      icon={markerIcon}
                      eventHandlers={{
                        click: () =>
                          setSelectedTruck(
                            truck.id
                          ),
                      }}
                    >

                      <Popup>

                        <div className="min-w-[220px]">

                          <div className="flex items-center justify-between gap-3 mb-3">

                            <div className="font-bold text-gray-900">
                              {truck.id}
                            </div>

                            <span
                              className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                                live
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {live
                                ? "LIVE"
                                : "OFFLINE"}
                            </span>

                          </div>

                          <div className="space-y-2 text-xs">

                            <div className="flex justify-between">
                              <span className="text-gray-500">
                                Latitude
                              </span>

                              <strong>
                                {truck.lat.toFixed(
                                  6
                                )}
                              </strong>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-gray-500">
                                Longitude
                              </span>

                              <strong>
                                {truck.lng.toFixed(
                                  6
                                )}
                              </strong>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-gray-500">
                                GPS Points
                              </span>

                              <strong>
                                {history.length}
                              </strong>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-gray-500">
                                Last Update
                              </span>

                              <strong>
                                {formatTimeAgo(
                                  truck.updatedAt
                                )}
                              </strong>
                            </div>

                          </div>

                        </div>

                      </Popup>

                    </Marker>

                  </React.Fragment>
                );
              })}

            </MapContainer>

          </div>

          {/* MAP LEGEND */}

          <div className="px-5 py-3 border-t border-[#1f2937] flex flex-wrap items-center gap-5 text-xs text-gray-500">

            <div className="flex items-center gap-2">
              <span className="text-base">
                🚚
              </span>
              Live Truck
            </div>

            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
              Start Point
            </div>

            <div className="flex items-center gap-2">
              <span className="w-7 h-[3px] bg-cyan-400 rounded" />
              Travelled Route
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Live
            </div>

          </div>

        </section>

        {/* ===================================================
            ACTIVE VEHICLES
        =================================================== */}

        <section className="bg-[#0b1220] border border-[#1f2937] rounded-2xl overflow-hidden">

          <div className="px-5 py-4 border-b border-[#1f2937]">

            <div className="flex items-center gap-3">

              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Truck
                  size={19}
                  className="text-blue-400"
                />
              </div>

              <div>
                <h2 className="font-bold">
                  Active Fleet
                </h2>

                <p className="text-xs text-gray-500">
                  Live driver device status
                </p>
              </div>

            </div>

          </div>

          {/* EMPTY STATE */}

          {trucks.length === 0 ? (

            <div className="py-16 text-center">

              <div className="w-14 h-14 rounded-full bg-gray-800 mx-auto flex items-center justify-center mb-4">

                <Truck
                  size={25}
                  className="text-gray-600"
                />

              </div>

              <h3 className="font-semibold text-gray-400">
                No vehicles connected
              </h3>

              <p className="text-xs text-gray-600 mt-1">
                Open a driver tracking link on a mobile device.
              </p>

            </div>

          ) : (

            <div className="divide-y divide-[#1f2937]">

              {trucks.map((truck, index) => {

                const live =
                  isTruckLive(
                    truck.updatedAt
                  );

                const history =
                  histories[truck.id] || [];

                const distance =
                  calculateDistance(
                    history
                  );

                const color =
                  getTruckColor(index);

                return (
                  <div
                    key={truck.id}
                    onClick={() =>
                      setSelectedTruck(
                        selectedTruck ===
                          truck.id
                          ? null
                          : truck.id
                      )
                    }
                    className={`p-4 sm:p-5 cursor-pointer transition ${
                      selectedTruck ===
                      truck.id
                        ? "bg-[#111827]"
                        : "hover:bg-[#0f172a]"
                    }`}
                  >

                    <div className="flex items-center justify-between gap-4">

                      {/* LEFT */}

                      <div className="flex items-center gap-3 min-w-0">

                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                          style={{
                            backgroundColor:
                              `${color}20`,
                            border: `1px solid ${color}40`,
                          }}
                        >
                          🚚
                        </div>

                        <div className="min-w-0">

                          <div className="flex items-center gap-2 flex-wrap">

                            <h3 className="font-bold text-sm sm:text-base">
                              {truck.id}
                            </h3>

                            <StatusBadge
                              live={live}
                            />

                          </div>

                          <p className="font-mono text-[11px] text-gray-500 mt-1">

                            {truck.lat.toFixed(
                              6
                            )}

                            {" , "}

                            {truck.lng.toFixed(
                              6
                            )}

                          </p>

                        </div>

                      </div>

                      {/* RIGHT */}

                      <div className="hidden sm:flex items-center gap-7 text-right">

                        <div>
                          <p className="text-[10px] text-gray-600">
                            GPS POINTS
                          </p>

                          <p className="font-semibold text-sm">
                            {history.length}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] text-gray-600">
                            DISTANCE
                          </p>

                          <p className="font-semibold text-sm">
                            {distance.toFixed(2)} km
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] text-gray-600">
                            LAST UPDATE
                          </p>

                          <p className="font-semibold text-sm">
                            {formatTime(
                              truck.updatedAt
                            )}
                          </p>
                        </div>

                      </div>

                    </div>

                    {/* MOBILE DETAILS */}

                    <div className="grid grid-cols-3 gap-3 mt-4 sm:hidden">

                      <div className="bg-[#070b14] rounded-lg p-3">

                        <p className="text-[9px] text-gray-600">
                          GPS POINTS
                        </p>

                        <p className="text-sm font-bold mt-1">
                          {history.length}
                        </p>

                      </div>

                      <div className="bg-[#070b14] rounded-lg p-3">

                        <p className="text-[9px] text-gray-600">
                          DISTANCE
                        </p>

                        <p className="text-sm font-bold mt-1">
                          {distance.toFixed(
                            1
                          )}{" "}
                          km
                        </p>

                      </div>

                      <div className="bg-[#070b14] rounded-lg p-3">

                        <p className="text-[9px] text-gray-600">
                          UPDATED
                        </p>

                        <p className="text-sm font-bold mt-1">
                          {formatTimeAgo(
                            truck.updatedAt
                          )}
                        </p>

                      </div>

                    </div>

                  </div>
                );
              })}

            </div>
          )}

        </section>

        {/* ===================================================
            FOOTER
        =================================================== */}

        <div className="flex items-center justify-center gap-2 text-[10px] text-gray-700 py-6">

          <CircleDot size={10} />

          NER-Logix · Multi-Vehicle GPS Tracking

          <span>·</span>

          Updates every {REFRESH_INTERVAL / 1000}s

        </div>

      </main>

    </div>
  );
}