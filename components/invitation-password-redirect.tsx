"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Supabase Auth may return invite/recovery tokens to the configured Site URL
 * (often /dashboard) in the URL fragment. Capture them before dashboard use.
 * Recovery links always open the shared password form. Invite links open it
 * for pending ITM activation or PM-only identities without creating an ITM
 * profile or granting ITM access.
 */
export function InvitationPasswordRedirect() {
  useEffect(() => {
    let cancelled = false;

    async function handleEmailAuthReturn() {
      const url = new URL(window.location.href);
      const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");
      const tokenType = fragment.get("type");

      if (!accessToken || !refreshToken) return;

      const isRecovery = tokenType === "recovery";
      const isInvite = tokenType === "invite" || tokenType === "signup";
      if (!isRecovery && !isInvite) return;

      const supabase = createClient();
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (cancelled || error || !data.user) return;

      // Password recovery must always land on the password form, including
      // when Supabase's Site URL sent the email link to /dashboard.
      if (isRecovery) {
        window.location.replace("/set-password");
        return;
      }

      const { data: activationState, error: activationError } = await supabase.rpc(
        "get_my_activation_state",
      );

      if (cancelled) return;

      if (!activationError && activationState === "pending") {
        window.location.replace("/set-password");
        return;
      }

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

      // Avoid leaving credentials in the address bar for unrelated accounts.
      window.history.replaceState({}, "", url.pathname + url.search);
    }

    void handleEmailAuthReturn();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
