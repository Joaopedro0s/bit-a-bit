import { describe, expect, test } from 'vitest';
import type { Condicao } from '../../src/core/ast';
import {
  aplicarToken,
  carregarFases,
  ErroFases,
  lerNoCaminho,
  simularFase,
  type Fase,
} from '../../src/core/fases';
import dados from '../../src/content/fases.json';
import { gerarJs, gerarJsMarcado } from '../../src/core/gerarJs';
import { montarPrograma } from '../../src/core/programa';

const fases = carregarFases(dados);
const copia = (): Fase[] => structuredClone(dados) as unknown as Fase[];

describe('fases.json', () => {
  test('é válido pelo schema e tem as 5 fases em ordem', () => {
    expect(fases.map((f) => f.id)).toEqual([1, 2, 3, 4, 5]);
    expect(fases.slice(0, 4).every((f) => f.tipo === 'blocos')).toBe(true);
    expect(fases[4].tipo).toBe('codigo');
  });

  test('JSON inválido falha com mensagem clara', () => {
    const semCampo = copia() as unknown as Record<string, unknown>[];
    delete semCampo[0].dica;
    expect(() => carregarFases(semCampo)).toThrow(ErroFases);

    const viaErrada = copia();
    (viaErrada[0].solucao[0] as { via: string }).via = 'Sul';
    expect(() => carregarFases(viaErrada)).toThrow(/fases.json inválido/);

    const solucaoVazia = copia();
    solucaoVazia[1].solucao = [];
    expect(() => carregarFases(solucaoVazia)).toThrow(ErroFases);

    expect(() => carregarFases({ nao: 'é uma lista' })).toThrow(ErroFases);
  });

  test('regras além do schema: ids em ordem, solução que monta, token com valor válido', () => {
    const idsFora = copia();
    idsFora[0].id = 9;
    expect(() => carregarFases(idsFora)).toThrow(/ids devem ser/);

    const naoMonta = copia();
    naoMonta[0].solucao.push({ tipo: 'FIM' });
    expect(() => carregarFases(naoMonta)).toThrow(/solucao não monta/);

    const tokenRuim = copia();
    tokenRuim[4].codigo!.tokens[0].opcoes = ['>', '=='];
    expect(() => carregarFases(tokenRuim)).toThrow(/fora das opções/);

    const semGaveta = copia();
    delete semGaveta[0].gaveta;
    expect(() => carregarFases(semGaveta)).toThrow(/sem gaveta/);
  });
});

describe.each(fases.map((f) => [f.id, f] as const))('fase %i', (_id, fase) => {
  test('a solução de referência VENCE com 3 estrelas', () => {
    const { simulacao, resultado } = simularFase(fase, fase.solucao);
    expect(simulacao.falha).toBeNull();
    expect(resultado.objetivos.filter((o) => !o.cumprido)).toEqual([]);
    expect(resultado.venceu).toBe(true);
    expect(resultado.estrelas).toBe(3);
  });

  test('a solução errada conhecida PERDE', () => {
    const { resultado } = simularFase(fase, fase.solucaoErrada);
    expect(resultado.venceu).toBe(false);
    expect(resultado.estrelas).toBe(0);
  });

  test('o JavaScript marcado (fase 5) é idêntico ao do botão "Ver em JavaScript"', () => {
    for (const linhas of [fase.solucao, fase.solucaoErrada]) {
      const texto = gerarJsMarcado(linhas, fase.codigo?.tokens)
        .map((l) => l.segmentos.map((s) => s.texto).join(''))
        .join('\n');
      expect(texto).toBe(gerarJs(montarPrograma(linhas)));
    }
  });

  test('é possível montar a solução com os blocos disponíveis', () => {
    if (fase.tipo === 'codigo') {
      // Fase 5: trocar os tokens do código inicial chega na solução.
      const { linhasIniciais, tokens } = fase.codigo!;
      let linhas = linhasIniciais;
      for (const t of tokens) {
        const alvo = lerNoCaminho(fase.solucao, t.caminho);
        expect(t.opcoes).toContain(alvo);
        linhas = aplicarToken(linhas, t.caminho, alvo);
      }
      expect(linhas).toEqual(fase.solucao);
      return;
    }
    const gaveta = fase.gaveta!;
    const pecasDaCondicao = (c: Condicao): boolean =>
      c.tipo === 'CMP'
        ? gaveta.condicoes.some((g) => JSON.stringify(g) === JSON.stringify(c))
        : gaveta.operadores.includes(c.op) && pecasDaCondicao(c.esq) && pecasDaCondicao(c.dir);
    for (const linha of fase.solucao) {
      if (linha.tipo === 'SE') {
        expect(pecasDaCondicao(linha.condicao)).toBe(true);
      } else {
        expect(gaveta.linhas).toContainEqual(linha);
      }
    }
  });
});

describe('perdas que ensinam (mensagens certas para o jogador)', () => {
  test('fase 1: abrir os dois sinais causa batida apontando a linha 2', () => {
    const { simulacao } = simularFase(fases[0], fases[0].solucaoErrada);
    expect(simulacao.status).toBe('colisao');
    expect(simulacao.falha?.linha).toBe(2);
  });

  test('fase 1: esquecer o esperar mostra a mensagem do loop', () => {
    const semEspera = fases[0].solucao.filter((l) => l.tipo !== 'ESPERAR');
    const { simulacao } = simularFase(fases[0], semEspera);
    expect(simulacao.falha?.tipo).toBe('loop');
  });

  test('fase 3: solução do GDD sem fechar sinais bate', () => {
    const semFechar = fases[2].solucao.filter((l) => l.tipo !== 'FECHAR');
    expect(simularFase(fases[2], semFechar).simulacao.status).toBe('colisao');
  });

  test('fase 5: fechar o sinal errado também perde (o Leste fecha e reabre e ninguém passa)', () => {
    const fase5 = fases[4];
    const token = fase5.codigo!.tokens.find((t) => t.id === 'via')!;
    const errado = aplicarToken(fase5.solucao, token.caminho, 'Leste');
    const { resultado } = simularFase(fase5, errado);
    expect(resultado.venceu).toBe(false);
    expect(resultado.objetivos.find((o) => o.objetivo.tipo === 'maiorFila')?.cumprido).toBe(false);
  });

  test('fase 5: cada token editável aparece uma vez no código, com o valor atual', () => {
    const { linhasIniciais, tokens } = fases[4].codigo!;
    const marcados = gerarJsMarcado(linhasIniciais, tokens).flatMap((l) =>
      l.segmentos.filter((s) => s.token).map((s) => [s.token, s.texto, l.linha]),
    );
    expect(marcados).toEqual([
      ['comparador', '<', 1],
      ['numero', '4', 1],
      ['via', 'Norte', 2],
    ]);
  });

  test('caminho de token inexistente é rejeitado', () => {
    expect(() => aplicarToken(fases[4].solucao, [0, 'naoExiste', 'op'], '>')).toThrow(ErroFases);
  });
});
