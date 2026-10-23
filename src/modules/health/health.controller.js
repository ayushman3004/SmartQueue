import mongoose from "mongoose";
import { serviceRegistry } from "../../gateway/gateway.router.js";

const dbStatusMap = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

/**
 * Basic health check endpoint
 * Fast, lightweight, suitable for cloud uptime monitors, AWS ALB, Render & Vercel
 */
export const getBasicHealth = (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const memory = process.memoryUsage();

  res.status(200).json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: dbStatusMap[dbState] || "unknown",
    environment: process.env.NODE_ENV || "development",
    memory: {
      rssMb: Math.round((memory.rss / (1024 * 1024)) * 100) / 100,
      heapUsedMb: Math.round((memory.heapUsed / (1024 * 1024)) * 100) / 100,
      heapTotalMb: Math.round((memory.heapTotal / (1024 * 1024)) * 100) / 100,
    },
  });
};

/**
 * Liveness probe
 * Confirms that the HTTP server process is running and responding.
 */
export const getLiveness = (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
};

/**
 * Readiness probe
 * Checks whether dependent services (e.g. MongoDB) are alive and accepting requests.
 * Returns 200 if ready, 503 if dependencies are disconnected or unreachable.
 */
export const getReadiness = async (_req, res) => {
  const dbState = mongoose.connection.readyState;

  if (dbState === 1 && mongoose.connection.db) {
    const startTime = Date.now();
    try {
      await Promise.race([
        mongoose.connection.db.admin().ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Database ping timed out")), 2000)
        ),
      ]);
      const latencyMs = Date.now() - startTime;

      return res.status(200).json({
        status: "ready",
        database: {
          status: "connected",
          latencyMs,
        },
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      return res.status(503).json({
        status: "not_ready",
        database: {
          status: "error",
          error: err.message,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  return res.status(503).json({
    status: "not_ready",
    database: {
      status: dbStatusMap[dbState] || "disconnected",
    },
    timestamp: new Date().toISOString(),
  });
};

/**
 * Detailed health & subsystem diagnostic
 * Reports architecture details, active service registry health, and system specs.
 */
export const getDetailedHealth = (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const memory = process.memoryUsage();

  const services = serviceRegistry
    ? Object.keys(serviceRegistry).reduce((acc, key) => {
        acc[key] = serviceRegistry[key].healthy ? "up" : "down";
        return acc;
      }, {})
    : {};

  res.status(200).json({
    status: dbState === 1 ? "healthy" : "degraded",
    architecture: "modular-monolith",
    gateway: "active",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    nodeVersion: process.version,
    database: {
      status: dbStatusMap[dbState] || "unknown",
      readyState: dbState,
    },
    memory: {
      rssMb: Math.round((memory.rss / (1024 * 1024)) * 100) / 100,
      heapUsedMb: Math.round((memory.heapUsed / (1024 * 1024)) * 100) / 100,
      heapTotalMb: Math.round((memory.heapTotal / (1024 * 1024)) * 100) / 100,
    },
    services,
  });
};
