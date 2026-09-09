const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();

const PORT = process.env.PORT || 8888;
const DB_PATH = path.join(__dirname, "gps.db");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = new sqlite3.Database(DB_PATH);

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // ---------------------------------------------
      // Check movement table
      // ---------------------------------------------

      db.all(`PRAGMA table_info(movement)`, (err, columns) => {
        if (err) {
          return reject(err);
        }

        // Table does not exist
        if (columns.length === 0) {
          console.log("Creating movement table...");

          db.run(
            `
            CREATE TABLE movement (
              id TEXT PRIMARY KEY,
              lat REAL NOT NULL,
              lng REAL NOT NULL,
              updatedAt INTEGER NOT NULL
            )
            `,
            (createErr) => {
              if (createErr) {
                return reject(createErr);
              }

              console.log("Movement table created.");
              continueDatabaseSetup(resolve, reject);
            }
          );

          return;
        }

        // Table already exists
        const hasUpdatedAt = columns.some(
          (column) => column.name === "updatedAt"
        );

        if (hasUpdatedAt) {
          console.log("updatedAt column already exists.");
          continueDatabaseSetup(resolve, reject);
          return;
        }

        // ---------------------------------------------
        // OLD DATABASE
        // Rebuild movement table with updatedAt
        // ---------------------------------------------

        console.log(
          "Old movement table detected."
        );

        console.log(
          "Adding updatedAt column..."
        );

        db.run(
          `
          ALTER TABLE movement
          ADD COLUMN updatedAt INTEGER
          `,
          (alterErr) => {
            if (alterErr) {
              return reject(alterErr);
            }

            console.log(
              "updatedAt column added."
            );

            // Update old records
            db.run(
              `
              UPDATE movement
              SET updatedAt = ?
              WHERE updatedAt IS NULL
              `,
              [Date.now()],
              (updateErr) => {
                if (updateErr) {
                  return reject(updateErr);
                }

                console.log(
                  "Existing records migrated."
                );

                continueDatabaseSetup(
                  resolve,
                  reject
                );
              }
            );
          }
        );
      });
    });
  });
}

// ---------------------------------------------
// Continue database setup
// ---------------------------------------------

function continueDatabaseSetup(resolve, reject) {
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
        return reject(err);
      }

      console.log(
        "Location history table ready."
      );

      resolve();
    }
  );
}

// =================================================
// ROOT
// =================================================

app.get("/", (req, res) => {
  res.json({
    message: "GPS Tracking API is running",
    status: "online",
  });
});

// =================================================
// HEALTH
// =================================================

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "GPS Tracking API",
    timestamp: Date.now(),
  });
});

// =================================================
// SET GPS LOCATION
// =================================================

app.post("/set", (req, res) => {
  const { id, lat, lng } = req.body;

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

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return res.status(400).json({
      error: "Invalid latitude or longitude",
    });
  }

  if (latitude < -90 || latitude > 90) {
    return res.status(400).json({
      error: "Invalid latitude",
    });
  }

  if (longitude < -180 || longitude > 180) {
    return res.status(400).json({
      error: "Invalid longitude",
    });
  }

  db.run(
    `
    INSERT INTO movement
    (
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
          "Movement error:",
          err.message
        );

        return res.status(500).json({
          error: err.message,
        });
      }

      db.run(
        `
        INSERT INTO location_history
        (
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
              "History error:",
              historyErr.message
            );

            return res.status(500).json({
              error: historyErr.message,
            });
          }

          console.log(
            `GPS: ${id} -> ${latitude}, ${longitude}`
          );

          res.json({
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

// =================================================
// GET LATEST LOCATIONS
// =================================================

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
          "Get movement error:",
          err.message
        );

        return res.status(500).json({
          error: err.message,
        });
      }

      res.json({
        message: "ok",
        data: rows,
      });
    }
  );
});

// =================================================
// GET HISTORY
// =================================================

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
          "History error:",
          err.message
        );

        return res.status(500).json({
          error: err.message,
        });
      }

      res.json({
        message: "ok",
        data: rows,
      });
    }
  );
});

// =================================================
// DELETE HISTORY
// =================================================

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
        return res.status(500).json({
          error: err.message,
        });
      }

      res.json({
        message: "History cleared",
        truckId,
        deletedRecords: this.changes,
      });
    }
  );
});

// =================================================
// 404
// =================================================

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  });
});

// =================================================
// START SERVER ONLY AFTER DATABASE IS READY
// =================================================

initializeDatabase()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `GPS server running on port ${PORT}`
      );
    });
  })
  .catch((err) => {
    console.error(
      "❌ Database initialization failed:",
      err
    );

    process.exit(1);
  });