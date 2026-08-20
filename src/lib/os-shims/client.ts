export const authEnabled = true;
export const GROK_PROVIDERS: { id: string; name: string }[] = [];
export async function signIn() {
  window.location.href = "/dashboard";
}
export async function signOut() {
  localStorage.removeItem("sm_token");
  localStorage.removeItem("token");
  localStorage.removeItem("clearance");
  window.location.href = "/painel";
}
export const authClient = {
  useSession: () => ({ data: null, isPending: false }),
};
