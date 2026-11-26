# Validação no celular mais fraco (#80)

Checklist para validar desempenho, toque e latência da mesa antes da primeira sessão com o grupo (#81).

## Metas técnicas
- **Latência da mesa:** movimento de token aparece para os outros clientes em menos de **200 ms** em rede local/estável (`server/src/mesa/socket.test.ts` valida o broadcast em `< 200 ms`).
- **Mapa:** imagens convertidas para WebP com lado maior máximo de **4096 px** (`LADO_MAXIMO_DO_MAPA`).
- **Palco Konva:** `Konva.pixelRatio` limitado a **2**, camadas estáticas com `listening={false}` e grade desenhada em um único caminho (`client/src/mesa/camadas/Mapa.tsx`).

## Roteiro no celular mais fraco do grupo
1. **Abrir a mesa em 390 px (ou aparelho real):**
   - Conferir que o cabeçalho mostra apenas **Voltar**, título, rodada/`sua vez`, **Você**, **Dados** e **Chat**.
   - Abrir e fechar as gavetas **Você** (PV, PD, Ímpeto, teste rápido) e **Chat** (enviar mensagem e alternar para **Registro**).
2. **Navegação e toque no mapa (com mapa próximo de 4096 px e breu ativo):**
   - Dar zoom com pinça (dois dedos) e arrastar o mapa sem travamentos visíveis.
   - Arrastar o próprio token com um dedo e verificar no outro cliente que o movimento aparece quase instantaneamente (`< 200 ms`).
   - Testar **Medir** (arrastar com um dedo e conferir quadrados/metros) e **Marcar** (tocar no mapa e confirmar que o pulso aparece para todos).
3. **Rolagem e ficha:**
   - Abrir **Dados** ou um teste rápido no painel **Você** e confirmar que o cartão de resultado aparece e fecha com um toque (área mínima de 44 px).
4. **Queda de rede (Modo Avião):**
   - Ativar Modo Avião, mover o token e enviar uma mensagem no chat; verificar a faixa de erro no topo, o cartão **Reconectando** com a fila de ações e o bloqueio de rolagens offline.
   - Desativar Modo Avião e confirmar que o estado volta completo e a fila é reenviada na ordem.
