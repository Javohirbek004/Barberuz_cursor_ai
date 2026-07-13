import { ReactNode, useEffect } from "react";
import { BottomNav } from "./BottomNav";
import { useLocation } from "wouter";

function isTelegramConnected(): boolean {
  try {
    const u = JSON.parse(localStorage.getItem("barber_user") || "null");
    return u?.telegramVerified === true;
  } catch {
    return false;
  }
}

function isLoggedIn(): boolean {
  return !!localStorage.getItem("barber_token");
}

export function Layout({ children, hideBottomNav }: { children: ReactNode; hideBottomNav?: boolean }) {
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (isLoggedIn() && !isTelegramConnected() && location !== "/verify-telegram") {
      navigate("/verify-telegram");
    }
  }, [location, navigate]);

  return (
    <div className={`min-h-screen bg-background relative ${hideBottomNav ? "pb-4" : "pb-28"}`}>
      <main className="max-w-md mx-auto p-4 sm:p-6 w-full relative z-10">
        {children}
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
