import { useState } from "react";
import { useTranslation } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Plus, X, Scissors, Clock, Phone, Star, MoreVertical, UserCheck, UserX, Copy, Check, Link2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface Barber {
  id: string;
  name: string;
  phone: string;
  speciality: string;
  workStart: string;
  workEnd: string;
  active: boolean;
  rating: number;
  totalBookings: number;
  inviteToken?: string;
  joined?: boolean;
}

const INITIAL_BARBERS: Barber[] = [
  {
    id: "1",
    name: "Ali Karimov",
    phone: "+998 90 123 45 67",
    speciality: "Klassik kesim, soqol",
    workStart: "09:00",
    workEnd: "18:00",
    active: true,
    rating: 4.9,
    totalBookings: 128,
    joined: true,
  },
  {
    id: "2",
    name: "Bobur Rahimov",
    phone: "+998 91 234 56 78",
    speciality: "Zamonaviy kesim, ranglar",
    workStart: "10:00",
    workEnd: "19:00",
    active: true,
    rating: 4.7,
    totalBookings: 94,
    joined: true,
  },
];

function generateToken(name: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  const slug = name.toLowerCase().replace(/\s+/g, "").slice(0, 6);
  return `${slug}_${random}`;
}

function InviteLinkDialog({
  name,
  token,
  onClose,
}: {
  name: string;
  token: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
  const link = `${base}/barber-setup/${token}`;

  function handleCopy() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-sm bg-card border border-white/10 rounded-3xl p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-lg text-foreground">Taklif linki tayyor!</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-display font-bold text-primary mb-3">
            {name.charAt(0).toUpperCase()}
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-semibold">{name}</span> uchun maxsus link yaratildi.
            Ushbu linkni Telegram yoki WhatsApp orqali yuboring:
          </p>
        </div>

        <div className="bg-background/60 border border-white/8 rounded-2xl p-3 mb-4">
          <p className="text-xs text-muted-foreground font-mono break-all leading-relaxed">{link}</p>
        </div>

        <button
          onClick={handleCopy}
          className={`w-full h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            copied
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {copied ? (
            <><Check className="w-4 h-4" /> Nusxalandi!</>
          ) : (
            <><Copy className="w-4 h-4" /> Linkni nusxalash</>
          )}
        </button>

        <p className="text-xs text-muted-foreground/50 text-center mt-3">
          Usta shu linkni bosib o'z parolini yaratadi
        </p>
      </motion.div>
    </div>
  );
}

export default function BarbersPage() {
  const { t } = useTranslation();
  useAuth();
  const { toast } = useToast();

  const [barbers, setBarbers] = useState<Barber[]>(INITIAL_BARBERS);
  const [showDialog, setShowDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [inviteData, setInviteData] = useState<{ name: string; token: string } | null>(null);

  const handleAdd = () => {
    if (!newName.trim()) {
      toast({ title: t("barbers.name_required"), variant: "destructive" });
      return;
    }
    const token = generateToken(newName.trim());
    const newBarber: Barber = {
      id: Date.now().toString(),
      name: newName.trim(),
      phone: "",
      speciality: t("barbers.default_speciality"),
      workStart: "09:00",
      workEnd: "18:00",
      active: true,
      rating: 0,
      totalBookings: 0,
      inviteToken: token,
      joined: false,
    };
    setBarbers(prev => [...prev, newBarber]);
    setNewName("");
    setShowDialog(false);
    setInviteData({ name: newBarber.name, token });
  };

  const toggleActive = (id: string) => {
    setBarbers(prev => prev.map(b => b.id === id ? { ...b, active: !b.active } : b));
  };

  const handleDelete = (id: string) => {
    setBarbers(prev => prev.filter(b => b.id !== id));
    toast({ title: t("barbers.deleted") });
  };

  const showInviteLink = (barber: Barber) => {
    if (barber.inviteToken) {
      setInviteData({ name: barber.name, token: barber.inviteToken });
    }
  };

  const activeCount = barbers.filter(b => b.active).length;

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="rounded-full bg-card hover:bg-white/10">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold font-display">{t("settings.barbers")}</h1>
        </div>
        <Button
          size="sm"
          onClick={() => setShowDialog(true)}
          className="rounded-xl gap-1.5 bg-primary text-black font-bold"
        >
          <Plus className="w-4 h-4" />
          {t("barbers.add")}
        </Button>
      </div>

      <Card className="p-4 bg-card/50 border-white/5 mb-5">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-2xl font-display font-bold text-primary">{barbers.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("barbers.total")}</p>
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-emerald-400">{activeCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("barbers.active")}</p>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        <AnimatePresence>
          {barbers.map((barber, i) => (
            <motion.div
              key={barber.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className={`p-4 border-white/5 transition-all ${barber.active ? "bg-card" : "bg-card/30 opacity-60"}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-primary font-display font-bold text-xl uppercase">
                      {barber.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-foreground">{barber.name}</p>
                        {barber.joined === false && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
                            Kutilmoqda
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Scissors className="w-3 h-3" />
                        {barber.speciality}
                      </p>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="w-8 h-8 rounded-xl hover:bg-white/10">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {barber.inviteToken && !barber.joined && (
                        <DropdownMenuItem onClick={() => showInviteLink(barber)} className="gap-2">
                          <Link2 className="w-4 h-4" /> Linkni ko'rish
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => toggleActive(barber.id)} className="gap-2">
                        {barber.active ? (
                          <><UserX className="w-4 h-4" /> {t("barbers.deactivate")}</>
                        ) : (
                          <><UserCheck className="w-4 h-4" /> {t("barbers.activate")}</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(barber.id)} className="gap-2 text-destructive focus:text-destructive">
                        <X className="w-4 h-4" /> {t("barbers.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-background/30 rounded-xl p-2">
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
                      <Clock className="w-3 h-3" />
                    </p>
                    <p className="text-xs font-medium">{barber.workStart}–{barber.workEnd}</p>
                  </div>
                  {barber.rating > 0 && (
                    <div className="bg-background/30 rounded-xl p-2">
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
                        <Star className="w-3 h-3" />
                      </p>
                      <p className="text-xs font-medium">{barber.rating}</p>
                    </div>
                  )}
                  <div className="bg-background/30 rounded-xl p-2">
                    <p className="text-xs text-muted-foreground mb-1">{t("barbers.bookings_count")}</p>
                    <p className="text-xs font-medium">{barber.totalBookings}</p>
                  </div>
                </div>

                {barber.phone && (
                  <a
                    href={`tel:${barber.phone}`}
                    className="mt-3 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Phone className="w-3 h-3" />
                    {barber.phone}
                  </a>
                )}
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {barbers.length === 0 && (
          <div className="text-center py-16 bg-white/5 border border-white/5 rounded-2xl border-dashed">
            <Scissors className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">{t("barbers.empty")}</p>
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-background border-white/10 rounded-3xl mx-4">
          <DialogHeader>
            <DialogTitle>Usta qo'shish</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-2">
            <p className="text-sm text-muted-foreground">
              Usta ismini kiriting — tizim avtomatik taklif linki yaratadi.
              Shu linkni ustaga yuboring.
            </p>
            <div className="space-y-2">
              <Label>Ism *</Label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
                placeholder="Sardor"
                className="bg-background/50 h-12"
                autoFocus
              />
            </div>
            <Button onClick={handleAdd} className="w-full h-12 font-bold rounded-xl gap-2">
              <Link2 className="w-4 h-4" />
              Link yaratish
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {inviteData && (
        <InviteLinkDialog
          name={inviteData.name}
          token={inviteData.token}
          onClose={() => setInviteData(null)}
        />
      )}
    </Layout>
  );
}
