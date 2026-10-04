# Sinal Aberto – O Controlador de Trânsito

Jogo educativo de lógica de programação para celular, feito para o concurso Framework Arcade.
Você programa os semáforos de um cruzamento tocando em blocos, solta o trânsito e vê os carros
fluírem ou baterem. Cada fase ensina um conceito: sequência, `if`, `if/else` com OU, variáveis e,
no fim, leitura e conserto de um código JavaScript de verdade.

O documento de design completo está em [`docs/gdd.md`](docs/gdd.md).

## Como jogar

1. Toque em **Jogar** e escolha a fase (as fases se liberam em ordem).
2. Leia a dica e toque nos blocos para montar o seu algoritmo, linha por linha.
3. Toque em **▶ INICIAR TRÁFEGO**. O algoritmo repete sem parar enquanto a fase dura.
4. Se der batida, a linha com problema fica vermelha e o jogo diz o que fazer. Corrija e tente de novo.
5. Use **🔍 PASSO A PASSO** para ver uma linha de cada vez e **{ } Ver em JavaScript** para ver o seu algoritmo como código.
6. Cumpra os objetivos para ganhar até 3 estrelas (3 estrelas = usar até o número ideal de linhas).

Na fase 5, o controlador já vem escrito em JavaScript com um erro: toque nas partes destacadas para trocá-las até o trânsito fluir.

### Offline

Baixe o `build.zip` da release, extraia e abra o `index.html` com dois cliques. Tudo (jogo, Phaser, estilos e
fases) está dentro desse único arquivo; não precisa de internet nem de servidor.

## Como rodar o projeto

Requisitos: Node.js 22 ou mais novo.

```bash
npm ci            # instala as dependências
npm run dev       # servidor de desenvolvimento (http://localhost:5173)
npm run build     # valida as fases e gera dist/index.html + dist/version.json
```

| Script | O que faz |
| --- | --- |
| `npm run dev` | Servidor local com recarga automática |
| `npm run build` | Roda os testes de integração das fases (`prebuild`) e gera o build em arquivo único |
| `npm test` | Testes de unidade e integração (Vitest) |
| `npm run test:ci` | Testes com cobertura (mínimo 70% em `src/core/`) e relatório JUnit |
| `npm run test:e2e` | Testes ponta a ponta (Playwright). Use `BASE_URL` para apontar para outro endereço |
| `npm run lint` | ESLint |
| `npm run gdd:pdf` | Gera `docs/GDD.pdf` a partir do `docs/gdd.md` (requer Pandoc) |

Exemplo de E2E contra um build local:

```bash
npm run build && npx vite preview --port 4173
BASE_URL=http://localhost:4173/ npm run test:e2e
```

Para os testes, `?teste=1` na URL expõe `window.__sinalAberto` (tela, fase, status, colisões) e `&vel=N`
acelera a simulação. Sem esse parâmetro nada disso existe.

## Stack e arquitetura

- **Phaser 3 + TypeScript + Vite**, com `vite-plugin-singlefile` (build em um único `index.html`) e caminhos relativos (`base: './'`), porque o jogo roda em `/hml/` e em `/releases/<sha>/` no GitHub Pages.
- **`src/core/`**: lógica pura, sem Phaser e sem DOM, toda testada:
  - `ast.ts` (tipos), `programa.ts` (linhas da Mesa para AST), `interpretador.ts` (executa a AST, sem `eval`);
  - `simulacao.ts` (trânsito determinístico), `rng.ts` (aleatório com semente), `objetivos.ts` (vitória e estrelas);
  - `gerarJs.ts` (AST para JavaScript), `fases.ts` (carrega e valida `fases.json`).
- **`src/scenes/`**: cenas do Phaser (Boot, Menu, Seleção de fases, Cruzamento, Fim de fase). Elas só desenham o estado que o core calcula.
- **`src/ui/`**: Mesa de Programação e telas em HTML (acessível, tocável e com `data-testid` para o Playwright).
- **`src/content/fases.json`** + **`fases.schema.json`**: as 5 fases, validadas com Ajv. Um JSON inválido quebra os testes e o build.
- Arte desenhada em código e sons sintetizados com Web Audio: nenhum asset de terceiros.

## Tamanho do build

| Arquivo | Tamanho |
| --- | --- |
| `dist/index.html` (tudo embutido) | cerca de 1,7 MB (cerca de 400 kB com gzip) |

O GDD original falava em menos de 1 MB, mas só o Phaser já ocupa cerca de 1,2 MB. O build continua bem abaixo do
limite de 5 MB (e o `build.zip`, do limite de 25 MB).

## O que o jogo guarda no navegador (LGPD)

O jogo não tem login, não usa servidor e não coleta nenhum dado pessoal. No `localStorage` do próprio navegador ficam só:

| Chave | Conteúdo |
| --- | --- |
| `sinalAberto.progresso.v1` | Melhor número de estrelas por fase, por exemplo `{"estrelas":{"1":3}}` |
| `sinalAberto.som.v1` | Se o som está ligado ou desligado |

Se o navegador bloquear o armazenamento (aba anônima, por exemplo), o jogo funciona normalmente, só não lembra o progresso.
Para apagar tudo, basta limpar os dados do site no navegador.

## Equipe, IA e licenças

- Equipe: [`SQUAD.md`](SQUAD.md)
- Uso de IA: [`AI-USAGE.md`](AI-USAGE.md)
- Componentes de terceiros: [`THIRD_PARTY.md`](THIRD_PARTY.md)
- Licença do projeto: [`LICENSE`](LICENSE)
