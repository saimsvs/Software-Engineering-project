
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/auth.js";
import featuresRoutes from "./routes/features.js";
import { connectionsRouter, usersRouter } from "./routes/social.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(morgan("dev"));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/api/auth", authRoutes);

  // US4 and US10 — Privacy and Goals
  app.use("/api/features", featuresRoutes);

  // US18 — Teammate's Connections implementation
  app.use("/api/users", usersRouter);
  app.use("/api/connections", connectionsRouter);

  return app;
}
