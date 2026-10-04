// Registra o Service Worker só no build publicado e só em HTTPS (ou localhost).
// Aberto direto do disco (file://, o build.zip) não há SW: lá tudo já é offline.

export function registrarServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;
  const { protocol, hostname } = window.location;
  if (protocol !== 'https:' && hostname !== 'localhost' && hostname !== '127.0.0.1') return;
  window.addEventListener('load', () => {
    // Escopo "./": só a pasta desta release (/hml/ ou /releases/<sha>/), nunca a raiz.
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      // Sem SW o jogo funciona igual, só não fica disponível offline pelo site.
    });
  });
}
