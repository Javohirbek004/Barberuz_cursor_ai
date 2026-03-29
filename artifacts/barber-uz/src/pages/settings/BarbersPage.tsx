import { useState } from "react";
import { useTranslation } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Plus, X, Scissors, Clock, Phone, Star, MoreVertical, UserCheck, UserX } from "lucide-react";
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
  },
];

export default function BarbersPage() {
  const { t } = useTranslation();
  useAuth();
  const { toast } = useToast();

  const [barbers, setBarbers] = useState<Barber[]>(INITIAL_BARBERS);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    speciality: "",
    workStart: "09:00",
    workEnd: "18:00",
  });

  const handleAdd = () => {
    if (!form.name.trim()) {
      toast({ title: t("barbers.name_required"), variant: "destructive" });
      return;
    }
    const newBarber: Barber = {
      id: Date.now().toString(),
      name: form.name,
      phone: form.phone,
      speciality: form.speciality || t("barbers.default_speciality"),
      workStart: form.workStart,
      workEnd: form.workEnd,
      active: true,
      rating: 0,
      totalBookings: 0,
    };
    setBarbers((prev) => [...prev, newBarber]);
    setForm({ name: "", phone: "", speciality: "", workStart: "09:00", workEnd: "18:00" });
    setShowDialog(false);
    toast({ title: t("barbers.added") });
  };

  const toggleActive = (id: string) => {
    setBarbers((prev) =>
      prev.map((b) => (b.id === id ? { ...b, active: !b.active } : b))
    );
  };

  const handleDelete = (id: string) => {
    setBarbers((prev) => prev.filter((b) => b.id !== id));
    toast({ title: t("barbers.deleted") });
  };

  const activeCount = barbers.filter((b) => b.active).length;

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
                      <p className="font-bold text-foreground">{barber.name}</p>
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
                    <DropdownMenuContent align="end" className="w-44">
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
            <DialogTitle>{t("barbers.add_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>{t("register.name")} *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("barbers.name_placeholder")}
                className="bg-background/50 h-12"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("barbers.phone_label")}</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+998 90 000 00 00"
                className="bg-background/50 h-12"
                type="tel"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("barbers.speciality_label")}</Label>
              <Input
                value={form.speciality}
                onChange={(e) => setForm({ ...form, speciality: e.target.value })}
                placeholder={t("barbers.speciality_placeholder")}
                className="bg-background/50 h-12"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("profile.hours")}</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="time"
                  value={form.workStart}
                  onChange={(e) => setForm({ ...form, workStart: e.target.value })}
                  className="bg-background/50 h-12"
                />
                <Input
                  type="time"
                  value={form.workEnd}
                  onChange={(e) => setForm({ ...form, workEnd: e.target.value })}
                  className="bg-background/50 h-12"
                />
              </div>
            </div>
            <Button onClick={handleAdd} className="w-full h-12 font-bold rounded-xl">
              {t("barbers.confirm_add")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
