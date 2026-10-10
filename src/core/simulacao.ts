// Motor de trânsito determinístico (sem Phaser, sem DOM).
// O tempo anda em "ticks" de 0,1 s. A cada tick:
//   1. chegam carros (aleatório com semente fixa);
//   2. o controlador (programa do jogador) roda até encontrar um `esperar`;
//   3. os carros andam: quem está na fila entra no cruzamento se o sinal estiver aberto;
//   4. verificamos colisão: carros de vias perpendiculares no cruzamento ao mesmo tempo.
// A cena do Phaser só lê este estado e desenha.

import type { Instrucao, Valor, Via } from './ast';
import { VIAS } from './ast';
import { Interpretador, type Efeito } from './interpretador';
import { ErroPrograma } from './programa';
import { criarRng, type Rng } from './rng';

export const TICKS_POR_SEGUNDO = 10;
/** Tempo entre o sinal abrir e o primeiro carro sair (reação do motorista). */
export const REACAO_TICKS = 10;
/** Tempo que um carro leva para atravessar o cruzamento. Menor que a reação: trocar de sinal é seguro. */
export const TRAVESSIA_TICKS = 6;
/** Intervalo mínimo entre dois carros da mesma via entrando no cruzamento. */
export const INTERVALO_TICKS = 10;
/** Proteção contra programa que repete sem nenhum `esperar`. */
export const LIMITE_PASSOS_POR_TICK = 500;

export interface PeriodoChegada {
  /** Início, em segundos. */
  de: number;
  /** Fim (exclusivo), em segundos. */
  ate: number;
  /** Carros por segundo. */
  taxa: number;
}

export interface ConfigTransito {
  /** Duração da fase, em segundos simulados. */
  duracao: number;
  semente: number;
  chegadas: Partial<Record<Via, PeriodoChegada[]>>;
  filaInicial?: Partial<Record<Via, number>>;
  ambulancias?: { via: Via; tempo: number }[];
  clima?: 'chuva' | 'limpo';
}

export interface Carro {
  id: number;
  via: Via;
  ambulancia: boolean;
  estado: 'fila' | 'cruzando' | 'passou';
  /** 0 a 1 enquanto atravessa o cruzamento. */
  progresso: number;
  chegouEm: number;
  entrouEm: number | null;
}

export interface Sinal {
  aberto: boolean;
  /** Tick em que abriu pela última vez. */
  desde: number;
  /** Linha do programa que abriu este sinal. */
  linha: number | null;
  ordem: number;
}

export type StatusSimulacao = 'pronta' | 'rodando' | 'colisao' | 'erro' | 'terminada';

export interface Falha {
  tipo: 'colisao' | 'erro' | 'loop';
  mensagem: string;
  linha: number | null;
}

export interface Estatisticas {
  segundos: number;
  colisoes: number;
  carrosQuePassaram: number;
  passaramPorVia: Record<Via, number>;
  maiorFila: number;
  maiorFilaPorVia: Record<Via, number>;
  /** Maior espera de uma ambulância (segundos), contando as que ainda esperam. */
  esperaMaxAmbulancia: number;
  /** Segundos com sinal verde sem nenhum carro daquela via esperando ou cruzando. */
  tempoAbertoSemCarros: number;
}

const porVia = <T>(f: (v: Via) => T): Record<Via, T> =>
  Object.fromEntries(VIAS.map((v) => [v, f(v)])) as Record<Via, T>;

export const outraVia = (v: Via): Via => (v === 'Norte' ? 'Leste' : 'Norte');

export class Simulacao {
  tick = 0;
  status: StatusSimulacao = 'pronta';
  falha: Falha | null = null;
  readonly sinais: Record<Via, Sinal> = porVia(() => ({ aberto: false, desde: 0, linha: null, ordem: 0 }));
  /** Última linha executada pelo controlador (para destacar na Mesa). */
  ultimaLinha: number | null = null;
  /** Ticks que o controlador ainda vai esperar. */
  espera = 0;
  /** Passo a Passo: `avancar()` só consome a espera, sem executar linhas novas. */
  modoPasso = false;

  private readonly interp: Interpretador;
  private readonly rng: Rng;
  private readonly filas: Record<Via, Carro[]> = porVia(() => []);
  private readonly cruzando: Carro[] = [];
  private readonly ambulancias: Carro[] = [];
  private readonly ultimaEntrada: Record<Via, number> = porVia(() => -Infinity);
  private proximoId = 1;
  private ordemAbertura = 0;
  private stats = {
    passaram: porVia(() => 0),
    maiorFila: porVia(() => 0),
    abertoSemCarrosTicks: 0,
    colisoes: 0,
  };

  constructor(
    private readonly config: ConfigTransito,
    programa: readonly Instrucao[],
  ) {
    this.interp = new Interpretador(programa);
    this.rng = criarRng(config.semente);
    for (const via of VIAS) {
      for (let i = 0; i < (config.filaInicial?.[via] ?? 0); i++) this.novoCarro(via, false);
    }
    this.registrarFilas();
  }

  get duracaoTicks(): number {
    return Math.round(this.config.duracao * TICKS_POR_SEGUNDO);
  }

  get ativa(): boolean {
    return this.status === 'pronta' || this.status === 'rodando';
  }

  get segundos(): number {
    return this.tick / TICKS_POR_SEGUNDO;
  }

  /** Valores que o programa do jogador pode ler. */
  lerSensor = (nome: string): Valor | undefined => {
    switch (nome) {
      case 'carrosNorte':
        return this.filas.Norte.length;
      case 'carrosLeste':
        return this.filas.Leste.length;
      case 'ambulanciaNorte':
        return this.filas.Norte.some((c) => c.ambulancia);
      case 'ambulanciaLeste':
        return this.filas.Leste.some((c) => c.ambulancia);
      default:
        return undefined;
    }
  };

  /** Variáveis do jogador (ex.: tempoVerde), para os painéis ao vivo. */
  variaveisDoJogador(): Record<string, Valor> {
    return Object.fromEntries(this.interp.variaveis);
  }

  proximaLinha(): number | null {
    return this.interp.proximaLinha();
  }

  /** Carros na tela (na fila ou cruzando), em ordem de fila. */
  carros(): Carro[] {
    return [...this.filas.Norte, ...this.filas.Leste, ...this.cruzando];
  }

  fila(via: Via): readonly Carro[] {
    return this.filas[via];
  }

  /** Avança um tick no modo contínuo (botão INICIAR TRÁFEGO). */
  avancar(): void {
    if (!this.ativa) return;
    this.status = 'rodando';
    this.chegadas();
    this.controlar();
    if (this.status !== 'rodando') return;
    this.fisica();
  }

  /** Roda até a fase acabar (ou bater/dar erro). Usado nos testes e na validação das fases. */
  rodarAteOFim(): this {
    while (this.ativa) this.avancar();
    return this;
  }

  /**
   * Passo a Passo: executa UMA linha, sem andar o tempo. Se a linha for
   * `esperar`, quem chama deve chamar `avancar()` enquanto `espera > 0`
   * (com `modoPasso` ligado, `avancar` só consome a espera e não roda mais linhas).
   * Devolve a linha executada, ou `null` se ainda estiver esperando.
   */
  executarLinha(): number | null {
    if (!this.ativa || this.espera > 0) return null;
    this.status = 'rodando';
    return this.executarUma()?.linha ?? null;
  }

  /** Passo a Passo completo (sem animação): executa uma linha e já consome a espera. */
  passoLinha(): number | null {
    if (!this.ativa) return null;
    const modoAnterior = this.modoPasso;
    this.modoPasso = true;
    const linha = this.espera > 0 ? this.ultimaLinha : this.executarLinha();
    while (this.espera > 0 && this.status === 'rodando') this.avancar();
    this.modoPasso = modoAnterior;
    return linha;
  }

  estatisticas(): Estatisticas {
    const agora = this.tick;
    const esperas = this.ambulancias.map((a) => (a.entrouEm ?? agora) - a.chegouEm);
    const segundos = (t: number) => t / TICKS_POR_SEGUNDO;
    return {
      segundos: segundos(agora),
      colisoes: this.stats.colisoes,
      carrosQuePassaram: this.stats.passaram.Norte + this.stats.passaram.Leste,
      passaramPorVia: { ...this.stats.passaram },
      maiorFila: Math.max(this.stats.maiorFila.Norte, this.stats.maiorFila.Leste),
      maiorFilaPorVia: { ...this.stats.maiorFila },
      esperaMaxAmbulancia: segundos(Math.max(0, ...esperas)),
      tempoAbertoSemCarros: segundos(this.stats.abertoSemCarrosTicks),
    };
  }

  // ---------------------------------------------------------------- interno

  private novoCarro(via: Via, ambulancia: boolean): Carro {
    const carro: Carro = {
      id: this.proximoId++,
      via,
      ambulancia,
      estado: 'fila',
      progresso: 0,
      chegouEm: this.tick,
      entrouEm: null,
    };
    const fila = this.filas[via];
    if (ambulancia) {
      // Os carros abrem caminho: a ambulância vai para a frente (atrás de outras ambulâncias).
      const pos = fila.findIndex((c) => !c.ambulancia);
      fila.splice(pos === -1 ? fila.length : pos, 0, carro);
      this.ambulancias.push(carro);
    } else {
      fila.push(carro);
    }
    return carro;
  }

  private chegadas(): void {
    const s = this.segundos;
    for (const via of VIAS) {
      const periodo = this.config.chegadas[via]?.find((p) => s >= p.de && s < p.ate);
      if (periodo && this.rng.proximo() < periodo.taxa / TICKS_POR_SEGUNDO) {
        this.novoCarro(via, false);
      }
    }
    for (const a of this.config.ambulancias ?? []) {
      if (Math.round(a.tempo * TICKS_POR_SEGUNDO) === this.tick) this.novoCarro(a.via, true);
    }
    this.registrarFilas();
  }

  private registrarFilas(): void {
    for (const via of VIAS) {
      this.stats.maiorFila[via] = Math.max(this.stats.maiorFila[via], this.filas[via].length);
    }
  }

  /** Roda o programa do jogador até ele pedir para esperar. */
  private controlar(): void {
    if (this.espera > 0) {
      this.espera--;
      if (this.espera > 0) return;
    }
    if (this.modoPasso) return;
    for (let passos = 0; ; passos++) {
      if (passos >= LIMITE_PASSOS_POR_TICK) {
        this.falhar({
          tipo: 'loop',
          mensagem:
            'Seu programa ficou repetindo sem parar e o tempo não andou. ' +
            'Coloque um bloco "esperar" para os carros terem tempo de passar.',
          linha: null,
        });
        return;
      }
      const efeito = this.executarUma();
      if (!efeito || this.status !== 'rodando' || this.espera > 0) return;
    }
  }

  private executarUma(): Efeito | null {
    let efeito: Efeito | null;
    try {
      efeito = this.interp.passo(this.lerSensor);
    } catch (e) {
      if (!(e instanceof ErroPrograma)) throw e;
      this.falhar({ tipo: 'erro', mensagem: e.message, linha: e.linha });
      return null;
    }
    if (!efeito) return null;
    this.ultimaLinha = efeito.linha;
    const sinal = efeito.tipo === 'ABRIR' || efeito.tipo === 'FECHAR' ? this.sinais[efeito.via] : null;
    if (efeito.tipo === 'ABRIR' && sinal && !sinal.aberto) {
      Object.assign(sinal, { aberto: true, desde: this.tick, linha: efeito.linha, ordem: ++this.ordemAbertura });
    } else if (efeito.tipo === 'FECHAR' && sinal) {
      sinal.aberto = false;
    } else if (efeito.tipo === 'ESPERAR') {
      this.espera = Math.round(efeito.segundos * TICKS_POR_SEGUNDO);
    }
    return efeito;
  }

  private fisica(): void {
    const chuva = this.config.clima === 'chuva';
    const tempoTravessia = chuva ? TRAVESSIA_TICKS * 1.5 : TRAVESSIA_TICKS;
    const tempoReacao = chuva ? REACAO_TICKS * 1.5 : REACAO_TICKS;
    const intervaloTicks = chuva ? INTERVALO_TICKS * 1.5 : INTERVALO_TICKS;

    // Quem está no cruzamento anda; quem termina, passou.
    for (let i = this.cruzando.length - 1; i >= 0; i--) {
      const c = this.cruzando[i];
      c.progresso = Math.min(1, c.progresso + 1 / tempoTravessia);
      if (c.progresso >= 1) {
        c.estado = 'passou';
        this.cruzando.splice(i, 1);
        this.stats.passaram[c.via]++;
      }
    }

    // Quem está na frente da fila entra, se o sinal estiver aberto.
    for (const via of VIAS) {
      const sinal = this.sinais[via];
      const fila = this.filas[via];
      if (
        sinal.aberto &&
        fila.length > 0 &&
        this.tick - sinal.desde >= tempoReacao &&
        this.tick - this.ultimaEntrada[via] >= intervaloTicks
      ) {
        const c = fila.shift() as Carro;
        c.estado = 'cruzando';
        c.entrouEm = this.tick;
        this.cruzando.push(c);
        this.ultimaEntrada[via] = this.tick;
      }
      if (sinal.aberto && fila.length === 0 && !this.cruzando.some((c) => c.via === via)) {
        this.stats.abertoSemCarrosTicks++;
      }
    }

    if (this.cruzando.some((c) => c.via === 'Norte') && this.cruzando.some((c) => c.via === 'Leste')) {
      this.stats.colisoes++;
      this.falhar(this.mensagemColisao());
      return;
    }

    this.tick++;
    if (this.tick >= this.duracaoTicks) this.status = 'terminada';
  }

  private mensagemColisao(): Falha {
    const [primeira, segunda] = [...VIAS].sort((a, b) => this.sinais[a].ordem - this.sinais[b].ordem);
    const linha = this.sinais[segunda].linha;
    const onde = linha !== null ? ` na linha ${linha}` : '';
    return {
      tipo: 'colisao',
      mensagem: `Batida! Os dois sinais ficaram abertos${onde}. Feche o ${primeira} antes de abrir o ${segunda}.`,
      linha,
    };
  }

  private falhar(falha: Falha): void {
    this.falha = falha;
    this.status = falha.tipo === 'colisao' ? 'colisao' : 'erro';
  }
}
