// Regras do Service Worker, em funções puras (testadas em tests/unit/sw.test.ts).
//
// O SW mora na pasta da própria release (/hml/ ou /releases/<sha>/) e só cuida
// do que está dentro dela. Ele NUNCA trata o carregador da raiz nem o rollout.json,
// senão o canário e o rollback deixariam de funcionar para quem já jogou.

export const PREFIXO_CACHE = 'sinal-aberto';

/** Arquivos guardados na instalação (o build é um único index.html). */
export const ARQUIVOS_DA_RELEASE = ['./', './index.html', './version.json'];

/** Nomes de arquivo que nunca passam pelo SW, mesmo dentro do escopo. */
export const NUNCA_TRATAR = ['rollout.json', 'sw.js'];

/**
 * O CacheStorage é um só para o site inteiro (todas as releases), por isso o
 * nome do cache leva o escopo (a pasta) e a versão (SHA do build).
 */
export function nomeDoCache(escopo: string, versao: string): string {
  return `${PREFIXO_CACHE}|${escopo}|${versao}`;
}

/** Caches antigos DESTA pasta. Caches de outras releases não são tocados. */
export function cachesParaApagar(nomes: readonly string[], escopo: string, versao: string): string[] {
  const atual = nomeDoCache(escopo, versao);
  const daPasta = `${PREFIXO_CACHE}|${escopo}|`;
  return nomes.filter((n) => n.startsWith(daPasta) && n !== atual);
}

/** O SW deve responder a este pedido? Só GET, só dentro da pasta da release. */
export function deveTratar(metodo: string, url: string, escopo: string): boolean {
  if (metodo !== 'GET') return false;
  let endereco: URL;
  let pasta: URL;
  try {
    endereco = new URL(url);
    pasta = new URL(escopo);
  } catch {
    return false;
  }
  if (endereco.origin !== pasta.origin) return false;
  if (!endereco.pathname.startsWith(pasta.pathname)) return false;
  const arquivo = endereco.pathname.split('/').pop() ?? '';
  return !NUNCA_TRATAR.includes(arquivo);
}

/** Navegações (com ou sem ?teste=1) usam sempre a mesma página guardada. */
export function chaveDoCache(url: string, navegacao: boolean, escopo: string): string {
  return navegacao ? escopo : url;
}
