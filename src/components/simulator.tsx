import { useMemo, useState, useCallback, useEffect } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  planoInicial, simular, P, REGIOES, META_LL, META_ROE, TETO_PROP,
  type EstadoPlano, type ResultadoSimulacao, type FormaPagamento,
} from "@/lib/engine";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  return { S, R, setScalar, setPer, setPerReg };
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
export function TelaEstrategia({ S, R, setPer }: SimCtx) {
  const data = chartData({ Capacidade: R.cap, Produção: R.prod }, ["Capacidade", "Produção"]);
  return (
    <div className="space-y-4">
      <SectionCard title="Capacidade vs. Produção" icon="📊">
        <div className="h-72">
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
                  <td className="text-right">{fmt0(p === 1 ? S.capIni : R.cap[p - 1] || 0)}</td>
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
        <div className="h-72">
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
      <TabsList className="bg-muted">
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
        <div className="h-72">
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
        <div className="h-72">
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
        <div className="h-72">
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
        <div className="h-72">
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
      <TabsList className="bg-muted">
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
      <div className="h-56">
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
      <TabsList className="bg-muted">
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
    <div className="h-72">
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
export function TelaResultados({ R }: SimCtx) {
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
        <div className="overflow-auto rounded border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#e6efef]">
                <th className="text-left px-3 py-2 sticky left-0 bg-[#e6efef]">Conta</th>
                {R.dre.map((d) => (
                  <th key={d.p} className="text-right px-3 py-2 whitespace-nowrap">P{d.p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={l.nome} className={cn(i % 2 && "bg-muted/40", l.bold && "font-semibold")}>
                  <td className="px-3 py-1.5 border-t border-border sticky left-0 bg-inherit">{l.nome}</td>
                  {R.dre.map((d) => {
                    const v = l.get(d);
                    return (
                      <td key={d.p} className={cn(
                        "px-3 py-1.5 text-right border-t border-border whitespace-nowrap",
                        v < 0 && "text-[#b23a4c]",
                      )}>{fmt2(v)}</td>
                    );
                  })}
                </tr>
              ))}
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
