import express from "express";
import { generateCode, explainError } from "../controllers/ai.controller.js";

const router = express.Router();
router.post("/generate", generateCode);
router.post("/explain", explainError);

export default router;
