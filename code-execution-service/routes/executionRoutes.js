import express from "express";
import { executePython, executeCpp } from "../controllers/executionController.js";

const router = express.Router();

// Python code execution endpoint
router.post("/python", executePython);

// C++ code execution endpoint
router.post("/cpp", executeCpp);

export default router;

