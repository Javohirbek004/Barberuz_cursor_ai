import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import NotFound from "@/pages/not-found";

type Status = "redirecting" | "not_found" | "error";

export default function BarberByIdPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<Status>("redirecting");

  useEffect(() => {
    if (!id) { setStatus("not_found"); return; }

    let cancelled = false;

    fetch(`/api/public/barber/id/${encodeURIComponent(id)}`)
      .then(async r => {
        if (cancelled) return;
        if (r.status === 404) { setStatus("not_found"); return; }
        if (!r.ok) { setStatus("error"); return; }
        const data = await r.json();
        if (cancelled) return;
        const slug: string | undefined = data.redirectTo;
        if (slug) {
          navigate(`/${slug}`, { replace: true });
        } else {
          setStatus("not_found");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => { cancelled = true; };
  }, [id]);

  if (status === "not_found") return <NotFound />;

  if (status === "error") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-2xl">⚠️</p>
        <p className="text-foreground font-semibold">Sahifani yuklashda xatolik</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-xl bg-white/8 border border-white/12 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
