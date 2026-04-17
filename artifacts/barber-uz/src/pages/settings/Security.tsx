import { useState } from "react";
import { useTranslation } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { useUpdatePassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SecuritySettings() {
  const { t } = useTranslation();
  useAuth();
  const { toast } = useToast();
  const updatePasswordMutation = useUpdatePassword();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || newPassword.length < 6) return;
    
    updatePasswordMutation.mutate({
      data: { oldPassword, newPassword }
    }, {
      onSuccess: () => {
        toast({ title: t('success') });
        setOldPassword("");
        setNewPassword("");
      },
      onError: (err) => {
        toast({ title: t('error'), description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Layout>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="rounded-full bg-card hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold font-display">{t('security.title')}</h1>
      </div>

      <div className="flex flex-col items-center justify-center py-8 mb-4">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 mb-4">
          <ShieldCheck className="w-10 h-10 text-emerald-400" />
        </div>
        <p className="text-muted-foreground text-center px-4">
          {t('security.protected_msg')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-card/50 p-6 rounded-3xl border border-white/5 space-y-4">
          <h3 className="font-bold text-lg mb-2">{t('security.pwd_update')}</h3>
          <div className="space-y-2">
            <Label>{t('security.old_pwd')}</Label>
            <Input 
              type="password" 
              value={oldPassword} 
              onChange={e => setOldPassword(e.target.value)} 
              className="bg-background/50 h-12 border-white/10 focus-visible:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('security.new_pwd')}</Label>
            <Input 
              type="password" 
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)} 
              className="bg-background/50 h-12 border-white/10 focus-visible:ring-primary"
              placeholder={t('security.new_pwd_placeholder')}
            />
          </div>
        </div>

        <Button 
          type="submit" 
          disabled={updatePasswordMutation.isPending || !oldPassword || newPassword.length < 6}
          className="w-full h-14 text-lg font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-lg shadow-primary/20"
        >
          {updatePasswordMutation.isPending && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
          {t('profile.save')}
        </Button>
      </form>
    </Layout>
  );
}
