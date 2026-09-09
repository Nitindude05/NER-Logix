import React from "react";
import ReactDOM from "react-dom/client";

import GpsTracker from "./GpsTracker.jsx";
import DriverTracker from "./components/DriverTracker.jsx";

import "./index.css";
import "leaflet/dist/leaflet.css";

const currentPath = window.location.pathname;

function App() {
  // 📱 Driver Mobile Tracking Page
  if (currentPath === "/driver") {
    return <DriverTracker />;
  }

  // 💻 Main Admin Dashboard
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <GpsTracker />
      </div>
    </div>
  );
}

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);