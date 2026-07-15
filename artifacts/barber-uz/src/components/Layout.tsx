import { ReactNode, useEffect } from "react";
import { BottomNav } from "./BottomNav";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export function Layout({ children, hideBottomNav }: { children: ReactNode; hideBottomNav?: boolean }) {
  const [location, navigate] = useLocation();
  const { user, isLoading } = useAuth(false);

  useEffect(() => {
    if (!isLoading && !!user && user?.telegramVerified !== true && location !== "/verify-telegram") {
      navigate("/verify-telegram");
    }
  }, [user, isLoading, location, navigate]);

  return (
    <div className={`min-h-screen bg-background relative ${hideBottomNav ? "pb-4" : "pb-28"}`}>
      <main className="max-w-md mx-auto p-4 sm:p-6 w-full relative z-10">
        {children}
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
