import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import executionRoutes from "./routes/executionRoutes.js";
import { initializePythonPool, getPythonPoolStats } from "./services/dockerPythonRunner.js";
import { initializeCppPool, getCppPoolStats } from "./services/dockercppRunner.js";
import { authenticateService } from "./middleware/authMiddleware.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.EXECUTION_SERVICE_PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Apply authentication to all execution routes (except health/stats)
app.use("/execute", authenticateService);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "code-execution-service" });
});

// Pool statistics endpoint
app.get("/stats", (req, res) => {
  res.json({
    python: getPythonPoolStats(),
    cpp: getCppPoolStats(),
  });
});

// Execution routes
app.use("/execute", executionRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  // Cleanup container pools
  try {
    // Note: We'll need to export cleanup methods from runners
    console.log("Cleaning up container pools...");
    // Pools will be cleaned up automatically when process exits
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
  
  process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Initialize container pools and start server
async function startServer() {
  // Start HTTP server first (non-blocking)
  app.listen(PORT, () => {
    console.log(`🚀 Code Execution Service Running on port ${PORT}`);
    console.log(`📊 Pool stats available at http://localhost:${PORT}/stats`);
  });

  // Initialize container pools in background (non-blocking)
  // Service will start even if Docker images don't exist yet
  console.log("🔥 Initializing container pools in background...");
  
  Promise.all([
    initializePythonPool().catch(err => {
      console.warn("⚠️ Python pool initialization failed (Docker images may not be built yet):", err.message);
    }),
    initializeCppPool().catch(err => {
      console.warn("⚠️ C++ pool initialization failed (Docker images may not be built yet):", err.message);
    }),
  ]).then(() => {
    console.log("✅ Container pools initialized");
  }).catch(() => {
    console.log("⚠️ Some pools failed to initialize - code execution will fail until Docker images are built");
  });
}

// Start the server
startServer();

