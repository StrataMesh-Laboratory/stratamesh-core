import { useEffect, useState } from "react";

export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  isDevFallback: boolean;
  clearance?: string;
};

export type CurrentUserState = { user: AppUser | null; isPending: boolean };

function readLiveUser(): AppUser | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("sm_token") || localStorage.getItem("token");
  if (!token) return null;
  const email = localStorage.getItem("sm_email") || localStorage.getItem("email");
  const clearance = localStorage.getItem("clearance") || "internal";
  return {
    id: email || "live-session",
    displayName: email,
    primaryEmail: email,
    profileImageUrl: null,
    isDevFallback: false,
    clearance,
  };
}

export function useCurrentUserState(): CurrentUserState {
  const [state, setState] = useState<CurrentUserState>({ user: null, isPending: true });
  useEffect(() => {
    setState({ user: readLiveUser(), isPending: false });
  }, []);
  return state;
}

export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
