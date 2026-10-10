import { describe, expect, test } from 'vitest';
import { bool, cmp, logico, num, variavel } from '../../../src/core/ast';
import { avaliarCondicao, avaliarExpressao, Interpretador } from '../../../src/core/interpretador';
import { avaliarFase, calcularEstrelas, type Objetivo } from '../../../src/core/objetivos';
import { ErroPrograma, montarPrograma, type Linha } from '../../../src/core/programa';

const sensores = (valores: Record<string, number | boolean>) => (nome: string) => valores[nome];

describe('Casos de Borda do Core', () => {
  describe('variável indefinida', () => {
    test('avaliação de expressão com variável não declarada nem no sensor lança ErroPrograma', () => {
      const ler = sensores({});
      expect(() => avaliarExpressao(variavel('tempoInexistente'), ler, 5)).toThrow(ErroPrograma);
      try {
        avaliarExpressao(variavel('tempoInexistente'), ler, 5);
      } catch (e) {
        expect(e).toBeInstanceOf(ErroPrograma);
        expect((e as ErroPrograma).linha).toBe(5);
        expect((e as ErroPrograma).message).toContain('tempoInexistente');
      }
    });

    test('passo do interpretador falha ao usar variável não inicializada', () => {
      const prog = montarPrograma([
        { tipo: 'ESPERAR', duracao: variavel('variavelSemValor') },
      ]);
      const interp = new Interpretador(prog);
      expect(() => interp.passo(sensores({}))).toThrow(ErroPrograma);
    });
  });

  describe('esperar negativo', () => {
    test('passo com tempo de espera negativo em número literal lança ErroPrograma', () => {
      const prog = montarPrograma([
        { tipo: 'ESPERAR', duracao: num(-5) },
      ]);
      const interp = new Interpretador(prog);
      expect(() => interp.passo(sensores({}))).toThrow(/negativo/);
    });

    test('passo com tempo de espera negativo via expressão/variável lança ErroPrograma', () => {
      const prog = montarPrograma([
        { tipo: 'ATRIBUIR', variavel: 'tempo', valor: num(-2) },
        { tipo: 'ESPERAR', duracao: variavel('tempo') },
      ]);
      const interp = new Interpretador(prog);
      interp.passo(sensores({})); // atribui -2
      expect(() => interp.passo(sensores({}))).toThrow(/negativo/);
    });
  });

  describe('senão vazio', () => {
    test('execução de bloco se com condição falsa e senão vazio pula para a próxima instrução', () => {
      const linhas: Linha[] = [
        { tipo: 'SE', condicao: cmp(variavel('carrosNorte'), '>', num(10)) },
        { tipo: 'ABRIR', via: 'Norte' },
        { tipo: 'FIM' },
        { tipo: 'ABRIR', via: 'Leste' },
      ];
      const prog = montarPrograma(linhas);
      const interp = new Interpretador(prog);
      const ler = sensores({ carrosNorte: 2 });

      // Passo 1: SE (resultado false)
      const efeitoSe = interp.passo(ler);
      expect(efeitoSe).toEqual({ tipo: 'SE', resultado: false, linha: 1 });

      // Passo 2: ABRIR Leste (linha 4), pulou o ramo então
      const efeitoProximo = interp.passo(ler);
      expect(efeitoProximo).toEqual({ tipo: 'ABRIR', via: 'Leste', linha: 4 });
    });
  });

  describe('programa vazio', () => {
    test('interpretador com programa vazio sinaliza vazio e retorna null no passo', () => {
      const interp = new Interpretador([]);
      expect(interp.vazio).toBe(true);
      expect(interp.proximaLinha()).toBeNull();
      expect(interp.passo(sensores({}))).toBeNull();
    });
  });

  describe('operadores AND e OR', () => {
    const ler = sensores({ c1: 5, c2: 10, amb: true });

    test('combinações complexas de AND e OR', () => {
      const cond1 = cmp(variavel('c1'), '>', num(0)); // true
      const cond2 = cmp(variavel('c2'), '<', num(5)); // false
      const cond3 = cmp(variavel('amb'), '==', bool(true)); // true

      // (true AND false) OR true => true
      const exp1 = logico('OR', logico('AND', cond1, cond2), cond3);
      expect(avaliarCondicao(exp1, ler)).toBe(true);

      // true AND (false OR false) => false
      const exp2 = logico('AND', cond1, logico('OR', cond2, cmp(variavel('c1'), '==', num(0))));
      expect(avaliarCondicao(exp2, ler)).toBe(false);
    });
  });

  describe('limite de estrelas', () => {
    test('calcularEstrelas retorna pontuação exata conforme idealBlocos', () => {
      const ideal = 5;
      expect(calcularEstrelas(4, ideal)).toBe(3);
      expect(calcularEstrelas(5, ideal)).toBe(3);
      expect(calcularEstrelas(6, ideal)).toBe(2);
      expect(calcularEstrelas(7, ideal)).toBe(2);
      expect(calcularEstrelas(8, ideal)).toBe(1);
      expect(calcularEstrelas(15, ideal)).toBe(1);
    });

    test('avaliarFase devolve 0 estrelas quando a simulação não vence', () => {
      const objetivos: Objetivo[] = [{ tipo: 'semColisao' }];
      const estatisticas = {
        tempoSimulado: 10,
        colisoes: 1,
        carrosQuePassaram: 0,
        maiorFila: 2,
        esperaMaxAmbulancia: 0,
        tempoAbertoSemCarros: 0,
      };
      const resultado = avaliarFase(objetivos, 'colisao', estatisticas, 4, 5);
      expect(resultado.venceu).toBe(false);
      expect(resultado.estrelas).toBe(0);
    });
  });
});
