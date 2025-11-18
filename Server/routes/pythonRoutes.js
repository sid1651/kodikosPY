import express from "express";
import { runPython } from "../controllers/pythonControllers.js";


const router = express.Router();

router.post("/run", runPython);

export default router;
