import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface ServiceCategory {
  id: string;
  barberId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export const CATEGORIES_KEY = ["categories"] as const;

export function useListCategories() {
  return useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: () => customFetch<{ categories: ServiceCategory[] }>("/api/categories"),
    select: (data) => data.categories,
    staleTime: 30_000,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation<ServiceCategory, Error, string>({
    mutationFn: (name: string) =>
      customFetch<ServiceCategory>("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation<ServiceCategory, Error, { id: string; name: string }>({
    mutationFn: ({ id, name }) =>
      customFetch<ServiceCategory>(`/api/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (id: string) =>
      customFetch(`/api/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  });
}
