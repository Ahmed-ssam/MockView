"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { useLocalMode } from "@/lib/localMode";

type Who = { admin: boolean } | null;

/** Right side of the header: login/signup when signed out, dashboard/logout when signed in.
 *  The Admin link is only a convenience; every admin endpoint is enforced by the server. */
export function NavActions() {
  const router = useRouter();
  const [who, setWho] = useState<Who | undefined>(undefined); // undefined = still checking
  const local = useLocalMode();

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return setWho(null);
    const apply = (s: Session | null) =>
      setWho(s?.user ? { admin: (s.user.app_metadata as { role?: string } | undefined)?.role === "admin" } : null);
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => apply(session));
    return () => data.subscription.unsubscribe();
  }, []);

  async function logout() {
    await getSupabase()?.auth.signOut();
    router.push("/");
  }

  if (local) {
    return (
      <div className="flex items-center gap-3">
        <Link href="/settings" className="text-sm text-cream/80 hover:text-cream">API key &amp; settings</Link>
        <Link href="/dashboard" className="rounded-full bg-soft-blue px-4 py-1.5 text-sm font-medium text-navy hover:bg-cream">Dashboard</Link>
      </div>
    );
  }
  if (who === undefined || local === undefined) return <div className="h-8 w-40" aria-hidden />; // reserve space, avoid a flash of the wrong buttons
  if (who === null) {
    return (
      <div className="flex items-center gap-3">
        <Link href="/login" className="rounded-full border border-cream/60 px-4 py-1.5 text-sm hover:bg-cream hover:text-navy">Log in</Link>
        <Link href="/signup" className="rounded-full bg-soft-blue px-4 py-1.5 text-sm font-medium text-navy hover:bg-cream">Get Started</Link>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      {who.admin && <Link href="/admin" className="text-sm text-cream/80 hover:text-cream">Admin</Link>}
      <Link href="/dashboard" className="rounded-full bg-soft-blue px-4 py-1.5 text-sm font-medium text-navy hover:bg-cream">Dashboard</Link>
      <button type="button" onClick={logout} className="rounded-full border border-cream/60 px-4 py-1.5 text-sm hover:bg-cream hover:text-navy">Log out</button>
    </div>
  );
}
