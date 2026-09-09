import { useState, useRef } from "react";
import {
  Play,
  Square,
  MapPin,
  Navigation,
  Wifi,
  AlertCircle,
} from "lucide-react";

const API_URL = "http://192.168.1.6:8888";

const TRUCK_ID = "TRUCK-001";

export default function DriverTracker() {
  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Ready to start");

  const watchId = useRef(null);

  // --------------------------------------------------
  // START TRACKING
  // --------------------------------------------------

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError("GPS is not supported on this device.");
      return;
    }

    setError("");
    setTracking(true);
    setStatus("Getting GPS location...");

    watchId.current = navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        const newLocation = {
          lat,
          lng,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
        };

        setLocation(newLocation);

        try {
          const response = await fetch(
            `${API_URL}/set`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                id: TRUCK_ID,
                lat,
                lng,
              }),
            }
          );

          if (!response.ok) {
            throw new Error("Failed to send location");
          }

          setStatus("Live location is being shared");
        } catch (err) {
          console.error(err);
          setStatus("GPS available — server disconnected");
        }
      },

      (err) => {
        console.error(err);

        setError(
          err.message || "Unable to get GPS location"
        );

        setTracking(false);
        setStatus("GPS error");
      },

      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000,
      }
    );
  };

  // --------------------------------------------------
  // STOP TRACKING
  // --------------------------------------------------

  const stopTracking = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(
        watchId.current
      );

      watchId.current = null;
    }

    setTracking(false);
    setStatus("Tracking stopped");
  };

  return (
    <div className="min-h-screen bg-[#07111f] text-white p-5">
      <div className="max-w-md mx-auto">

        {/* HEADER */}

        <div className="mb-6">
          <div className="flex items-center gap-3">
            <Navigation className="text-cyan-400" />

            <div>
              <h1 className="text-xl font-semibold">
                Driver Tracking
              </h1>

              <p className="text-sm text-slate-500">
                {TRUCK_ID}
              </p>
            </div>
          </div>
        </div>

        {/* STATUS */}

        <div className="border border-slate-800 bg-slate-900/60 rounded-xl p-4 mb-4">

          <div className="flex items-center gap-2 mb-3">

            <Wifi
              size={16}
              className={
                tracking
                  ? "text-emerald-400"
                  : "text-slate-500"
              }
            />

            <span className="text-sm">
              {status}
            </span>

          </div>

          {location && (
            <div className="grid grid-cols-2 gap-3">

              <div>
                <p className="text-xs text-slate-500">
                  Latitude
                </p>

                <p className="font-mono text-sm">
                  {location.lat.toFixed(6)}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Longitude
                </p>

                <p className="font-mono text-sm">
                  {location.lng.toFixed(6)}
                </p>
              </div>

            </div>
          )}

        </div>

        {/* ERROR */}

        {error && (
          <div className="flex gap-2 items-start bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">

            <AlertCircle
              size={17}
              className="text-red-400"
            />

            <p className="text-sm text-red-300">
              {error}
            </p>

          </div>
        )}

        {/* BUTTON */}

        <button
          onClick={
            tracking
              ? stopTracking
              : startTracking
          }
          className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-medium ${
            tracking
              ? "bg-red-500/15 text-red-400 border border-red-500/30"
              : "bg-cyan-400 text-black"
          }`}
        >

          {tracking ? (
            <>
              <Square size={18} />
              Stop Tracking
            </>
          ) : (
            <>
              <Play size={18} />
              Start Tracking
            </>
          )}

        </button>

        <div className="mt-6 text-center text-xs text-slate-600">
          <MapPin
            size={13}
            className="inline mr-1"
          />
          Keep this page open while driving.
        </div>

      </div>
    </div>
  );
}