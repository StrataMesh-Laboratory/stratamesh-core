import type { ReactNode } from "react";
import { useCurrentUser, useCurrentUserState } from "./user";

export const SIGN_IN_PATH = "/dashboard";

export function SignedIn({ children }: { children: ReactNode }) {
  const { user } = useCurrentUserState();
  return user ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending || user) return null;
  return <>{children}</>;
}

export function RedirectToSignIn({ to = SIGN_IN_PATH }: { to?: string }) {
  if (typeof window !== "undefined") window.location.replace(to);
  return null;
}

export function UserButton() {
  const user = useCurrentUser();
  if (!user) return null;
  return <span className="mono text-[0.75rem] text-muted">{user.primaryEmail}</span>;
}
