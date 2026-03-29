import { useState, useRef } from "react";
import { useTranslation } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Copy, Download, CheckCheck, QrCode, ExternalLink, Share2 } from "lucide-react";
import QRCode from "react-qr-code";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function PersonalPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const username = user?.username || "barber";
  const pageUrl = `https://barber.uz/${username}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      toast({ title: t("page.link_copied") });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: t("error"), variant: "destructive" });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: user?.brandName || user?.name || "Barber", url: pageUrl });
    } else {
      handleCopy();
    }
  };

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = 400;
      canvas.height = 400;
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 400, 400);
        ctx.drawImage(img, 20, 20, 360, 360);
      }
      URL.revokeObjectURL(url);
      const link = document.createElement("a");
      link.download = `${username}-qr.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = url;
    toast({ title: t("page.qr_downloaded") });
  };

  return (
    <Layout>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="rounded-full bg-card hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold font-display">
          {user?.mode === "team" ? t("settings.page.team") : t("settings.page.solo")}
        </h1>
      </div>

      <div className="space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-6 bg-card/50 border-white/5">
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <QrCode className="w-4 h-4" />
                <span>{t("page.your_qr")}</span>
              </div>

              <div
                ref={qrRef}
                className="bg-white p-4 rounded-2xl shadow-lg shadow-black/20"
              >
                <QRCode
                  value={pageUrl}
                  size={200}
                  fgColor="#000000"
                  bgColor="#ffffff"
                  level="M"
                />
              </div>

              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">{t("page.url_label")}</p>
                <p className="font-mono text-sm text-primary font-bold break-all">{pageUrl}</p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3"
        >
          <Button
            variant="outline"
            onClick={handleCopy}
            className="flex flex-col gap-1.5 h-auto py-4 bg-card border-white/10 hover:bg-white/5 rounded-2xl"
          >
            {copied ? <CheckCheck className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
            <span className="text-xs">{copied ? t("page.copied") : t("page.copy")}</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleDownload}
            className="flex flex-col gap-1.5 h-auto py-4 bg-card border-white/10 hover:bg-white/5 rounded-2xl"
          >
            <Download className="w-5 h-5" />
            <span className="text-xs">{t("page.download")}</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleShare}
            className="flex flex-col gap-1.5 h-auto py-4 bg-card border-white/10 hover:bg-white/5 rounded-2xl"
          >
            <Share2 className="w-5 h-5" />
            <span className="text-xs">{t("page.share")}</span>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-5 bg-card/50 border-white/5">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              {t("page.how_to_use")}
            </p>
            <div className="space-y-3">
              {[
                { icon: "🖨️", text: t("page.tip1") },
                { icon: "📱", text: t("page.tip2") },
                { icon: "🔗", text: t("page.tip3") },
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-xl">{tip.icon}</span>
                  <p className="text-sm text-muted-foreground leading-relaxed">{tip.text}</p>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <a
            href={pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-5 bg-primary/10 border border-primary/20 rounded-2xl group hover:bg-primary/20 transition-colors"
          >
            <div>
              <p className="font-bold text-primary">{t("page.open_link")}</p>
              <p className="text-xs text-primary/70 mt-0.5">{t("page.open_link_desc")}</p>
            </div>
            <ExternalLink className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
          </a>
        </motion.div>
      </div>
    </Layout>
  );
}
