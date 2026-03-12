import { useTranslation } from "@/i18n/LanguageContext";
import { Globe, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function LanguageSwitcher() {
  const { lang, setLang } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-panel border border-white/10 text-white/80 hover:text-white hover:border-white/25 transition-all text-sm font-semibold select-none focus:outline-none">
          <Globe className="w-4 h-4 text-primary" />
          <span>{lang.toUpperCase()}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card/95 backdrop-blur-xl border-white/10 min-w-[120px]">
        <DropdownMenuItem
          onClick={() => setLang('uz')}
          className={`cursor-pointer gap-2 ${lang === 'uz' ? 'text-primary font-bold' : ''}`}
        >
          🇺🇿 O'zbekcha
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setLang('ru')}
          className={`cursor-pointer gap-2 ${lang === 'ru' ? 'text-primary font-bold' : ''}`}
        >
          🇷🇺 Русский
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
