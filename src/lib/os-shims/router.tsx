import type { AnchorHTMLAttributes, ReactNode } from "react";

function hrefOf(to: string | undefined) {
  if (!to) return "/";
  if (to === "/login") return "/dashboard";
  return to;
}

export function Link({
  to,
  children,
  className,
  ...rest
}: { to?: string; children?: ReactNode; className?: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a href={hrefOf(to)} className={className} {...rest}>
      {children}
    </a>
  );
}

export function Navigate({ to }: { to?: string }) {
  if (typeof window !== "undefined" && to) window.location.replace(hrefOf(to));
  return null;
}

export function useRouter() {
  return { navigate: ({ to }: { to: string }) => { window.location.href = hrefOf(to); } };
}

export function createFileRoute() {
  return () => ({});
}
