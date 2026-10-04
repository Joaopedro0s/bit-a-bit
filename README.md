# Bit a Bit

Jogo educativo de lógica de programação para o concurso Framework Arcade.

## Sobre o Jogo
O jogador guia um pequeno robô por uma grade até a saída montando uma sequência de blocos de instrução. 
O foco é ensinar conceitos básicos de programação como sequência, ordem, repetição e condicional para jovens iniciantes.

## Como jogar (offline / local)
1. Extraia o `build.zip`
2. Abra o arquivo `index.html` no seu navegador (com duplo clique)
Ou, caso prefira um servidor local:
```bash
npx serve .
```

## Como desenvolver
```bash
npm install
npm run dev
```

## Scripts
- `npm run dev`: Inicia o servidor local
- `npm run build`: Compila o jogo e gera o `dist/version.json`
- `npm test`: Roda os testes de unidade e integração
- `npm run test:ci`: Roda testes com cobertura e relatório JUnit
- `npm run test:e2e`: Roda testes ponta a ponta com Playwright
- `npm run lint`: Verifica erros de estilo e sintaxe
- `npm run gdd:pdf`: Gera PDF do GDD (requer Pandoc)
