// Partes em DOM das telas de menu, seleção de fases e fim de fase.

import type { Fase } from '../core/fases';
import { faseLiberada, type Progresso } from '../progresso';
import { abrirJanela, botao, el, estrelasTexto } from './dom';

export function telaMenu(versao: string, aoJogar: () => void): HTMLElement {
  return el(
    'div',
    { classe: 'tela' },
    el('h2', {}, 'Você manda no cruzamento!'),
    el(
      'p',
      {},
      'Monte as regras dos semáforos com blocos, solte o trânsito e veja se os carros passam sem bater. ' +
        'É assim que se aprende a programar.',
    ),
    botao('▶ Jogar', aoJogar, { classe: 'botao-grande', testid: 'btn-jogar' }),
    botao('Como jogar', abrirComoJogar, { classe: 'botao-secundario', testid: 'btn-como-jogar' }),
    el('p', { classe: 'versao', testid: 'versao' }, versao),
  );
}

export function abrirComoJogar(): void {
  const passo = (texto: string) => el('li', {}, texto);
  abrirJanela(
    'Como jogar',
    [
      el(
        'ol',
        { style: 'margin:0;padding-left:1.2em;line-height:1.6;color:var(--texto-fraco)' },
        passo('Toque nos blocos para montar o seu algoritmo, linha por linha.'),
        passo('Toque em ▶ INICIAR TRÁFEGO para soltar os carros.'),
        passo('O algoritmo repete sem parar enquanto a fase dura.'),
        passo('Se der batida, a linha com problema fica vermelha. Conserte e tente de novo!'),
        passo('Use 🔍 PASSO A PASSO para ver uma linha de cada vez.'),
        passo('Toque em { } Ver em JavaScript para ver o seu algoritmo em código de verdade.'),
      ),
      el('p', {}, 'Sinal verde mostra ▲ ABERTO. Sinal vermelho mostra ■ FECHADO.'),
    ],
    { textoBotao: 'Entendi', testid: 'janela-como-jogar' },
  );
}

export function telaSelecao(
  fases: Fase[],
  progresso: Progresso,
  aoEscolher: (id: number) => void,
  aoVoltar: () => void,
): HTMLElement {
  const itens = fases.map((f) => {
    const liberada = faseLiberada(progresso, f.id);
    const estrelas = progresso.estrelas[f.id] ?? 0;
    const b = botao('', () => aoEscolher(f.id), {
      classe: 'botao-fase',
      testid: `btn-fase-${f.id}`,
      rotulo: liberada
        ? `Fase ${f.id}: ${f.titulo}. ${estrelas} de 3 estrelas.`
        : `Fase ${f.id}: ${f.titulo}. Bloqueada: vença a fase ${f.id - 1} antes.`,
    });
    b.append(
      el('span', {}, `${f.id}. ${f.titulo}`),
      el('span', { classe: 'estrelas', 'aria-hidden': 'true' }, liberada ? estrelasTexto(estrelas) : '🔒'),
    );
    b.disabled = !liberada;
    return el('li', {}, b);
  });
  return el(
    'div',
    { classe: 'tela' },
    el('div', { classe: 'mesa-topo' }, botao('←', aoVoltar, { classe: 'botao-voltar', testid: 'btn-voltar', rotulo: 'Voltar ao menu' }), el('h2', {}, 'Escolha a fase')),
    el('ul', { classe: 'lista-fases' }, ...itens),
  );
}

export interface DadosFim {
  fase: Fase;
  estrelas: number;
  ultima: boolean;
  aoProxima: () => void;
  aoRepetir: () => void;
  aoMenu: () => void;
  /** Só na última fase: o JavaScript completo que o jogador consertou. */
  jsFinal?: string;
}

export function telaFimFase(d: DadosFim): HTMLElement {
  return el(
    'div',
    { classe: 'tela', testid: d.ultima ? 'tela-fim-jogo' : 'tela-fim-fase' },
    el('h2', {}, d.ultima ? 'Você completou o Sinal Aberto!' : `Fase ${d.fase.id} concluída!`),
    el(
      'p',
      { classe: 'estrelas-fim', testid: 'estrelas', rotulo: `${d.estrelas} de 3 estrelas` },
      el('span', { 'aria-hidden': 'true', style: 'font-size:2rem;color:var(--foco);letter-spacing:4px' }, estrelasTexto(d.estrelas)),
    ),
    el('div', { classe: 'cartao' }, el('p', { testid: 'revelacao', style: 'color:var(--texto)' }, d.fase.revelacao)),
    el('p', {}, `O que você aprendeu: ${d.fase.conceito}`),
    d.jsFinal !== undefined && el('pre', { classe: 'codigo', testid: 'js-final' }, d.jsFinal),
    d.ultima && el('p', { style: 'color:var(--texto);font-weight:700' }, 'Você leu e consertou código de verdade.'),
    d.ultima
      ? botao('Voltar ao menu', d.aoMenu, { classe: 'botao-grande', testid: 'btn-menu' })
      : botao('Próxima fase ➜', d.aoProxima, { classe: 'botao-grande', testid: 'btn-proxima' }),
    botao('Jogar esta fase de novo', d.aoRepetir, { classe: 'botao-secundario', testid: 'btn-repetir' }),
  );
}
