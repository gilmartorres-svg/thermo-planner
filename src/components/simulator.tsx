import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import {
  planoInicial, simular, P, REGIOES, META_LL, META_ROE, TETO_PROP,
  type EstadoPlano, type ResultadoSimulacao, type FormaPagamento,
} from "@/lib/engine";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── formatters ─────────────────────────────────────────────
export const fmt0 = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n || 0);
export const fmt2 = (n: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
export const money = (n: number) => "$ " + fmt2(n);

export const COLORS = {
  r1: "#f0b429", r2: "#4a90d9", r3: "#2dd4a7", total: "#e05a6f",
  cap: "#4a90d9", prod: "#2dd4a7",
  disp: "#4a90d9", contr: "#2dd4a7", demit: "#e05a6f",
};

// ─── plan context ─────────────────────────────────────────────
export interface SimCtx {
  S: EstadoPlano;
  R: ResultadoSimulacao;
  setScalar: (key: keyof EstadoPlano, v: number | string) => void;
  setPer: (key: keyof EstadoPlano, p: number, v: number) => void;
  setPerReg: (key: keyof EstadoPlano, p: number, r: number, v: number) => void;
  setEstado: (novo: EstadoPlano) => void;
  resetar: () => void;
}

export function useSimulator(): SimCtx {
  const [S, setS] = useState<EstadoPlano>(() => planoInicial());
  const R = useMemo(() => simular(S), [S]);
  const setScalar = useCallback((k: keyof EstadoPlano, v: number | string) => {
    setS((prev) => ({ ...prev, [k]: v as never }));
  }, []);
  const setPer = useCallback((k: keyof EstadoPlano, p: number, v: number) => {
    setS((prev) => {
      const arr = [...(prev[k] as number[])];
      arr[p] = v;
      return { ...prev, [k]: arr } as EstadoPlano;
    });
  }, []);
  const setPerReg = useCallback((k: keyof EstadoPlano, p: number, r: number, v: number) => {
    setS((prev) => {
      const mat = (prev[k] as number[][]).map((row) => [...row]);
      mat[p][r] = v;
      return { ...prev, [k]: mat } as EstadoPlano;
    });
  }, []);
  const setEstado = useCallback((novo: EstadoPlano) => setS(novo), []);
  const resetar = useCallback(() => setS(planoInicial()), []);
  return { S, R, setScalar, setPer, setPerReg, setEstado, resetar };
}


// ─── UI atoms ─────────────────────────────────────────────


// A cleaner controlled numeric cell that syncs to external value
export function NumCell({
  value, onCommit, disabled, warn,
}: { value: number; onCommit: (v: number) => void; disabled?: boolean; warn?: boolean }) {
  const [local, setLocal] = useState(String(value ?? 0));
  useEffect(() => { setLocal(String(value ?? 0)); }, [value]);
  return (
    <input
      type="number"
      inputMode="decimal"
      className={cn(
        "w-full min-w-[64px] h-10 sm:h-8 px-2 py-1 text-right text-sm bg-transparent border border-transparent rounded",
        "focus:border-primary focus:bg-background focus:outline-none",
        "hover:border-border transition-colors",
        disabled && "opacity-60 cursor-not-allowed bg-muted/40",
        warn && "bg-amber-50 border-amber-300 text-amber-900",
      )}
      value={local}
      disabled={disabled}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const n = Number(String(local).replace(",", ".")) || 0;
        if (n !== value) onCommit(n);
        setLocal(String(n));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
      }}
    />
  );
}

export function SectionCard({
  title, icon, children, right,
}: { title: string; icon?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-md overflow-hidden border border-border bg-card shadow-sm">
      <header className="bg-[#0f6f6f] text-white px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-lg leading-none">{icon}</span>}
          <h3 className="font-semibold tracking-wide uppercase text-sm">{title}</h3>
        </div>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Zebra({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded border border-border -mx-1 sm:mx-0">
      <table className="w-full min-w-max text-xs sm:text-sm [&_th]:bg-[#e6efef] [&_th]:text-foreground [&_th]:font-semibold [&_th]:text-left [&_th]:px-3 [&_th]:py-2 [&_th]:whitespace-nowrap [&_td]:px-3 [&_td]:py-1.5 [&_td]:border-t [&_td]:border-border [&_td]:whitespace-nowrap [&_tbody_tr:nth-child(even)]:bg-muted/40 [&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:z-10 [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:bg-card [&_tbody_tr:nth-child(even)_td:first-child]:bg-[#eef1f1]">
        {children}
      </table>
    </div>
  );
}

// ─── Chart helpers ─────────────────────────────────────────────
function chartData<K extends string>(
  values: Record<K, number[]>, keys: K[],
): Array<Record<string, number | string>> {
  const rows: Array<Record<string, number | string>> = [];
  for (let p = 1; p <= P; p++) {
    const r: Record<string, number | string> = { periodo: `P${p}` };
    for (const k of keys) r[k] = values[k][p] ?? 0;
    rows.push(r);
  }
  return rows;
}

// ═══════════════════════════════════════════════════════════════
// SCREEN 1 — ESTRATÉGIA
// ═══════════════════════════════════════════════════════════════
export function TelaEstrategia({ S, R, setPer, setScalar }: SimCtx) {
  const data = chartData({ Capacidade: R.cap, Produção: R.prod }, ["Capacidade", "Produção"]);
  return (
    <div className="space-y-4">
      <SectionCard title="Capacidade vs. Produção" icon="📊">
        <div className="h-52 sm:h-72">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="periodo" />
              <YAxis tickFormatter={(v) => fmt0(v as number)} />
              <Tooltip formatter={(v: number) => fmt0(v)} />
              <Legend />
              <Bar dataKey="Capacidade" fill={COLORS.cap} />
              <Bar dataKey="Produção" fill={COLORS.prod} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard title="Planejamento — Estratégia" icon="🏭">
        <Zebra>
          <thead>
            <tr>
              <th>Período</th>
              <th>Situação da fábrica</th>
              <th className="!text-right">Capacidade inicial</th>
              <th className="!text-right">Capacidade disponível em T</th>
              <th className="!text-right">Expansão para T+1</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: P }, (_, i) => i + 1).map((p) => {
              const situ = (S.exp[p] || 0) > 0 ? "Expansão programada" : "Estável";
              return (
                <tr key={p}>
                  <td className="font-medium">P{p}</td>
                  <td className="text-muted-foreground">{situ}</td>
                  {p === 1 ? (
                    <td className="w-40"><NumCell value={S.capIni} onCommit={(v) => setScalar("capIni", v)} /></td>
                  ) : (
                    <td className="text-right">{fmt0(R.cap[p - 1] || 0)}</td>
                  )}
                  <td className="text-right font-medium">{fmt0(R.cap[p])}</td>
                  <td className="w-40">
                    {p < P ? (
                      <NumCell value={S.exp[p]} onCommit={(v) => setPer("exp", p, v)} />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Zebra>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SCREEN 2 — PRODUÇÃO
// ═══════════════════════════════════════════════════════════════
export function TelaProducao({ S, R, setPer }: SimCtx) {
  const data = chartData({ Capacidade: R.cap, Produção: R.prod }, ["Capacidade", "Produção"]);
  return (
    <div className="space-y-4">
      <SectionCard title="Capacidade vs. Produção" icon="⚙️">
        <div className="h-52 sm:h-72">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="periodo" />
              <YAxis tickFormatter={(v) => fmt0(v as number)} />
              <Tooltip formatter={(v: number) => fmt0(v)} />
              <Legend />
              <Bar dataKey="Capacidade" fill={COLORS.cap} />
              <Bar dataKey="Produção" fill={COLORS.prod} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard title="Planejamento — Produção" icon="🏭">
        <Zebra>
          <thead>
            <tr>
              <th>Período</th>
              <th className="!text-right">Capacidade disponível</th>
              <th className="!text-right">Programação p/ T+1</th>
              <th className="!text-right">Compra MP p/ T+1</th>
              <th className="!text-right">Horas de MOD (T+1)</th>
              <th className="!text-right">Produção</th>
              <th className="!text-right">Estoque Final MP</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: P }, (_, i) => i + 1).map((p) => (
              <tr key={p}>
                <td className="font-medium">P{p}</td>
                <td className="text-right">{fmt0(R.cap[p])}</td>
                <td className="w-32">
                  <NumCell value={S.prog[p]} onCommit={(v) => setPer("prog", p, v)} />
                </td>
                <td className="w-32">
                  <NumCell value={S.mp[p]} onCommit={(v) => setPer("mp", p, v)} />
                </td>
                <td className="text-right text-muted-foreground">{fmt0((R.op[p] || 0) * 480)}</td>
                <td className="text-right font-medium">{fmt0(R.prod[p])}</td>
                <td className="text-right">{fmt0(R.mpFim[p])}</td>
              </tr>
            ))}
          </tbody>
        </Zebra>
        <p className="mt-3 text-xs text-muted-foreground">
          Produção usa MP disponível, horas de MOD e capacidade — o mínimo dita a saída real.
        </p>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SCREEN 3 — MARKETING
// ═══════════════════════════════════════════════════════════════
export function TelaMarketing({ S, R, setPer, setPerReg, setScalar }: SimCtx) {
  return (
    <Tabs defaultValue="previsao" className="w-full">
      <TabsList className="bg-muted flex w-full max-w-full overflow-x-auto justify-start h-auto whitespace-nowrap">
        <TabsTrigger value="previsao">Previsão</TabsTrigger>
        <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
        <TabsTrigger value="propaganda">Propaganda</TabsTrigger>
        <TabsTrigger value="preco">Preço</TabsTrigger>
        <TabsTrigger value="pd">P&D</TabsTrigger>
      </TabsList>

      <TabsContent value="previsao" className="mt-4">
        <MktPrevisao S={S} R={R} setPerReg={setPerReg} />
      </TabsContent>
      <TabsContent value="vendedores" className="mt-4">
        <MktVendedores S={S} R={R} setPerReg={setPerReg} />
      </TabsContent>
      <TabsContent value="propaganda" className="mt-4">
        <MktPropaganda S={S} setPerReg={setPerReg} />
      </TabsContent>
      <TabsContent value="preco" className="mt-4">
        <MktPreco S={S} setPerReg={setPerReg} setScalar={setScalar} />
      </TabsContent>
      <TabsContent value="pd" className="mt-4">
        <MktPD S={S} setPer={setPer} />
      </TabsContent>
    </Tabs>
  );
}

function MktPrevisao({
  S, R, setPerReg,
}: { S: EstadoPlano; R: ResultadoSimulacao; setPerReg: SimCtx["setPerReg"] }) {
  const r1: number[] = Array(P + 1).fill(0);
  const r2: number[] = Array(P + 1).fill(0);
  const r3: number[] = Array(P + 1).fill(0);
  const tot: number[] = Array(P + 1).fill(0);
  for (let p = 1; p <= P; p++) {
    r1[p] = S.vendas[p][0] || 0; r2[p] = S.vendas[p][1] || 0; r3[p] = S.vendas[p][2] || 0;
    tot[p] = r1[p] + r2[p] + r3[p];
  }
  const data = chartData({ "Região 1": r1, "Região 2": r2, "Região 3": r3, "Total": tot },
    ["Região 1", "Região 2", "Região 3", "Total"]);
  return (
    <div className="space-y-4">
      <SectionCard title="Previsão de Vendas por Região" icon="📈">
        <div className="h-52 sm:h-72">
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="periodo" />
              <YAxis tickFormatter={(v) => fmt0(v as number)} />
              <Tooltip formatter={(v: number) => fmt0(v)} />
              <Legend />
              <Line type="monotone" dataKey="Região 1" stroke={COLORS.r1} strokeWidth={2} />
              <Line type="monotone" dataKey="Região 2" stroke={COLORS.r2} strokeWidth={2} />
              <Line type="monotone" dataKey="Região 3" stroke={COLORS.r3} strokeWidth={2} />
              <Line type="monotone" dataKey="Total" stroke={COLORS.total} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard title="Planejamento — Previsão de Vendas" icon="🎯"
        right={<span className="text-xs text-white/85">Distribuição: prioridade R2 &gt; R3 &gt; R1</span>}>
        <Zebra>
          <thead>
            <tr>
              <th>Período</th>
              <th className="!text-right">Disponível p/ venda</th>
              <th className="!text-right">Região 1</th>
              <th className="!text-right">Região 2</th>
              <th className="!text-right">Região 3</th>
              <th className="!text-right">Previsão total</th>
              <th className="!text-right">Estoque final PA</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: P }, (_, i) => i + 1).map((p) => {
              const disp = (R.paFim[p - 1] || 0) + R.prod[p];
              const total = (S.vendas[p][0] || 0) + (S.vendas[p][1] || 0) + (S.vendas[p][2] || 0);
              const warn = total > disp;
              return (
                <tr key={p}>
                  <td className="font-medium">P{p}</td>
                  <td className="text-right">{fmt0(disp)}</td>
                  {[0, 1, 2].map((r) => (
                    <td key={r} className="w-28">
                      <NumCell value={S.vendas[p][r]} onCommit={(v) => setPerReg("vendas", p, r, v)} />
                    </td>
                  ))}
                  <td className={cn("text-right font-medium", warn && "text-amber-700")}>{fmt0(total)}</td>
                  <td className="text-right">{fmt0(R.paFim[p])}</td>
                </tr>
              );
            })}
          </tbody>
        </Zebra>
      </SectionCard>
    </div>
  );
}

function MktVendedores({
  S, R, setPerReg,
}: { S: EstadoPlano; R: ResultadoSimulacao; setPerReg: SimCtx["setPerReg"] }) {
  const r1: number[] = Array(P + 1).fill(0);
  const r2: number[] = Array(P + 1).fill(0);
  const r3: number[] = Array(P + 1).fill(0);
  const tot: number[] = Array(P + 1).fill(0);
  for (let p = 1; p <= P; p++) {
    r1[p] = S.vend[p][0] || 0; r2[p] = S.vend[p][1] || 0; r3[p] = S.vend[p][2] || 0;
    tot[p] = r1[p] + r2[p] + r3[p];
  }
  const data = chartData({ "Região 1": r1, "Região 2": r2, "Região 3": r3, "Total": tot },
    ["Região 1", "Região 2", "Região 3", "Total"]);
  return (
    <div className="space-y-4">
      <SectionCard title="Alocação de Vendedores" icon="🧑‍💼">
        <div className="h-52 sm:h-72">
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="periodo" />
              <YAxis tickFormatter={(v) => fmt0(v as number)} />
              <Tooltip formatter={(v: number) => fmt0(v)} />
              <Legend />
              <Line type="monotone" dataKey="Região 1" stroke={COLORS.r1} strokeWidth={2} />
              <Line type="monotone" dataKey="Região 2" stroke={COLORS.r2} strokeWidth={2} />
              <Line type="monotone" dataKey="Região 3" stroke={COLORS.r3} strokeWidth={2} />
              <Line type="monotone" dataKey="Total" stroke={COLORS.total} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard title="Planejamento — Vendedores por Região" icon="📋">
        <Zebra>
          <thead>
            <tr>
              <th>Período</th>
              <th className="!text-right">Disponíveis</th>
              <th className="!text-right">Região 1</th>
              <th className="!text-right">Região 2</th>
              <th className="!text-right">Região 3</th>
              <th className="!text-right">Alocados</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: P }, (_, i) => i + 1).map((p) => {
              const aloc = (S.vend[p][0] || 0) + (S.vend[p][1] || 0) + (S.vend[p][2] || 0);
              const warn = aloc > R.vd[p];
              return (
                <tr key={p}>
                  <td className="font-medium">P{p}</td>
                  <td className="text-right">{fmt0(R.vd[p])}</td>
                  {[0, 1, 2].map((r) => (
                    <td key={r} className="w-28">
                      <NumCell value={S.vend[p][r]} onCommit={(v) => setPerReg("vend", p, r, v)} />
                    </td>
                  ))}
                  <td className={cn("text-right font-medium", warn && "text-amber-700")}>{fmt0(aloc)}</td>
                </tr>
              );
            })}
          </tbody>
        </Zebra>
      </SectionCard>
    </div>
  );
}

function MktPropaganda({
  S, setPerReg,
}: { S: EstadoPlano; setPerReg: SimCtx["setPerReg"] }) {
  return (
    <SectionCard title="Propaganda por Mídia e Região" icon="📣"
      right={<span className="text-xs text-white/85">Teto por campo: {money(TETO_PROP)}</span>}>
      <Zebra>
        <thead>
          <tr>
            <th>Período</th>
            <th className="!text-right" colSpan={3}>Tradicional (R1 / R2 / R3)</th>
            <th className="!text-right" colSpan={3}>Online (R1 / R2 / R3)</th>
            <th className="!text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: P }, (_, i) => i + 1).map((p) => {
            const total = [0, 1, 2].reduce((s, r) => s + (S.propT[p][r] || 0) + (S.propO[p][r] || 0), 0);
            return (
              <tr key={p}>
                <td className="font-medium">P{p}</td>
                {[0, 1, 2].map((r) => (
                  <td key={"t" + r} className="w-24">
                    <NumCell
                      value={S.propT[p][r]}
                      onCommit={(v) => setPerReg("propT", p, r, v)}
                      warn={(S.propT[p][r] || 0) > TETO_PROP}
                    />
                  </td>
                ))}
                {[0, 1, 2].map((r) => (
                  <td key={"o" + r} className="w-24">
                    <NumCell
                      value={S.propO[p][r]}
                      onCommit={(v) => setPerReg("propO", p, r, v)}
                      warn={(S.propO[p][r] || 0) > TETO_PROP}
                    />
                  </td>
                ))}
                <td className="text-right font-medium">{money(total)}</td>
              </tr>
            );
          })}
        </tbody>
      </Zebra>
    </SectionCard>
  );
}

function MktPreco({
  S, setPerReg, setScalar,
}: { S: EstadoPlano; setPerReg: SimCtx["setPerReg"]; setScalar: SimCtx["setScalar"] }) {
  const r1: number[] = Array(P + 1).fill(0);
  const r2: number[] = Array(P + 1).fill(0);
  const r3: number[] = Array(P + 1).fill(0);
  for (let p = 1; p <= P; p++) {
    r1[p] = S.preco[p][0] || 0; r2[p] = S.preco[p][1] || 0; r3[p] = S.preco[p][2] || 0;
  }
  const data = chartData({ "Região 1": r1, "Região 2": r2, "Região 3": r3 },
    ["Região 1", "Região 2", "Região 3"]);
  return (
    <div className="space-y-4">
      <SectionCard title="Preço por Região" icon="💲"
        right={
          <div className="flex items-center gap-2 text-xs">
            <label className="text-white/85">Forma de pagamento:</label>
            <select
              className="rounded px-2 py-1 text-foreground bg-background text-xs"
              value={S.pagto}
              onChange={(e) => setScalar("pagto", e.target.value as FormaPagamento)}
            >
              <option value="100">100% em T</option>
              <option value="5050">50% T / 50% T+1</option>
              <option value="333334">33% / 33% / 34%</option>
            </select>
          </div>
        }>
        <div className="h-52 sm:h-72">
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="periodo" />
              <YAxis tickFormatter={(v) => fmt0(v as number)} />
              <Tooltip formatter={(v: number) => money(v)} />
              <Legend />
              <Line type="monotone" dataKey="Região 1" stroke={COLORS.r1} strokeWidth={2} />
              <Line type="monotone" dataKey="Região 2" stroke={COLORS.r2} strokeWidth={2} />
              <Line type="monotone" dataKey="Região 3" stroke={COLORS.r3} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard title="Planejamento — Preços" icon="💰">
        <Zebra>
          <thead>
            <tr>
              <th>Período</th>
              {REGIOES.map((r) => <th key={r} className="!text-right">{r}</th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: P }, (_, i) => i + 1).map((p) => (
              <tr key={p}>
                <td className="font-medium">P{p}</td>
                {[0, 1, 2].map((r) => (
                  <td key={r} className="w-28">
                    <NumCell value={S.preco[p][r]} onCommit={(v) => setPerReg("preco", p, r, v)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Zebra>
      </SectionCard>
    </div>
  );
}

function MktPD({ S, setPer }: { S: EstadoPlano; setPer: SimCtx["setPer"] }) {
  const serie: number[] = Array(P + 1).fill(0);
  let ac = 0;
  const acumulado: number[] = Array(P + 1).fill(0);
  for (let p = 1; p <= P; p++) {
    serie[p] = S.pd[p] || 0;
    ac += serie[p]; acumulado[p] = ac;
  }
  const data = chartData({ "P&D": serie, "Acumulado": acumulado }, ["P&D", "Acumulado"]);
  const total = ac;
  const alvo = 102000;
  const pct = Math.min(100, (total / alvo) * 100);
  return (
    <div className="space-y-4">
      <SectionCard title="Investimento em P&D" icon="🔬">
        <div className="h-52 sm:h-72">
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="periodo" />
              <YAxis tickFormatter={(v) => fmt0(v as number)} />
              <Tooltip formatter={(v: number) => money(v)} />
              <Legend />
              <Line type="monotone" dataKey="P&D" stroke={COLORS.r2} strokeWidth={2} />
              <Line type="monotone" dataKey="Acumulado" stroke={COLORS.total} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span>Acumulado: <strong>{money(total)}</strong></span>
            <span className="text-muted-foreground">Saturação: {money(alvo)}</span>
          </div>
          <div className="h-2 w-full rounded bg-muted overflow-hidden">
            <div
              className={cn("h-full transition-all", pct >= 100 ? "bg-[#2dd4a7]" : "bg-[#4a90d9]")}
              style={{ width: pct + "%" }}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Planejamento — P&D por Período" icon="📊">
        <Zebra>
          <thead>
            <tr>
              <th>Período</th>
              <th className="!text-right">Investimento</th>
              <th className="!text-right">Acumulado</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: P }, (_, i) => i + 1).map((p) => (
              <tr key={p}>
                <td className="font-medium">P{p}</td>
                <td className="w-40"><NumCell value={S.pd[p]} onCommit={(v) => setPer("pd", p, v)} /></td>
                <td className="text-right">{money(acumulado[p])}</td>
              </tr>
            ))}
          </tbody>
        </Zebra>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SCREEN 4 — PESSOAS
// ═══════════════════════════════════════════════════════════════
export function TelaPessoas({ S, R, setPer }: SimCtx) {
  return (
    <Tabs defaultValue="op" className="w-full">
      <TabsList className="bg-muted flex w-full max-w-full overflow-x-auto justify-start h-auto whitespace-nowrap">
        <TabsTrigger value="op">Operacional</TabsTrigger>
        <TabsTrigger value="cm">Comercial</TabsTrigger>
      </TabsList>

      <TabsContent value="op" className="mt-4 space-y-4">
        <GrupoRH titulo="Operários (OP)" icon="👷" disp={R.op}
          C={S.opC} D={S.opD} setC={(p, v) => setPer("opC", p, v)} setD={(p, v) => setPer("opD", p, v)} />
        <GrupoRH titulo="Supervisores de Produção (SP)" icon="🧭" disp={R.sp}
          C={S.spC} D={S.spD} setC={(p, v) => setPer("spC", p, v)} setD={(p, v) => setPer("spD", p, v)} />
      </TabsContent>

      <TabsContent value="cm" className="mt-4 space-y-4">
        <GrupoRH titulo="Vendedores (VD)" icon="🧑‍💼" disp={R.vd}
          C={S.vdC} D={S.vdD} setC={(p, v) => setPer("vdC", p, v)} setD={(p, v) => setPer("vdD", p, v)} />
        <GrupoRH titulo="Supervisores de Venda (SV)" icon="🎯" disp={R.sv}
          C={S.svC} D={S.svD} setC={(p, v) => setPer("svC", p, v)} setD={(p, v) => setPer("svD", p, v)} />
        <SectionCard title="Comissão de Vendas (%)" icon="💼">
          <Zebra>
            <thead>
              <tr>
                <th>Período</th>
                <th className="!text-right">Comissão (%)</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: P }, (_, i) => i + 1).map((p) => (
                <tr key={p}>
                  <td className="font-medium">P{p}</td>
                  <td className="w-40"><NumCell value={S.com[p]} onCommit={(v) => setPer("com", p, v)} /></td>
                </tr>
              ))}
            </tbody>
          </Zebra>
        </SectionCard>
      </TabsContent>
    </Tabs>
  );
}

function GrupoRH({
  titulo, icon, disp, C, D, setC, setD,
}: {
  titulo: string; icon: string; disp: number[]; C: number[]; D: number[];
  setC: (p: number, v: number) => void; setD: (p: number, v: number) => void;
}) {
  const cSerie: number[] = Array(P + 1).fill(0);
  const dSerie: number[] = Array(P + 1).fill(0);
  const dispSerie: number[] = Array(P + 1).fill(0);
  for (let p = 1; p <= P; p++) {
    cSerie[p] = C[p] || 0; dSerie[p] = D[p] || 0; dispSerie[p] = disp[p] || 0;
  }
  const data = chartData(
    { "Disponíveis": dispSerie, "Contratados": cSerie, "Demitidos": dSerie },
    ["Disponíveis", "Contratados", "Demitidos"],
  );
  return (
    <SectionCard title={titulo} icon={icon}>
      <div className="h-48 sm:h-56">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="periodo" />
            <YAxis tickFormatter={(v) => fmt0(v as number)} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Disponíveis" stroke={COLORS.disp} strokeWidth={2} />
            <Line type="monotone" dataKey="Contratados" stroke={COLORS.contr} strokeWidth={2} />
            <Line type="monotone" dataKey="Demitidos" stroke={COLORS.demit} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4">
        <Zebra>
          <thead>
            <tr>
              <th>Período</th>
              <th className="!text-right">Disponíveis</th>
              <th className="!text-right">Contratar</th>
              <th className="!text-right">Demitir</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: P }, (_, i) => i + 1).map((p) => (
              <tr key={p}>
                <td className="font-medium">P{p}</td>
                <td className="text-right">{fmt0(disp[p])}</td>
                <td className="w-32"><NumCell value={C[p]} onCommit={(v) => setC(p, v)} /></td>
                <td className="w-32"><NumCell value={D[p]} onCommit={(v) => setD(p, v)} /></td>
              </tr>
            ))}
          </tbody>
        </Zebra>
      </div>
    </SectionCard>
  );
}

// ═══════════════════════════════════════════════════════════════
// SCREEN 5 — FINANÇAS
// ═══════════════════════════════════════════════════════════════
export function TelaFinancas({ S, setPer }: SimCtx) {
  return (
    <Tabs defaultValue="inv" className="w-full">
      <TabsList className="bg-muted flex w-full max-w-full overflow-x-auto justify-start h-auto whitespace-nowrap">
        <TabsTrigger value="inv">Investimentos</TabsTrigger>
        <TabsTrigger value="fin">Financiamentos</TabsTrigger>
      </TabsList>

      <TabsContent value="inv" className="mt-4">
        <SectionCard title="Aplicações Financeiras" icon="🏦">
          <FinChart series={{ "Giro (1,8% a.p.)": S.apG, "Curto prazo (3,5%)": S.apC, "Médio prazo (4,0%)": S.apM }} />
          <div className="mt-4">
            <FinTable
              cols={[
                { label: "Giro", key: "apG" },
                { label: "Curto prazo", key: "apC" },
                { label: "Médio prazo", key: "apM" },
              ]}
              S={S}
              setPer={setPer}
            />
          </div>
        </SectionCard>
      </TabsContent>

      <TabsContent value="fin" className="mt-4">
        <SectionCard title="Empréstimos" icon="💳">
          <FinChart series={{ "Curto prazo (4,9%)": S.emC, "Longo prazo (4,3%)": S.emL }} />
          <div className="mt-4">
            <FinTable
              cols={[
                { label: "Empréstimo CP", key: "emC" },
                { label: "Empréstimo LP", key: "emL" },
              ]}
              S={S}
              setPer={setPer}
            />
          </div>
        </SectionCard>
      </TabsContent>
    </Tabs>
  );
}

function FinChart({ series }: { series: Record<string, number[]> }) {
  const keys = Object.keys(series);
  const data = chartData(series, keys);
  const palette = [COLORS.r2, COLORS.r3, COLORS.r1, COLORS.total];
  return (
    <div className="h-52 sm:h-72">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="periodo" />
          <YAxis tickFormatter={(v) => fmt0(v as number)} />
          <Tooltip formatter={(v: number) => money(v)} />
          <Legend />
          {keys.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} stroke={palette[i % palette.length]} strokeWidth={2} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function FinTable({
  cols, S, setPer,
}: {
  cols: Array<{ label: string; key: keyof EstadoPlano }>;
  S: EstadoPlano; setPer: SimCtx["setPer"];
}) {
  return (
    <Zebra>
      <thead>
        <tr>
          <th>Período</th>
          {cols.map((c) => <th key={String(c.key)} className="!text-right">{c.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: P }, (_, i) => i + 1).map((p) => (
          <tr key={p}>
            <td className="font-medium">P{p}</td>
            {cols.map((c) => {
              const arr = S[c.key] as number[];
              return (
                <td key={String(c.key)} className="w-40">
                  <NumCell value={arr[p]} onCommit={(v) => setPer(c.key, p, v)} />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </Zebra>
  );
}

// ═══════════════════════════════════════════════════════════════
// SCREEN 6 — RESULTADOS
// ═══════════════════════════════════════════════════════════════
export function TelaResultados({ S, R }: SimCtx) {
  const [openRel, setOpenRel] = useState(false);
  const pctMeta = Math.min(100, (R.llAcum / META_LL) * 100);
  const linhas: Array<{ nome: string; get: (d: (typeof R.dre)[number]) => number; neg?: boolean; bold?: boolean }> = [
    { nome: "Receita bruta", get: (d) => d.receita, bold: true },
    { nome: "(–) CPV", get: (d) => -d.cpv, neg: true },
    { nome: "(–) Frete", get: (d) => -d.frete, neg: true },
    { nome: "(–) Comissões", get: (d) => -d.comis, neg: true },
    { nome: "(–) Armazenagem", get: (d) => -d.arm, neg: true },
    { nome: "(–) Propaganda", get: (d) => -d.prop, neg: true },
    { nome: "(–) P&D", get: (d) => -d.pd, neg: true },
    { nome: "(–) Custos fixos", get: (d) => -d.fixos, neg: true },
    { nome: "(–) Administrativas", get: (d) => -d.admin, neg: true },
    { nome: "(–) Ociosidade MOD", get: (d) => -d.ocios, neg: true },
    { nome: "(–) Folha supervisão prod.", get: (d) => -d.folhaSup, neg: true },
    { nome: "(–) Folha vendas", get: (d) => -d.folhaVd, neg: true },
    { nome: "(–) Folha superv. vendas", get: (d) => -d.folhaSv, neg: true },
    { nome: "(–) Contratações / demissões", get: (d) => -d.contr, neg: true },
    { nome: "(–) Depreciação", get: (d) => -d.deprec, neg: true },
    { nome: "(+) Receita financeira", get: (d) => d.jRec },
    { nome: "(–) Despesa financeira", get: (d) => -d.jPag, neg: true },
    { nome: "LAIR", get: (d) => d.lair, bold: true },
    { nome: "(–) IR (30%)", get: (d) => -d.ir, neg: true },
    { nome: "Lucro líquido do período", get: (d) => d.ll, bold: true },
    { nome: "Lucro líquido acumulado", get: (d) => d.llAcum, bold: true },
    { nome: "Caixa final", get: (d) => d.caixa, bold: true },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpenRel(true)} className="bg-[#1B3A4B] hover:bg-[#152d3a] text-white">
          📄 Visualizar Relatório
        </Button>
      </div>

      <RelatorioDialog open={openRel} onOpenChange={setOpenRel} R={R} linhas={linhas} pctMeta={pctMeta} />

      <SectionCard title="Indicadores Oficiais — SES" icon="🏅">
        <IndicadoresBar R={R} compact={false} />
      </SectionCard>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Lucro líquido acumulado" value={money(R.llAcum)} color={R.llAcum >= 0 ? "green" : "red"} />
        <KPI label="Patrimônio líquido" value={money(R.pl)} />
        <KPI label="Caixa mínimo" value={money(R.caixaMin)} color={R.caixaMin < 0 ? "red" : undefined} />
        <KPI label="Alertas" value={String(R.alertas.length)} color={R.alertas.some((a) => !a.aviso) ? "red" : R.alertas.length ? "amber" : "green"} />
      </div>

      <SectionCard title="Meta de ROE — 55,29%" icon="🎯">
        <div className="flex justify-between text-sm mb-1">
          <span>ROE projetado: <strong>{(R.roe * 100).toFixed(2)}%</strong></span>
          <span className="text-muted-foreground">Meta: {(META_ROE * 100).toFixed(2)}% ({money(META_LL)})</span>
        </div>
        <div className="h-3 rounded bg-muted overflow-hidden">
          <div
            className={cn("h-full transition-all",
              pctMeta >= 100 ? "bg-[#2dd4a7]" : pctMeta >= 60 ? "bg-[#f0b429]" : "bg-[#e05a6f]")}
            style={{ width: pctMeta + "%" }}
          />
        </div>
      </SectionCard>

      <SectionCard title="DRE — Período a Período" icon="📑">
        <div className="overflow-x-auto rounded border border-border -mx-1 sm:mx-0">
          <table className="w-full min-w-max text-[11px] sm:text-xs">
            <thead>
              <tr className="bg-[#e6efef]">
                <th className="text-left px-3 py-2 sticky left-0 z-10 bg-[#e6efef] whitespace-nowrap">Conta</th>
                {R.dre.map((d) => (
                  <th key={d.p} className="text-right px-3 py-2 whitespace-nowrap bg-[#e6efef]">P{d.p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => {
                const rowBg = i % 2 ? "bg-[#eef1f1]" : "bg-card";
                return (
                  <tr key={l.nome} className={cn(l.bold && "font-semibold")}>
                    <td className={cn("px-3 py-1.5 border-t border-border sticky left-0 z-10 whitespace-nowrap", rowBg)}>{l.nome}</td>
                    {R.dre.map((d) => {
                      const v = l.get(d);
                      return (
                        <td key={d.p} className={cn(
                          "px-3 py-1.5 text-right border-t border-border whitespace-nowrap",
                          rowBg,
                          v < 0 && "text-[#b23a4c]",
                        )}>{fmt2(v)}</td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Alertas de Consistência" icon="⚠️">
        {R.alertas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum alerta — plano consistente.</p>
        ) : (
          <ul className="space-y-1.5">
            {R.alertas.map((a, i) => (
              <li key={i}
                className={cn(
                  "text-sm px-3 py-2 rounded border-l-4",
                  a.aviso
                    ? "bg-amber-50 border-amber-500 text-amber-900"
                    : "bg-red-50 border-red-500 text-red-900",
                )}>
                {a.texto}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function KPI({ label, value, color }: { label: string; value: string; color?: "green" | "red" | "amber" }) {
  const bar =
    color === "green" ? "bg-[#2dd4a7]" :
    color === "red" ? "bg-[#e05a6f]" :
    color === "amber" ? "bg-[#f0b429]" : "bg-[#0f6f6f]";
  return (
    <div className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
      <div className={cn("h-1", bar)} />
      <div className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
        <div className="mt-1 text-2xl font-semibold text-foreground tabular-nums">{value}</div>
      </div>
    </div>
  );
}

// ─── Indicadores oficiais (Faturamento / Lucratividade / Crescimento do PL) ───
export function calcIndicadores(R: ResultadoSimulacao) {
  const faturamento = R.receita.reduce((a, b) => a + (b || 0), 0);
  const lucratividade = R.roe;
  const dre = R.dre;
  let crescPL = 0;
  if (dre.length >= 2) {
    const CAP = 3_000_000;
    const plAnt = CAP + dre[dre.length - 2].llAcum;
    const plFim = CAP + dre[dre.length - 1].llAcum;
    crescPL = plAnt !== 0 ? (plFim - plAnt) / plAnt : 0;
  }
  return { faturamento, lucratividade, crescPL };
}

function IndicadorCard({
  nome, peso, valor, subvalor, detalhe, tone, compact,
}: { nome: string; peso: number; valor: string; subvalor?: string; detalhe?: string; tone?: "green" | "red" | "amber"; compact?: boolean }) {
  const valColor =
    tone === "red" ? "text-[#b23a4c]" :
    tone === "green" ? "text-[#0f8a5f]" :
    tone === "amber" ? "text-[#a06a00]" :
    "text-foreground";
  return (
    <div className="rounded-md border border-border bg-card shadow-sm px-1.5 sm:px-3 py-2 flex items-start gap-1.5 sm:gap-3 min-w-0">
      <span
        className="inline-flex items-center justify-center rounded bg-[#1f6feb] text-white text-[10px] sm:text-[11px] font-bold w-5 h-5 sm:w-6 sm:h-6 shrink-0 mt-0.5"
        title={`Peso ${peso}`}
      >
        {peso}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{nome}</div>
        <div className={cn("font-semibold tabular-nums truncate leading-tight", compact ? "text-sm" : "text-xl", valColor)}>
          {valor}
        </div>
        {subvalor && (
          <div className="text-[10px] sm:text-[11px] text-muted-foreground truncate leading-tight">{subvalor}</div>
        )}
        {detalhe && !compact && (
          <div className="text-[11px] text-muted-foreground truncate">{detalhe}</div>
        )}
      </div>
    </div>
  );
}

export function IndicadoresBar({ R, compact = true }: { R: ResultadoSimulacao; compact?: boolean }) {
  const { faturamento, lucratividade, crescPL } = calcIndicadores(R);
  return (
    <div className="grid grid-cols-3 gap-2">
      <IndicadorCard
        nome="Faturamento" peso={4}
        valor={money(faturamento)}
        detalhe="Receita total projetada (8 períodos)"
        compact={compact}
      />
      <IndicadorCard
        nome="Lucratividade" peso={7}
        valor={(lucratividade * 100).toFixed(2) + "%"}
        subvalor={money(R.llAcum)}
        detalhe={`ROE — LL acum. ${money(R.llAcum)}`}
        tone={lucratividade < 0 ? "red" : lucratividade >= META_ROE ? "green" : "amber"}
        compact={compact}
      />
      <IndicadorCard
        nome="Crescimento do PL" peso={6}
        valor={(crescPL * 100).toFixed(2) + "%"}
        subvalor={money(R.pl)}
        detalhe={`PL final ${money(R.pl)}`}
        tone={crescPL < 0 ? "red" : crescPL > 0 ? "green" : undefined}
        compact={compact}
      />
    </div>
  );
}

interface Sugestao { area: string; problema: string; acao: string; oficial?: boolean; periodo?: number }

function gerarSugestoes(S: EstadoPlano, R: ResultadoSimulacao): Sugestao[] {
  const out: Sugestao[] = [];
  const { crescPL } = calcIndicadores(R);

  // 1) Ociosidade MOD por período
  for (const d of R.dre) {
    if (d.ocios > 0) {
      const p = d.p;
      const progP = +S.prog[p - 1] || 0;
      const opIdeal = Math.max(0, Math.ceil((progP * 2.4) / 480));
      const opHoje = R.op[p] || 0;
      const delta = opHoje - opIdeal;
      const nota = delta > 0
        ? ` A redução exige demitir ${fmt0(delta)} operário(s) (custo $5.300 cada) — compare com manter o quadro se a produção dos próximos períodos absorver o excedente.`
        : "";
      out.push({
        area: "Pessoas",
        periodo: p,
        problema: `Ociosidade de MOD em P${p} (custo ${money(d.ocios)}).`,
        acao: `Pessoas → Operacional → Operários: ajustar Contratar/Demitir para chegar a ${fmt0(opIdeal)} operários em P${p} (hoje: ${fmt0(opHoje)}). Cada operário excedente custa $5.280/período sem gerar produção.${nota}`,
      });
    }
  }

  // 2) Produção limitada por MP
  for (let p = 2; p <= P; p++) {
    const progP = +S.prog[p - 1] || 0;
    if (progP <= 0) continue;
    const mpAntFim = R.mpFim[p - 2] || 0;
    const mpCompra = +S.mp[p - 1] || 0;
    const mpDisp = mpAntFim + mpCompra;
    if (progP > Math.floor(mpDisp / 3)) {
      const mpIdeal = progP * 3 - mpAntFim;
      out.push({
        area: "Produção",
        periodo: p,
        problema: `Produção de P${p} limitada por matéria-prima disponível (${fmt0(mpDisp)} MP; precisa ${fmt0(progP * 3)}).`,
        acao: `Produção → Compra MP p/ T+1 no P${p - 1}: alterar para ${fmt0(mpIdeal)} (hoje: ${fmt0(mpCompra)}) para viabilizar a programação de ${fmt0(progP)} unidades em P${p}.`,
      });
    }
  }

  // 3) Produção limitada por capacidade
  for (let p = 1; p <= P; p++) {
    const progP = +S.prog[p - 1] || 0;
    const capP = R.cap[p] || 0;
    if (progP > capP) {
      const deficit = progP - capP;
      out.push({
        area: "Capacidade",
        periodo: p,
        problema: `Programação de P${p} (${fmt0(progP)}) excede a capacidade instalada (${fmt0(capP)}).`,
        acao: `Estratégia → Expansão para T+1 no P${p - 1}: aumentar em ${fmt0(deficit)} unidades de capacidade (custo $210/un., pago 50/25/25%), ou reduzir Produção → Programação p/ T+1 no P${p - 1} para ${fmt0(capP)}.`,
      });
    }
  }

  // 4) Supervisores de produção insuficientes
  for (let p = 1; p <= P; p++) {
    const opP = R.op[p] || 0;
    if (opP <= 0) continue;
    const necSP = Math.ceil(opP / 12);
    if ((R.sp[p] || 0) < necSP) {
      const falta = necSP - (R.sp[p] || 0);
      out.push({
        area: "Pessoas",
        periodo: p,
        problema: `Supervisores de produção insuficientes em P${p} (${R.sp[p]}/${necSP}) — perda de 20% de produtividade.`,
        acao: `Pessoas → Operacional → Supervisores de Produção: contratar ${fmt0(falta)} SP até P${p} para eliminar a perda de produtividade.`,
      });
    }
  }

  // 5) Supervisores de venda insuficientes
  for (let p = 1; p <= P; p++) {
    const vdP = R.vd[p] || 0;
    if (vdP <= 0) continue;
    const necSV = Math.ceil(vdP / 8);
    if ((R.sv[p] || 0) < necSV) {
      const falta = necSV - (R.sv[p] || 0);
      out.push({
        area: "Pessoas",
        periodo: p,
        problema: `Supervisores de venda insuficientes em P${p} (${R.sv[p]}/${necSV}) — perda de até 30% de produtividade.`,
        acao: `Pessoas → Comercial → Supervisores de Venda: contratar ${fmt0(falta)} SV até P${p} para eliminar a perda de produtividade.`,
      });
    }
  }

  // 6) Propaganda acima do teto
  const rotulos = ["R1", "R2", "R3"] as const;
  for (let p = 1; p <= P; p++) {
    for (let r = 0; r < 3; r++) {
      const t = +(S.propT[p]?.[r] || 0);
      const o = +(S.propO[p]?.[r] || 0);
      if (t > TETO_PROP) {
        out.push({
          area: "Marketing",
          periodo: p,
          problema: `Propaganda Tradicional ${rotulos[r]} no P${p} acima do teto (${money(t)}).`,
          acao: `Marketing → Propaganda → Tradicional ${rotulos[r]} no P${p}: reduzir de ${money(t)} para ${money(TETO_PROP)} — o excedente de ${money(t - TETO_PROP)} é desperdício puro.`,
        });
      }
      if (o > TETO_PROP) {
        out.push({
          area: "Marketing",
          periodo: p,
          problema: `Propaganda Online ${rotulos[r]} no P${p} acima do teto (${money(o)}).`,
          acao: `Marketing → Propaganda → Online ${rotulos[r]} no P${p}: reduzir de ${money(o)} para ${money(TETO_PROP)} — o excedente de ${money(o - TETO_PROP)} é desperdício puro.`,
        });
      }
    }
  }

  // 7) P&D abaixo da saturação
  const pdTotal = R.dre.reduce((s, d) => s + d.pd, 0);
  if (pdTotal < 102000) {
    const falta = 102000 - pdTotal;
    out.push({
      area: "P&D",
      problema: `Investimento acumulado em P&D de ${money(pdTotal)} — abaixo do ponto de saturação (${money(102000)}).`,
      acao: `Marketing → P&D: distribuir mais ${money(falta)} nos períodos iniciais (P1–P3) — quanto antes atingir a saturação de ${money(102000)}, mais períodos se beneficiam da qualidade máxima.`,
    });
  }

  // 8) Rotativo automático acionado
  const perRot = new Set<number>();
  for (const a of R.alertas) {
    const m = /P(\d+):\s*caixa estourou/.exec(a.texto);
    if (m) perRot.add(parseInt(m[1], 10));
  }
  for (const p of Array.from(perRot).sort((a, b) => a - b)) {
    const deficit = -(R.dre.find((d) => d.p === p)?.caixa ?? 0);
    const contexto = deficit > 0 ? ` (déficit aproximado ${money(deficit)})` : "";
    const alvo = Math.max(1, p - 1);
    out.push({
      area: "Finanças",
      periodo: p,
      problema: `Rotativo automático a 8% acionado em P${p}${contexto}.`,
      acao: `Finanças → Financiamentos → Empréstimo LP no P${alvo}: contratar valor suficiente para cobrir o déficit do P${p} — LP a 4,3% custa quase metade do rotativo a 8%.`,
    });
  }

  // 9) Vendas acima do disponível
  for (const a of R.alertas) {
    const m = /P(\d+):\s*previsão de vendas maior que o disponível/.exec(a.texto);
    if (m) {
      const p = parseInt(m[1], 10);
      const disp = (R.paFim[p - 1] || 0) + (R.prod[p] || 0);
      const alvo = Math.max(1, p - 1);
      out.push({
        area: "Marketing",
        periodo: p,
        problema: `Previsão de vendas em P${p} maior que o disponível (${fmt0(disp)} un.).`,
        acao: `Marketing → Previsão: reduzir a previsão total do P${p} para ${fmt0(disp)} unidades, ou aumentar Produção → Programação p/ T+1 no P${alvo}.`,
      });
    }
  }

  // 10) ROE abaixo da meta (oficial)
  if (R.roe < META_ROE) {
    out.push({
      area: "Lucratividade",
      oficial: true,
      problema: `ROE projetado (${(R.roe * 100).toFixed(2)}%) abaixo da meta de ${(META_ROE * 100).toFixed(2)}%.`,
      acao: "As ações acima atacam diretamente o LL acumulado — priorize na ordem: eliminar ociosidade de MOD, eliminar o rotativo automático, capturar as vendas perdidas por falta de produto.",
    });
  }

  // 11) Crescimento do PL negativo (oficial)
  if (crescPL < 0) {
    out.push({
      area: "Crescimento do PL",
      oficial: true,
      problema: `Crescimento do PL de ${(crescPL * 100).toFixed(2)}% — o patrimônio está encolhendo.`,
      acao: "O PL cresce via lucro líquido retido. Priorize as ações de lucratividade (preço, custo, propaganda) para reverter o LL agregado e recompor o patrimônio, preservando a saúde financeira da empresa nos ciclos seguintes.",
    });
  }

  // Ordenação: oficiais primeiro; depois por período crescente; sem período ao final.
  out.sort((a, b) => {
    if (!!b.oficial !== !!a.oficial) return a.oficial ? -1 : 1;
    const pa = a.periodo ?? Number.POSITIVE_INFINITY;
    const pb = b.periodo ?? Number.POSITIVE_INFINITY;
    return pa - pb;
  });

  return out;
}

function RelatorioDialog({

  open, onOpenChange, S, R, linhas, pctMeta,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  S: EstadoPlano;
  R: ResultadoSimulacao;
  linhas: Array<{ nome: string; get: (d: (typeof R.dre)[number]) => number; neg?: boolean; bold?: boolean }>;
  pctMeta: number;
}) {
  const { faturamento, lucratividade, crescPL } = calcIndicadores(R);
  const agora = new Date().toLocaleString("pt-BR");

  const dadosReceita = R.dre.map((d) => ({ periodo: `P${d.p}`, receita: d.receita }));
  const dadosLL = R.dre.map((d) => ({ periodo: `P${d.p}`, ll: d.ll }));

  const reportRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    const node = reportRef.current;
    if (!node) return;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Habilite pop-ups para imprimir o relatório.");
      return;
    }
    const headAssets = Array.from(
      document.head.querySelectorAll('link[rel="stylesheet"], style'),
    )
      .map((el) => el.outerHTML)
      .join("\n");
    const printCss = `
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        html, body {
          background: #fff !important;
          margin: 0; padding: 0;
          color: #2D2D2D;
        }
        *, *::before, *::after {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .report-root {
          max-width: 100%;
          background: #fff;
          padding: 12mm 10mm;
        }
        section { break-inside: avoid; page-break-inside: avoid; margin-bottom: 18px; }
        table { break-inside: auto; width: 100%; border-collapse: collapse; }
        thead { display: table-header-group; }
        tr { break-inside: avoid; page-break-inside: avoid; }
        .dre-print { font-size: 9px !important; }
        .dre-print th, .dre-print td { padding: 3px 6px !important; }
        .dre-scroll { overflow: visible !important; }
      </style>
    `;
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório ThermoTech SA</title>${headAssets}${printCss}</head><body><div class="report-root">${node.innerHTML}</div></body></html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
    const doPrint = () => {
      w.focus();
      w.print();
    };
    const onAfter = () => {
      w.close();
    };
    w.addEventListener("afterprint", onAfter);
    if (w.document.readyState === "complete") {
      setTimeout(doPrint, 150);
    } else {
      w.addEventListener("load", () => setTimeout(doPrint, 150));
    }
  }, []);

  const sugestoes = gerarSugestoes(R);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 bg-[#FAFAFA] text-[#2D2D2D]">
        <div ref={reportRef} className="px-8 pt-8 pb-6">

          <DialogHeader className="mb-0">
            <div className="border-b-2 border-[#1B3A4B] pb-4">
              <DialogTitle className="text-2xl font-semibold text-[#1B3A4B] tracking-tight">
                ThermoTech SA — Relatório de Resultados
              </DialogTitle>
              <div className="text-xs text-[#2D2D2D]/70 mt-1">Gerado em {agora}</div>
            </div>
          </DialogHeader>

          <section className="mt-8">
            <h2 className="text-sm uppercase tracking-widest text-[#1B3A4B] font-semibold mb-3 pb-2 border-b border-[#d0d0d0]">
              Indicadores Oficiais
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <RelInd nome="Faturamento" peso={4} valor={money(faturamento)} sub="Receita total (8 períodos)" />
              <RelInd nome="Lucratividade" peso={7} valor={(lucratividade * 100).toFixed(2) + "%"} sub={`LL acum. ${money(R.llAcum)}`} />
              <RelInd nome="Crescimento do PL" peso={6} valor={(crescPL * 100).toFixed(2) + "%"} sub={`PL final ${money(R.pl)}`} />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-sm uppercase tracking-widest text-[#1B3A4B] font-semibold mb-3 pb-2 border-b border-[#d0d0d0]">
              KPIs
            </h2>
            <div className="grid grid-cols-4 gap-4">
              <RelKPI label="LL acumulado" value={money(R.llAcum)} />
              <RelKPI label="Patrimônio líquido" value={money(R.pl)} />
              <RelKPI label="Caixa mínimo" value={money(R.caixaMin)} />
              <RelKPI label="Alertas" value={String(R.alertas.length)} />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-sm uppercase tracking-widest text-[#1B3A4B] font-semibold mb-3 pb-2 border-b border-[#d0d0d0]">
              Meta de ROE — {(META_ROE * 100).toFixed(2)}%
            </h2>
            <div className="flex justify-between text-sm mb-2">
              <span>ROE projetado: <strong>{(R.roe * 100).toFixed(2)}%</strong></span>
              <span className="text-[#2D2D2D]/70">Meta: {money(META_LL)}</span>
            </div>
            <div className="h-3 rounded bg-[#e6e6e6] overflow-hidden border border-[#d0d0d0]">
              <div className="h-full bg-[#1B3A4B] meta-bar-fill" style={{ width: pctMeta + "%" }} />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-sm uppercase tracking-widest text-[#1B3A4B] font-semibold mb-3 pb-2 border-b border-[#d0d0d0]">
              Evolução Financeira
            </h2>
            <div className="flex flex-col gap-6 items-center">
              <div>
                <div className="text-xs font-semibold text-[#1B3A4B] mb-1">Receita Bruta por Período</div>
                <BarChart width={700} height={250} data={dadosReceita} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d0d0d0" />
                  <XAxis dataKey="periodo" stroke="#2D2D2D" fontSize={11} />
                  <YAxis stroke="#2D2D2D" fontSize={11} tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Bar dataKey="receita" fill="#1B3A4B" name="Receita" />
                </BarChart>
              </div>
              <div>
                <div className="text-xs font-semibold text-[#1B3A4B] mb-1">Lucro Líquido por Período</div>
                <LineChart width={700} height={250} data={dadosLL} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d0d0d0" />
                  <XAxis dataKey="periodo" stroke="#2D2D2D" fontSize={11} />
                  <YAxis stroke="#2D2D2D" fontSize={11} tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <ReferenceLine y={0} stroke="#b23a4c" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="ll" stroke="#2dd4a7" strokeWidth={2} dot={{ r: 3 }} name="Lucro líquido" />
                </LineChart>
              </div>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-sm uppercase tracking-widest text-[#1B3A4B] font-semibold mb-3 pb-2 border-b border-[#d0d0d0]">
              Sugestões de Melhoria
            </h2>
            {sugestoes.length === 0 ? (
              <p className="text-sm text-[#2D2D2D]/70">
                Todos os indicadores dentro dos parâmetros — plano consistente.
              </p>
            ) : (
              <ul className="space-y-3">
                {sugestoes.map((s, i) => (
                  <li
                    key={i}
                    className="border border-[#d0d0d0] bg-white p-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={cn(
                          "inline-block text-[11px] font-semibold uppercase tracking-wide text-white px-2 py-0.5",
                          s.oficial ? "bg-[#D97706]" : "bg-[#1B3A4B]",
                        )}
                      >
                        {s.area}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-[#2D2D2D]">{s.problema}</div>
                    <div className="text-sm text-[#2D2D2D]/80 mt-1">{s.acao}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>



          <section className="mt-8">
            <h2 className="text-sm uppercase tracking-widest text-[#1B3A4B] font-semibold mb-3 pb-2 border-b border-[#d0d0d0]">
              DRE — Período a Período
            </h2>
            <div className="dre-scroll overflow-x-auto border border-[#d0d0d0]">
              <table className="dre-print w-full text-xs">
                <thead>
                  <tr className="bg-[#1B3A4B] text-white">
                    <th className="text-left px-3 py-2 whitespace-nowrap">Conta</th>
                    {R.dre.map((d) => (
                      <th key={d.p} className="text-right px-3 py-2 whitespace-nowrap">P{d.p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr
                      key={l.nome}
                      className={cn(
                        l.bold && "font-semibold subtotal",
                        l.bold ? "bg-[#e8eff3]" : i % 2 ? "bg-[#f2f2f2]" : "bg-white",
                      )}
                    >
                      <td className="px-3 py-1.5 whitespace-nowrap">{l.nome}</td>
                      {R.dre.map((d) => {
                        const v = l.get(d);
                        return (
                          <td key={d.p} className={cn("px-3 py-1.5 text-right whitespace-nowrap tabular-nums", v < 0 && "text-[#b23a4c]")}>
                            {fmt2(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8 mb-4">
            <h2 className="text-sm uppercase tracking-widest text-[#1B3A4B] font-semibold mb-3 pb-2 border-b border-[#d0d0d0]">
              Alertas de Consistência
            </h2>
            {R.alertas.length === 0 ? (
              <p className="text-sm text-[#2D2D2D]/70">Nenhum alerta — plano consistente.</p>
            ) : (
              <ul className="space-y-2">
                {R.alertas.map((a, i) => (
                  <li
                    key={i}
                    className={cn(
                      "text-sm px-3 py-2 border-l-4",
                      a.aviso ? "border-[#D97706] bg-[#fff7ed] text-[#7c2d12]" : "border-[#b23a4c] bg-[#fef2f2] text-[#7a1f2d]",
                    )}
                  >
                    {a.texto}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <DialogFooter className="no-print px-8 py-4 border-t border-[#d0d0d0] bg-white">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={handlePrint} className="bg-[#1B3A4B] hover:bg-[#152d3a] text-white">
            🖨️ Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function RelInd({ nome, peso, valor, sub }: { nome: string; peso: number; valor: string; sub: string }) {
  return (
    <div className="border border-[#d0d0d0] bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center bg-[#1B3A4B] text-white text-[11px] font-bold w-6 h-6">{peso}</span>
        <div className="text-[11px] uppercase tracking-wide text-[#2D2D2D]/70">{nome}</div>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-[#1B3A4B]">{valor}</div>
      <div className="text-[11px] text-[#2D2D2D]/70 mt-1">{sub}</div>
    </div>
  );
}

function RelKPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#d0d0d0] bg-white p-4">
      <div className="text-[11px] uppercase tracking-wide text-[#2D2D2D]/70">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-[#1B3A4B]">{value}</div>
    </div>
  );
}
