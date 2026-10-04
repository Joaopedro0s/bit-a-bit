// Service Worker do Sinal Aberto (vira dist/sw.js no `npm run build:sw`).
// Estratégia "rede primeiro": online, sempre busca a versão publicada (assim um
// novo deploy em /hml/ aparece na hora); sem internet, usa o que foi guardado.

import { ARQUIVOS_DA_RELEASE, cachesParaApagar, chaveDoCache, deveTratar, nomeDoCache } from './regras';

/** SHA + versão do build, trocado pelo esbuild. Mudou o valor, o navegador instala o SW novo. */
declare const __VERSAO_SW__: string;

// Tipos mínimos do ambiente de Service Worker (o tsconfig usa a lib DOM).
interface EventoEstendivel extends Event {
  waitUntil(promessa: Promise<unknown>): void;
}
interface EventoFetch extends EventoEstendivel {
  request: Request;
  respondWith(resposta: Promise<Response>): void;
}
interface EscopoSW {
  registration: { scope: string };
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(tipo: string, ouvinte: (evento: Event) => void): void;
}

const sw = self as unknown as EscopoSW;
const escopo = sw.registration.scope;
const CACHE = nomeDoCache(escopo, __VERSAO_SW__);

sw.addEventListener('install', (evento) => {
  (evento as EventoEstendivel).waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          ARQUIVOS_DA_RELEASE.map((arquivo) => {
            const url = new URL(arquivo, escopo).href;
            // Um arquivo que falhar (ex.: version.json local) não impede a instalação.
            return cache.add(chaveDoCache(url, arquivo === './', escopo)).catch(() => undefined);
          }),
        ),
      )
      .then(() => sw.skipWaiting()),
  );
});

sw.addEventListener('activate', (evento) => {
  (evento as EventoEstendivel).waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(cachesParaApagar(nomes, escopo, __VERSAO_SW__).map((n) => caches.delete(n))))
      .then(() => sw.clients.claim()),
  );
});

sw.addEventListener('fetch', (evento) => {
  const e = evento as EventoFetch;
  const pedido = e.request;
  if (!deveTratar(pedido.method, pedido.url, escopo)) return; // o navegador cuida normalmente
  const chave = chaveDoCache(pedido.url, pedido.mode === 'navigate', escopo);
  e.respondWith(redePrimeiro(pedido, chave));
});

async function redePrimeiro(pedido: Request, chave: string): Promise<Response> {
  const cache = await caches.open(CACHE);
  try {
    const resposta = await fetch(pedido);
    if (resposta.ok && resposta.type === 'basic') await cache.put(chave, resposta.clone());
    return resposta;
  } catch (erro) {
    const guardada = await cache.match(chave, { ignoreSearch: true });
    if (guardada) return guardada;
    throw erro;
  }
}
