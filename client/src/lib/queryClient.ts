import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

const STORAGE_KEY = "peptide_app_session";
function clearStoredSession() {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Simple session token holder — React state syncs with this
let sessionToken: string | null = null;
export function setSessionToken(token: string | null) {
  sessionToken = token;
}
export function getSessionToken() {
  return sessionToken;
}

function authHeaders(extra?: Record<string, string>) {
  const h: Record<string, string> = { ...(extra || {}) };
  if (sessionToken) h["x-session-token"] = sessionToken;
  return h;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401) clearStoredSession();
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: authHeaders(data ? { "Content-Type": "application/json" } : {}),
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/");
    const res = await fetch(`${API_BASE}${url}`, { headers: authHeaders() });

    if (res.status === 401) {
      clearStoredSession();
      if (unauthorizedBehavior === "returnNull") return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
