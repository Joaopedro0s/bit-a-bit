import { describe, expect, test } from 'vitest';
import { num, variavel } from '../../../src/core/ast';
import { montarPrograma, type Linha } from '../../../src/core/programa';
import { criarRng } from '../../../src/core/rng';
import { Simulacao, TICKS_POR_SEGUNDO, type ConfigTransito } from '../../../src/core/simulacao';

const abrir = (via: 'Norte' | 'Leste'): Linha => ({ tipo: 'ABRIR', via });
const fechar = (via: 'Norte' | 'Leste'): Linha => ({ tipo: 'FECHAR', via });
const esperar = (s: number): Linha => ({ tipo: 'ESPERAR', duracao: num(s) });

const transito: ConfigTransito = {
  duracao: 60,
  semente: 42,
  chegadas: {
    Norte: [{ de: 0, ate: 60, taxa: 0.3 }],
    Leste: [{ de: 0, ate: 60, taxa: 0.3 }],
  },
  filaInicial: { Norte: 2, Leste: 2 },
};

const simular = (linhas: Linha[], config: ConfigTransito = transito) =>
  new Simulacao(config, montarPrograma(linhas));

describe('rng com semente', () => {
  test('mesma semente gera a mesma sequência', () => {
    const a = criarRng(123);
    const b = criarRng(123);
    const seqA = Array.from({ length: 10 }, () => a.proximo());
    expect(Array.from({ length: 10 }, () => b.proximo())).toEqual(seqA);
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  test('sementes diferentes geram sequências diferentes e inteiro respeita os limites', () => {
    const a = criarRng(1);
    const b = criarRng(2);
    expect(a.proximo()).not.toBe(b.proximo());
    for (let i = 0; i < 100; i++) {
      const n = a.inteiro(3, 5);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(5);
    }
  });
});

describe('Simulacao', () => {
  test('sequência correta (fase 1 do GDD) roda o tempo todo sem batida e carros passam', () => {
    const sim = simular([abrir('Norte'), esperar(4), fechar('Norte'), abrir('Leste'), esperar(4), fechar('Leste')]);
    sim.rodarAteOFim();
    expect(sim.status).toBe('terminada');
    expect(sim.segundos).toBe(60);
    const e = sim.estatisticas();
    expect(e.colisoes).toBe(0);
    expect(e.passaramPorVia.Norte).toBeGreaterThan(5);
    expect(e.passaramPorVia.Leste).toBeGreaterThan(5);
  });

  test('trocar o sinal na mesma hora é seguro: o carro que entrou sai antes do outro lado andar', () => {
    const sim = simular(
      [abrir('Norte'), esperar(2), fechar('Norte'), abrir('Leste'), esperar(2), fechar('Leste')],
      { ...transito, filaInicial: { Norte: 30, Leste: 30 } },
    );
    sim.rodarAteOFim();
    expect(sim.status).toBe('terminada');
    expect(sim.estatisticas().colisoes).toBe(0);
  });

  test('dois sinais abertos juntos causam batida, congelam e apontam a linha responsável', () => {
    const sim = simular([abrir('Norte'), abrir('Leste'), esperar(4)]);
    sim.rodarAteOFim();
    expect(sim.status).toBe('colisao');
    expect(sim.falha?.linha).toBe(2);
    expect(sim.falha?.mensagem).toContain('linha 2');
    expect(sim.falha?.mensagem).toContain('Feche o Norte antes de abrir o Leste');
    const tickDaBatida = sim.tick;
    sim.avancar();
    expect(sim.tick).toBe(tickDaBatida); // congelada
    expect(sim.estatisticas().colisoes).toBe(1);
  });

  test('programa que repete sem esperar para com mensagem amigável', () => {
    const sim = simular([abrir('Norte'), fechar('Norte')]);
    sim.avancar();
    expect(sim.status).toBe('erro');
    expect(sim.falha?.tipo).toBe('loop');
    expect(sim.falha?.mensagem).toContain('esperar');
  });

  test('erro no programa (variável sem valor) para a simulação na linha certa', () => {
    const sim = simular([abrir('Norte'), { tipo: 'ESPERAR', duracao: variavel('tempoVerde') }]);
    sim.avancar();
    expect(sim.status).toBe('erro');
    expect(sim.falha).toMatchObject({ tipo: 'erro', linha: 2 });
  });

  test('esperar faz o relógio andar exatamente o tempo pedido', () => {
    const sim = simular([abrir('Norte'), esperar(4), fechar('Norte'), esperar(1)]);
    expect(sim.passoLinha()).toBe(1);
    expect(sim.tick).toBe(0); // abrir é instantâneo
    expect(sim.sinais.Norte.aberto).toBe(true);
    expect(sim.passoLinha()).toBe(2);
    expect(sim.tick).toBe(4 * TICKS_POR_SEGUNDO);
    expect(sim.proximaLinha()).toBe(3);
    expect(sim.passoLinha()).toBe(3);
    expect(sim.sinais.Norte.aberto).toBe(false);
  });

  test('modo passo: avancar só consome a espera e não executa linhas novas', () => {
    const sim = simular([abrir('Norte'), esperar(1), fechar('Norte'), esperar(1)]);
    sim.modoPasso = true;
    expect(sim.executarLinha()).toBe(1);
    expect(sim.executarLinha()).toBe(2);
    expect(sim.executarLinha()).toBeNull(); // ainda esperando
    for (let i = 0; i < 20; i++) sim.avancar();
    expect(sim.espera).toBe(0);
    expect(sim.tick).toBe(20);
    expect(sim.sinais.Norte.aberto).toBe(true); // nada além da espera foi executado
    sim.modoPasso = false;
    sim.avancar();
    expect(sim.ultimaLinha).toBe(4);
    expect(sim.sinais.Norte.aberto).toBe(false);
  });

  test('conta carros na fila e guarda a maior fila', () => {
    const sim = simular([], {
      duracao: 10,
      semente: 7,
      chegadas: { Norte: [{ de: 0, ate: 5, taxa: 1 }] },
      filaInicial: { Norte: 3 },
    });
    expect(sim.lerSensor('carrosNorte')).toBe(3);
    sim.rodarAteOFim();
    const e = sim.estatisticas();
    expect(sim.fila('Norte').length).toBeGreaterThan(3);
    expect(e.maiorFila).toBe(sim.fila('Norte').length);
    expect(e.maiorFilaPorVia.Leste).toBe(0);
    expect(e.carrosQuePassaram).toBe(0);
  });

  test('ambulância vai para a frente da fila e o tempo de espera dela é medido', () => {
    const sim = simular([esperar(5), abrir('Leste'), esperar(60)], {
      duracao: 10,
      semente: 1,
      chegadas: {},
      filaInicial: { Leste: 3 },
      ambulancias: [{ via: 'Leste', tempo: 2 }],
    });
    for (let i = 0; i < 30; i++) sim.avancar();
    expect(sim.lerSensor('ambulanciaLeste')).toBe(true);
    expect(sim.fila('Leste')[0].ambulancia).toBe(true);
    sim.rodarAteOFim();
    // Chegou aos 2 s, o sinal abriu aos 5 s, saiu 1 s depois (reação): 4 s de espera.
    expect(sim.estatisticas().esperaMaxAmbulancia).toBe(4);
    expect(sim.lerSensor('ambulanciaLeste')).toBe(false);
  });

  test('mede o tempo de sinal verde sem nenhum carro', () => {
    const sim = simular([abrir('Norte'), esperar(100)], { duracao: 5, semente: 1, chegadas: {} });
    sim.rodarAteOFim();
    expect(sim.estatisticas().tempoAbertoSemCarros).toBe(5);
  });

  test('mesma semente e mesmo programa dão exatamente o mesmo resultado', () => {
    const linhas = [abrir('Norte'), esperar(3), fechar('Norte'), abrir('Leste'), esperar(3), fechar('Leste')];
    const a = simular(linhas).rodarAteOFim();
    const b = simular(linhas).rodarAteOFim();
    expect(a.estatisticas()).toEqual(b.estatisticas());
    const c = simular(linhas, { ...transito, semente: 999 }).rodarAteOFim();
    expect(c.carros().map((x) => x.chegouEm)).not.toEqual(a.carros().map((x) => x.chegouEm));
  });

  test('variáveis do jogador ficam visíveis para os painéis', () => {
    const sim = simular([
      { tipo: 'ATRIBUIR', variavel: 'tempoVerde', valor: num(3) },
      esperar(1),
    ]);
    sim.passoLinha();
    expect(sim.variaveisDoJogador()).toEqual({ tempoVerde: 3 });
    expect(sim.lerSensor('naoExiste')).toBeUndefined();
  });
});
