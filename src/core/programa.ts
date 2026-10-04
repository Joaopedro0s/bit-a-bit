// A Mesa de Programação é uma lista simples de linhas (o que o jogador toca).
// Aqui essa lista vira a AST, com os blocos `se`/`senão`/`fim` aninhados.

import type { Condicao, Expressao, Instrucao, InstrucaoSe, Via } from './ast';
import { ehSensor } from './ast';

export type Linha =
  | { tipo: 'ABRIR'; via: Via }
  | { tipo: 'FECHAR'; via: Via }
  | { tipo: 'ESPERAR'; duracao: Expressao }
  | { tipo: 'ATRIBUIR'; variavel: string; valor: Expressao }
  | { tipo: 'SE'; condicao: Condicao }
  | { tipo: 'SENAO' }
  | { tipo: 'FIM' };

/** Erro no programa, sempre com mensagem simples e (se houver) a linha. */
export class ErroPrograma extends Error {
  constructor(
    mensagem: string,
    public readonly linha: number | null = null,
  ) {
    super(mensagem);
    this.name = 'ErroPrograma';
  }
}

interface Aberto {
  no: InstrucaoSe;
  noSenao: boolean;
}

export function montarPrograma(linhas: readonly Linha[]): Instrucao[] {
  const raiz: Instrucao[] = [];
  const pilha: Aberto[] = [];
  const destino = (): Instrucao[] => {
    const topo = pilha[pilha.length - 1];
    if (!topo) return raiz;
    return topo.noSenao ? (topo.no.senao ??= []) : topo.no.entao;
  };

  linhas.forEach((l, i) => {
    const linha = i + 1;
    switch (l.tipo) {
      case 'ABRIR':
      case 'FECHAR':
        destino().push({ kind: 'ACTION', acao: l.tipo, via: l.via, linha });
        break;
      case 'ESPERAR':
        destino().push({ kind: 'ACTION', acao: 'ESPERAR', duracao: l.duracao, linha });
        break;
      case 'ATRIBUIR':
        if (ehSensor(l.variavel)) {
          throw new ErroPrograma(
            `"${l.variavel}" é contada pelo cruzamento. Você pode ler, mas não pode mudar.`,
            linha,
          );
        }
        destino().push({ kind: 'ASSIGN', variavel: l.variavel, valor: l.valor, linha });
        break;
      case 'SE': {
        const no: InstrucaoSe = { kind: 'IF', condicao: l.condicao, entao: [], linha };
        destino().push(no);
        pilha.push({ no, noSenao: false });
        break;
      }
      case 'SENAO': {
        const topo = pilha[pilha.length - 1];
        if (!topo) throw new ErroPrograma('O bloco "senão" precisa vir depois de um "se".', linha);
        if (topo.noSenao) {
          throw new ErroPrograma('Este "se" já tem um "senão". Use só um.', linha);
        }
        topo.noSenao = true;
        topo.no.senao = [];
        break;
      }
      case 'FIM':
        if (!pilha.pop()) {
          throw new ErroPrograma('Este "fim" não fecha nenhum "se". Tire ele daqui.', linha);
        }
        break;
    }
  });

  const naoFechado = pilha[pilha.length - 1];
  if (naoFechado) {
    throw new ErroPrograma(
      `O "se" da linha ${naoFechado.no.linha} não foi fechado. Coloque um bloco "fim" depois dele.`,
      naoFechado.no.linha,
    );
  }
  return raiz;
}

/** Profundidade de recuo de cada linha (para desenhar a Mesa). */
export function recuoDasLinhas(linhas: readonly Linha[]): number[] {
  let nivel = 0;
  return linhas.map((l) => {
    if (l.tipo === 'FIM' || l.tipo === 'SENAO') nivel = Math.max(0, nivel - 1);
    const atual = nivel;
    if (l.tipo === 'SE' || l.tipo === 'SENAO') nivel++;
    return atual;
  });
}
