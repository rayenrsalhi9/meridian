const API_BASE = "/api/v1";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function decodeJwtPayload(
  token: string,
): { sub: string; roles: string[] } | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return { sub: payload.sub, roles: payload.roles };
  } catch {
    return null;
  }
}

export async function apiClient(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401) {
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      accessToken = data.accessToken;
      headers.set("Authorization", `Bearer ${accessToken}`);
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        credentials: "include",
      });
    } else {
      accessToken = null;
    }
  }

  return res;
}
