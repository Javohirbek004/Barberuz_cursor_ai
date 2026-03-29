import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n/LanguageContext";
import NotFound from "@/pages/not-found";

// Pages
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import TelegramVerify from "@/pages/TelegramVerify";
import Dashboard from "@/pages/Dashboard";
import Calendar from "@/pages/Calendar";
import Clients from "@/pages/Clients";
import ClientDetail from "@/pages/ClientDetail";
import Settings from "@/pages/Settings";
import ProfileSettings from "@/pages/settings/ProfileSettings";
import NotificationSettings from "@/pages/settings/NotificationSettings";
import AnalyticsPage from "@/pages/settings/Analytics";
import SecuritySettings from "@/pages/settings/Security";
import PersonalPage from "@/pages/settings/PersonalPage";
import BonusPage from "@/pages/settings/BonusPage";
import FeedbackPage from "@/pages/settings/FeedbackPage";
import BarbersPage from "@/pages/settings/BarbersPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Smart root redirect — checks for token without blocking render */
function RootRedirect() {
  const token = localStorage.getItem('barber_token');
  return token ? <Redirect to="/dashboard" /> : <Redirect to="/register" />;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/verify-telegram" component={TelegramVerify} />

      {/* Root: go to dashboard if logged in, otherwise registration */}
      <Route path="/" component={RootRedirect} />

      <Route path="/dashboard" component={Dashboard} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/clients" component={Clients} />
      <Route path="/client/:id" component={ClientDetail} />

      <Route path="/settings" component={Settings} />
      <Route path="/settings/profile" component={ProfileSettings} />
      <Route path="/settings/page" component={PersonalPage} />
      <Route path="/settings/notifications" component={NotificationSettings} />
      <Route path="/settings/analytics" component={AnalyticsPage} />
      <Route path="/settings/security" component={SecuritySettings} />
      <Route path="/settings/bonus" component={BonusPage} />
      <Route path="/settings/feedback" component={FeedbackPage} />
      <Route path="/settings/barbers" component={BarbersPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRoutes />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
