import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  useSimulator,
  TelaEstrategia, TelaProducao, TelaMarketing,
  TelaPessoas, TelaFinancas, TelaResultados,
} from "@/components/simulator";

export const Route = createFileRoute("/")({
  component: Simulador,
});

type SecKey = "estrategia" | "producao" | "marketing" | "pessoas" | "financas" | "resultados";

const SECOES: Array<{ key: SecKey; label: string; icon: string }> = [
  { key: "estrategia",  label: "Estratégia",  icon: "🎯" },
  { key: "producao",    label: "Produção",    icon: "🏭" },
  { key: "marketing",   label: "Marketing",   icon: "📣" },
  { key: "pessoas",     label: "Pessoas",     icon: "👥" },
  { key: "financas",    label: "Finanças",    icon: "💰" },
  { key: "resultados",  label: "Resultados",  icon: "📊" },
];

function Simulador() {
  const ctx = useSimulator();
  const [sec, setSec] = useState<SecKey>("estrategia");

  return (
    <div className="min-h-screen bg-[#f4f6f7] text-foreground flex">
      {/* Sidebar */}
      <aside className="w-60 bg-[#0a4f4f] text-white flex flex-col">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="text-[11px] uppercase tracking-widest text-white/60">SES • FGV</div>
          <div className="text-lg font-semibold leading-tight mt-0.5">ThermoTech SA</div>
          <div className="text-xs text-white/60 mt-0.5">Simulador de Gestão</div>
        </div>
        <nav className="flex-1 py-3">
          {SECOES.map((s) => (
            <button
              key={s.key}
              onClick={() => setSec(s.key)}
              className={cn(
                "w-full text-left px-5 py-2.5 text-sm flex items-center gap-3 transition-colors border-l-4",
                sec === s.key
                  ? "bg-white/10 border-[#2dd4a7] text-white font-medium"
                  : "border-transparent text-white/75 hover:bg-white/5 hover:text-white",
              )}
            >
              <span className="text-base">{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </nav>
        <div className="px-5 py-3 border-t border-white/10 text-[11px] text-white/50 leading-relaxed">
          Sessão em memória — recarregar restaura o plano-base.
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-border px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {SECOES.find((s) => s.key === sec)?.label}
            </h1>
            <p className="text-xs text-muted-foreground">
              Planejamento — 8 períodos — motor de cálculo validado
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <MiniKPI label="ROE proj." value={(ctx.R.roe * 100).toFixed(1) + "%"} />
            <MiniKPI label="LL acum." value={fmtMoney(ctx.R.llAcum)} />
            <MiniKPI label="Caixa mín." value={fmtMoney(ctx.R.caixaMin)} tone={ctx.R.caixaMin < 0 ? "red" : undefined} />
            <MiniKPI label="Alertas" value={String(ctx.R.alertas.length)}
              tone={ctx.R.alertas.some((a) => !a.aviso) ? "red" : ctx.R.alertas.length ? "amber" : "green"} />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {sec === "estrategia" && <TelaEstrategia {...ctx} />}
          {sec === "producao" && <TelaProducao {...ctx} />}
          {sec === "marketing" && <TelaMarketing {...ctx} />}
          {sec === "pessoas" && <TelaPessoas {...ctx} />}
          {sec === "financas" && <TelaFinancas {...ctx} />}
          {sec === "resultados" && <TelaResultados {...ctx} />}
        </main>
      </div>
    </div>
  );
}

function fmtMoney(n: number) {
  return "$ " + new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n || 0);
}

function MiniKPI({ label, value, tone }: { label: string; value: string; tone?: "red" | "green" | "amber" }) {
  const color =
    tone === "red" ? "text-[#b23a4c]" :
    tone === "green" ? "text-[#0f8a5f]" :
    tone === "amber" ? "text-[#a06a00]" :
    "text-foreground";
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-semibold tabular-nums", color)}>{value}</div>
    </div>
  );
}
