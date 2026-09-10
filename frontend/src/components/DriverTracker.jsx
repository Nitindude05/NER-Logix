import React, { useEffect, useRef, useState } from "react";
import {
  Truck,
  MapPin,
  Navigation,
  Wifi,
  WifiOff,
  Activity,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

const API_URL = "https://ner-logix-vgvp.onrender.com";

export default function DriverTracker() {
  // ============================================
  // GET TRUCK ID FROM URL
  // ============================================

  const params = new URLSearchParams(
    window.location.search
  );

  const truckId =
    params.get("truck") || "TRUCK-001";

  // ============================================
  // STATES
  // ============================================

  const [location, setLocation] =
    useState(null);

  const [status, setStatus] =
    useState("Starting GPS...");

  const [error, setError] =
    useState("");

  const [serverStatus, setServerStatus] =
    useState("Checking...");

  const [pointsSent, setPointsSent] =
    useState(0);

  const [lastSent, setLastSent] =
    useState(null);

  const watchIdRef =
    useRef(null);

  // ============================================
  // SEND GPS LOCATION
  // ============================================

  const sendLocation = async (
    latitude,
    longitude
  ) => {
    try {
      const response = await fetch(
        `${API_URL}/set`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            id: truckId,
            lat: latitude,
            lng: longitude,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Server returned ${response.status}`
        );
      }

      const data =
        await response.json();

      console.log(
        `GPS sent for ${truckId}:`,
        data
      );

      setServerStatus("Connected");

      setPointsSent(
        (previous) =>
          previous + 1
      );

      setLastSent(
        new Date()
      );

      setError("");
    } catch (err) {
      console.error(
        "GPS send error:",
        err
      );

      setServerStatus(
        "Connection problem"
      );

      setError(
        "Unable to send GPS location to the server."
      );
    }
  };

  // ============================================
  // START GPS TRACKING
  // ============================================

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus(
        "GPS not supported"
      );

      setError(
        "Your browser does not support GPS location."
      );

      return;
    }

    setStatus(
      "Requesting location permission..."
    );

    watchIdRef.current =
      navigator.geolocation.watchPosition(
        (position) => {
          const latitude =
            position.coords.latitude;

          const longitude =
            position.coords.longitude;

          const accuracy =
            position.coords.accuracy;

          const gpsLocation = {
            lat: latitude,
            lng: longitude,
            accuracy,
            timestamp:
              Date.now(),
          };

          console.log(
            `${truckId} location:`,
            gpsLocation
          );

          setLocation(
            gpsLocation
          );

          setStatus(
            "GPS tracking active"
          );

          setError("");

          sendLocation(
            latitude,
            longitude
          );
        },

        (gpsError) => {
          console.error(
            "GPS error:",
            gpsError
          );

          switch (
            gpsError.code
          ) {
            case 1:
              setStatus(
                "Location permission denied"
              );

              setError(
                "Please allow location permission for this website."
              );

              break;

            case 2:
              setStatus(
                "GPS unavailable"
              );

              setError(
                "Your device could not determine its location."
              );

              break;

            case 3:
              setStatus(
                "GPS timeout"
              );

              setError(
                "GPS took too long to respond."
              );

              break;

            default:
              setStatus(
                "GPS error"
              );

              setError(
                "Unable to get GPS location."
              );
          }
        },

        {
          enableHighAccuracy: true,
          maximumAge: 2000,
          timeout: 15000,
        }
      );

    // ==========================================
    // CLEANUP
    // ==========================================

    return () => {
      if (
        watchIdRef.current !==
        null
      ) {
        navigator.geolocation.clearWatch(
          watchIdRef.current
        );
      }
    };
  }, [truckId]);

  // ============================================
  // CHECK SERVER
  // ============================================

  useEffect(() => {
    const checkServer =
      async () => {
        try {
          const response =
            await fetch(
              `${API_URL}/health`
            );

          if (response.ok) {
            setServerStatus(
              "Connected"
            );
          } else {
            setServerStatus(
              "Server error"
            );
          }
        } catch (err) {
          console.error(
            err
          );

          setServerStatus(
            "Offline"
          );
        }
      };

    checkServer();
  }, []);

  // ============================================
  // UI
  // ============================================

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">

      {/* HEADER */}

      <header className="bg-white border-b border-gray-200">

        <div className="max-w-3xl mx-auto px-4 py-5">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-3">

              <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center">

                <Truck
                  size={24}
                  className="text-white"
                />

              </div>

              <div>

                <h1 className="text-lg font-bold">
                  Driver GPS Tracker
                </h1>

                <p className="text-xs text-gray-500">
                  NER-Logix Live Tracking
                </p>

              </div>

            </div>

            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold ${
                serverStatus ===
                "Connected"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >

              {serverStatus ===
              "Connected" ? (
                <Wifi size={14} />
              ) : (
                <WifiOff size={14} />
              )}

              {serverStatus}

            </div>

          </div>

        </div>

      </header>

      {/* MAIN */}

      <main className="max-w-3xl mx-auto px-4 py-6">

        {/* TRUCK */}

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-5">

          <p className="text-sm text-gray-500">
            Tracking Vehicle
          </p>

          <div className="flex items-center gap-3 mt-2">

            <h2 className="text-3xl font-bold">
              {truckId}
            </h2>

            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                location
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {location
                ? "LIVE"
                : "WAITING"}
            </span>

          </div>

        </div>

        {/* STATUS */}

        <div
          className={`rounded-2xl p-5 mb-5 border ${
            location
              ? "bg-green-50 border-green-200"
              : error
              ? "bg-red-50 border-red-200"
              : "bg-blue-50 border-blue-200"
          }`}
        >

          <div className="flex items-start gap-3">

            {location ? (
              <CheckCircle
                size={23}
                className="text-green-600"
              />
            ) : error ? (
              <AlertCircle
                size={23}
                className="text-red-600"
              />
            ) : (
              <Navigation
                size={23}
                className="text-blue-600"
              />
            )}

            <div>

              <h3 className="font-bold">
                {status}
              </h3>

              {error && (
                <p className="text-sm mt-1 text-red-700">
                  {error}
                </p>
              )}

            </div>

          </div>

        </div>

        {/* CURRENT LOCATION */}

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-5">

          <div className="flex items-center gap-3 mb-5">

            <div className="p-3 bg-blue-50 rounded-xl">

              <MapPin
                size={23}
                className="text-blue-600"
              />

            </div>

            <div>

              <h3 className="font-bold text-lg">
                Current Location
              </h3>

              <p className="text-sm text-gray-500">
                Live GPS coordinates
              </p>

            </div>

          </div>

          {location ? (
            <div className="space-y-3">

              <div className="flex justify-between bg-gray-50 rounded-xl p-4">

                <span className="text-gray-500">
                  Latitude
                </span>

                <span className="font-mono font-semibold">
                  {location.lat.toFixed(
                    6
                  )}
                </span>

              </div>

              <div className="flex justify-between bg-gray-50 rounded-xl p-4">

                <span className="text-gray-500">
                  Longitude
                </span>

                <span className="font-mono font-semibold">
                  {location.lng.toFixed(
                    6
                  )}
                </span>

              </div>

              <div className="flex justify-between bg-gray-50 rounded-xl p-4">

                <span className="text-gray-500">
                  Accuracy
                </span>

                <span className="font-semibold">
                  ±
                  {Math.round(
                    location.accuracy
                  )}{" "}
                  m
                </span>

              </div>

            </div>
          ) : (
            <div className="py-10 text-center">

              <Navigation
                size={40}
                className="mx-auto mb-3 text-gray-300"
              />

              <p className="text-gray-500">
                Waiting for GPS location...
              </p>

            </div>
          )}

        </div>

        {/* STATS */}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">

            <div className="flex items-center gap-3">

              <div className="p-3 bg-green-50 rounded-xl">

                <Activity
                  size={20}
                  className="text-green-600"
                />

              </div>

              <div>

                <p className="text-sm text-gray-500">
                  GPS Points Sent
                </p>

                <p className="text-2xl font-bold">
                  {pointsSent}
                </p>

              </div>

            </div>

          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">

            <div className="flex items-center gap-3">

              <div className="p-3 bg-blue-50 rounded-xl">

                <Wifi
                  size={20}
                  className="text-blue-600"
                />

              </div>

              <div>

                <p className="text-sm text-gray-500">
                  Last Sent
                </p>

                <p className="font-bold">

                  {lastSent
                    ? lastSent.toLocaleTimeString()
                    : "--"}

                </p>

              </div>

            </div>

          </div>

        </div>

        {/* INFO */}

        <div className="mt-6 text-center">

          <p className="text-xs text-gray-400">

            GPS tracking is running
            automatically.

          </p>

          <p className="text-xs text-gray-400 mt-1">

            Vehicle ID:{" "}
            <span className="font-semibold">
              {truckId}
            </span>

          </p>

        </div>

      </main>

    </div>
  );
}