// Progresso do jogador (LGPD: só estrelas por fase, nenhum dado pessoal).
// Fica no localStorage do próprio navegador; qualquer falha vira "sem progresso".

export const CHAVE_PROGRESSO = 'sinalAberto.progresso.v1';

export interface Progresso {
  /** Melhor número de estrelas por id de fase. */
  estrelas: Record<number, number>;
}

type Armazenamento = Pick<Storage, 'getItem' | 'setItem'>;

function armazenamentoPadrao(): Armazenamento | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // navegação privada ou cookies bloqueados
  }
}

export function carregarProgresso(armazenamento = armazenamentoPadrao()): Progresso {
  try {
    const texto = armazenamento?.getItem(CHAVE_PROGRESSO);
    if (!texto) return { estrelas: {} };
    const dados = JSON.parse(texto) as Partial<Progresso>;
    const estrelas: Record<number, number> = {};
    for (const [id, n] of Object.entries(dados.estrelas ?? {})) {
      if (Number.isInteger(Number(id)) && typeof n === 'number' && n >= 0 && n <= 3) {
        estrelas[Number(id)] = n;
      }
    }
    return { estrelas };
  } catch {
    return { estrelas: {} };
  }
}

export function salvarProgresso(p: Progresso, armazenamento = armazenamentoPadrao()): void {
  try {
    armazenamento?.setItem(CHAVE_PROGRESSO, JSON.stringify(p));
  } catch {
    // Sem espaço ou bloqueado: o jogo continua, só não lembra o progresso.
  }
}

/** Guarda o resultado, mantendo sempre o melhor número de estrelas. */
export function registrarEstrelas(p: Progresso, faseId: number, estrelas: number): Progresso {
  return { estrelas: { ...p.estrelas, [faseId]: Math.max(p.estrelas[faseId] ?? 0, estrelas) } };
}

/** A fase 1 sempre está liberada; as outras, quando a anterior foi vencida. */
export function faseLiberada(p: Progresso, faseId: number): boolean {
  return faseId === 1 || (p.estrelas[faseId - 1] ?? 0) > 0;
}
