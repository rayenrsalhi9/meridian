import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { logger } from "./lib/logger.js";
import authRouter from "./routes/auth.js";

const app = express();

app.use(helmet());

app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/auth", authRouter);

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err.stack ?? err.message);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
