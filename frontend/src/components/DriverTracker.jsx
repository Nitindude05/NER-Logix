import React, { useEffect, useRef, useState } from "react";
import {
  MapPin,
  Navigation,
  Wifi,
  WifiOff,
  Truck,
  Activity,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

const API_URL = "https://ner-logix-vgvp.onrender.com";
const TRUCK_ID = "TRUCK-001";

export default function DriverTracker() {
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState("Requesting GPS...");
  const [error, setError] = useState("");
  const [serverStatus, setServerStatus] = useState("Checking...");
  const [pointsSent, setPointsSent] = useState(0);

  const watchIdRef = useRef(null);

  // Send GPS location to backend
  const sendLocation = async (latitude, longitude) => {
    try {
      const response = await fetch(`${API_URL}/set`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: TRUCK_ID,
          lat: latitude,
          lng: longitude,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();

      console.log("GPS location sent:", data);

      setServerStatus("Connected");
      setPointsSent((previous) => previous + 1);
    } catch (err) {
      console.error("Failed to send GPS:", err);

      setServerStatus("Connection problem");
      setError(
        "Unable to send GPS location to the server."
      );
    }
  };

  // Start GPS tracking automatically
  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus("GPS not supported");
      setError(
        "Your browser does not support GPS location."
      );
      return;
    }

    setStatus("Requesting location permission...");

    watchIdRef.current =
      navigator.geolocation.watchPosition(
        (position) => {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;

          const newLocation = {
            lat: latitude,
            lng: longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now(),
          };

          console.log("GPS location:", newLocation);

          setLocation(newLocation);
          setStatus("GPS tracking active");
          setError("");

          sendLocation(latitude, longitude);
        },
        (gpsError) => {
          console.error("GPS error:", gpsError);

          switch (gpsError.code) {
            case gpsError.PERMISSION_DENIED:
              setStatus("Location permission denied");
              setError(
                "Please allow location permission for this website in your browser settings."
              );
              break;

            case gpsError.POSITION_UNAVAILABLE:
              setStatus("GPS unavailable");
              setError(
                "Your phone could not determine its current location."
              );
              break;

            case gpsError.TIMEOUT:
              setStatus("GPS timeout");
              setError(
                "GPS took too long to respond. Please try again."
              );
              break;

            default:
              setStatus("GPS error");
              setError("Unable to get your GPS location.");
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 2000,
          timeout: 15000,
        }
      );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(
          watchIdRef.current
        );
      }
    };
  }, []);

  // Check backend
  useEffect(() => {
    const checkServer = async () => {
      try {
        const response = await fetch(
          `${API_URL}/health`
        );

        if (response.ok) {
          setServerStatus("Connected");
        } else {
          setServerStatus("Server error");
        }
      } catch (err) {
        console.error("Server check failed:", err);
        setServerStatus("Offline");
      }
    };

    checkServer();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4">

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
                  GPS Truck Tracker
                </h1>

                <p className="text-xs text-gray-500">
                  Live vehicle tracking system
                </p>
              </div>

            </div>

            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold ${
                serverStatus === "Connected"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {serverStatus === "Connected" ? (
                <Wifi size={14} />
              ) : (
                <WifiOff size={14} />
              )}

              {serverStatus}
            </div>

          </div>

        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-4 py-6">

        {/* Truck */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-5">

          <p className="text-sm text-gray-500">
            Tracking vehicle
          </p>

          <div className="flex items-center gap-3 mt-1">

            <h2 className="text-2xl font-bold">
              {TRUCK_ID}
            </h2>

            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                location
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {location ? "LIVE" : "WAITING"}
            </span>

          </div>

        </div>

        {/* GPS status */}
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
                className="text-green-600 mt-1"
                size={22}
              />
            ) : error ? (
              <AlertCircle
                className="text-red-600 mt-1"
                size={22}
              />
            ) : (
              <Navigation
                className="text-blue-600 mt-1"
                size={22}
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

        {/* Current Location */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-5">

          <div className="flex items-center gap-3 mb-5">

            <div className="p-3 bg-blue-50 rounded-xl">
              <MapPin
                size={22}
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
                  {location.lat.toFixed(6)}
                </span>
              </div>

              <div className="flex justify-between bg-gray-50 rounded-xl p-4">
                <span className="text-gray-500">
                  Longitude
                </span>

                <span className="font-mono font-semibold">
                  {location.lng.toFixed(6)}
                </span>
              </div>

              <div className="flex justify-between bg-gray-50 rounded-xl p-4">
                <span className="text-gray-500">
                  Accuracy
                </span>

                <span className="font-semibold">
                  ±{Math.round(location.accuracy)} m
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

        {/* Server */}
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
                  Server
                </p>

                <p className="font-bold">
                  {serverStatus}
                </p>
              </div>

            </div>

          </div>

        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Keep this page open while driving.
          GPS location is sent automatically.
        </p>

      </main>
    </div>
  );
}