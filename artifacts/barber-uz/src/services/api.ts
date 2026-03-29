/**
 * API Service Layer — Barber.uz
 *
 * This file is the single source of truth for all data operations.
 * When migrating to Cursor + Supabase, replace the implementations
 * in this file. The rest of the app stays the same.
 *
 * Current: React Query hooks from @workspace/api-client-react (Express + PostgreSQL)
 * Future:  Replace with Supabase client calls
 */

export {
  useGetCurrentUser,
  useLoginUser,
  useRegisterUser,
  useLogoutUser,
  useGetProfile,
  useUpdateProfile,
  useUpdatePassword,
  useListBookings,
  useCreateBooking,
  useUpdateBooking,
  useDeleteBooking,
  useGetBooking,
  useListClients,
  useGetClient,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  useListServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
  useGetDashboardStats,
  useGetAnalytics,
  useGetNotificationSettings,
  useUpdateNotificationSettings,
} from "@workspace/api-client-react";
