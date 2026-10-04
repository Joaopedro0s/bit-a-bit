import { describe, expect, test } from 'vitest';
import { bin, bool, cmp, logico, num, variavel } from '../../../src/core/ast';
import { avaliarCondicao, avaliarExpressao, Interpretador } from '../../../src/core/interpretador';
import { ErroPrograma, montarPrograma, recuoDasLinhas, type Linha } from '../../../src/core/programa';

const sensores = (valores: Record<string, number | boolean>) => (nome: string) => valores[nome];

describe('condições', () => {
  const ler = sensores({ carrosNorte: 3, carrosLeste: 6, ambulanciaLeste: true });

  test('maior, menor e igual com números', () => {
    expect(avaliarCondicao(cmp(variavel('carrosNorte'), '>', num(0)), ler)).toBe(true);
    expect(avaliarCondicao(cmp(variavel('carrosNorte'), '<', num(3)), ler)).toBe(false);
    expect(avaliarCondicao(cmp(variavel('carrosNorte'), '==', num(3)), ler)).toBe(true);
  });

  test('igual com verdadeiro/falso', () => {
    expect(avaliarCondicao(cmp(variavel('ambulanciaLeste'), '==', bool(true)), ler)).toBe(true);
    expect(avaliarCondicao(cmp(variavel('ambulanciaLeste'), '==', bool(false)), ler)).toBe(false);
  });

  test('E (AND) só é verdadeiro se os dois lados forem', () => {
    const sim = cmp(variavel('carrosNorte'), '>', num(0));
    const nao = cmp(variavel('carrosLeste'), '<', num(2));
    expect(avaliarCondicao(logico('AND', sim, sim), ler)).toBe(true);
    expect(avaliarCondicao(logico('AND', sim, nao), ler)).toBe(false);
  });

  test('OU (OR) é verdadeiro se um dos lados for', () => {
    const sim = cmp(variavel('carrosLeste'), '>', num(5));
    const nao = cmp(variavel('ambulanciaLeste'), '==', bool(false));
    expect(avaliarCondicao(logico('OR', nao, sim), ler)).toBe(true);
    expect(avaliarCondicao(logico('OR', nao, nao), ler)).toBe(false);
  });

  test('comparar verdadeiro/falso com > dá erro amigável', () => {
    expect(() => avaliarCondicao(cmp(variavel('ambulanciaLeste'), '>', num(1)), ler)).toThrow(ErroPrograma);
  });
});

describe('expressões', () => {
  const ler = sensores({ carrosNorte: 4 });

  test('conta com multiplicação, soma e subtração', () => {
    expect(avaliarExpressao(bin('*', variavel('carrosNorte'), num(1.5)), ler)).toBe(6);
    expect(avaliarExpressao(bin('+', num(2), bin('*', num(3), num(4))), ler)).toBe(14);
    expect(avaliarExpressao(bin('-', variavel('carrosNorte'), num(1)), ler)).toBe(3);
  });

  test('variável sem valor dá erro com a linha', () => {
    try {
      avaliarExpressao(variavel('tempoVerde'), ler, 7);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErroPrograma);
      expect((e as ErroPrograma).linha).toBe(7);
      expect((e as ErroPrograma).message).toContain('tempoVerde');
    }
  });

  test('conta com verdadeiro/falso dá erro', () => {
    expect(() => avaliarExpressao(bin('+', bool(true), num(1)), ler)).toThrow(ErroPrograma);
  });
});

describe('montar o programa a partir das linhas da Mesa', () => {
  const linhasSe: Linha[] = [
    { tipo: 'SE', condicao: cmp(variavel('carrosNorte'), '>', num(0)) },
    { tipo: 'ABRIR', via: 'Norte' },
    { tipo: 'SENAO' },
    { tipo: 'FECHAR', via: 'Norte' },
    { tipo: 'FIM' },
    { tipo: 'ESPERAR', duracao: num(1) },
  ];

  test('se/senão viram um nó IF com os dois ramos e números de linha', () => {
    const prog = montarPrograma(linhasSe);
    expect(prog).toHaveLength(2);
    const se = prog[0];
    expect(se.kind).toBe('IF');
    if (se.kind !== 'IF') return;
    expect(se.linha).toBe(1);
    expect(se.entao).toEqual([{ kind: 'ACTION', acao: 'ABRIR', via: 'Norte', linha: 2 }]);
    expect(se.senao).toEqual([{ kind: 'ACTION', acao: 'FECHAR', via: 'Norte', linha: 4 }]);
    expect(prog[1].linha).toBe(6);
  });

  test('recuo das linhas acompanha os blocos', () => {
    expect(recuoDasLinhas(linhasSe)).toEqual([0, 1, 0, 1, 0, 0]);
  });

  test('erros de estrutura têm mensagem simples e linha', () => {
    expect(() => montarPrograma([{ tipo: 'SENAO' }])).toThrow(/depois de um "se"/);
    expect(() => montarPrograma([{ tipo: 'FIM' }])).toThrow(/não fecha nenhum/);
    expect(() => montarPrograma([linhasSe[0], linhasSe[1]])).toThrow(/não foi fechado/);
    expect(() =>
      montarPrograma([linhasSe[0], { tipo: 'SENAO' }, { tipo: 'SENAO' }, { tipo: 'FIM' }]),
    ).toThrow(/já tem um "senão"/);
  });

  test('não deixa mudar uma variável do cruzamento', () => {
    expect(() =>
      montarPrograma([{ tipo: 'ATRIBUIR', variavel: 'carrosNorte', valor: num(1) }]),
    ).toThrow(ErroPrograma);
  });
});

describe('Interpretador', () => {
  test('executa uma linha por passo e volta para a linha 1 no fim (ciclo contínuo)', () => {
    const prog = montarPrograma([
      { tipo: 'ABRIR', via: 'Norte' },
      { tipo: 'ESPERAR', duracao: num(2) },
      { tipo: 'FECHAR', via: 'Norte' },
    ]);
    const it = new Interpretador(prog);
    const ler = sensores({});
    const linhas = Array.from({ length: 5 }, () => it.passo(ler)?.linha);
    expect(linhas).toEqual([1, 2, 3, 1, 2]);
  });

  test('se/senão escolhe o ramo certo e informa o resultado', () => {
    const prog = montarPrograma([
      { tipo: 'SE', condicao: cmp(variavel('carrosNorte'), '>', num(0)) },
      { tipo: 'ABRIR', via: 'Norte' },
      { tipo: 'SENAO' },
      { tipo: 'ABRIR', via: 'Leste' },
      { tipo: 'FIM' },
    ]);
    const comCarros = new Interpretador(prog);
    expect(comCarros.passo(sensores({ carrosNorte: 2 }))).toEqual({ tipo: 'SE', resultado: true, linha: 1 });
    expect(comCarros.passo(sensores({ carrosNorte: 2 }))).toMatchObject({ tipo: 'ABRIR', via: 'Norte' });

    const semCarros = new Interpretador(prog);
    semCarros.passo(sensores({ carrosNorte: 0 }));
    expect(semCarros.passo(sensores({ carrosNorte: 0 }))).toMatchObject({ tipo: 'ABRIR', via: 'Leste', linha: 4 });
    // Depois do ramo, volta para o início.
    expect(semCarros.proximaLinha()).toBe(1);
  });

  test('ASSIGN guarda a variável e esperar usa o valor dela', () => {
    const prog = montarPrograma([
      { tipo: 'ATRIBUIR', variavel: 'tempoVerde', valor: bin('*', variavel('carrosNorte'), num(1.5)) },
      { tipo: 'ESPERAR', duracao: variavel('tempoVerde') },
    ]);
    const it = new Interpretador(prog);
    const ler = sensores({ carrosNorte: 4 });
    expect(it.passo(ler)).toEqual({ tipo: 'ATRIBUIR', variavel: 'tempoVerde', valor: 6, linha: 1 });
    expect(it.passo(ler)).toEqual({ tipo: 'ESPERAR', segundos: 6, linha: 2 });
    expect(it.variaveis.get('tempoVerde')).toBe(6);
  });

  test('esperar com tempo negativo dá erro', () => {
    const it = new Interpretador(montarPrograma([{ tipo: 'ESPERAR', duracao: num(-1) }]));
    expect(() => it.passo(sensores({}))).toThrow(/negativo/);
  });

  test('programa vazio não faz nada', () => {
    const it = new Interpretador([]);
    expect(it.passo(sensores({}))).toBeNull();
    expect(it.proximaLinha()).toBeNull();
  });

  test('reiniciar limpa variáveis e volta para a linha 1', () => {
    const it = new Interpretador(
      montarPrograma([
        { tipo: 'ATRIBUIR', variavel: 'x', valor: num(1) },
        { tipo: 'ABRIR', via: 'Norte' },
      ]),
    );
    it.passo(sensores({}));
    it.reiniciar();
    expect(it.variaveis.size).toBe(0);
    expect(it.proximaLinha()).toBe(1);
  });
});
