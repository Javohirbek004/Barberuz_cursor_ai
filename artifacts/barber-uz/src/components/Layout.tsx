import { ReactNode, useEffect } from "react";
import { BottomNav } from "./BottomNav";
import { QuickLock } from "./QuickLock";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { touchThisDevice } from "@/lib/device";

/** Bottom menu only on the four main tabs. Any nested page, including /settings/..., hides it. */
const ROOT_TAB_PATHS = new Set(["/", "/dashboard", "/calendar", "/clients", "/settings"]);

function isRootTab(pathname: string): boolean {
  const bare = pathname.split("?")[0].split("#")[0];
  const path = bare.length > 1 ? bare.replace(/\/+$/, "") : bare || "/";
  return ROOT_TAB_PATHS.has(path);
}

export function Layout({ children, hideBottomNav }: { children: ReactNode; hideBottomNav?: boolean }) {
  const [location, navigate] = useLocation();
  const { user, isLoading } = useAuth(false);
  const showBottomNav = !hideBottomNav && isRootTab(location);

  useEffect(() => { touchThisDevice(); }, []);

  useEffect(() => {
    if (!isLoading && !!user && user?.telegramVerified !== true && location !== "/verify-telegram") {
      navigate("/verify-telegram");
    }
  }, [user, isLoading, location, navigate]);

  return (
    <div className={`min-h-screen bg-background relative ${showBottomNav ? "pb-28" : "pb-4"}`}>
      <QuickLock />
      <main className="max-w-md mx-auto p-4 sm:p-6 w-full relative z-10">
        {children}
      </main>
      {showBottomNav && <BottomNav />}
    </div>
  );
}
