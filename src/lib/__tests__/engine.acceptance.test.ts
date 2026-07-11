// Estes testes codificam os valores oficiais dos relatórios SES (Real P1 / Projetado P2).
// Falhas indicam correções pendentes no motor — NUNCA ajustar os valores esperados para fazer os testes passarem.

import { describe, it, expect } from 'vitest';
import { simular, planoInicial, type EstadoPlano } from '../engine';

const P = 8;
const zeros = () => Array(P + 1).fill(0);
const zerosR = () => Array(P + 1).fill(0).map(() => [0, 0, 0]);

// Fixture com as decisões reais da equipe apenas em P1 e P2; todos os demais períodos zerados.
function planoReal(): EstadoPlano {
  const opC = zeros(); opC[1] = 10;
  const spC = zeros(); spC[1] = 1; spC[2] = 1;
  const vdC = zeros(); vdC[2] = 22;
  const svC = zeros(); svC[2] = 3;
  const prog = zeros(); prog[1] = 2000; prog[2] = 2000;
  const mp = zeros(); mp[1] = 6000; mp[2] = 6000;
  const pd = zeros(); pd[1] = 34000; pd[2] = 34000;
  const com = zeros(); com[1] = 2; com[2] = 2;
  const apG = zeros(); apG[1] = 300000; apG[2] = 198000;
  const apC = zeros(); apC[1] = 700000; apC[2] = 500000;
  const apM = zeros(); apM[1] = 1200000;

  const propT = zerosR();
  propT[1] = [4000, 15000, 15000];
  propT[2] = [4000, 15000, 15000];
  const propO = zerosR();
  propO[1] = [10000, 15000, 5000];
  propO[2] = [10000, 15000, 5000];

  return {
    capIni: 2000,
    pagto: '100',
    exp: zeros(),
    prog,
    mp,
    vendas: zerosR(),
    preco: zerosR(),
    vend: zerosR(),
    propT,
    propO,
    pd,
    opC, opD: zeros(),
    spC, spD: zeros(),
    vdC, vdD: zeros(),
    svC, svD: zeros(),
    com,
    apG, apC, apM,
    emC: zeros(), emL: zeros(),
    // C5: eventos oficiais do Real P1 / Projetado P2
    eventosDesp: [0, 101850, 5500, 0, 0, 0, 0, 0, 0],
    eventosRec:  [0,   1850,    0, 0, 0, 0, 0, 0, 0],
  };
}

describe('Aceitação SES — valores oficiais P1–P2', () => {
  const R = simular(planoReal());
  const CAPITAL = 3_000_000;

  it('LL P1 = -260650', () => {
    expect(R.dre[0].ll).toBeCloseTo(-260650, 2);
  });
  it('Caixa final P1 = 292000', () => {
    expect(R.dre[0].caixa).toBeCloseTo(292000, 2);
  });
  it('PL após P1 = 2739350', () => {
    expect(CAPITAL + R.dre[0].llAcum).toBeCloseTo(2739350, 2);
  });
  it('LL P2 = -365080', () => {
    expect(R.dre[1].ll).toBeCloseTo(-365080, 2);
  });
  it('LL acumulado P2 = -625730', () => {
    expect(R.dre[1].llAcum).toBeCloseTo(-625730, 2);
  });
  it('Produção P2 = 1800', () => {
    expect(R.dre[1].prod).toBeCloseTo(1800, 2);
  });
  it('Estoque final MP P2 = 600', () => {
    expect(R.dre[1].mp).toBeCloseTo(600, 2);
  });
  it('Perdas MOD P2 = 5280', () => {
    expect(R.dre[1].ocios).toBeCloseTo(5280, 2);
  });
  it('Armazenagem P2 = 1800', () => {
    expect(R.dre[1].arm).toBeCloseTo(1800, 2);
  });
  it('Depreciação P2 = 9450', () => {
    expect(R.dre[1].deprec).toBeCloseTo(9450, 2);
  });
  it('Depreciação P1 = 0', () => {
    expect(R.dre[0].deprec).toBeCloseTo(0, 2);
  });
  it('Custos fixos P1 = 0', () => {
    expect(R.dre[0].fixos).toBeCloseTo(0, 2);
  });
  it('Contratação/treinamento DRE P2 = 41450', () => {
    expect(R.dre[1].contr).toBeCloseTo(41450, 2);
  });
  it('Contratação/treinamento DRE P1 = 10650', () => {
    expect(R.dre[0].contr).toBeCloseTo(10650, 2);
  });
  it('Receita financeira P2 = 29900', () => {
    expect(R.dre[1].jRec).toBeCloseTo(29900, 2);
  });
  it('Caixa final P2 = 0', () => {
    expect(R.dre[1].caixa).toBeCloseTo(0, 2);
  });
});

describe('Regressão — teto de propaganda', () => {
  it('Propaganda de 21000 em P2 não deve gerar alerta "acima do teto" (teto vigente P2 = 21727,66)', () => {
    const S = planoReal();
    S.propT[2] = [21000, 15000, 15000];
    const R = simular(S);
    const alertasTetoP2 = R.alertas.filter(
      (a) => a.texto.includes('P2') && a.texto.includes('acima do teto'),
    );
    expect(alertasTetoP2).toHaveLength(0);
  });

  it('Propaganda de 21000 em P1 DEVE gerar alerta "acima do teto" (teto vigente P1 = 20649,76)', () => {
    const S = planoReal();
    S.propT[1] = [21000, 15000, 15000];
    const R = simular(S);
    const alertasTetoP1 = R.alertas.filter(
      (a) => a.texto.includes('P1') && a.texto.includes('acima do teto'),
    );
    expect(alertasTetoP1.length).toBeGreaterThan(0);
  });
});
