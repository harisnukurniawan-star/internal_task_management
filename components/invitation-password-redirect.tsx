"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Supabase dashboard invitations can return to the configured Site URL with
 * credentials in the URL fragment. The fragment is not visible to Server
 * Components, so capture it globally before the normal dashboard route runs.
 *
 * Pending Internal Task Management activations and active PM-only identities
 * are sent to the existing shared set-password screen. PM-only users are not
 * granted an Internal Task Management profile by this bridge.
 */
export function InvitationPasswordRedirect() {
  useEffect(() => {
    let cancelled = false;

    async function handleInvitation() {
      const url = new URL(window.location.href);
      const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");
      const tokenType = fragment.get("type");

      if (!accessToken || !refreshToken || (tokenType && tokenType !== "invite" && tokenType !== "recovery" && tokenType !== "signup")) {
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (cancelled || error || !data.user) return;

      const { data: activationState, error: activationError } = await supabase.rpc(
        "get_my_activation_state",
      );

      if (cancelled) return;

      if (!activationError && activationState === "pending") {
        window.location.replace("/set-password");
        return;
      }

      // PM identities use the same Supabase Auth password as Internal Task
      // Management, but their application authorization remains PM-scoped.
      const { data: pmAccess, error: pmAccessError } = await supabase
        .from("project_manager_access")
        .select("user_id")
        .eq("user_id", data.user.id)
        .eq("active", true)
        .maybeSingle();

      if (cancelled) return;

      if (!pmAccessError && pmAccess) {
        window.location.replace("/set-password");
        return;
      }

      // Do not leave invitation credentials in the address bar.
      window.history.replaceState({}, "", url.pathname + url.search);
    }

    void handleInvitation();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
