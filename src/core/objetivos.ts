// Objetivos mensuráveis de cada fase, avaliados sobre as estatísticas da simulação.

import type { Estatisticas, StatusSimulacao } from './simulacao';

export type Objetivo =
  | { tipo: 'semColisao' }
  | { tipo: 'carrosQuePassaram'; minimo: number }
  | { tipo: 'maiorFila'; maximo: number }
  | { tipo: 'esperaMaxAmbulancia'; maximo: number }
  | { tipo: 'tempoAbertoSemCarros'; maximo: number }
  | { tipo: 'maxBlocos'; maximo: number };

export interface ResultadoObjetivo {
  objetivo: Objetivo;
  cumprido: boolean;
  /** Valor medido na simulação. */
  valor: number;
}

export interface ResultadoFase {
  venceu: boolean;
  estrelas: 0 | 1 | 2 | 3;
  objetivos: ResultadoObjetivo[];
}

/** Texto curto, sem jargão, para mostrar o objetivo ao jogador. */
export function descreverObjetivo(o: Objetivo): string {
  switch (o.tipo) {
    case 'semColisao':
      return 'Nenhuma batida';
    case 'carrosQuePassaram':
      return `Pelo menos ${o.minimo} carros passam`;
    case 'maiorFila':
      return `Nenhuma fila maior que ${o.maximo} carros`;
    case 'esperaMaxAmbulancia':
      return `A ambulância espera no máximo ${o.maximo} s`;
    case 'tempoAbertoSemCarros':
      return `Sinal verde sem carros por no máximo ${o.maximo} s`;
    case 'maxBlocos':
      return `Use no máximo ${o.maximo} blocos/linhas`;
  }
}

export function avaliarObjetivo(o: Objetivo, e: Estatisticas, linhasUsadas: number): ResultadoObjetivo {
  switch (o.tipo) {
    case 'semColisao':
      return { objetivo: o, valor: e.colisoes, cumprido: e.colisoes === 0 };
    case 'carrosQuePassaram':
      return { objetivo: o, valor: e.carrosQuePassaram, cumprido: e.carrosQuePassaram >= o.minimo };
    case 'maiorFila':
      return { objetivo: o, valor: e.maiorFila, cumprido: e.maiorFila <= o.maximo };
    case 'esperaMaxAmbulancia':
      return { objetivo: o, valor: e.esperaMaxAmbulancia, cumprido: e.esperaMaxAmbulancia <= o.maximo };
    case 'tempoAbertoSemCarros':
      return { objetivo: o, valor: e.tempoAbertoSemCarros, cumprido: e.tempoAbertoSemCarros <= o.maximo };
    case 'maxBlocos':
      return { objetivo: o, valor: linhasUsadas, cumprido: linhasUsadas <= o.maximo };
  }
}

/** 3 estrelas: até `ideal` linhas; 2: até `ideal + 2`; 1: só cumpriu os objetivos. */
export function calcularEstrelas(linhasUsadas: number, idealBlocos: number): 1 | 2 | 3 {
  if (linhasUsadas <= idealBlocos) return 3;
  if (linhasUsadas <= idealBlocos + 2) return 2;
  return 1;
}

/**
 * Resultado final. Só há vitória se a simulação chegou ao fim
 * (sem batida e sem erro) e todos os objetivos foram cumpridos.
 */
export function avaliarFase(
  objetivos: readonly Objetivo[],
  status: StatusSimulacao,
  estatisticas: Estatisticas,
  linhasUsadas: number,
  idealBlocos: number,
): ResultadoFase {
  const resultados = objetivos.map((o) => avaliarObjetivo(o, estatisticas, linhasUsadas));
  const venceu = status === 'terminada' && resultados.every((r) => r.cumprido);
  return {
    venceu,
    estrelas: venceu ? calcularEstrelas(linhasUsadas, idealBlocos) : 0,
    objetivos: resultados,
  };
}
