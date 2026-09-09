const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();

const PORT = process.env.PORT || 8888;

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================================================
// DATABASE
// =====================================================

const dbPath = path.join(__dirname, "gps.db");

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Database connection error:", err.message);
    process.exit(1);
  }

  console.log("✅ Connected to GPS database.");
});

// =====================================================
// CREATE TABLES + DATABASE MIGRATION
// =====================================================

db.serialize(() => {
  // ---------------------------------------------------
  // Movement table
  // ---------------------------------------------------

  db.run(
    `
    CREATE TABLE IF NOT EXISTS movement (
      id TEXT PRIMARY KEY,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      updatedAt INTEGER NOT NULL
    )
    `,
    (err) => {
      if (err) {
        console.error(
          "❌ Movement table error:",
          err.message
        );
      } else {
        console.log("✅ Movement table ready.");
      }
    }
  );

  // ---------------------------------------------------
  // Migration:
  // Add updatedAt if old database doesn't have it
  // ---------------------------------------------------

  db.all(`PRAGMA table_info(movement)`, (err, columns) => {
    if (err) {
      console.error(
        "❌ Could not inspect movement table:",
        err.message
      );
      return;
    }

    const hasUpdatedAt = columns.some(
      (column) => column.name === "updatedAt"
    );

    if (!hasUpdatedAt) {
      console.log(
        "⚠️ updatedAt column missing. Adding it..."
      );

      db.run(
        `ALTER TABLE movement ADD COLUMN updatedAt INTEGER`,
        (alterErr) => {
          if (alterErr) {
            console.error(
              "❌ Migration error:",
              alterErr.message
            );
            return;
          }

          console.log(
            "✅ updatedAt column added successfully."
          );

          // Give existing rows a timestamp
          db.run(
            `
            UPDATE movement
            SET updatedAt = ?
            WHERE updatedAt IS NULL
            `,
            [Date.now()],
            (updateErr) => {
              if (updateErr) {
                console.error(
                  "❌ Existing row update error:",
                  updateErr.message
                );
              } else {
                console.log(
                  "✅ Existing movement records updated."
                );
              }
            }
          );
        }
      );
    } else {
      console.log("✅ updatedAt column already exists.");
    }
  });

  // ---------------------------------------------------
  // Location history table
  // ---------------------------------------------------

  db.run(
    `
    CREATE TABLE IF NOT EXISTS location_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      truckId TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      timestamp INTEGER NOT NULL
    )
    `,
    (err) => {
      if (err) {
        console.error(
          "❌ Location history table error:",
          err.message
        );
      } else {
        console.log(
          "✅ Location history table ready."
        );
      }
    }
  );
});

// =====================================================
// ROOT ROUTE
// =====================================================

app.get("/", (req, res) => {
  res.json({
    message: "GPS Tracking API is running",
    status: "online",
  });
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "GPS Tracking API",
    timestamp: Date.now(),
  });
});

// =====================================================
// SET GPS LOCATION
// =====================================================

app.post("/set", (req, res) => {
  const { id, lat, lng } = req.body;

  // Validate required fields
  if (
    !id ||
    lat === undefined ||
    lng === undefined
  ) {
    return res.status(400).json({
      error: "id, lat and lng are required",
    });
  }

  const latitude = Number(lat);
  const longitude = Number(lng);
  const timestamp = Date.now();

  // Validate coordinates
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return res.status(400).json({
      error: "Invalid latitude or longitude",
    });
  }

  // Validate latitude range
  if (latitude < -90 || latitude > 90) {
    return res.status(400).json({
      error: "Latitude must be between -90 and 90",
    });
  }

  // Validate longitude range
  if (longitude < -180 || longitude > 180) {
    return res.status(400).json({
      error: "Longitude must be between -180 and 180",
    });
  }

  // ---------------------------------------------------
  // Update latest truck position
  // ---------------------------------------------------

  db.run(
    `
    INSERT INTO movement (
      id,
      lat,
      lng,
      updatedAt
    )
    VALUES (?, ?, ?, ?)

    ON CONFLICT(id)
    DO UPDATE SET
      lat = excluded.lat,
      lng = excluded.lng,
      updatedAt = excluded.updatedAt
    `,
    [
      id,
      latitude,
      longitude,
      timestamp,
    ],
    (err) => {
      if (err) {
        console.error(
          "❌ Movement save error:",
          err.message
        );

        return res.status(500).json({
          error: err.message,
        });
      }

      // -------------------------------------------------
      // Save location to history
      // -------------------------------------------------

      db.run(
        `
        INSERT INTO location_history (
          truckId,
          lat,
          lng,
          timestamp
        )
        VALUES (?, ?, ?, ?)
        `,
        [
          id,
          latitude,
          longitude,
          timestamp,
        ],
        (historyErr) => {
          if (historyErr) {
            console.error(
              "❌ History save error:",
              historyErr.message
            );

            return res.status(500).json({
              error: historyErr.message,
            });
          }

          console.log(
            `📍 ${id}: ${latitude}, ${longitude}`
          );

          return res.json({
            message: "Location saved",
            data: {
              id,
              lat: latitude,
              lng: longitude,
              timestamp,
            },
          });
        }
      );
    }
  );
});

// =====================================================
// GET LATEST TRUCK LOCATIONS
// =====================================================

app.get("/get", (req, res) => {
  db.all(
    `
    SELECT
      id,
      lat,
      lng,
      updatedAt
    FROM movement
    ORDER BY updatedAt DESC
    `,
    [],
    (err, rows) => {
      if (err) {
        console.error(
          "❌ Get movement error:",
          err.message
        );

        return res.status(500).json({
          error: err.message,
        });
      }

      return res.json({
        message: "ok",
        data: rows,
      });
    }
  );
});

// =====================================================
// GET TRUCK LOCATION HISTORY
// =====================================================

app.get("/history/:truckId", (req, res) => {
  const { truckId } = req.params;

  db.all(
    `
    SELECT
      lat,
      lng,
      timestamp
    FROM location_history
    WHERE truckId = ?
    ORDER BY timestamp ASC
    `,
    [truckId],
    (err, rows) => {
      if (err) {
        console.error(
          "❌ History fetch error:",
          err.message
        );

        return res.status(500).json({
          error: err.message,
        });
      }

      return res.json({
        message: "ok",
        data: rows,
      });
    }
  );
});

// =====================================================
// CLEAR TRUCK HISTORY
// =====================================================

app.delete("/history/:truckId", (req, res) => {
  const { truckId } = req.params;

  db.run(
    `
    DELETE FROM location_history
    WHERE truckId = ?
    `,
    [truckId],
    function (err) {
      if (err) {
        console.error(
          "❌ Delete history error:",
          err.message
        );

        return res.status(500).json({
          error: err.message,
        });
      }

      return res.json({
        message: "History cleared",
        truckId,
        deletedRecords: this.changes,
      });
    }
  );
});

// =====================================================
// 404 HANDLER
// =====================================================

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  });
});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `🚛 GPS server running on port ${PORT}`
  );
});