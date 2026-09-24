import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface BackgroundSetting {
  id: string;
  page_type: string;
  background_type: string;
  background_value: string;
  is_active: boolean;
  name: string;
}

export const useBackgroundSettings = (pageType: "auth" | "auth_login" | "auth_signup" | "welcome") => {
  return useQuery({
    queryKey: ["active-background", pageType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("background_settings")
        .select("*")
        .eq("page_type", pageType)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return (data as BackgroundSetting | null) ?? null;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};
