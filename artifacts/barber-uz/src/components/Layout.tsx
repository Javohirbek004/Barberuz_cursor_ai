import { ReactNode, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BottomNav } from "./BottomNav";
import { useLocation } from "wouter";
import { touchThisDevice } from "@/lib/device";
import { pathAfterAuth } from "@/lib/onboarding";
import { BOT_LINK_PENDING_KEY } from "@/lib/bot-link";

const BOT_TOAST_SEEN_KEY = "zumio_return_toast_once";

/** Bottom menu only on the four main tabs. Any nested page, including /settings/..., hides it. */
const ROOT_TAB_PATHS = new Set(["/", "/dashboard", "/calendar", "/clients", "/settings"]);

function isRootTab(pathname: string): boolean {
  const bare = pathname.split("?")[0].split("#")[0];
  const path = bare.length > 1 ? bare.replace(/\/+$/, "") : bare || "/";
  return ROOT_TAB_PATHS.has(path);
}

export function BotConnectedToast() {
  const queryClient = useQueryClient();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let stop = false;
    let shown = false;
    let tick = 0;
    const fromBot = new URLSearchParams(window.location.search).get("bot") === "ulandi";
    if (fromBot) {
      const url = new URL(window.location.href);
      url.searchParams.delete("bot");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      if (localStorage.getItem(BOT_TOAST_SEEN_KEY) !== "1") {
        localStorage.setItem(BOT_TOAST_SEEN_KEY, "1");
        localStorage.removeItem(BOT_LINK_PENDING_KEY);
        setShow(true);
      }
      return;
    }
    async function look() {
      if (shown) return;
      try {
        if (localStorage.getItem(BOT_LINK_PENDING_KEY) !== "1") return;
        if (localStorage.getItem(BOT_TOAST_SEEN_KEY) === "1") return;
        const token = localStorage.getItem("barber_token");
        if (!token) return;
        const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const me = await res.json();
        if (stop || shown || me?.telegramVerified !== true || !me?.id) return;
        shown = true;
        window.clearInterval(tick);
        localStorage.removeItem(BOT_LINK_PENDING_KEY);
        localStorage.setItem(BOT_TOAST_SEEN_KEY, "1");
        localStorage.setItem("barber_user", JSON.stringify(me));
        queryClient.setQueryData(["/api/auth/me"], me);
        setShow(true);
      } catch { /* the barber may still be in the bot */ }
    }
    look();
    tick = window.setInterval(look, 3000);
    const stopTick = window.setTimeout(() => window.clearInterval(tick), 120000);
    const onVisible = () => { if (document.visibilityState === "visible") look(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      window.clearInterval(tick);
      window.clearTimeout(stopTick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [queryClient]);

  useEffect(() => {
    if (!show) return;
    const hide = window.setTimeout(() => setShow(false), 3200);
    return () => window.clearTimeout(hide);
  }, [show]);

  if (!show) return null;
  return (
    <div className="fixed top-24 left-1/2 z-[60] w-[min(92vw,22rem)] -translate-x-1/2 rounded-2xl border border-[#F5B82E]/50 bg-zinc-900 px-4 py-3 text-center text-sm font-medium leading-snug text-foreground shadow-lg">
      Telegram bot muvaffaqiyatli ulandi ✅
    </div>
  );
}

export function Layout({ children, hideBottomNav }: { children: ReactNode; hideBottomNav?: boolean }) {
  const [location, navigate] = useLocation();
  const showBottomNav = !hideBottomNav && isRootTab(location);

  useEffect(() => { touchThisDevice(); }, []);

  useEffect(() => {
    if (pathAfterAuth() === "/onboarding" && location !== "/onboarding") navigate("/onboarding");
  }, [location, navigate]);

  return (
    <div className={`min-h-screen bg-background relative ${showBottomNav ? "pb-28" : "pb-4"}`}>
      <main className="max-w-md mx-auto p-4 sm:p-6 w-full relative z-10">
        {children}
      </main>
      {showBottomNav && <BottomNav />}
    </div>
  );
}
