import express from "express";
import { generateCode, explainError } from "../controllers/ai.controller.js";
import { executeServerScript } from "../controllers/run.controller.js";

const router = express.Router();
router.post("/generate", generateCode);
router.post("/explain", explainError);
router.post("/run-backend", executeServerScript);

export default router;
