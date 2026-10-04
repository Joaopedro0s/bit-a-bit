// Dados compartilhados entre as cenas (criados uma vez no main.ts).

import type { Fase } from './core/fases';
import type { Progresso } from './progresso';

export interface Contexto {
  fases: Fase[];
  progresso: Progresso;
  /** Parte de baixo da tela (DOM): menus e Mesa de Programação. */
  painel: HTMLElement;
  /** Texto da versão, lido do version.json. */
  versao: string;
  /** Velocidade da simulação (1, 2 ou 4; nos testes pode ser maior). */
  velocidade: number;
  modoTeste: boolean;
}

let atual: Contexto | null = null;

export function definirContexto(c: Contexto): void {
  atual = c;
}

export function contexto(): Contexto {
  if (!atual) throw new Error('Contexto do jogo ainda não foi criado.');
  return atual;
}

/** Troca o conteúdo do painel de baixo. */
export function trocarPainel(...filhos: Node[]): void {
  const { painel } = contexto();
  painel.replaceChildren(...filhos);
  painel.scrollTop = 0;
}
