// Fase 5: JavaScript de verdade com UM erro. As partes destacadas são botões:
// cada toque troca pela próxima opção válida. O texto nunca é executado: as
// trocas mudam as linhas (AST) e o interpretador roda essas linhas.

import { clique } from '../audio';
import { aplicarToken, lerNoCaminho, type Fase, type TokenEditavel } from '../core/fases';
import { gerarJsMarcado } from '../core/gerarJs';
import type { Linha } from '../core/programa';
import { botao, el } from './dom';
import { PainelFase, type AcoesPainel } from './painelFase';

const NOME_DO_TOKEN: Record<string, string> = {
  comparador: 'comparação',
  numero: 'número',
  via: 'nome da via',
};

export class EditorCodigo extends PainelFase {
  linhas: Linha[];
  private readonly codigo: HTMLElement;
  private readonly tokens: TokenEditavel[];

  constructor(fase: Fase, acoes: AcoesPainel, velocidadeInicial: number) {
    super(fase, acoes, velocidadeInicial);
    this.linhas = structuredClone(fase.codigo!.linhasIniciais);
    this.tokens = fase.codigo!.tokens;
    this.codigo = el('div', { classe: 'codigo editor', role: 'group', rotulo: 'Código do controlador', testid: 'codigo-editavel' });
    this.montar(
      el('div', { classe: 'rotulo' }, 'Código JavaScript (toque nas partes destacadas)'),
      this.codigo,
    );
    this.botoes.apagar.hidden = true;
    this.desenhar();
  }

  protected areaDasLinhas(): HTMLElement {
    return this.codigo;
  }

  protected apagar(): void {
    // Não há linhas para apagar: aqui só se trocam as partes destacadas.
  }

  private trocar(token: TokenEditavel): void {
    if (this.travada()) return;
    const atual = lerNoCaminho(this.linhas, token.caminho) as string | number | boolean;
    const i = token.opcoes.indexOf(atual);
    const proximo = token.opcoes[(i + 1) % token.opcoes.length];
    this.linhas = aplicarToken(this.linhas, token.caminho, proximo);
    clique();
    this.esquecerDestaque();
    this.desenhar();
    this.anuncio.textContent = `${NOME_DO_TOKEN[token.id] ?? token.id} trocado para ${String(proximo)}`;
    this.codigo.querySelector<HTMLButtonElement>(`[data-testid="token-${token.id}"]`)?.focus();
    this.acoes.editou();
  }

  protected atualizarBotoes(): void {
    super.atualizarBotoes();
    this.codigo?.querySelectorAll<HTMLButtonElement>('button.token').forEach((b) => {
      b.disabled = this.travada();
    });
  }

  private desenhar(): void {
    const porId = new Map(this.tokens.map((t) => [t.id, t]));
    const linhasDeCodigo = gerarJsMarcado(this.linhas, this.tokens).map((lc) =>
      el(
        'div',
        { classe: 'linha-codigo', testid: lc.linha !== null ? `linha-${lc.linha}` : undefined },
        ...lc.segmentos.map((s) => {
          if (!s.token) return s.texto;
          const token = porId.get(s.token)!;
          return botao(s.texto, () => this.trocar(token), {
            classe: 'token',
            testid: `token-${s.token}`,
            rotulo: `${NOME_DO_TOKEN[s.token] ?? s.token}: ${s.texto}. Toque para trocar.`,
          });
        }),
      ),
    );
    this.codigo.replaceChildren(...linhasDeCodigo);
    this.reaplicarDestaque();
    this.atualizarBotoes();
  }
}
