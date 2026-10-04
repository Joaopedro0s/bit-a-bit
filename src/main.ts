// Provisório: as cenas do Phaser e a Mesa de Programação entram na etapa 3.
// Por enquanto só validamos as fases ao abrir, para um JSON quebrado aparecer logo.
import dados from './content/fases.json';
import { carregarFases } from './core/fases';

const fases = carregarFases(dados);
const app = document.getElementById('app');
if (app) {
  app.textContent = `Sinal Aberto: ${fases.length} fases carregadas. Jogo em construção.`;
}
