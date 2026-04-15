import { useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useGetCurrentUser, useLogoutUser } from '@workspace/api-client-react';

function getBarberMemberFromStorage() {
  try {
    const raw = localStorage.getItem('barber_user');
    if (!raw) return null;
    const u = JSON.parse(raw);
    if ((u?.mode as string) === 'barber_member') return u;
    return null;
  } catch {
    return null;
  }
}

/**
 * Core auth hook used on every protected page.
 *
 * Behaviour:
 * - If localStorage has a barber_member user (UI mock, no real session),
 *   returns that user directly without calling the API.
 * - Otherwise calls GET /api/auth/me (hits DB → always fresh)
 * - Syncs the returned user object to localStorage
 * - Redirects to /login if the token is missing or invalid
 */
export function useAuth(requireAuth = true) {
  const [, navigate] = useLocation();

  const localMember = useMemo(() => getBarberMemberFromStorage(), []);
  const isBarberMember = !!localMember;

  const { data: apiUser, isLoading: apiLoading, error } = useGetCurrentUser({
    query: {
      retry: false,
      staleTime: 5 * 60 * 1000,
      enabled: !isBarberMember,
    },
  });

  const user = isBarberMember ? localMember : apiUser;
  const isLoading = isBarberMember ? false : apiLoading;

  // Keep localStorage in sync with the latest server data (real users only)
  useEffect(() => {
    if (apiUser && !isBarberMember) {
      localStorage.setItem('barber_user', JSON.stringify(apiUser));
    }
  }, [apiUser, isBarberMember]);

  // Redirect unauthenticated users to login (skip for barber_member)
  useEffect(() => {
    if (isBarberMember) return;
    if (requireAuth && !apiLoading && (error || !apiUser)) {
      navigate('/login');
    }
  }, [apiUser, apiLoading, error, requireAuth, navigate, isBarberMember]);

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
    logout: () => {
      if (isBarberMember) {
        localStorage.removeItem('barber_token');
        localStorage.removeItem('barber_user');
        navigate('/login');
      } else {
        logoutMutation.mutate();
      }
    },
  };
}

/**
 * checkVerificationStatus — call this on any page where you need to know
 * the up-to-date telegramVerified value immediately.
 */
export function useVerificationStatus() {
  const { user, isLoading } = useAuth(false);
  return {
    isVerified: user?.telegramVerified ?? false,
    isLoading,
  };
}
