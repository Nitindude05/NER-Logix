const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = 8888;

/* =========================================================
   MIDDLEWARE
   ========================================================= */

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   DATABASE
   ========================================================= */

const db = new sqlite3.Database(
  path.join(__dirname, "gps.db"),
  (err) => {
    if (err) {
      console.error("Database error:", err.message);
      process.exit(1);
    }

    console.log("Connected to GPS database.");
  }
);

/* =========================================================
   CREATE TABLES
   ========================================================= */

db.run(`
  CREATE TABLE IF NOT EXISTS movement (
    id TEXT PRIMARY KEY,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    updatedAt INTEGER NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS location_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    truckId TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    timestamp INTEGER NOT NULL
  )
`);

/* =========================================================
   ROOT ENDPOINT
   ========================================================= */

app.get("/", (req, res) => {
  res.json({
    message: "GPS Tracking API is running",
    status: "online",
  });
});

/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "GPS Tracking API",
    timestamp: Date.now(),
  });
});

/* =========================================================
   SET / SAVE CURRENT GPS LOCATION
   ========================================================= */

app.post("/set", (req, res) => {
  const { id, lat, lng } = req.body;

  /* -------------------------------------------------------
     Validate required fields
     ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     Validate coordinates
     ------------------------------------------------------- */

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return res.status(400).json({
      error: "Invalid latitude or longitude",
    });
  }

  /* -------------------------------------------------------
     Save / update current movement
     ------------------------------------------------------- */

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
          "Movement error:",
          err.message
        );

        return res.status(500).json({
          error: err.message,
        });
      }

      /* ---------------------------------------------------
         Save location history
         --------------------------------------------------- */

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
              "History error:",
              historyErr.message
            );

            return res.status(500).json({
              error: historyErr.message,
            });
          }

          /* -----------------------------------------------
             Success response
             ----------------------------------------------- */

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

/* =========================================================
   GET CURRENT TRUCK LOCATION
   ========================================================= */

app.get("/get", (req, res) => {
  db.all(
    `
    SELECT *
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

/* =========================================================
   GET LOCATION HISTORY
   ========================================================= */

app.get(
  "/history/:truckId",
  (req, res) => {
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
            "History fetch error:",
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
  }
);

/* =========================================================
   DELETE LOCATION HISTORY
   ========================================================= */

app.delete(
  "/history/:truckId",
  (req, res) => {
    const { truckId } = req.params;

    db.run(
      `
      DELETE FROM location_history
      WHERE truckId = ?
      `,
      [truckId],
      (err) => {
        if (err) {
          console.error(
            "Delete history error:",
            err.message
          );

          return res.status(500).json({
            error: err.message,
          });
        }

        res.json({
          message: "History cleared",
        });
      }
    );
  }
);

/* =========================================================
   START SERVER
   ========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `GPS server running on http://localhost:${PORT}`
    );
  }
);