interface Bucket {
  count: number;
  resetAt: number;
}

export function rateLimiter(opts: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: import("express").Request) => string;
}) {
  const store = new Map<string, Bucket>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of store) {
      if (bucket.resetAt <= now) store.delete(key);
    }
  }, opts.windowMs).unref();

  return (req: import("express").Request, res: import("express").Response): boolean => {
    const key = opts.keyGenerator ? opts.keyGenerator(req) : (req.ip ?? "unknown");
    const now = Date.now();
    let bucket = store.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      store.set(key, bucket);
    }
    bucket.count++;
    if (bucket.count > opts.max) {
      res.status(401).json({ error: "Invalid credentials" });
      return false;
    }
    return true;
  };
}
