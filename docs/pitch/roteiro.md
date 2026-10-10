# Roteiro do Vídeo de Pitch — Sinal Aberto

- **Projeto:** Sinal Aberto: O Controlador de Trânsito
- **Formato:** Vídeo vertical/horizontal para pitch de demonstração (Demo Day / Avaliação)
- **Duração máxima:** 90 segundos (Duração estimada: 86 segundos)
- **Integrantes e papéis:**
  - **João Gabriel Floriano Olimpio** — Produto e Game Design (Apresentador / Gancho e Fechamento)
  - **Kauan Alejandro da Rosa** — Desenvolvimento e Qualidade (Problema)
  - **Joao Pedro Fonseca Alves de Carvalho** — Plataforma e Release (Gameplay e Mecânicas)
  - **Renan Ramos Capeleti** — SRE e Segurança (Tecnologia, Código Real e Robustez)

---

## Estrutura do Roteiro

| Tempo | Bloco | Locutor | Visual / Cena | Áudio / Efeitos Sonoros | Fala |
|---|---|---|---|---|---|
| **00:00 – 00:03** | **Gancho** (0–3 s) | **João Gabriel** (Produto e Game Design) | Corte rápido: Cruzamento caótico, dois carros colidindo no jogo, sinal vermelho piscando com som de freio estridente. Transição rápida para a logo "Sinal Aberto". | SFX de freada de pneu e batida cômica (*baque*), seguido por batida rítmica animada. | *"E se aprender a programar fosse tão intuitivo quanto destravar o trânsito da sua rua?"* |
| **00:03 – 00:20** | **Problema** (17 s) | **Kauan Alejandro** (Dev e Qualidade) | Imagens/cenas de jovens navegando no celular em transporte público e tela cheia de código em IDE pesada cheia de mensagens de erro. | Trilha musical reduz um pouco; tom empático e direto. | *"Milhões de jovens querem entrar na tecnologia, mas o único computador que têm é um celular simples com internet limitada. A maioria dos cursos exige PC potente, cadastro obrigatório e usa jargões que mais afastam do que ensinam."* |
| **00:20 – 00:42** | **Gameplay Real — Blocos e Simulação** (22 s) | **Joao Pedro** (Plataforma e Release) | Captura de gameplay real no celular (9:16): montando o algoritmo na Mesa de Programação tocando nos blocos verdes e amarelos. Toque no botão "INICIAR TRÁFEGO", carros coloridos fluindo em simulação determinística. Depois, um erro intencional: batida, tela congela e destaca a linha vermelha. | Trilha sobe em tom dinâmico. SFX de cliques na tela e arpejo de vitória ao passar de fase. | *"É aí que nasce o Sinal Aberto! Você programa os semáforos de um cruzamento real. Em vez de comandos abstratos, abrir e fechar sinal viram verdadeiro e falso. Se o algoritmo estiver certo, o trânsito flui; se errar, os carros batem e o jogo mostra a linha exata do problema."* |
| **00:42 – 00:65** | **Gameplay Avançado, JS Real e Engenharia** (23 s) | **Renan Ramos** (SRE e Segurança) | Gameplay da Fase 3 (ambulância com operador OU) e Fase 5 (código JavaScript autêntico sendo editado por toques nos tokens). Destaque para o selo offline (PWA) e carregamento instantâneo. | SFX de sirene sutil, clique nos tokens de código e confirmação sonora. | *"O aprendizado evolui: você usa condições, operadores lógicos para abrir passagem para ambulâncias, calcula variáveis de tempo e, na fase final, depura código JavaScript de verdade direto no celular. Sem backend, seguro, sem eval e funcionando até offline via Service Worker."* |
| **00:65 – 00:86** | **Chamada e Fechamento** (21 s) | **João Gabriel** e **Squad** | Tela de vitória com confetes e 3 estrelas; transição para cartela final com QR Code, link do GitHub Pages e créditos dos 4 integrantes. | Trilha alcança o clímax com arpejo brilhante da vitória do jogo e finaliza limpa. | **João Gabriel:** *"O Sinal Aberto transforma qualquer celular em uma sala de aula prática, gratuita e acessível."* <br>**Todos (ou João):** *"Abra o sinal para o seu futuro na tecnologia. Jogue agora no navegador!"* |

---

## Orientações de Produção

1. **Ritmo de fala:** Ágil, enérgico e coloquial, sem falar rápido demais.
2. **Captação de Gameplay:** Gravar diretamente em tela de smartphone (formato vertical 9:16 ou centralizado em 16:9 com moldura temática) utilizando o build estático real.
3. **Sons do Jogo:** Utilizar os efeitos sonoros originais sintetizados em Web Audio API presentes no repositório (`audio.ts`): batida, vitória, clique e erro.
4. **Legendas:** Utilizar o arquivo sincronizado `docs/pitch/legendas.srt`.
