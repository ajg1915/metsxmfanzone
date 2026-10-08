import { useEffect } from "react";
import { markEngaged } from "@/lib/promptCoordinator";

/** Call on pages where someone reads or watches (articles, streams) so the notification request can follow. */
export const useMarkEngaged = () => {
  useEffect(() => {
    markEngaged();
  }, []);
};
