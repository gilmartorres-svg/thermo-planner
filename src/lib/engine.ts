// Motor de cálculo do Simulador SES — ThermoTech SA
// Porte fiel do motor validado (não alterar as fórmulas sem revisão explícita)

export const P = 8;
export const REGIOES = ['R1', 'R2', 'R3'] as const;
// Constantes que NÃO variam por período (regras estruturais do jogo)
const MP_UN = 3, MOD_H = 2.4, H_PER = 480;
const IR = 0.30, CAPITAL = 3_000_000;
const DEPREC = 0.025;
export const META_ROE = 0.5529;
export const META_LL = CAPITAL * META_ROE;

// Defaults dos parâmetros que PODEM variar por período (Seção 9).
// Mantidos como fonte dos valores default; o loop lê tudo via PR(p)/tetoPropDe.
const DEF_CUSTO_MP = 40;
const DEF_SAL_H = 11;
const DEF_ADMIN = 52000;
const DEF_MODULO = 210;
const DEF_ARM_MP = 3;
const DEF_ARM_PA = 4.85;
const DEF_FRETE: [number, number, number] = [20, 0, 44];
const DEF_OP = { c: 3000, t: 700, d: 5300, sal: 5280 };
const DEF_SP = { c: 4700, t: 900, d: 8500, sal: 6500 };
const DEF_VD = { c: 3500, t: 1000, d: 5900, sal: 4600 };
const DEF_SV = { c: 5000, t: 1200, d: 9200, sal: 7100 };
const DEF_FAIXAS: Array<{ ate: number; custo: number }> = [
  { ate: 1250, custo: 150000 },
  { ate: 2500, custo: 175000 },
  { ate: 3750, custo: 200000 },
  { ate: 5000, custo: 225000 },
  { ate: 6250, custo: 250000 },
  { ate: Infinity, custo: 275000 },
];

// ─── Seção 8: teto de propaganda dinâmico ────────────────────────────────
// P1 = teto vigente informado pelo e-NEWS de P1;
// P2..P8 = teto informado pelo e-NEWS de P2 (atualizar manualmente a cada rodada
// conforme o novo faturamento médio publicado).
export const TETO_PROP_DEFAULT: number[] = [
  0,
  20649.76,
  21727.66, 21727.66, 21727.66, 21727.66, 21727.66, 21727.66, 21727.66,
];

export function tetoPropDe(S: EstadoPlano, p: number): number {
  return S.tetoProp?.[p] ?? TETO_PROP_DEFAULT[p];
}

/** @deprecated — usar tetoPropDe(S, p) — teto agora varia por período. */
export const TETO_PROP = TETO_PROP_DEFAULT[1];

// ─── Seção 9: tabela de parâmetros por período ───────────────────────────
export interface ParamCargo { c: number; t: number; d: number; sal: number }
export interface ParamsPeriodo {
  custoMP: number;
  salH: number;
  op: ParamCargo;
  sp: ParamCargo;
  vd: ParamCargo;
  sv: ParamCargo;
  frete: [number, number, number];
  faixasCF: Array<{ ate: number; custo: number }>;
  admin: number;
  modulo: number;
  armMP: number;
  armPA: number;
}

function paramPadrao(): ParamsPeriodo {
  return {
    custoMP: DEF_CUSTO_MP,
    salH: DEF_SAL_H,
    op: { ...DEF_OP },
    sp: { ...DEF_SP },
    vd: { ...DEF_VD },
    sv: { ...DEF_SV },
    frete: [...DEF_FRETE] as [number, number, number],
    faixasCF: DEF_FAIXAS.map((f) => ({ ...f })),
    admin: DEF_ADMIN,
    modulo: DEF_MODULO,
    armMP: DEF_ARM_MP,
    armPA: DEF_ARM_PA,
  };
}

export function paramsDefault(): ParamsPeriodo[] {
  const arr: ParamsPeriodo[] = [];
  for (let i = 0; i <= P; i++) arr.push(paramPadrao());
  return arr;
}

/** Custo fixo por faixa de capacidade — recebe as faixas do período (Seção 9). */
export function cfFaixaTab(cap: number, faixas: Array<{ ate: number; custo: number }>): number {
  if (cap <= 0) return 0;
  for (const f of faixas) if (cap <= f.ate) return f.custo;
  return faixas[faixas.length - 1].custo;
}

/** @deprecated — usar cfFaixaTab(cap, PR(p).faixasCF). */
export function cfFaixa(cap: number): number {
  return cfFaixaTab(cap, DEF_FAIXAS);
}

export type FormaPagamento = '100' | '5050' | '333334';

export interface FlagsPlano {
  // C1: quando ligada, expansão opera a 90% no primeiro período (default: desligada).
  ativacaoParcialExpansao?: boolean;
  // Quando ligada, IR de 30% incide apenas sobre a parcela positiva do LAIR
  // que exceder o prejuízo acumulado (default: desligada — comportamento atual).
  compensarPrejuizoAcumulado?: boolean;
}

export interface EstadoPlano {
  capIni: number;
  pagto: FormaPagamento;
  exp: number[];
  prog: number[];
  mp: number[];
  vendas: number[][];
  preco: number[][];
  vend: number[][];
  propT: number[][];
  propO: number[][];
  pd: number[];
  opC: number[]; opD: number[]; spC: number[]; spD: number[];
  vdC: number[]; vdD: number[]; svC: number[]; svD: number[];
  com: number[];
  apG: number[]; apC: number[]; apM: number[];
  emC: number[]; emL: number[];
  // C5: eventos e gastos não recorrentes (opcionais; ausência = zeros)
  eventosDesp?: number[];
  eventosRec?: number[];
  flags?: FlagsPlano;
  // Seção 8: teto de propaganda por período (opcional; default TETO_PROP_DEFAULT)
  tetoProp?: number[];
  // Seção 9: parâmetros por período (opcional; default paramsDefault())
  params?: ParamsPeriodo[];
  // Seção 9: inflação informativa (NÃO aplicada automaticamente a nenhuma rubrica —
  // quais rubricas sofrem reajuste será confirmado no Real P3).
  inflacao?: number[];
}

export interface Alerta { texto: string; aviso: boolean }

export interface PeriodoDRE {
  p: number; receita: number; cpv: number; frete: number; comis: number; arm: number;
  prop: number; pd: number; fixos: number; admin: number; ocios: number;
  folhaSup: number; folhaVd: number; folhaSv: number; contr: number; deprec: number;
  jRec: number; jPag: number; lair: number; ir: number; ll: number; llAcum: number;
  caixa: number; prod: number; vTot: number; cap: number; pa: number; mp: number;
  op: number; sp: number; vd: number; sv: number;
  // C5: eventos não recorrentes
  eventosDesp: number; eventosRec: number;
}

export interface ResultadoSimulacao {
  dre: PeriodoDRE[]; llAcum: number; pl: number; roe: number; caixaMin: number;
  cap: number[]; op: number[]; sp: number[]; vd: number[]; sv: number[];
  prod: number[]; vTot: number[]; receita: number[]; paFim: number[]; mpFim: number[];
  alertas: Alerta[];
}

const zeros = () => Array(P + 1).fill(0);
const zerosR = () => Array(P + 1).fill(0).map(() => [0, 0, 0]);

export function planoInicial(): EstadoPlano {
  return {
    capIni: 2000, pagto: '100',
    exp:   [0,0,500,0,500,0,0,0,0],
    prog:  [0,2000,2000,2500,3000,3000,3000,0,0],
    mp:    [0,6000,6000,7500,9000,9000,9000,0,0],
    vendas:[[0,0,0],[0,0,0],[0,0,0],[300,1000,700],[300,1000,700],[350,1250,900],[450,1450,1100],[450,1450,1100],[450,1450,1100]],
    preco: [[0,0,0],[0,0,0],[0,0,0],[500,470,450],[500,470,450],[500,470,450],[510,480,455],[510,480,455],[510,480,455]],
    vend:  [[0,0,0],[0,0,0],[0,0,0],[3,10,9],[3,10,9],[4,11,10],[4,12,14],[4,12,14],[4,12,14]],
    propT: [[0,0,0],[4000,15000,15000],[4000,15000,15000],[4000,15000,15000],[4000,15000,15000],[4000,15000,15000],[4000,15000,15000],[2000,7000,7000],[0,0,0]],
    propO: [[0,0,0],[10000,15000,5000],[10000,15000,5000],[10000,15000,5000],[10000,15000,5000],[10000,15000,5000],[10000,15000,5000],[5000,7000,3000],[0,0,0]],
    pd:    [0,34000,34000,34000,25000,25000,25000,0,0],
    opC:[0,10,0,3,2,0,0,0,0], opD:zeros(), spC:[0,1,0,1,0,0,0,0,0], spD:zeros(),
    vdC:[0,0,22,0,3,5,0,0,0], vdD:zeros(), svC:[0,0,3,0,1,0,0,0,0], svD:zeros(),
    com:[0,2,2,2,2,2,2,2,2],
    apG:[0,300000,300000,300000,300000,300000,300000,300000,400000],
    apC:[0,700000,500000,400000,500000,600000,700000,800000,0],
    apM:[0,1200000,0,0,0,0,0,0,0],
    emC: zeros(), emL: zeros(),
    // C5: eventos oficiais do Real P1 / Projetado P2
    eventosDesp: [0, 101850, 5500, 0, 0, 0, 0, 0, 0],
    eventosRec:  [0,   1850,    0, 0, 0, 0, 0, 0, 0],
    // Seção 9: inflação informativa — nenhuma rubrica é reajustada automaticamente.
    inflacao:    [0, 0, 1.5, 0, 0, 0, 0, 0, 0],
  };
}

export function simular(S: EstadoPlano): ResultadoSimulacao {
  const alertas: Alerta[] = [];
  const A = (texto: string, aviso = false) => alertas.push({ texto, aviso });

  // Seção 9: acesso a parâmetros por período (default se não vier no plano)
  const DEFS = paramsDefault();
  const PR = (p: number): ParamsPeriodo => S.params?.[p] ?? DEFS[p];

  const cap = zeros(), op = zeros(), sp = zeros(), vd = zeros(), sv = zeros();
  const prod = zeros(), mpFim = zeros(), paFim = zeros(), vTot = zeros(), receita = zeros();
  const vReal = zerosR();

  // Capacidade instalada (informativa — usada apenas para saldo contábil auxiliar)
  cap[1] = S.capIni;
  for (let p = 2; p <= P; p++) cap[p] = cap[p - 1] + (+S.exp[p - 1] || 0);

  // C1 + C3: capacidade ATIVA (regra dos 90% em P2; expansões operam a partir de T+1)
  const capAtiva = zeros();
  const parcial = !!(S.flags && S.flags.ativacaoParcialExpansao);
  capAtiva[1] = 0; // fábrica em construção
  capAtiva[2] = Math.round(0.9 * S.capIni / 100) * 100;
  for (let p = 3; p <= P; p++) {
    let base = S.capIni; // fábrica original 100% a partir de P3
    for (let t = 1; t <= p - 1; t++) {
      const e = +S.exp[t] || 0;
      if (!e) continue;
      if (t + 1 > p) continue;
      if (t + 1 === p && parcial) base += Math.round(0.9 * e / 100) * 100;
      else base += e;
    }
    capAtiva[p] = base;
  }

  // C2 + Seção 9: valor do investimento sujeito à depreciação, a PREÇO HISTÓRICO
  // (capex inicial usa PR(1).modulo; cada expansão usa PR(t).modulo do período em que
  // foi decidida — inflação posterior não reavalia investimento já feito).
  const investAtivo = zeros();
  const capexIniHist = S.capIni * PR(1).modulo;
  investAtivo[1] = 0;
  investAtivo[2] = 0.9 * capexIniHist;
  for (let p = 3; p <= P; p++) {
    let base = capexIniHist;
    for (let t = 1; t <= p - 1; t++) {
      const e = +S.exp[t] || 0;
      if (e && t + 1 <= p) base += e * PR(t).modulo;
    }
    investAtivo[p] = base;
  }

  for (let p = 1; p <= P; p++) {
    op[p] = (op[p - 1] || 0) + (+S.opC[p - 1] || 0) - (+S.opD[p - 1] || 0);
    sp[p] = (sp[p - 1] || 0) + (+S.spC[p - 1] || 0) - (+S.spD[p - 1] || 0);
    vd[p] = (vd[p - 1] || 0) + (+S.vdC[p - 1] || 0) - (+S.vdD[p - 1] || 0);
    sv[p] = (sv[p - 1] || 0) + (+S.svC[p - 1] || 0) - (+S.svD[p - 1] || 0);
  }

  // Fluxos de caixa 50/25/25 do capex e 20/40/40 da MP, ambos a preço do período da decisão
  const outF = zeros(), inF = zeros();
  outF[1] += capexIniHist * .5; outF[2] += capexIniHist * .25; outF[3] += capexIniHist * .25;
  for (let p = 1; p <= P; p++) {
    const e = (+S.exp[p] || 0) * PR(p).modulo;
    if (e) { outF[p] += e * .5; if (p + 1 <= P) outF[p + 1] += e * .25; if (p + 2 <= P) outF[p + 2] += e * .25; }
  }
  for (let p = 1; p <= P; p++) {
    // Seção 9: MP comprada em p desembolsa ao custo do próprio p (20/40/40)
    const c = (+S.mp[p] || 0) * PR(p).custoMP;
    if (c) { outF[p] += c * .2; if (p + 1 <= P) outF[p + 1] += c * .4; if (p + 2 <= P) outF[p + 2] += c * .4; }
  }

  // C4 + Seção 9: gasto total (contratação + treinamento + demissão) no período em que é decidido,
  // ao preço vigente naquele período. Parcelamento em 4 x 25% na DRE.
  // Observação: parcelamento do custo de demissão pendente de confirmação empírica no Real P3+.
  const contrGasto = zeros();
  for (let p = 1; p <= P; p++) {
    const pr = PR(p);
    contrGasto[p] =
      (+S.opC[p] || 0) * (pr.op.c + pr.op.t) +
      (+S.spC[p] || 0) * (pr.sp.c + pr.sp.t) +
      (+S.vdC[p] || 0) * (pr.vd.c + pr.vd.t) +
      (+S.svC[p] || 0) * (pr.sv.c + pr.sv.t) +
      (+S.opD[p] || 0) * pr.op.d +
      (+S.spD[p] || 0) * pr.sp.d +
      (+S.vdD[p] || 0) * pr.vd.d +
      (+S.svD[p] || 0) * pr.sv.d;
  }

  for (let p = 1; p <= P; p++) {
    const mpDisp = (mpFim[p - 1] || 0) + (p >= 2 ? (+S.mp[p - 1] || 0) : 0);
    const supNec = Math.ceil(op[p] / 12) || 0;
    const produt = (op[p] > 0 && sp[p] < supNec) ? 0.8 : 1.0;
    if (op[p] > 0 && sp[p] < supNec) A(`P${p}: supervisores de produção insuficientes (${sp[p]}/${supNec}) — produtividade reduzida a 80%`);
    const hDisp = op[p] * H_PER * produt;
    const progAnt = p >= 2 ? (+S.prog[p - 1] || 0) : 0;
    // C1/C3: limite de produção usa capacidade ATIVA do período
    const q = Math.min(progAnt, capAtiva[p], Math.floor(hDisp / MOD_H), Math.floor(mpDisp / MP_UN));
    if (progAnt > capAtiva[p]) A(`P${p}: programação excede a capacidade ativa`);
    if (progAnt > Math.floor(hDisp / MOD_H)) A(`P${p}: horas de MOD insuficientes`);
    if (progAnt > Math.floor(mpDisp / MP_UN)) A(`P${p}: matéria-prima insuficiente`);
    prod[p] = Math.max(0, q);
    mpFim[p] = mpDisp - prod[p] * MP_UN;

    const disp = (paFim[p - 1] || 0) + prod[p];
    const want = [+S.vendas[p][0] || 0, +S.vendas[p][1] || 0, +S.vendas[p][2] || 0];
    let rest = disp; const got = [0, 0, 0];
    for (const r of [1, 2, 0]) { got[r] = Math.min(want[r], rest); rest -= got[r]; }
    if (want[0] + want[1] + want[2] > disp) A(`P${p}: previsão de vendas maior que o disponível — corte por prioridade R2>R3>R1`, true);
    for (const r of [0, 1, 2]) { if (got[r] > 0 && (+S.vend[p][r] || 0) === 0) A(`P${p}: vendas em ${REGIOES[r]} sem vendedor alocado`); }
    vReal[p] = got; vTot[p] = got[0] + got[1] + got[2];
    paFim[p] = disp - vTot[p];
    receita[p] = got[0] * (+S.preco[p][0] || 0) + got[1] * (+S.preco[p][1] || 0) + got[2] * (+S.preco[p][2] || 0);

    const rv = receita[p];
    if (S.pagto === '100') inF[p] += rv;
    else if (S.pagto === '5050') { inF[p] += rv * .5; if (p + 1 <= P) inF[p + 1] += rv * .5; }
    else { inF[p] += rv * .33; if (p + 1 <= P) inF[p + 1] += rv * .33; if (p + 2 <= P) inF[p + 2] += rv * .34; }

    const aloc = (+S.vend[p][0] || 0) + (+S.vend[p][1] || 0) + (+S.vend[p][2] || 0);
    if (aloc > vd[p]) A(`P${p}: vendedores alocados excedem os disponíveis`);
    const svNec = Math.ceil(vd[p] / 8) || 0;
    if (vd[p] > 0 && sv[p] < svNec) A(`P${p}: supervisores de venda insuficientes — perda de até 30% de produtividade`);
    // Seção 8: teto vigente do período (via tetoPropDe)
    const tetoP = tetoPropDe(S, p);
    for (const r of [0, 1, 2]) {
      if ((+S.propT[p][r] || 0) > tetoP || (+S.propO[p][r] || 0) > tetoP)
        A(`P${p}: propaganda em ${REGIOES[r]} acima do teto`);
    }
  }
  if ((+S.prog[7] || 0) > 0 || (+S.prog[8] || 0) > 0) A('Programação em P7/P8 não gera produto vendável dentro do jogo', true);
  const pdAc = S.pd.slice(1).reduce((a, b) => a + (+b || 0), 0);
  if (pdAc > 0 && pdAc < 102000) A(`P&D acumulado abaixo dos $102.000 do ponto de saturação (~51%)`, true);

  const dre: PeriodoDRE[] = []; let caixa = CAPITAL, llAcum = 0, caixaMin = Infinity;
  let prejAcum = 0; // para flag compensarPrejuizoAcumulado
  const irPag = zeros(), folhaPag = zeros(), rotSaldo = zeros();
  const apRet = zeros(), emPay = zeros();
  for (let p = 1; p <= P; p++) {
    if (+S.apC[p] && p + 1 <= P) apRet[p + 1] += (+S.apC[p]) * 1.035;
    if (+S.apM[p] && p + 2 <= P) apRet[p + 2] += (+S.apM[p]) * 1.04;
    if (+S.emC[p] && p + 1 <= P) emPay[p + 1] += (+S.emC[p]) * 1.049;
  }
  const lpJur = zeros(), lpAmt = zeros();
  for (let p = 1; p <= P; p++) {
    const L = +S.emL[p] || 0; if (!L) continue;
    let saldo = L;
    for (let t = p + 1; t <= P; t++) { lpJur[t] += saldo * 0.043; if (t > p + 4) { const par = L / 4; lpAmt[t] += par; saldo -= par; } }
  }

  // C7: aplicação de giro efetiva (após eventual resgate antecipado no próprio período)
  const apGEfetivo = zeros();
  const compensarIR = !!(S.flags && S.flags.compensarPrejuizoAcumulado);

  for (let p = 1; p <= P; p++) {
    const pr = PR(p);
    // Seção 9: CPV unitário = custo MP * unidades + horas MOD * salário-hora (ambos do período p)
    const modUnP = MOD_H * pr.salH;
    const cpv = vTot[p] * (pr.custoMP * MP_UN + modUnP);
    const frete = vReal[p][0] * pr.frete[0] + vReal[p][2] * pr.frete[2];
    const comis = receita[p] * ((+S.com[p] || 0) / 100);
    // C6 + Seção 9: PA paga armazenagem sobre o estoque que ENTRA no período (paFim[p-1])
    const arm = mpFim[p] * pr.armMP + (paFim[p - 1] || 0) * pr.armPA;
    const prop = (+S.propT[p][0] || 0) + (+S.propT[p][1] || 0) + (+S.propT[p][2] || 0) + (+S.propO[p][0] || 0) + (+S.propO[p][1] || 0) + (+S.propO[p][2] || 0);
    const pd = +S.pd[p] || 0;
    // C1 + Seção 9: fixos usam capacidade ATIVA e a tabela de faixas do período
    const fixos = cfFaixaTab(capAtiva[p], pr.faixasCF);
    // Seção 9: folha e salários ao valor do período
    const folhaOp = op[p] * pr.op.sal;
    const folhaOpExtra = Math.max(0, folhaOp - prod[p] * modUnP);
    const folhaSup = sp[p] * pr.sp.sal, folhaVd = vd[p] * pr.vd.sal, folhaSv = sv[p] * pr.sv.sal;
    // C4: DRE reconhece 4 x 25% do gasto de contratação/treinamento/demissão
    let contr = 0;
    for (let t = Math.max(1, p - 3); t <= p; t++) contr += 0.25 * contrGasto[t];
    // C7: juros de aplicação de giro usam saldo EFETIVO do período anterior
    const jGiro = (p >= 2 ? apGEfetivo[p - 1] * 0.018 : 0);
    const jCP = (p >= 2 ? (+S.apC[p - 1] || 0) * 0.035 : 0);
    const jMP = (p >= 3 ? (+S.apM[p - 2] || 0) * 0.04 : 0);
    const jRec = jGiro + jCP + jMP;
    const jRot = (rotSaldo[p - 1] || 0) * 0.08;
    const jEmC = (p >= 2 ? (+S.emC[p - 1] || 0) * 0.049 : 0);
    const jPag = jRot + jEmC + lpJur[p];
    // C2: depreciação incide sobre investimento ativo (bruto, a preço histórico)
    const deprec = investAtivo[p] * DEPREC;
    // C5: eventos não recorrentes entram no LAIR (despesa negativa, receita positiva)
    const evDesp = +(S.eventosDesp?.[p] || 0);
    const evRec = +(S.eventosRec?.[p] || 0);
    const lair = receita[p] - cpv - frete - comis - arm - prop - pd - fixos - pr.admin - folhaOpExtra - folhaSup - folhaVd - folhaSv - contr - deprec + jRec - jPag - evDesp + evRec;
    let ir = 0;
    if (lair > 0) {
      if (compensarIR) {
        const baseIR = Math.max(0, lair - prejAcum);
        ir = baseIR * IR;
      } else {
        ir = lair * IR;
      }
    }
    const ll = lair - ir;
    llAcum += ll;
    if (compensarIR) {
      if (lair <= 0) prejAcum += -lair;
      else prejAcum = Math.max(0, prejAcum - lair);
    }
    if (p + 1 <= P) irPag[p + 1] += ir;
    const folhaCaixa = folhaOp + folhaSup + folhaVd + folhaSv + contrGasto[p] + comis;
    if (p + 1 <= P) folhaPag[p + 1] += folhaCaixa;

    let cx = caixa;
    cx += inF[p]; cx += apRet[p];
    // C7: crédito do giro no caixa usa saldo EFETIVO do período anterior
    cx += (p >= 2 ? apGEfetivo[p - 1] * 1.018 : 0);
    cx += (+S.emC[p] || 0) + (+S.emL[p] || 0);
    cx -= outF[p]; cx -= prop + pd + pr.admin + fixos + arm;
    cx -= folhaPag[p]; cx -= irPag[p];
    cx -= emPay[p]; cx -= lpJur[p] + lpAmt[p];
    cx -= (rotSaldo[p - 1] || 0) * 1.08;
    // C5: eventos entram/saem no caixa do próprio período
    cx -= evDesp; cx += evRec;
    let apG = +S.apG[p] || 0, apC = +S.apC[p] || 0, apM = +S.apM[p] || 0;
    cx -= apG + apC + apM;
    if (cx < 0 && apG > 0) { const usa = Math.min(apG, -cx); cx += usa; apG -= usa; A(`P${p}: aplicação de giro resgatada antecipadamente para cobrir o caixa`, true); }
    apGEfetivo[p] = apG;
    if (cx < 0) { rotSaldo[p] = -cx; cx = 0; A(`P${p}: caixa estourou — rotativo automático a 8% (pago em P${p + 1})`); }
    caixa = cx; caixaMin = Math.min(caixaMin, cx);

    dre.push({
      p, receita: receita[p], cpv, frete, comis, arm, prop, pd, fixos, admin: pr.admin, ocios: folhaOpExtra,
      folhaSup, folhaVd, folhaSv, contr, deprec, jRec, jPag, lair, ir, ll, llAcum, caixa: cx,
      prod: prod[p], vTot: vTot[p], cap: capAtiva[p], pa: paFim[p], mp: mpFim[p], op: op[p], sp: sp[p], vd: vd[p], sv: sv[p],
      eventosDesp: evDesp, eventosRec: evRec,
    });
  }

  return { dre, llAcum, pl: CAPITAL + llAcum, roe: llAcum / CAPITAL, caixaMin, cap: capAtiva, op, sp, vd, sv, prod, vTot, receita, paFim, mpFim, alertas };
}
