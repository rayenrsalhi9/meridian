import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import rolesRouter from "./routes/roles.js";
import claimsRouter from "./routes/claims.js";
import { prisma } from "./db.js";

const app = express();

app.use(helmet());
app.use(express.json());

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", usersRouter);
app.use("/api/v1/roles", rolesRouter);
app.use("/api/v1/claims", claimsRouter);

app.get("/api/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "error", message: "Database unavailable" });
  }
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack ?? err.message);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
