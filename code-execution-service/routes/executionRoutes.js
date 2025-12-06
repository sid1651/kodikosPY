import express from "express";
import { executePython, executeCpp } from "../controllers/executionController.js";

const router = express.Router();

// Add logging middleware
router.use((req, res, next) => {
    process.stderr.write(`🔍 DEBUG Route: ${req.method} ${req.path}\n`);
    next();
});

// Python code execution endpoint
router.post("/python", executePython);

// C++ code execution endpoint
router.post("/cpp", executeCpp);

export default router;

