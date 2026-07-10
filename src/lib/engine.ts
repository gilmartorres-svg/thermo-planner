// Motor de cálculo do Simulador SES — ThermoTech SA
// Porte fiel do motor validado (não alterar as fórmulas sem revisão explícita)

export const P = 8;
export const REGIOES = ['R1', 'R2', 'R3'] as const;
const FRETE = [20, 0, 44];
const CUSTO_MP = 40, MP_UN = 3, MOD_H = 2.4, SAL_H = 11, H_PER = 480;
const MOD_UN = MOD_H * SAL_H; // 26.4
const ARM_MP = 3, ARM_PA = 4.85, ADMIN = 52000, IR = 0.30, CAPITAL = 3_000_000;
export const META_ROE = 0.5529;
export const META_LL = CAPITAL * META_ROE;
const MODULO = 210; // $/unidade de capacidade
const DEPREC = 0.025;
export const TETO_PROP = 20649.76; // 1% do faturamento médio potencial

const OP = { c: 3000, t: 700, d: 5300, sal: 5280 };
const SP = { c: 4700, t: 900, d: 8500, sal: 6500 };
const VD = { c: 3500, t: 1000, d: 5900, sal: 4600 };
const SV = { c: 5000, t: 1200, d: 9200, sal: 7100 };

export function cfFaixa(cap: number): number {
  if (cap <= 0) return 0;
  if (cap <= 1250) return 150000;
  if (cap <= 2500) return 175000;
  if (cap <= 3750) return 200000;
  if (cap <= 5000) return 225000;
  if (cap <= 6250) return 250000;
  return 275000;
}

export type FormaPagamento = '100' | '5050' | '333334';

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
}

export interface Alerta { texto: string; aviso: boolean }

export interface PeriodoDRE {
  p: number; receita: number; cpv: number; frete: number; comis: number; arm: number;
  prop: number; pd: number; fixos: number; admin: number; ocios: number;
  folhaSup: number; folhaVd: number; folhaSv: number; contr: number; deprec: number;
  jRec: number; jPag: number; lair: number; ir: number; ll: number; llAcum: number;
  caixa: number; prod: number; vTot: number; cap: number; pa: number; mp: number;
  op: number; sp: number; vd: number; sv: number;
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
  };
}

export function simular(S: EstadoPlano): ResultadoSimulacao {
  const alertas: Alerta[] = [];
  const A = (texto: string, aviso = false) => alertas.push({ texto, aviso });

  const cap = zeros(), op = zeros(), sp = zeros(), vd = zeros(), sv = zeros();
  const prod = zeros(), mpFim = zeros(), paFim = zeros(), vTot = zeros(), receita = zeros();
  const vReal = zerosR();

  cap[1] = S.capIni;
  for (let p = 2; p <= P; p++) cap[p] = cap[p - 1] + (+S.exp[p - 1] || 0);
  for (let p = 1; p <= P; p++) {
    op[p] = (op[p - 1] || 0) + (+S.opC[p - 1] || 0) - (+S.opD[p - 1] || 0);
    sp[p] = (sp[p - 1] || 0) + (+S.spC[p - 1] || 0) - (+S.spD[p - 1] || 0);
    vd[p] = (vd[p - 1] || 0) + (+S.vdC[p - 1] || 0) - (+S.vdD[p - 1] || 0);
    sv[p] = (sv[p - 1] || 0) + (+S.svC[p - 1] || 0) - (+S.svD[p - 1] || 0);
  }

  const outF = zeros(), inF = zeros();
  const capex0 = S.capIni * MODULO;
  outF[1] += capex0 * .5; outF[2] += capex0 * .25; outF[3] += capex0 * .25;
  for (let p = 1; p <= P; p++) {
    const e = (+S.exp[p] || 0) * MODULO;
    if (e) { outF[p] += e * .5; if (p + 1 <= P) outF[p + 1] += e * .25; if (p + 2 <= P) outF[p + 2] += e * .25; }
  }
  for (let p = 1; p <= P; p++) {
    const c = (+S.mp[p] || 0) * CUSTO_MP;
    if (c) { outF[p] += c * .2; if (p + 1 <= P) outF[p + 1] += c * .4; if (p + 2 <= P) outF[p + 2] += c * .4; }
  }

  for (let p = 1; p <= P; p++) {
    const mpDisp = (mpFim[p - 1] || 0) + (p >= 2 ? (+S.mp[p - 1] || 0) : 0);
    const supNec = Math.ceil(op[p] / 12) || 0;
    const produt = (op[p] > 0 && sp[p] < supNec) ? 0.8 : 1.0;
    if (op[p] > 0 && sp[p] < supNec) A(`P${p}: supervisores de produção insuficientes (${sp[p]}/${supNec}) — produtividade reduzida a 80%`);
    const hDisp = op[p] * H_PER * produt;
    const progAnt = p >= 2 ? (+S.prog[p - 1] || 0) : 0;
    const q = Math.min(progAnt, cap[p], Math.floor(hDisp / MOD_H), Math.floor(mpDisp / MP_UN));
    if (progAnt > cap[p]) A(`P${p}: programação excede a capacidade`);
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
    for (const r of [0, 1, 2]) {
      if ((+S.propT[p][r] || 0) > TETO_PROP || (+S.propO[p][r] || 0) > TETO_PROP)
        A(`P${p}: propaganda em ${REGIOES[r]} acima do teto`);
    }
  }
  if ((+S.prog[7] || 0) > 0 || (+S.prog[8] || 0) > 0) A('Programação em P7/P8 não gera produto vendável dentro do jogo', true);
  const pdAc = S.pd.slice(1).reduce((a, b) => a + (+b || 0), 0);
  if (pdAc > 0 && pdAc < 102000) A(`P&D acumulado abaixo dos $102.000 do ponto de saturação (~51%)`, true);

  const dre: PeriodoDRE[] = []; let caixa = CAPITAL, llAcum = 0, caixaMin = Infinity;
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

  for (let p = 1; p <= P; p++) {
    const cpv = vTot[p] * (CUSTO_MP * MP_UN + MOD_UN);
    const frete = vReal[p][0] * FRETE[0] + vReal[p][2] * FRETE[2];
    const comis = receita[p] * ((+S.com[p] || 0) / 100);
    const arm = mpFim[p] * ARM_MP + paFim[p] * ARM_PA;
    const prop = (+S.propT[p][0] || 0) + (+S.propT[p][1] || 0) + (+S.propT[p][2] || 0) + (+S.propO[p][0] || 0) + (+S.propO[p][1] || 0) + (+S.propO[p][2] || 0);
    const pd = +S.pd[p] || 0;
    const fixos = cfFaixa(cap[p]);
    const folhaOp = op[p] * OP.sal;
    const folhaOpExtra = Math.max(0, folhaOp - prod[p] * MOD_UN);
    const folhaSup = sp[p] * SP.sal, folhaVd = vd[p] * VD.sal, folhaSv = sv[p] * SV.sal;
    const contr = (+S.opC[p] || 0) * (OP.c + OP.t) + (+S.spC[p] || 0) * (SP.c + SP.t) + (+S.vdC[p] || 0) * (VD.c + VD.t) + (+S.svC[p] || 0) * (SV.c + SV.t)
      + (+S.opD[p] || 0) * OP.d + (+S.spD[p] || 0) * SP.d + (+S.vdD[p] || 0) * VD.d + (+S.svD[p] || 0) * SV.d;
    const jGiro = (p >= 2 ? (+S.apG[p - 1] || 0) * 0.018 : 0);
    const jCP = (p >= 2 ? (+S.apC[p - 1] || 0) * 0.035 : 0);
    const jMP = (p >= 3 ? (+S.apM[p - 2] || 0) * 0.04 : 0);
    const jRec = jGiro + jCP + jMP;
    const jRot = (rotSaldo[p - 1] || 0) * 0.08;
    const jEmC = (p >= 2 ? (+S.emC[p - 1] || 0) * 0.049 : 0);
    const jPag = jRot + jEmC + lpJur[p];
    const deprec = cap[p] * MODULO * DEPREC;
    const lair = receita[p] - cpv - frete - comis - arm - prop - pd - fixos - ADMIN - folhaOpExtra - folhaSup - folhaVd - folhaSv - contr - deprec + jRec - jPag;
    const ir = lair > 0 ? lair * IR : 0;
    const ll = lair - ir;
    llAcum += ll;
    if (p + 1 <= P) irPag[p + 1] += ir;
    const folhaCaixa = folhaOp + folhaSup + folhaVd + folhaSv + contr + comis;
    if (p + 1 <= P) folhaPag[p + 1] += folhaCaixa;

    let cx = caixa;
    cx += inF[p]; cx += apRet[p];
    cx += (p >= 2 ? ((+S.apG[p - 1] || 0) * 1.018) : 0);
    cx += (+S.emC[p] || 0) + (+S.emL[p] || 0);
    cx -= outF[p]; cx -= prop + pd + ADMIN + fixos + arm;
    cx -= folhaPag[p]; cx -= irPag[p];
    cx -= emPay[p]; cx -= lpJur[p] + lpAmt[p];
    cx -= (rotSaldo[p - 1] || 0) * 1.08;
    let apG = +S.apG[p] || 0, apC = +S.apC[p] || 0, apM = +S.apM[p] || 0;
    cx -= apG + apC + apM;
    if (cx < 0 && apG > 0) { const usa = Math.min(apG, -cx); cx += usa; apG -= usa; A(`P${p}: aplicação de giro resgatada antecipadamente para cobrir o caixa`, true); }
    if (cx < 0) { rotSaldo[p] = -cx; cx = 0; A(`P${p}: caixa estourou — rotativo automático a 8% (pago em P${p + 1})`); }
    caixa = cx; caixaMin = Math.min(caixaMin, cx);

    dre.push({
      p, receita: receita[p], cpv, frete, comis, arm, prop, pd, fixos, admin: ADMIN, ocios: folhaOpExtra,
      folhaSup, folhaVd, folhaSv, contr, jRec, jPag, lair, ir, ll, llAcum, caixa: cx,
      prod: prod[p], vTot: vTot[p], cap: cap[p], pa: paFim[p], mp: mpFim[p], op: op[p], sp: sp[p], vd: vd[p], sv: sv[p],
    });
  }

  return { dre, llAcum, pl: CAPITAL + llAcum, roe: llAcum / CAPITAL, caixaMin, cap, op, sp, vd, sv, prod, vTot, receita, paFim, mpFim, alertas };
}
