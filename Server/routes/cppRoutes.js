import express from "express";
import { executeCpp } from "../controllers/cppController.js";

const router = express.Router();

router.post("/run", executeCpp);

export default router;
