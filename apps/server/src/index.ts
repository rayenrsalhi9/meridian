import express, { type Request, type Response, type NextFunction } from "express"

const app = express()
const PORT = process.env.PORT ?? 4000

app.use(express.json())

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" })
})

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: "Internal server error" })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
