import { describe, expect, test } from 'vitest';
import { bin, bool, cmp, logico, num, variavel } from '../../../src/core/ast';
import { condicaoParaTexto, expressaoParaTexto, gerarJs, linhaParaTexto } from '../../../src/core/gerarJs';
import { avaliarFase, calcularEstrelas, descreverObjetivo, type Objetivo } from '../../../src/core/objetivos';
import { montarPrograma, type Linha } from '../../../src/core/programa';
import type { Estatisticas } from '../../../src/core/simulacao';

const stats = (parcial: Partial<Estatisticas> = {}): Estatisticas => ({
  segundos: 60,
  colisoes: 0,
  carrosQuePassaram: 12,
  passaramPorVia: { Norte: 6, Leste: 6 },
  maiorFila: 4,
  maiorFilaPorVia: { Norte: 4, Leste: 3 },
  esperaMaxAmbulancia: 2,
  tempoAbertoSemCarros: 1,
  ...parcial,
});

const objetivos: Objetivo[] = [
  { tipo: 'semColisao' },
  { tipo: 'carrosQuePassaram', minimo: 10 },
  { tipo: 'maiorFila', maximo: 5 },
  { tipo: 'esperaMaxAmbulancia', maximo: 3 },
  { tipo: 'tempoAbertoSemCarros', maximo: 2 },
];

describe('estrelas e objetivos', () => {
  test('3 estrelas até o ideal, 2 até ideal+2, 1 acima disso', () => {
    expect(calcularEstrelas(6, 6)).toBe(3);
    expect(calcularEstrelas(5, 6)).toBe(3);
    expect(calcularEstrelas(8, 6)).toBe(2);
    expect(calcularEstrelas(9, 6)).toBe(1);
  });

  test('vence quando a fase termina e cumpre todos os objetivos', () => {
    const r = avaliarFase(objetivos, 'terminada', stats(), 7, 6);
    expect(r.venceu).toBe(true);
    expect(r.estrelas).toBe(2);
    expect(r.objetivos.every((o) => o.cumprido)).toBe(true);
  });

  test('perde se algum objetivo falhar e diz qual foi', () => {
    const r = avaliarFase(objetivos, 'terminada', stats({ maiorFila: 9 }), 6, 6);
    expect(r.venceu).toBe(false);
    expect(r.estrelas).toBe(0);
    const fila = r.objetivos.find((o) => o.objetivo.tipo === 'maiorFila');
    expect(fila).toMatchObject({ cumprido: false, valor: 9 });
  });

  test('batida ou erro nunca é vitória', () => {
    expect(avaliarFase(objetivos, 'colisao', stats({ colisoes: 1 }), 6, 6).venceu).toBe(false);
    expect(avaliarFase(objetivos, 'erro', stats(), 6, 6).venceu).toBe(false);
  });

  test('cada objetivo tem um texto simples', () => {
    expect(objetivos.map(descreverObjetivo)).toEqual([
      'Nenhuma batida',
      'Pelo menos 10 carros passam',
      'Nenhuma fila maior que 5 carros',
      'A ambulância espera no máximo 3 s',
      'Sinal verde sem carros por no máximo 2 s',
    ]);
  });
});

describe('gerarJs', () => {
  test('fase 3: se/senão com OU vira if/else com || e ===', () => {
    const linhas: Linha[] = [
      {
        tipo: 'SE',
        condicao: logico(
          'OR',
          cmp(variavel('ambulanciaLeste'), '==', bool(true)),
          cmp(variavel('carrosLeste'), '>', num(5)),
        ),
      },
      { tipo: 'FECHAR', via: 'Norte' },
      { tipo: 'ABRIR', via: 'Leste' },
      { tipo: 'SENAO' },
      { tipo: 'FECHAR', via: 'Leste' },
      { tipo: 'ABRIR', via: 'Norte' },
      { tipo: 'FIM' },
      { tipo: 'ESPERAR', duracao: num(2) },
    ];
    expect(gerarJs(montarPrograma(linhas))).toBe(
      [
        '// O cruzamento repete este código enquanto a fase durar.',
        'while (true) {',
        '  if (ambulanciaLeste === true || carrosLeste > 5) {',
        '    fecharSinal("Norte");',
        '    abrirSinal("Leste");',
        '  } else {',
        '    fecharSinal("Leste");',
        '    abrirSinal("Norte");',
        '  }',
        '  esperar(2);',
        '}',
      ].join('\n'),
    );
    expect(linhaParaTexto(linhas[0])).toBe('se (ambulanciaLeste == verdadeiro OU carrosLeste > 5) {');
    expect(linhaParaTexto(linhas[3])).toBe('} senão {');
  });

  test('fase 4: variável é declarada com let e usada no esperar', () => {
    const linhas: Linha[] = [
      { tipo: 'ATRIBUIR', variavel: 'tempoVerde', valor: bin('*', variavel('carrosNorte'), num(1.5)) },
      { tipo: 'ABRIR', via: 'Norte' },
      { tipo: 'ESPERAR', duracao: variavel('tempoVerde') },
      { tipo: 'FECHAR', via: 'Norte' },
    ];
    expect(gerarJs(montarPrograma(linhas))).toBe(
      [
        'let tempoVerde;',
        '',
        '// O cruzamento repete este código enquanto a fase durar.',
        'while (true) {',
        '  tempoVerde = carrosNorte * 1.5;',
        '  abrirSinal("Norte");',
        '  esperar(tempoVerde);',
        '  fecharSinal("Norte");',
        '}',
      ].join('\n'),
    );
    expect(linhas.map(linhaParaTexto)).toEqual([
      'tempoVerde = carrosNorte * 1.5',
      'abrirSinal("Norte")',
      'esperar(tempoVerde)',
      'fecharSinal("Norte")',
    ]);
  });

  test('parênteses só onde a ordem das contas exige', () => {
    expect(expressaoParaTexto(bin('*', bin('+', num(1), num(2)), num(3)))).toBe('(1 + 2) * 3');
    expect(expressaoParaTexto(bin('+', num(1), bin('*', num(2), num(3))))).toBe('1 + 2 * 3');
    expect(expressaoParaTexto(bin('-', num(5), bin('-', num(2), num(1))))).toBe('5 - (2 - 1)');
    const misto = logico('AND', logico('OR', cmp(num(1), '<', num(2)), cmp(num(3), '>', num(4))), cmp(num(1), '==', num(1)));
    expect(condicaoParaTexto(misto)).toBe('(1 < 2 || 3 > 4) && 1 === 1');
    expect(condicaoParaTexto(misto, 'bloco')).toBe('(1 < 2 OU 3 > 4) E 1 == 1');
  });
});
