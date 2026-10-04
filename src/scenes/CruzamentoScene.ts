// Cena da fase: liga a Mesa de Programação (DOM) à simulação (core) e à vista (Phaser).
// A cena só orquestra e desenha: quem decide batida, vitória e estrelas é o core.

import Phaser from 'phaser';
import type { Fase } from '../core/fases';
import { gerarJs } from '../core/gerarJs';
import { avaliarFase, descreverObjetivo } from '../core/objetivos';
import { ErroPrograma, montarPrograma, type Linha } from '../core/programa';
import { Simulacao, TICKS_POR_SEGUNDO } from '../core/simulacao';
import { contexto, trocarPainel } from '../contexto';
import { registrarEstrelas, salvarProgresso } from '../progresso';
import { publicarEstado } from '../testeHook';
import { abrirJanela, el } from '../ui/dom';
import { Mesa, type EstadoMesa } from '../ui/mesa';
import { VistaCruzamento } from './vistaCruzamento';

const VELOCIDADES = [1, 2, 4];
/** Limite de ticks por frame, para um celular lento não travar. */
const MAX_TICKS_POR_FRAME = 200;

export class CruzamentoScene extends Phaser.Scene {
  private fase!: Fase;
  private vista!: VistaCruzamento;
  private mesa!: Mesa;
  private sim!: Simulacao;
  private estado: EstadoMesa = 'editando';
  private acumulado = 0;

  constructor() {
    super('Cruzamento');
  }

  init(dados: { faseId: number }): void {
    this.fase = contexto().fases.find((f) => f.id === dados.faseId) ?? contexto().fases[0];
    this.estado = 'editando';
    this.acumulado = 0;
  }

  create(): void {
    this.vista = new VistaCruzamento(this, {
      painel: true,
      ambulancia: (this.fase.transito.ambulancias?.length ?? 0) > 0,
    });
    this.novaSimulacao([]);

    if (this.fase.tipo === 'codigo') {
      // A fase 5 (JavaScript editável) entra na próxima etapa.
      trocarPainel(el('div', { classe: 'tela' }, el('h2', {}, 'Fase 5 em construção'), el('p', {}, 'Volte em breve!')));
      return;
    }

    this.mesa = new Mesa(
      this.fase,
      {
        iniciar: () => this.iniciar(),
        passo: () => this.passo(),
        reiniciar: () => this.reiniciar(),
        verJs: () => this.verJs(),
        velocidade: () => this.trocarVelocidade(),
        voltar: () => this.scene.start('SelecaoFases'),
        editou: () => this.reiniciar(),
      },
      contexto().velocidade,
    );
    trocarPainel(this.mesa.raiz);
    this.publicar();

    abrirJanela(`Fase ${this.fase.id}: ${this.fase.titulo}`, [el('p', { testid: 'dica' }, this.fase.dica)], {
      textoBotao: 'Começar',
      testidBotao: 'btn-comecar',
      testid: 'janela-dica',
    });
  }

  update(_tempo: number, delta: number): void {
    const v = contexto().velocidade;
    if (this.estado === 'rodando' || this.estado === 'esperando') {
      this.acumulado += (delta / 1000) * TICKS_POR_SEGUNDO * v;
      let ticks = Math.min(Math.floor(this.acumulado), MAX_TICKS_POR_FRAME);
      this.acumulado = Math.min(this.acumulado - ticks, 1);
      while (ticks-- > 0 && this.sim.ativa) {
        if (this.estado === 'esperando' && this.sim.espera === 0) break;
        this.sim.avancar();
      }
      if (this.estado === 'rodando') this.mesa.destacarLinha(this.sim.ultimaLinha);
      if (!this.sim.ativa) {
        this.terminou();
      } else if (this.estado === 'esperando' && this.sim.espera === 0) {
        this.mudarEstado('passo');
      }
    }
    this.vista.atualizar(delta, v);
  }

  // ------------------------------------------------------------ ações da Mesa

  private iniciar(): void {
    if (this.estado === 'passo' || this.estado === 'esperando') {
      this.sim.modoPasso = false;
      this.mudarEstado('rodando');
      return;
    }
    if (!this.prepararSimulacao()) return;
    this.mudarEstado('rodando');
  }

  private passo(): void {
    if (this.estado === 'rodando') {
      // Pausa: a partir daqui, uma linha por toque.
      this.sim.modoPasso = true;
      this.mudarEstado(this.sim.espera > 0 ? 'esperando' : 'passo');
      return;
    }
    if (this.estado === 'editando' || this.estado === 'acabou') {
      if (!this.prepararSimulacao()) return;
      this.sim.modoPasso = true;
      this.mudarEstado('passo');
      this.mesa.mostrarMensagem('info', 'Passo a passo: cada toque executa uma linha. A linha azul é a que acabou de rodar.');
    }
    if (this.sim.espera > 0) return;
    const linha = this.sim.executarLinha();
    this.mesa.destacarLinha(linha);
    if (!this.sim.ativa) this.terminou();
    else if (this.sim.espera > 0) this.mudarEstado('esperando');
  }

  private reiniciar(): void {
    this.novaSimulacao([]);
    this.mudarEstado('editando');
    this.mesa.destacarLinha(null);
    this.mesa.limparMensagem();
    this.mesa.marcarObjetivos(null);
  }

  private verJs(): void {
    let conteudo: HTMLElement;
    try {
      conteudo = el('pre', { classe: 'codigo', testid: 'codigo-js' }, gerarJs(montarPrograma(this.mesa.linhas)));
    } catch (e) {
      conteudo = el('p', {}, `Ainda não dá para mostrar: ${(e as Error).message}`);
    }
    abrirJanela(
      'Seu algoritmo em JavaScript',
      [
        el('p', {}, 'Os blocos que você montou viram este código. É JavaScript de verdade, a linguagem da web.'),
        conteudo,
      ],
      { testid: 'janela-js' },
    );
  }

  private trocarVelocidade(): void {
    const ctx = contexto();
    const i = VELOCIDADES.indexOf(ctx.velocidade);
    ctx.velocidade = VELOCIDADES[(i + 1) % VELOCIDADES.length];
    this.mesa.mostrarVelocidade(ctx.velocidade);
  }

  // ------------------------------------------------------------ interno

  private novaSimulacao(linhas: Linha[]): void {
    this.sim = new Simulacao(this.fase.transito, montarPrograma(linhas));
    this.acumulado = 0;
    this.vista.definirSimulacao(this.sim);
  }

  /** Monta o programa da Mesa; se tiver erro de estrutura, avisa e aponta a linha. */
  private prepararSimulacao(): boolean {
    this.mesa.limparMensagem();
    this.mesa.marcarObjetivos(null);
    try {
      this.sim = new Simulacao(this.fase.transito, montarPrograma(this.mesa.linhas));
    } catch (e) {
      if (!(e instanceof ErroPrograma)) throw e;
      this.mesa.mostrarMensagem('erro', e.message);
      this.mesa.destacarLinha(e.linha, 'erro');
      return false;
    }
    this.acumulado = 0;
    this.vista.definirSimulacao(this.sim);
    return true;
  }

  private mudarEstado(estado: EstadoMesa): void {
    this.estado = estado;
    this.mesa.definirEstado(estado);
    this.publicar();
  }

  private terminou(): void {
    this.mudarEstado('acabou');
    const sim = this.sim;
    if (sim.falha) {
      if (sim.falha.tipo === 'colisao') this.vista.mostrarBatida();
      this.mesa.destacarLinha(sim.falha.linha, 'erro');
      this.mesa.mostrarMensagem('erro', sim.falha.mensagem);
      this.publicar();
      return;
    }

    const resultado = avaliarFase(
      this.fase.objetivos,
      sim.status,
      sim.estatisticas(),
      this.mesa.linhas.length,
      this.fase.idealBlocos,
    );
    this.mesa.marcarObjetivos(resultado.objetivos);
    this.mesa.destacarLinha(null);

    if (resultado.venceu) {
      const ctx = contexto();
      ctx.progresso = registrarEstrelas(ctx.progresso, this.fase.id, resultado.estrelas);
      salvarProgresso(ctx.progresso);
      const dica =
        resultado.estrelas < 3 ? ` Dá para fazer com ${this.fase.idealBlocos} linhas e ganhar 3 estrelas.` : '';
      this.mesa.mostrarMensagem(
        'vitoria',
        `Trânsito fluindo! Você ganhou ${resultado.estrelas} de 3 estrelas.${dica}`,
        {
          texto: 'Continuar ➜',
          testid: 'btn-continuar',
          aoClicar: () =>
            this.scene.start('FimFase', {
              faseId: this.fase.id,
              estrelas: resultado.estrelas,
              linhas: this.mesa.linhas,
            }),
        },
      );
    } else {
      const faltou = resultado.objetivos
        .filter((o) => !o.cumprido)
        .map((o) => `${descreverObjetivo(o.objetivo)} (teve ${Math.round(o.valor * 10) / 10})`);
      this.mesa.mostrarMensagem('erro', `Quase! Faltou: ${faltou.join('; ')}. Mude o algoritmo e tente de novo.`);
    }
    this.publicar();
  }

  private publicar(): void {
    publicarEstado({
      tela: 'cruzamento',
      fase: this.fase.id,
      status: this.estado === 'acabou' ? this.sim.status : this.estado,
      colisoes: this.sim.estatisticas().colisoes,
    });
  }
}
