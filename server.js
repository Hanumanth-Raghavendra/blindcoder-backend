import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import apiRouter from "./src/routes/api.routes.js";

dotenv.config();

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

app.use("/api", apiRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend server active on port ${PORT}`));
