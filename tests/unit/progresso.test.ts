import { describe, expect, test } from 'vitest';
import {
  CHAVE_PROGRESSO,
  carregarProgresso,
  faseLiberada,
  registrarEstrelas,
  salvarProgresso,
} from '../../src/progresso';

const memoria = () => {
  const dados = new Map<string, string>();
  return {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => void dados.set(k, v),
    dados,
  };
};

describe('progresso no navegador', () => {
  test('salva e carrega só as estrelas por fase', () => {
    const m = memoria();
    salvarProgresso({ estrelas: { 1: 3, 2: 1 } }, m);
    expect(JSON.parse(m.dados.get(CHAVE_PROGRESSO)!)).toEqual({ estrelas: { 1: 3, 2: 1 } });
    expect(carregarProgresso(m)).toEqual({ estrelas: { 1: 3, 2: 1 } });
  });

  test('dados quebrados ou armazenamento bloqueado viram progresso vazio', () => {
    const m = memoria();
    m.setItem(CHAVE_PROGRESSO, '{nao é json');
    expect(carregarProgresso(m)).toEqual({ estrelas: {} });
    m.setItem(CHAVE_PROGRESSO, JSON.stringify({ estrelas: { 1: 99, 2: 'x', 3: 2 } }));
    expect(carregarProgresso(m)).toEqual({ estrelas: { 3: 2 } });

    const bloqueado = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('cheio');
      },
    };
    expect(carregarProgresso(bloqueado)).toEqual({ estrelas: {} });
    expect(() => salvarProgresso({ estrelas: { 1: 1 } }, bloqueado)).not.toThrow();
    expect(carregarProgresso(null)).toEqual({ estrelas: {} });
  });

  test('mantém o melhor resultado e libera as fases em ordem', () => {
    let p = registrarEstrelas({ estrelas: {} }, 1, 3);
    p = registrarEstrelas(p, 1, 1);
    expect(p.estrelas[1]).toBe(3);
    expect(faseLiberada(p, 1)).toBe(true);
    expect(faseLiberada(p, 2)).toBe(true);
    expect(faseLiberada(p, 3)).toBe(false);
  });
});
