// Carregamento e validação das fases (src/content/fases.json).
// O JSON é validado pelo schema (ajv) e depois por regras que o schema não cobre.

import Ajv from 'ajv';
import type { Comparacao, OperadorLogico } from './ast';
import { avaliarFase, type Objetivo, type ResultadoFase } from './objetivos';
import { montarPrograma, type Linha } from './programa';
import { Simulacao, type ConfigTransito } from './simulacao';
import schema from '../content/fases.schema.json';

/** Blocos que aparecem na gaveta de uma fase. */
export interface Gaveta {
  /** Blocos de linha prontos (abrir, fechar, esperar, senão, fim...). */
  linhas: Linha[];
  /** Peças para montar a condição do bloco "se". Vazio = fase sem "se". */
  condicoes: Comparacao[];
  /** Operadores E/OU que podem juntar duas condições. */
  operadores: OperadorLogico[];
}

/** Trecho do código da fase 5 que o jogador pode trocar tocando nele. */
export interface TokenEditavel {
  id: string;
  /** Caminho até o valor dentro das linhas (ex.: [0, "condicao", "dir", "op"]). */
  caminho: (string | number)[];
  opcoes: (string | number | boolean)[];
}

export interface Fase {
  id: number;
  titulo: string;
  /** Conceito em linguagem simples (tela de fim de fase). */
  conceito: string;
  /** Dica curta antes de começar. */
  dica: string;
  /** "Momento revelação" mostrado ao vencer. */
  revelacao: string;
  tipo: 'blocos' | 'codigo';
  transito: ConfigTransito;
  objetivos: Objetivo[];
  idealBlocos: number;
  gaveta?: Gaveta;
  codigo?: { linhasIniciais: Linha[]; tokens: TokenEditavel[] };
  /** Solução de referência: tem que vencer. */
  solucao: Linha[];
  /** Solução errada conhecida: tem que perder. */
  solucaoErrada: Linha[];
}

export class ErroFases extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroFases';
  }
}

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validarSchema = ajv.compile(schema);

type Caminho = TokenEditavel['caminho'];

/** Lê o valor no caminho do token. */
export function lerNoCaminho(raiz: unknown, caminho: Caminho): unknown {
  return caminho.reduce<unknown>(
    (atual, chave) => (atual as Record<string | number, unknown> | undefined)?.[chave],
    raiz,
  );
}

/** Devolve uma cópia das linhas com o valor trocado no caminho do token. */
export function aplicarToken(linhas: readonly Linha[], caminho: Caminho, valor: unknown): Linha[] {
  const copia = structuredClone(linhas) as Linha[];
  const pai = lerNoCaminho(copia, caminho.slice(0, -1)) as Record<string | number, unknown> | undefined;
  const chave = caminho[caminho.length - 1];
  if (!pai || typeof pai !== 'object' || !(chave in pai)) {
    throw new ErroFases(`Caminho de token inválido: ${caminho.join('.')}`);
  }
  pai[chave] = valor;
  return copia;
}

/** Roda um programa na fase até o fim (sem animação) e avalia o resultado. */
export function simularFase(
  fase: Fase,
  linhas: readonly Linha[],
): { simulacao: Simulacao; resultado: ResultadoFase } {
  const simulacao = new Simulacao(fase.transito, montarPrograma(linhas)).rodarAteOFim();
  const resultado = avaliarFase(
    fase.objetivos,
    simulacao.status,
    simulacao.estatisticas(),
    linhas.length,
    fase.idealBlocos,
  );
  return { simulacao, resultado };
}

/** Valida e devolve as fases. Lança ErroFases com a lista de problemas. */
export function carregarFases(dados: unknown): Fase[] {
  if (!validarSchema(dados)) {
    const detalhes = (validarSchema.errors ?? [])
      .map((e) => `${e.instancePath || '/'} ${e.message}`)
      .join('; ');
    throw new ErroFases(`fases.json inválido: ${detalhes}`);
  }
  const fases = dados as unknown as Fase[];
  const problemas: string[] = [];

  fases.forEach((fase, i) => {
    const nome = `fase ${fase.id}`;
    if (fase.id !== i + 1) problemas.push(`${nome}: ids devem ser 1, 2, 3... em ordem`);
    if (fase.tipo === 'blocos' && !fase.gaveta) problemas.push(`${nome}: fase de blocos sem gaveta`);
    if (fase.tipo === 'codigo' && !fase.codigo) problemas.push(`${nome}: fase de código sem código`);
    for (const [rotulo, linhas] of [
      ['solucao', fase.solucao],
      ['solucaoErrada', fase.solucaoErrada],
    ] as const) {
      try {
        montarPrograma(linhas);
      } catch (e) {
        problemas.push(`${nome}: ${rotulo} não monta (${(e as Error).message})`);
      }
    }
    for (const token of fase.codigo?.tokens ?? []) {
      const valor = lerNoCaminho(fase.codigo?.linhasIniciais, token.caminho);
      if (!token.opcoes.includes(valor as string | number | boolean)) {
        problemas.push(`${nome}: token ${token.id} começa com valor fora das opções`);
      }
    }
  });

  if (problemas.length > 0) throw new ErroFases(problemas.join('\n'));
  return fases;
}
