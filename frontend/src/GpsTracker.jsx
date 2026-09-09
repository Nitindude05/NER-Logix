import {
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";

import {
  Satellite,
  Navigation,
  Radio,
  MapPin,
  TriangleAlert,
  Wifi,
  WifiOff,
  Truck,
  Target,
  Route,
  Activity,
} from "lucide-react";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";

import L from "leaflet";

// ============================================================
// CONFIGURATION
// ============================================================

const TRUCK_ID = "TRUCK-001";

// ============================================================
// SEVEN SISTERS ROUTE
// ============================================================

const SEVEN_SISTERS_ROUTE = [
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

// ============================================================
// DESTINATION
// ============================================================

const DESTINATION =
  SEVEN_SISTERS_ROUTE[
    SEVEN_SISTERS_ROUTE.length - 1
  ];

// ============================================================
// API HELPER
// ============================================================

async function callApi(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(
      `${url} returned ${response.status}`
    );
  }

  return response.json();
}

// ============================================================
// DISTANCE CALCULATION
// ============================================================

function calculateDistance(
  lat1,
  lng1,
  lat2,
  lng2
) {
  const R = 6371;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLng =
    ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
}

// ============================================================
// TOTAL TRAVELLED DISTANCE
// ============================================================

function calculateTotalDistance(points) {
  if (!points || points.length < 2) {
    return 0;
  }

  let total = 0;

  for (let i = 1; i < points.length; i++) {
    total += calculateDistance(
      points[i - 1][0],
      points[i - 1][1],
      points[i][0],
      points[i][1]
    );
  }

  return total;
}

// ============================================================
// TRUCK ICON
// ============================================================

function createTruckIcon() {
  return L.divIcon({
    className: "",
    html: `
      <div
        style="
          width:42px;
          height:42px;
          border-radius:50%;
          background:#06b6d4;
          border:3px solid white;
          box-shadow:0 4px 18px rgba(0,0,0,0.45);
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:22px;
        "
      >
        🚚
      </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -22],
  });
}

// ============================================================
// START ICON
// ============================================================

function createStartIcon() {
  return L.divIcon({
    className: "",
    html: `
      <div
        style="
          width:34px;
          height:34px;
          border-radius:50%;
          background:#22c55e;
          border:3px solid white;
          box-shadow:0 3px 12px rgba(0,0,0,0.4);
          display:flex;
          align-items:center;
          justify-content:center;
          color:white;
          font-size:18px;
          font-weight:bold;
        "
      >
        S
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });
}

// ============================================================
// DESTINATION ICON
// ============================================================

function createDestinationIcon() {
  return L.divIcon({
    className: "",
    html: `
      <div
        style="
          width:38px;
          height:38px;
          border-radius:50%;
          background:#ef4444;
          border:3px solid white;
          box-shadow:0 3px 15px rgba(0,0,0,0.45);
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:20px;
        "
      >
        🎯
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -19],
  });
}

// ============================================================
// STOP ICON
// ============================================================

function createStopIcon(number) {
  return L.divIcon({
    className: "",
    html: `
      <div
        style="
          width:28px;
          height:28px;
          border-radius:50%;
          background:#334155;
          border:2px solid #94a3b8;
          display:flex;
          align-items:center;
          justify-content:center;
          color:white;
          font-size:12px;
          font-weight:bold;
        "
      >
        ${number}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// ============================================================
// MAP FOLLOW CONTROLLER
// ============================================================

function MapController({ position }) {
  const map = useMap();

  useEffect(() => {
    if (!position) {
      return;
    }

    map.flyTo(
      [position.lat, position.lng],
      map.getZoom() < 8 ? 8 : map.getZoom(),
      {
        duration: 1,
      }
    );
  }, [position, map]);

  return null;
}

// ============================================================
// ROUTE MAP
// ============================================================

function TrackingMap({
  currentPosition,
  history,
}) {
  // ----------------------------------------------------------
  // START POINT
  // ----------------------------------------------------------

  const startPoint =
    history.length > 0
      ? history[0]
      : currentPosition
      ? [
          currentPosition.lat,
          currentPosition.lng,
        ]
      : null;

  // ----------------------------------------------------------
  // CURRENT POSITION
  // ----------------------------------------------------------

  const currentPoint = currentPosition
    ? [
        currentPosition.lat,
        currentPosition.lng,
      ]
    : null;

  // ----------------------------------------------------------
  // DESTINATION
  // ----------------------------------------------------------

  const destinationPoint = [
    DESTINATION.lat,
    DESTINATION.lng,
  ];

  // ----------------------------------------------------------
  // INITIAL MAP CENTER
  // ----------------------------------------------------------

  const mapCenter =
    currentPoint ||
    [
      SEVEN_SISTERS_ROUTE[0].lat,
      SEVEN_SISTERS_ROUTE[0].lng,
    ];

  // ----------------------------------------------------------
  // PLANNED ROUTE
  // ----------------------------------------------------------

  const plannedRoute =
    SEVEN_SISTERS_ROUTE.map(
      (point) => [
        point.lat,
        point.lng,
      ]
    );

  return (
    <MapContainer
      center={mapCenter}
      zoom={7}
      scrollWheelZoom={true}
      className="h-full w-full"
    >

      {/* ================================================== */}
      {/* OPEN STREET MAP */}
      {/* ================================================== */}

      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* ================================================== */}
      {/* FOLLOW TRUCK */}
      {/* ================================================== */}

      <MapController
        position={currentPosition}
      />

      {/* ================================================== */}
      {/* PLANNED ROUTE */}
      {/* ================================================== */}

      <Polyline
        positions={plannedRoute}
        pathOptions={{
          color: "#64748b",
          weight: 4,
          opacity: 0.75,
          dashArray: "10 10",
        }}
      />

      {/* ================================================== */}
      {/* ACTUAL TRAVELLED PATH */}
      {/* ================================================== */}

      {history.length >= 2 && (
        <Polyline
          positions={history}
          pathOptions={{
            color: "#06b6d4",
            weight: 6,
            opacity: 0.95,
          }}
        />
      )}

      {/* ================================================== */}
      {/* START MARKER */}
      {/* ================================================== */}

      {startPoint && (
        <Marker
          position={startPoint}
          icon={createStartIcon()}
        >
          <Popup>
            <div>
              <strong>
                Tracking Started
              </strong>

              <br />

              <span>
                First GPS location
              </span>

              <br />

              <small>
                {startPoint[0].toFixed(6)},
                {" "}
                {startPoint[1].toFixed(6)}
              </small>
            </div>
          </Popup>
        </Marker>
      )}

      {/* ================================================== */}
      {/* ROUTE STOP MARKERS */}
      {/* ================================================== */}

      {SEVEN_SISTERS_ROUTE.map(
        (stop, index) => {
          const isDestination =
            index ===
            SEVEN_SISTERS_ROUTE.length - 1;

          if (isDestination) {
            return null;
          }

          return (
            <Marker
              key={stop.name}
              position={[
                stop.lat,
                stop.lng,
              ]}
              icon={createStopIcon(
                index + 1
              )}
            >
              <Popup>
                <strong>
                  {stop.name}
                </strong>

                <br />

                <span>
                  {stop.state}
                </span>
              </Popup>
            </Marker>
          );
        }
      )}

      {/* ================================================== */}
      {/* DESTINATION */}
      {/* ================================================== */}

      <Marker
        position={destinationPoint}
        icon={createDestinationIcon()}
      >
        <Popup>
          <div>
            <strong>
              🎯 Destination
            </strong>

            <br />

            <span>
              {DESTINATION.name}
            </span>

            <br />

            <span>
              {DESTINATION.state}
            </span>
          </div>
        </Popup>
      </Marker>

      {/* ================================================== */}
      {/* LIVE TRUCK */}
      {/* ================================================== */}

      {currentPoint && (
        <Marker
          position={currentPoint}
          icon={createTruckIcon()}
        >
          <Popup>
            <div>
              <strong>
                🚚 {TRUCK_ID}
              </strong>

              <br />

              <span>
                Live GPS Location
              </span>

              <br />

              <small>
                Lat:{" "}
                {currentPosition.lat.toFixed(
                  6
                )}
              </small>

              <br />

              <small>
                Lng:{" "}
                {currentPosition.lng.toFixed(
                  6
                )}
              </small>
            </div>
          </Popup>
        </Marker>
      )}

    </MapContainer>
  );
}

// ============================================================
// MAIN GPS TRACKER
// ============================================================

export default function GpsTracker() {

  // ----------------------------------------------------------
  // STATE
  // ----------------------------------------------------------

  const [currentPosition, setCurrentPosition] =
    useState(null);

  const [history, setHistory] =
    useState([]);

  const [backendOnline, setBackendOnline] =
    useState(null);

  const [lastUpdate, setLastUpdate] =
    useState(null);

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  // Prevent unnecessary duplicate requests
  const historyRequest = useRef(false);

  // ----------------------------------------------------------
  // GET CURRENT TRUCK LOCATION
  // ----------------------------------------------------------

  const fetchCurrentLocation =
    async () => {
      try {
        const result =
          await callApi("/get");

        setBackendOnline(true);

        const truck =
          (result.data || []).find(
            (device) =>
              String(device.id) ===
              String(TRUCK_ID)
          );

        if (!truck) {
          setCurrentPosition(null);
          return;
        }

        const position = {
          lat: Number(truck.lat),
          lng: Number(truck.lng),
        };

        setCurrentPosition(position);

        setLastUpdate(
          truck.updatedAt ||
            Date.now()
        );

        setError("");
      } catch (err) {
        console.error(err);

        setBackendOnline(false);

        setError(
          "Unable to connect to GPS server."
        );
      } finally {
        setLoading(false);
      }
    };

  // ----------------------------------------------------------
  // GET TRUCK HISTORY
  // ----------------------------------------------------------

  const fetchHistory =
    async () => {

      if (historyRequest.current) {
        return;
      }

      historyRequest.current = true;

      try {
        const result =
          await callApi(
            `/history/${TRUCK_ID}`
          );

        const points =
          (result.data || []).map(
            (point) => [
              Number(point.lat),
              Number(point.lng),
            ]
          );

        setHistory(points);

      } catch (err) {
        console.error(
          "History error:",
          err
        );
      } finally {
        historyRequest.current = false;
      }
    };

  // ----------------------------------------------------------
  // START POLLING
  // ----------------------------------------------------------

  useEffect(() => {

    fetchCurrentLocation();
    fetchHistory();

    const interval =
      setInterval(() => {
        fetchCurrentLocation();
        fetchHistory();
      }, 3000);

    return () =>
      clearInterval(interval);

  }, []);

  // ----------------------------------------------------------
  // TRAVELLED DISTANCE
  // ----------------------------------------------------------

  const travelledDistance =
    useMemo(() => {
      return calculateTotalDistance(
        history
      );
    }, [history]);

  // ----------------------------------------------------------
  // DISTANCE TO DESTINATION
  // ----------------------------------------------------------

  const remainingDistance =
    useMemo(() => {

      if (!currentPosition) {
        return 0;
      }

      return calculateDistance(
        currentPosition.lat,
        currentPosition.lng,
        DESTINATION.lat,
        DESTINATION.lng
      );

    }, [currentPosition]);

  // ----------------------------------------------------------
  // FORMAT TIME
  // ----------------------------------------------------------

  const formattedLastUpdate =
    lastUpdate
      ? new Date(
          lastUpdate
        ).toLocaleTimeString()
      : "--";

  // ----------------------------------------------------------
  // UI
  // ----------------------------------------------------------

  return (
    <div className="w-full min-h-[720px] bg-[#0B1220] text-slate-200 font-sans flex flex-col rounded-lg overflow-hidden border border-[#1E293B]">

      {/* ==================================================== */}
      {/* HEADER */}
      {/* ==================================================== */}

      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E293B] bg-[#0E1729]">

        <div className="flex items-center gap-3">

          <div className="w-9 h-9 rounded-lg bg-cyan-400/10 flex items-center justify-center">
            <Satellite
              size={19}
              className="text-cyan-400"
            />
          </div>

          <div>

            <h1 className="text-sm font-semibold text-slate-100">
              GPS Tracking Console
            </h1>

            <p className="text-xs text-slate-500">
              Live Vehicle Monitoring
            </p>

          </div>

        </div>

        {/* CONNECTION STATUS */}

        <div className="flex items-center gap-2">

          {backendOnline ? (
            <>
              <Wifi
                size={15}
                className="text-emerald-400"
              />

              <span className="text-xs text-emerald-400">
                LIVE
              </span>
            </>
          ) : backendOnline === false ? (
            <>
              <WifiOff
                size={15}
                className="text-red-400"
              />

              <span className="text-xs text-red-400">
                OFFLINE
              </span>
            </>
          ) : (
            <>
              <Radio
                size={15}
                className="text-amber-400"
              />

              <span className="text-xs text-amber-400">
                CONNECTING
              </span>
            </>
          )}

        </div>

      </div>

      {/* ==================================================== */}
      {/* TRUCK INFO */}
      {/* ==================================================== */}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#1E293B]">

        {/* TRUCK */}

        <div className="bg-[#0E1729] p-4">

          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">

            <Truck size={14} />

            Truck

          </div>

          <div className="text-sm font-semibold text-slate-100">
            {TRUCK_ID}
          </div>

        </div>

        {/* TRAVELLED */}

        <div className="bg-[#0E1729] p-4">

          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">

            <Route size={14} />

            Travelled

          </div>

          <div className="text-sm font-semibold text-cyan-400">
            {travelledDistance.toFixed(2)} km
          </div>

        </div>

        {/* REMAINING */}

        <div className="bg-[#0E1729] p-4">

          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">

            <Target size={14} />

            To Destination

          </div>

          <div className="text-sm font-semibold text-red-400">
            {remainingDistance.toFixed(2)} km
          </div>

        </div>

        {/* LAST UPDATE */}

        <div className="bg-[#0E1729] p-4">

          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">

            <Activity size={14} />

            Last Update

          </div>

          <div className="text-sm font-semibold text-slate-100">
            {formattedLastUpdate}
          </div>

        </div>

      </div>

      {/* ==================================================== */}
      {/* MAP AREA */}
      {/* ==================================================== */}

      <div className="flex-1 p-4">

        <div className="relative h-[570px] rounded-xl overflow-hidden border border-[#1E293B]">

          {/* MAP */}

          <TrackingMap
            currentPosition={
              currentPosition
            }
            history={history}
          />

          {/* ================================================= */}
          {/* MAP LEGEND */}
          {/* ================================================= */}

          <div className="absolute left-4 bottom-4 z-[1000] bg-[#0B1220]/95 backdrop-blur border border-[#334155] rounded-lg p-3">

            <div className="text-xs font-semibold text-slate-300 mb-3">
              Map Legend
            </div>

            <div className="space-y-2 text-xs">

              <div className="flex items-center gap-2">

                <span className="w-3 h-3 rounded-full bg-green-500" />

                <span className="text-slate-400">
                  Tracking Start
                </span>

              </div>

              <div className="flex items-center gap-2">

                <span className="w-8 h-1 rounded bg-cyan-400" />

                <span className="text-slate-400">
                  Actual Travelled
                </span>

              </div>

              <div className="flex items-center gap-2">

                <span className="w-8 border-t-2 border-dashed border-slate-400" />

                <span className="text-slate-400">
                  Planned Route
                </span>

              </div>

              <div className="flex items-center gap-2">

                <span className="text-base">
                  🚚
                </span>

                <span className="text-slate-400">
                  Live Truck
                </span>

              </div>

              <div className="flex items-center gap-2">

                <span className="text-base">
                  🎯
                </span>

                <span className="text-slate-400">
                  Destination
                </span>

              </div>

            </div>

          </div>

          {/* ================================================= */}
          {/* LIVE INDICATOR */}
          {/* ================================================= */}

          {currentPosition && (
            <div className="absolute top-4 right-4 z-[1000] bg-[#0B1220]/95 backdrop-blur border border-cyan-400/30 rounded-lg px-3 py-2">

              <div className="flex items-center gap-2">

                <span className="relative flex h-2.5 w-2.5">

                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />

                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400" />

                </span>

                <span className="text-xs text-cyan-300">
                  LIVE GPS
                </span>

              </div>

            </div>
          )}

          {/* ================================================= */}
          {/* WAITING STATE */}
          {/* ================================================= */}

          {!currentPosition && !loading && (
            <div className="absolute inset-0 z-[900] pointer-events-none flex items-center justify-center">

              <div className="bg-[#0B1220]/95 border border-[#334155] rounded-xl px-6 py-5 text-center">

                <Navigation
                  size={28}
                  className="mx-auto mb-3 text-slate-500"
                />

                <p className="text-sm text-slate-300">
                  Waiting for {TRUCK_ID}
                </p>

                <p className="text-xs text-slate-600 mt-1">
                  Start tracking from the driver phone
                </p>

              </div>

            </div>
          )}

        </div>

      </div>

      {/* ==================================================== */}
      {/* BOTTOM DETAILS */}
      {/* ==================================================== */}

      <div className="border-t border-[#1E293B] bg-[#0E1729] px-5 py-4">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* CURRENT LOCATION */}

          <div>

            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">

              <MapPin size={13} />

              Current Location

            </div>

            {currentPosition ? (
              <p className="font-mono text-xs text-slate-300">

                {currentPosition.lat.toFixed(
                  6
                )}
                ,{" "}
                {currentPosition.lng.toFixed(
                  6
                )}

              </p>
            ) : (
              <p className="text-xs text-slate-600">
                No GPS data
              </p>
            )}

          </div>

          {/* JOURNEY POINTS */}

          <div>

            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">

              <Navigation size={13} />

              GPS Points

            </div>

            <p className="text-xs text-slate-300">
              {history.length} points recorded
            </p>

          </div>

          {/* DESTINATION */}

          <div>

            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">

              <Target size={13} />

              Destination

            </div>

            <p className="text-xs text-slate-300">
              {DESTINATION.name},{" "}
              {DESTINATION.state}
            </p>

          </div>

        </div>

      </div>

      {/* ==================================================== */}
      {/* ERROR */}
      {/* ==================================================== */}

      {error && (
        <div className="border-t border-red-500/20 bg-red-500/5 px-5 py-3">

          <div className="flex items-center gap-2">

            <TriangleAlert
              size={15}
              className="text-red-400"
            />

            <span className="text-xs text-red-300">
              {error}
            </span>

          </div>

        </div>
      )}

    </div>
  );
}