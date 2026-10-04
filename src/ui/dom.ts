// Ajudantes para criar elementos. Sempre usamos textContent (nunca innerHTML
// com conteúdo dinâmico), então nada vira código sem querer.

type Filho = Node | string | null | undefined | false;

export interface Atributos {
  classe?: string;
  testid?: string;
  rotulo?: string; // aria-label
  [atributo: string]: string | undefined;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  atributos: Atributos = {},
  ...filhos: Filho[]
): HTMLElementTagNameMap[K] {
  const elemento = document.createElement(tag);
  for (const [nome, valor] of Object.entries(atributos)) {
    if (valor === undefined) continue;
    if (nome === 'classe') elemento.className = valor;
    else if (nome === 'testid') elemento.dataset.testid = valor;
    else if (nome === 'rotulo') elemento.setAttribute('aria-label', valor);
    else elemento.setAttribute(nome, valor);
  }
  for (const filho of filhos) {
    if (filho === null || filho === undefined || filho === false) continue;
    elemento.append(filho);
  }
  return elemento;
}

export function botao(
  texto: string,
  aoClicar: () => void,
  atributos: Atributos = {},
): HTMLButtonElement {
  const b = el('button', { type: 'button', ...atributos }, texto);
  b.addEventListener('click', aoClicar);
  return b;
}

export function estrelasTexto(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

/**
 * Janela por cima de tudo (dica, "Ver em JavaScript", "Como jogar").
 * Fecha com o botão, com Esc ou tocando fora. Devolve o foco para quem abriu.
 */
export function abrirJanela(
  titulo: string,
  conteudo: Filho[],
  opcoes: { textoBotao?: string; testid?: string; testidBotao?: string; aoFechar?: () => void } = {},
): () => void {
  const anterior = document.activeElement as HTMLElement | null;
  const idTitulo = `janela-titulo-${Date.now()}`;
  let fechada = false;
  const fechar = () => {
    if (fechada) return;
    fechada = true;
    fundo.remove();
    document.removeEventListener('keydown', aoTecla);
    anterior?.focus?.();
    opcoes.aoFechar?.();
  };
  const aoTecla = (e: KeyboardEvent) => {
    if (e.key === 'Escape') fechar();
  };
  const botaoFechar = botao(opcoes.textoBotao ?? 'Fechar', fechar, {
    classe: 'botao-grande',
    testid: opcoes.testidBotao ?? 'btn-fechar-janela',
  });
  const janela = el(
    'div',
    { classe: 'janela', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': idTitulo, testid: opcoes.testid },
    el('h2', { id: idTitulo }, titulo),
    ...conteudo,
    botaoFechar,
  );
  const fundo = el('div', { classe: 'janela-fundo' }, janela);
  fundo.addEventListener('click', (e) => {
    if (e.target === fundo) fechar();
  });
  document.addEventListener('keydown', aoTecla);
  document.body.append(fundo);
  botaoFechar.focus();
  return fechar;
}
