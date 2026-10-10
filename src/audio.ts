// Sons sintetizados na hora com a Web Audio API: nenhum arquivo de áudio,
// nenhuma licença de terceiros. Se o navegador não tiver áudio, o jogo segue mudo.

const CHAVE_SOM = 'sinalAberto.som.v1';

let contextoAudio: AudioContext | null = null;
let ligado = lerPreferencia();

function lerPreferencia(): boolean {
  try {
    return globalThis.localStorage?.getItem(CHAVE_SOM) !== 'desligado';
  } catch {
    return true;
  }
}

export function somLigado(): boolean {
  return ligado;
}

export function alternarSom(): boolean {
  ligado = !ligado;
  try {
    globalThis.localStorage?.setItem(CHAVE_SOM, ligado ? 'ligado' : 'desligado');
  } catch {
    // Sem armazenamento: vale só até fechar a página.
  }
  if (ligado) clique();
  return ligado;
}

function audio(): AudioContext | null {
  if (!ligado) {
    pararMusica();
    return null;
  }
  try {
    if (!contextoAudio) {
      const Construtor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Construtor) return null;
      contextoAudio = new Construtor();
    }
    if (contextoAudio.state === 'suspended') void contextoAudio.resume();
    iniciarMusica(contextoAudio);
    return contextoAudio;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────── Música de Fundo
let noMusica: AudioBufferSourceNode | null = null;

function pararMusica(): void {
  if (noMusica) {
    noMusica.stop();
    noMusica.disconnect();
    noMusica = null;
  }
}

function iniciarMusica(ac: AudioContext): void {
  if (noMusica) return; // já tocando
  const bpm = 100;
  const tQuarto = 60 / bpm;
  // Notas: C major pentatonic (C3, D3, E3, G3, A3) com duração total de 4 compassos
  const notas = [
    { n: 130.81, t: 0 }, { n: 146.83, t: 1 }, { n: 164.81, t: 2 }, { n: 196.00, t: 3 },
    { n: 164.81, t: 4 }, { n: 146.83, t: 5.5 }, { n: 130.81, t: 6.5 },
  ];
  const duracaoLoop = 8 * tQuarto;
  
  // Cria buffer com um "sintetizador" gravado offline para loop perfeito
  const offline = new OfflineAudioContext(1, ac.sampleRate * duracaoLoop, ac.sampleRate);
  notas.forEach(({ n, t }) => {
    const osc = offline.createOscillator();
    const gain = offline.createGain();
    osc.type = 'triangle';
    osc.frequency.value = n;
    const agora = t * tQuarto;
    gain.gain.setValueAtTime(0, agora);
    gain.gain.linearRampToValueAtTime(0.05, agora + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, agora + tQuarto - 0.05);
    osc.connect(gain).connect(offline.destination);
    osc.start(agora);
    osc.stop(agora + tQuarto);
  });
  
  void offline.startRendering().then(buffer => {
    if (!ligado) return; // pode ter desligado enquanto renderizava
    noMusica = ac.createBufferSource();
    noMusica.buffer = buffer;
    noMusica.loop = true;
    const ganhoGeral = ac.createGain();
    ganhoGeral.gain.value = 0.4; // volume baixo
    noMusica.connect(ganhoGeral).connect(ac.destination);
    noMusica.start();
  });
}

interface Tom {
  freq: number;
  freqFinal?: number;
  inicio?: number;
  duracao: number;
  tipo?: OscillatorType;
  volume?: number;
}

function tocar(ac: AudioContext, t: Tom): void {
  const agora = ac.currentTime + (t.inicio ?? 0);
  const osc = ac.createOscillator();
  const ganho = ac.createGain();
  osc.type = t.tipo ?? 'sine';
  osc.frequency.setValueAtTime(t.freq, agora);
  if (t.freqFinal) osc.frequency.exponentialRampToValueAtTime(t.freqFinal, agora + t.duracao);
  ganho.gain.setValueAtTime(0.0001, agora);
  ganho.gain.exponentialRampToValueAtTime(t.volume ?? 0.15, agora + 0.015);
  ganho.gain.exponentialRampToValueAtTime(0.0001, agora + t.duracao);
  osc.connect(ganho).connect(ac.destination);
  osc.start(agora);
  osc.stop(agora + t.duracao + 0.05);
}

/** Toque curtinho ao colocar um bloco. */
export function clique(): void {
  const ac = audio();
  if (ac) tocar(ac, { freq: 880, freqFinal: 660, duracao: 0.06, volume: 0.06 });
}

/** Pneu cantando + pancada: ruído filtrado descendo e um baque grave. */
export function freio(): void {
  const ac = audio();
  if (!ac) return;
  const agora = ac.currentTime;
  const duracao = 0.7;
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * duracao), ac.sampleRate);
  const dados = buffer.getChannelData(0);
  for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1;
  const ruido = ac.createBufferSource();
  ruido.buffer = buffer;
  const filtro = ac.createBiquadFilter();
  filtro.type = 'bandpass';
  filtro.Q.value = 8;
  filtro.frequency.setValueAtTime(3200, agora);
  filtro.frequency.exponentialRampToValueAtTime(900, agora + duracao);
  const ganho = ac.createGain();
  ganho.gain.setValueAtTime(0.0001, agora);
  ganho.gain.exponentialRampToValueAtTime(0.35, agora + 0.03);
  ganho.gain.exponentialRampToValueAtTime(0.0001, agora + duracao);
  ruido.connect(filtro).connect(ganho).connect(ac.destination);
  ruido.start(agora);
  tocar(ac, { freq: 1500, freqFinal: 950, duracao: 0.55, tipo: 'sawtooth', volume: 0.04 });
  tocar(ac, { freq: 110, freqFinal: 40, inicio: 0.55, duracao: 0.35, volume: 0.4 });
}

/** Arpejo alegre de vitória. */
export function vitoria(): void {
  const ac = audio();
  if (!ac) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
    tocar(ac, { freq, inicio: i * 0.12, duracao: i === 3 ? 0.5 : 0.18, tipo: 'triangle', volume: 0.18 }),
  );
}

/** Dois bipes graves para erro no programa ou objetivo não cumprido. */
export function erro(): void {
  const ac = audio();
  if (!ac) return;
  tocar(ac, { freq: 240, duracao: 0.14, tipo: 'square', volume: 0.06 });
  tocar(ac, { freq: 180, inicio: 0.17, duracao: 0.2, tipo: 'square', volume: 0.06 });
}
