// Só com ?teste=1 na URL: expõe um resumo do estado para os testes E2E.
// Nenhum dado pessoal: apenas tela, fase, status e número de colisões.

export interface EstadoTeste {
  tela: 'menu' | 'selecao' | 'cruzamento' | 'fim';
  fase: number | null;
  status: string;
  colisoes: number;
}

declare global {
  interface Window {
    __sinalAberto?: EstadoTeste;
  }
}

let ativo = false;

export function ligarHookDeTeste(): void {
  ativo = true;
  window.__sinalAberto = { tela: 'menu', fase: null, status: 'pronta', colisoes: 0 };
}

export function publicarEstado(parcial: Partial<EstadoTeste>): void {
  if (!ativo || !window.__sinalAberto) return;
  Object.assign(window.__sinalAberto, parcial);
}
