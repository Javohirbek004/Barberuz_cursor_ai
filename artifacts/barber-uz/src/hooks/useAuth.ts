import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useGetCurrentUser, useLogoutUser } from '@workspace/api-client-react';

/**
 * Core auth hook used on every protected page.
 *
 * Behaviour:
 * - Calls GET /api/auth/me (hits DB → always fresh, including telegramVerified)
 * - Syncs the returned user object to localStorage so other parts of the app
 *   (e.g. TelegramVerify polling) can read up-to-date data without extra calls
 * - Redirects to /login if the token is missing or invalid
 */
export function useAuth(requireAuth = true) {
  const [, navigate] = useLocation();

  const { data: user, isLoading, error } = useGetCurrentUser({
    query: {
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  });

  // Keep localStorage in sync with the latest server data
  useEffect(() => {
    if (user) {
      localStorage.setItem('barber_user', JSON.stringify(user));
    }
  }, [user]);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (requireAuth && !isLoading && (error || !user)) {
      navigate('/login');
    }
  }, [user, isLoading, error, requireAuth, navigate]);

  const logoutMutation = useLogoutUser({
    mutation: {
      onSuccess: () => {
        localStorage.removeItem('barber_token');
        localStorage.removeItem('barber_user');
        navigate('/login');
      },
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: () => logoutMutation.mutate(),
  };
}

/**
 * checkVerificationStatus — call this on any page where you need to know
 * the up-to-date telegramVerified value immediately.
 *
 * Returns the verified flag from the latest server response.
 * This is a thin wrapper — the actual fetch is already performed by useAuth
 * via useGetCurrentUser, so no extra network request is made.
 */
export function useVerificationStatus() {
  const { user, isLoading } = useAuth(false); // non-blocking
  return {
    isVerified: user?.telegramVerified ?? false,
    isLoading,
  };
}
