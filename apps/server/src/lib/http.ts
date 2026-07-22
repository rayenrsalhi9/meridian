export function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((c) => {
      const eq = c.indexOf("=");
      return eq === -1
        ? [c.trim(), ""]
        : [c.slice(0, eq).trim(), c.slice(eq + 1).trim()];
    }),
  );
}
