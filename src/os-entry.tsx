import { createRoot } from "react-dom/client";
import { Painel } from "@/components/painel";
import "./styles.css";

const lang: "pt" | "en" = window.location.pathname.startsWith("/en") ? "en" : "pt";
document.documentElement.lang = lang === "en" ? "en-GB" : "pt-PT";
const pt = lang === "pt";

function Chrome() {
  return (
    <>
      <a className="skip-link" href="#conteudo">
        {pt ? "Saltar para o conteúdo" : "Skip to content"}
      </a>
      <div className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <a href="/" className="mono text-[0.75rem] text-muted">
            <strong className="text-fg">Calhegas Morais</strong> · {pt ? "Painel OS" : "OS panel"}
          </a>
          <nav className="mono flex flex-wrap items-center gap-3 text-[0.75rem] text-muted" aria-label={pt ? "Navegação" : "Navigation"}>
            <a href="/roadmap">{pt ? "Mapa" : "Map"}</a>
            <a href="/dashboard">{pt ? "Identidade" : "Identity"}</a>
            <a href="/painel" className={pt ? "border-b border-accent text-fg" : ""} hrefLang="pt-PT">
              PT
            </a>
            <span className="opacity-40">/</span>
            <a href="/en/painel" className={pt ? "" : "border-b border-accent text-fg"} hrefLang="en-GB">
              EN
            </a>
          </nav>
        </div>
      </div>
      <Painel lang={lang} />
    </>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Chrome />);
