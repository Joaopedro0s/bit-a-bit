# Relatório de Qualidade de Software - Sinal Aberto

## Pirâmide de Testes

| Camada de Testes | Ferramenta | Quantidade de Testes | Descrição / Arquivos |
| --- | --- | --- | --- |
| **Unidade** | Vitest | 88 | Testes de componentes isolados (`interpretador`, `casos-de-borda`, `objetivos`, `simulacao`, `progresso`, `sw`). |
| **Integração** | Vitest | 29 | Testes da simulação completa de fases e validação de regras de negócio (`tests/integration/fases.test.ts`). |
| **Ponta a Ponta (E2E)** | Playwright | 8 | Fluxos completos de usuário, modo offline e testes de regressão visual/interação (`smoke`, `offline`, `regressao`). |

---

## Cobertura de Testes (`src/core`)

Relatório gerado via `npm run test:ci` (Vitest v8 coverage):

- **Declarações (Statements):** 99.83%
- **Ramificações (Branches):** 95.94%
- **Funções (Functions):** 98.73%
- **Linhas (Lines):** 99.83%

### Cobertura por Arquivo

| Arquivo | % Declarações | % Ramificações | % Funções | % Linhas |
| --- | --- | --- | --- | --- |
| `src/core/ast.ts` | 100% | 100% | 100% | 100% |
| `src/core/fases.ts` | 100% | 93.10% | 100% | 100% |
| `src/core/gerarJs.ts` | 99.58% | 95.57% | 100% | 99.58% |
| `src/core/interpretador.ts` | 100% | 96.96% | 100% | 100% |
| `src/core/objetivos.ts` | 100% | 100% | 100% | 100% |
| `src/core/programa.ts` | 100% | 100% | 100% | 100% |
| `src/core/rng.ts` | 100% | 100% | 100% | 100% |
| `src/core/simulacao.ts` | 99.73% | 94.26% | 96.15% | 99.73% |

---

## Bug Encontrado por Teste

Durante a execução dos testes de unidade focados em casos de borda (`tests/unit/core/casos-de-borda.test.ts`), foram validados os seguintes cenários extremos do motor do jogo (`src/core`):
1. **Variável indefinida:** O interpretador e a avaliação de expressões lançam exceção amigável `ErroPrograma` contendo o nome da variável e o número da linha correspondente.
2. **Esperar tempo negativo:** Veto imediato com lançamento de `ErroPrograma` indicando tempo inválido.
3. **Bloco `senão` vazio:** O interpretador prossegue a execução normalmente sem interrupção indevida da pilha de execução.
4. **Programa vazio:** Trata adequadamente indicando estado vazio e retornando `null` no passo de execução.
5. **Combinações complexas de `E` / `OU` (AND / OR):** Avaliação de precedência lógica sem efeito colateral.
6. **Limite de estrelas:** O cálculo de estrelas baseado no `idealBlocos` e a recusa de estrelas (0 estrelas) em simulações não vitoriosas atendem estritamente aos requisitos.

Nenhum bug real no código de `src/core` que ferisse a especificação foi detectado nestes testes, confirmando a estabilidade e integridade da implementação atual.
