"use client";
import { useEffect, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
let cached: boolean | null = null;

/** True when the backend runs in local (no-login) mode. Asked once per page load; failures are not cached. */
export async function isLocalMode(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    const res = await fetch(`${BASE}/api/v1/config`, { cache: "no-store" });
    if (!res.ok) return false;
    cached = Boolean((await res.json()).local_mode);
    return cached;
  } catch {
    return false;
  }
}

/** undefined while checking. */
export function useLocalMode(): boolean | undefined {
  const [v, setV] = useState<boolean | undefined>(cached ?? undefined);
  useEffect(() => { void isLocalMode().then(setV); }, []);
  return v;
}
