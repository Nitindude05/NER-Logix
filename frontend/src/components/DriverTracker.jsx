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

const API_URL = "https://ner-logix-vgvp.onrender.com";

const POLLING_INTERVAL = 3000;

// =====================================================
// TRUCK COLORS
// =====================================================

const truckColors = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#db2777",
  "#ca8a04",
];

// =====================================================
// CREATE TRUCK ICON
// =====================================================

function createTruckIcon(color) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: ${color};
        border: 4px solid white;
        box-shadow: 0 3px 14px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
      ">
        🚛
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
  });
}

// =====================================================
// START ICON
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
      font-weight: bold;
      font-size: 14px;
    ">
      S
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

// =====================================================
// MAP FIT
// =====================================================

function MapController({ trucks }) {
  const map = useMap();

  useEffect(() => {
    if (!trucks.length) return;

    const validTrucks = trucks.filter(
      (truck) =>
        Number.isFinite(truck.lat) &&
        Number.isFinite(truck.lng)
    );

    if (!validTrucks.length) return;

    const bounds = L.latLngBounds(
      validTrucks.map((truck) => [
        truck.lat,
        truck.lng,
      ])
    );

    map.fitBounds(bounds, {
      padding: [60, 60],
      maxZoom: 15,
    });
  }, [trucks.length]);

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
// DISTANCE
// =====================================================

function calculateDistance(point1, point2) {
  if (!point1 || !point2) return 0;

  const R = 6371;

  const lat1 =
    (point1.lat * Math.PI) / 180;

  const lat2 =
    (point2.lat * Math.PI) / 180;

  const deltaLat =
    ((point2.lat - point1.lat) *
      Math.PI) /
    180;

  const deltaLng =
    ((point2.lng - point1.lng) *
      Math.PI) /
    180;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) ** 2;

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
  const [trucks, setTrucks] = useState([]);

  const [histories, setHistories] =
    useState({});

  const [serverStatus, setServerStatus] =
    useState("Checking...");

  const [lastUpdate, setLastUpdate] =
    useState(null);

  const [error, setError] = useState("");

  const [loading, setLoading] =
    useState(true);

  // ===================================================
  // GET ALL TRUCKS
  // ===================================================

  const fetchLiveLocations = async () => {
    try {
      const response = await fetch(
        `${API_URL}/get`
      );

      if (!response.ok) {
        throw new Error(
          `Server returned ${response.status}`
        );
      }

      const result =
        await response.json();

      console.log(
        "ALL LIVE TRUCKS:",
        result.data
      );

      if (
        Array.isArray(result.data)
      ) {
        const validTrucks =
          result.data
            .map((truck) => ({
              id: truck.id,

              lat: Number(
                truck.lat
              ),

              lng: Number(
                truck.lng
              ),

              updatedAt: Number(
                truck.updatedAt
              ),
            }))
            .filter(
              (truck) =>
                truck.id &&
                Number.isFinite(
                  truck.lat
                ) &&
                Number.isFinite(
                  truck.lng
                )
            );

        setTrucks(validTrucks);

        if (validTrucks.length > 0) {
          setLastUpdate(
            Math.max(
              ...validTrucks.map(
                (truck) =>
                  truck.updatedAt
              )
            )
          );
        }

        setServerStatus(
          "Connected"
        );

        setError("");
      }

      setLoading(false);
    } catch (err) {
      console.error(
        "Live truck fetch error:",
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
  // GET HISTORY FOR ONE TRUCK
  // ===================================================

  const fetchTruckHistory = async (
    truckId
  ) => {
    try {
      const response = await fetch(
        `${API_URL}/history/${encodeURIComponent(
          truckId
        )}`
      );

      if (!response.ok) {
        throw new Error(
          `History returned ${response.status}`
        );
      }

      const result =
        await response.json();

      if (
        Array.isArray(result.data)
      ) {
        const points =
          result.data
            .map((point) => ({
              lat: Number(
                point.lat
              ),

              lng: Number(
                point.lng
              ),

              timestamp: Number(
                point.timestamp
              ),
            }))
            .filter(
              (point) =>
                Number.isFinite(
                  point.lat
                ) &&
                Number.isFinite(
                  point.lng
                )
            );

        setHistories(
          (previous) => ({
            ...previous,
            [truckId]: points,
          })
        );
      }
    } catch (err) {
      console.error(
        `History error for ${truckId}:`,
        err
      );
    }
  };

  // ===================================================
  // FETCH ALL HISTORIES
  // ===================================================

  const fetchAllHistories = async (
    truckList
  ) => {
    if (!truckList.length) return;

    await Promise.all(
      truckList.map((truck) =>
        fetchTruckHistory(
          truck.id
        )
      )
    );
  };

  // ===================================================
  // POLLING
  // ===================================================

  useEffect(() => {
    const updateDashboard =
      async () => {
        try {
          const response =
            await fetch(
              `${API_URL}/get`
            );

          if (!response.ok) {
            throw new Error(
              "Server error"
            );
          }

          const result =
            await response.json();

          if (
            Array.isArray(
              result.data
            )
          ) {
            const truckList =
              result.data
                .map((truck) => ({
                  id: truck.id,
                  lat: Number(
                    truck.lat
                  ),
                  lng: Number(
                    truck.lng
                  ),
                  updatedAt:
                    Number(
                      truck.updatedAt
                    ),
                }))
                .filter(
                  (truck) =>
                    truck.id &&
                    Number.isFinite(
                      truck.lat
                    ) &&
                    Number.isFinite(
                      truck.lng
                    )
                );

            setTrucks(truckList);

            if (
              truckList.length
            ) {
              setLastUpdate(
                Math.max(
                  ...truckList.map(
                    (truck) =>
                      truck.updatedAt
                  )
                )
              );

              setServerStatus(
                "Connected"
              );

              setError("");
            }

            setLoading(false);

            await Promise.all(
              truckList.map(
                (truck) =>
                  fetchTruckHistory(
                    truck.id
                  )
              )
            );
          }
        } catch (err) {
          console.error(err);

          setServerStatus(
            "Offline"
          );

          setError(
            "Unable to connect to GPS server."
          );

          setLoading(false);
        }
      };

    updateDashboard();

    const interval =
      setInterval(
        updateDashboard,
        POLLING_INTERVAL
      );

    return () => {
      clearInterval(
        interval
      );
    };
  }, []);

  // ===================================================
  // TOTAL GPS POINTS
  // ===================================================

  const totalPoints =
    useMemo(() => {
      return Object.values(
        histories
      ).reduce(
        (total, points) =>
          total + points.length,
        0
      );
    }, [histories]);

  // ===================================================
  // TOTAL DISTANCE
  // ===================================================

  const totalDistance =
    useMemo(() => {
      let total = 0;

      Object.values(
        histories
      ).forEach((points) => {
        for (
          let i = 1;
          i < points.length;
          i++
        ) {
          total +=
            calculateDistance(
              points[i - 1],
              points[i]
            );
        }
      });

      return total;
    }, [histories]);

  // ===================================================
  // REFRESH
  // ===================================================

  const handleRefresh = () => {
    setLoading(true);

    fetchLiveLocations();
  };

  // ===================================================
  // MAP CENTER
  // ===================================================

  const defaultCenter = [
    23.2599,
    77.4126,
  ];

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
                className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg"
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
        {/* SUMMARY */}
        {/* =========================================== */}

        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <div>

              <p className="text-sm text-gray-500">
                Active Vehicles
              </p>

              <h2 className="text-3xl font-bold">
                {trucks.length}
              </h2>

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
        {/* STAT CARDS */}
        {/* =========================================== */}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">

            <div className="flex items-center gap-3">

              <div className="p-3 bg-blue-50 rounded-xl">
                <Truck
                  size={21}
                  className="text-blue-600"
                />
              </div>

              <div>

                <p className="text-sm text-gray-500">
                  Active Trucks
                </p>

                <p className="text-2xl font-bold">
                  {trucks.length}
                </p>

              </div>

            </div>

          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">

            <div className="flex items-center gap-3">

              <div className="p-3 bg-green-50 rounded-xl">
                <Activity
                  size={21}
                  className="text-green-600"
                />
              </div>

              <div>

                <p className="text-sm text-gray-500">
                  GPS Points
                </p>

                <p className="text-2xl font-bold">
                  {totalPoints}
                </p>

              </div>

            </div>

          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">

            <div className="flex items-center gap-3">

              <div className="p-3 bg-purple-50 rounded-xl">
                <Route
                  size={21}
                  className="text-purple-600"
                />
              </div>

              <div>

                <p className="text-sm text-gray-500">
                  Total Distance
                </p>

                <p className="text-2xl font-bold">
                  {totalDistance.toFixed(
                    2
                  )}{" "}
                  <span className="text-sm">
                    km
                  </span>
                </p>

              </div>

            </div>

          </div>

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
                  Update Rate
                </p>

                <p className="text-2xl font-bold">
                  3s
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
            {error}
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
                    All connected driver devices
                  </p>

                </div>

              </div>

              <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">

                <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />

                Live

              </div>

            </div>

          </div>

          <div className="h-[550px]">

            <MapContainer
              center={defaultCenter}
              zoom={5}
              scrollWheelZoom={true}
              className="w-full h-full"
            >

              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapController
                trucks={trucks}
              />

              {/* ================================= */}
              {/* ALL TRUCKS */}
              {/* ================================= */}

              {trucks.map(
                (truck, index) => {

                  const color =
                    truckColors[
                      index %
                        truckColors.length
                    ];

                  const icon =
                    createTruckIcon(
                      color
                    );

                  const truckHistory =
                    histories[
                      truck.id
                    ] || [];

                  return (
                    <React.Fragment
                      key={truck.id}
                    >

                      {/* START POINT */}

                      {truckHistory.length >
                        0 && (
                        <Marker
                          position={[
                            truckHistory[0]
                              .lat,
                            truckHistory[0]
                              .lng,
                          ]}
                          icon={
                            startIcon
                          }
                        >
                          <Popup>

                            <strong>
                              {truck.id}
                            </strong>

                            <br />

                            Tracking Start

                          </Popup>

                        </Marker>
                      )}

                      {/* TRAVELLED ROUTE */}

                      {truckHistory.length >
                        1 && (
                        <Polyline
                          positions={truckHistory.map(
                            (
                              point
                            ) => [
                              point.lat,
                              point.lng,
                            ]
                          )}
                          pathOptions={{
                            color:
                              color,
                            weight: 5,
                            opacity: 0.75,
                          }}
                        />
                      )}

                      {/* HISTORY DOTS */}

                      {truckHistory.map(
                        (
                          point,
                          pointIndex
                        ) => (
                          <CircleMarker
                            key={`${truck.id}-${point.timestamp}-${pointIndex}`}
                            center={[
                              point.lat,
                              point.lng,
                            ]}
                            radius={3}
                            pathOptions={{
                              color:
                                color,
                              fillColor:
                                color,
                              fillOpacity: 0.8,
                            }}
                          />
                        )
                      )}

                      {/* TRUCK */}

                      <Marker
                        position={[
                          truck.lat,
                          truck.lng,
                        ]}
                        icon={icon}
                      >

                        <Popup>

                          <div className="min-w-[190px]">

                            <h3 className="font-bold text-lg mb-2">
                              🚛{" "}
                              {truck.id}
                            </h3>

                            <div className="text-sm space-y-1">

                              <p>
                                <strong>
                                  Latitude:
                                </strong>{" "}
                                {truck.lat.toFixed(
                                  6
                                )}
                              </p>

                              <p>
                                <strong>
                                  Longitude:
                                </strong>{" "}
                                {truck.lng.toFixed(
                                  6
                                )}
                              </p>

                              <p>
                                <strong>
                                  Updated:
                                </strong>{" "}
                                {formatTime(
                                  truck.updatedAt
                                )}
                              </p>

                              <p>
                                <strong>
                                  GPS Points:
                                </strong>{" "}
                                {
                                  truckHistory.length
                                }
                              </p>

                            </div>

                          </div>

                        </Popup>

                      </Marker>

                    </React.Fragment>
                  );
                }
              )}

            </MapContainer>

          </div>

        </div>

        {/* =========================================== */}
        {/* TRUCK LIST */}
        {/* =========================================== */}

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

          <div className="p-5 border-b border-gray-200">

            <div className="flex items-center gap-3">

              <div className="p-2.5 bg-blue-50 rounded-xl">

                <Truck
                  size={21}
                  className="text-blue-600"
                />

              </div>

              <div>

                <h2 className="font-bold text-lg">
                  Active Vehicles
                </h2>

                <p className="text-sm text-gray-500">
                  Live driver device status
                </p>

              </div>

            </div>

          </div>

          {trucks.length > 0 ? (

            <div className="divide-y divide-gray-100">

              {trucks.map(
                (truck, index) => {

                  const color =
                    truckColors[
                      index %
                        truckColors.length
                    ];

                  const truckHistory =
                    histories[
                      truck.id
                    ] || [];

                  return (
                    <div
                      key={truck.id}
                      className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                    >

                      <div className="flex items-center gap-4">

                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                          style={{
                            backgroundColor:
                              `${color}20`,
                          }}
                        >
                          🚛
                        </div>

                        <div>

                          <h3 className="font-bold">
                            {truck.id}
                          </h3>

                          <p className="text-sm text-gray-500">

                            {truck.lat.toFixed(
                              6
                            )}

                            ,{" "}

                            {truck.lng.toFixed(
                              6
                            )}

                          </p>

                        </div>

                      </div>

                      <div className="flex items-center gap-6">

                        <div>

                          <p className="text-xs text-gray-400">
                            GPS Points
                          </p>

                          <p className="font-semibold">
                            {
                              truckHistory.length
                            }
                          </p>

                        </div>

                        <div>

                          <p className="text-xs text-gray-400">
                            Last Update
                          </p>

                          <p className="font-semibold">
                            {formatTime(
                              truck.updatedAt
                            )}
                          </p>

                        </div>

                        <div className="flex items-center gap-2 text-green-600 font-semibold text-sm">

                          <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />

                          LIVE

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          ) : (

            <div className="py-14 text-center text-gray-400">

              <Truck
                size={42}
                className="mx-auto mb-3"
              />

              <p className="font-medium">
                No active vehicles
              </p>

              <p className="text-sm mt-1">
                Start tracking from driver phones
              </p>

            </div>

          )}

        </div>

        {/* FOOTER */}

        <div className="text-center text-xs text-gray-400 py-8">

          NER-Logix • Multi-Vehicle GPS Tracking

        </div>

      </main>

    </div>
  );
}