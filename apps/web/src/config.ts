/** API base URL (REST). The WS URL is derived from it. */
export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8000";

/** ws:// or wss:// origin derived from API_URL. */
export const WS_URL: string = API_URL.replace(/^http/, "ws");
