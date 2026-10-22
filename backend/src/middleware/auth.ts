import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing token" });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, env.jwtSecret) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
