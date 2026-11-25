# Produto e funcionalidades

Nov 18, 2026 · @Guilherme

## Visão do produto

A MEMBRANA é uma mesa virtual para um grupo de amigos jogar RPG de mesa online: Ordem Paranormal II e sistemas inventados pelo próprio grupo. Ela reúne ficha, mapa, breu, pistas, dados, chat e trilha sonora num só lugar, com o visual de dossiê da marca MEMBRANA.

Esta documentação tem três abas:

- **Produto e funcionalidades** (esta): o que o sistema faz, para quem e com quais permissões.
- **Arquitetura técnica:** como o sistema é construído, hospedado e testado.
- **Regras do jogo:** as regras que o motor implementa e como um sistema inventado é configurado.

### Papéis

| Papel | Quem é | O que faz |
| --- | --- | --- |
| Mestre | Quem conduz o caso | Prepara mapas, salas, pistas e ameaças; controla o breu e a trilha; narra; vê tudo |
| Jogador | Cada amigo com um personagem | Move o próprio token, investiga, rola testes, guarda e apresenta pistas |

Uma mesma pessoa pode ser mestre num caso e jogador em outro. O papel vale por caso, não por conta.

## Glossário

| Termo | Significado |
| --- | --- |
| Caso | Uma campanha: história, grupo, sistema de jogo e sessões |
| Sessão | Um encontro de jogo, com rodadas, chat e registro próprios |
| Cena | Um trecho da história num lugar, normalmente um mapa |
| Rodada | Ciclo em que cada jogador faz uma ação importante |
| Ponto de interesse | Lugar do mapa com informações liberadas por perícia e DT |
| Pista | Informação que o mestre coloca no mapa ou envia a um jogador, e que ele pode apresentar ao grupo |
| Inventário de pistas | Pistas que um jogador tem e os outros ainda não viram |
| Acontecimentos | Aba lateral com o registro da sessão, incluindo pistas apresentadas |
| Token | Peça de um personagem ou NPC no mapa |
| Prop | Objeto de cena no mapa (caixote, mancha, papel), abaixo dos tokens |
| Breu | Área do mapa que o mestre tampa para os jogadores não verem; eles enxergam só escuridão até o mestre revelar |
| Névoa | A névoa da Membrana, de Ordem Paranormal: a barreira entre a Realidade e o Outro Lado. Quando ela se adensa numa cena, a Membrana está fina e o paranormal pode atravessar. Na mesa, o mestre controla o quanto ela está densa e todos a veem sobre o mapa. É só visual: não esconde nada no mapa nem barra ninguém; isso é o breu |
| Sala | Área do mapa com notas que só o mestre vê |
| Guia de cena | Aba lateral do mestre na mesa, com roteiro, pontos de interesse, pistas e salas |
| Escudo do mestre | Tela de referência do mestre, com 4 painéis editáveis |
| DT | Dificuldade de um teste; o padrão é 7 |

## Mapa de telas

São 10 telas. A Mesa é onde o jogo acontece; as outras preparam ou registram o que acontece nela.

| Tela | Para que serve | Quem usa | Arquivo no protótipo |
| --- | --- | --- | --- |
| Central | Início: caso em andamento, convites, próximas sessões | Todos | `OPCentral` |
| Casos | Lista de casos com abas Ordem Paranormal e RPGs inventados; diário, quadro de pistas, objetivos | Todos | `OPCasos` |
| Novo caso | Criar um caso: sistema de jogo, premissa, regras, agenda e convites | Mestre | `OPNovoCaso` |
| Criar personagem | Passo a passo ou ficha em branco | Jogador | `OPCriar` |
| Ficha | Atributos, perícias, testes, PV/PD, foto, token, itens e pistas | Jogador (mestre consulta) | `OPFicha` |
| Mesa | Mapa, tokens, props, breu, pistas, dados, chat, trilha e guia do mestre | Todos | `OPMesa` |
| Mesa no celular | A mesa adaptada para telas de 390 px | Jogador | `OPMesaMobile` |
| Mestre | Escudo do mestre, editor de pontos de interesse, grupo, caso | Mestre | `OPMestre` |
| Arquivo | Biblioteca de regras, itens, ameaças e inventário de itens | Todos | `OPArquivo` |
| Perfil | Conta, aparência, som, notificações e privacidade | Todos | `OPPerfil` |

## Casos, campanhas e sistemas de jogo

Cada caso pertence a um sistema de jogo. A tela Casos separa os casos em duas abas, Ordem Paranormal e RPGs inventados, além de uma aba com todos.

| Código | Requisito |
| --- | --- |
| RF-01 | O mestre cria um caso escolhendo o sistema: Ordem Paranormal II ou RPG inventado |
| RF-02 | Num RPG inventado, o mestre informa nome do sistema, dado principal (1d20, 2d6, 1d100 ou parada de d6), atributos e regras da casa |
| RF-03 | A lista de casos filtra por Todos, Ordem Paranormal e RPGs inventados, com a contagem de cada aba e uma etiqueta no cartão do caso |
| RF-04 | O mestre define premissa, capa, tipo de personagens, nível inicial, DT padrão, vagas, agenda e convites |
| RF-05 | Jogadores entram no caso por código ou link de convite |
| RF-06 | Cada caso tem diário, quadro de pistas com ligações, objetivos e linha do tempo |

## Personagens e fichas

Há dois caminhos para criar um personagem: o passo a passo, que aplica as regras de criação, e a ficha em branco, para quem já sabe o que quer ou traz um personagem pronto.

| Código | Requisito |
| --- | --- |
| RF-07 | Criação guiada em 5 etapas: conceito, perfil, atributos, perícias e revisão, com prévia da ficha ao lado |
| RF-08 | Ficha em branco: todos os campos numa página, atributos e perícias de d4 a d12, habilidade livre, PV e PD calculados ou digitados |
| RF-09 | A ficha em branco avisa, sem bloquear, quando os atributos ou perícias fogem da regra de criação |
| RF-10 | O jogador envia a arte do personagem (foto da ficha) e a imagem do token; pode gerar o token a partir da foto |
| RF-11 | A imagem do token aparece na mesa e na lista do grupo assim que é trocada |
| RF-12 | A ficha rola testes ao clicar numa perícia (ou, no modo de dados físicos, registra o resultado informado), aplica Ajuda, Ímpeto e habilidades, e registra o histórico |
| RF-13 | A ficha mostra itens (espaços limitados pelo Físico), anotações, ferimentos e o inventário de pistas recebidas na mesa |
| RF-83 | Modo de dados de cada personagem: virtuais (o app rola) ou físicos (o jogador rola dados de verdade). Escolhido na criação e trocado a qualquer momento na ficha ou na mesa; vale nas duas telas e no celular |
| RF-84 | No modo físico, clicar numa perícia abre um modal com os dados a rolar (atributo, perícia e bônus) e a DT, e oferece dois jeitos: digitar o valor de cada dado, e o sistema soma os três maiores, confere a DT e os críticos e diz se passou; ou só dizer se foi sucesso, fracasso, sucesso crítico ou falha crítica. O app lembra o último jeito usado |
| RF-85 | Quando o jogador só diz o resultado, a soma dos dados é opcional. Nos testes que dependem dela (investigar, hack social) ou do maior ou menor dado (arrombar, alcançar), o modal pede esses valores; sem eles, o sucesso conta como a DT exata |
| RF-86 | Falha crítica no modo físico pede o resultado do d8 da tabela e, em Acidente ou Frustração, o d4 de perda; os efeitos são aplicados como no modo virtual |
| RF-87 | O resultado informado consome Ímpeto e Gambiarra, preenche o ímpeto na falha, entra no histórico e no chat marcado como “dados físicos” e aparece para o mestre em Acontecimentos. Cancelar o modal não registra nada |

## Mesa: mapas, tokens, props e breu

A mesa segue o modelo do Owlbear Rodeo: o mapa é uma imagem com grade, as peças são arrastadas com o mouse ou o dedo, e o mestre esconde áreas sob o breu e as revela quando o grupo chega lá.

O mapa tem camadas, de baixo para cima: imagem do mapa, grade, props, contornos das salas (só o mestre), breu, pontos de interesse, pistas e tokens.

| Código | Requisito |
| --- | --- |
| RF-14 | O mestre envia imagens de mapa, troca entre mapas e ajusta o tamanho da grade de cada um |
| RF-15 | Barra de ferramentas: mover, medir (1 quadrado = 1,5 m), marcar um ponto, breu, revelar, névoa, sala e pista; grade e encaixe ligam e desligam |
| RF-16 | Cada jogador arrasta o próprio token; o de outro jogador não se move e mostra quem é o dono |
| RF-17 | Um jogador não solta o token dentro do breu |
| RF-18 | Tokens têm imagem, tamanho 1×, 2× ou 3× e movimento pelas setas do teclado; o mestre pode ocultá-los |
| RF-19 | O mestre cria tokens de NPC e ameaças com imagem enviada ou modelos prontos, e traz o grupo para outro mapa |
| RF-20 | Props: o mestre coloca objetos de cena com arte própria ou desenhos prontos (caixote, contorno, papel, mancha, rádio) |
| RF-21 | Props são movidos, girados (livre ou de 45 em 45 graus), redimensionados, duplicados, travados e trazidos para a frente; jogadores não mexem neles |
| RF-22 | Breu: o mestre arrasta para cobrir e para revelar, apaga blocos, cobre ou limpa o mapa inteiro, e cobre ou revela uma sala com um clique |
| RF-23 | Jogadores veem o breu em preto; o mestre vê hachurado e enxerga o que está embaixo |
| RF-88 | Névoa da Membrana: o mestre ajusta numa régua de 0 a 100 (com atalhos Sem névoa, Fina, Densa e Espessa) o quanto a névoa está densa na cena, e todos veem a mesma névoa animada sobre o mapa. É só visual: não esconde tokens, props nem pistas e não impede movimento; vale mesmo sem mapa na mesa |
| RF-24 | Soltar uma imagem do computador sobre o mapa cria um token ali (mestre) ou troca a imagem do próprio token (jogador) |

## Pistas, inventário e acontecimentos

Além das informações dos pontos de interesse, o mestre coloca pistas soltas no mapa e decide quem as recebe. Quem recebe uma pista escolhe a hora de mostrá-la ao grupo.

> Diagrama: ciclo de vida de uma pista · 4 estados. Está só no [documento original](https://claude.ai/artifact/HbsQrCdY2GKt2kfP3mcYGj); a exportação para Markdown não leva diagramas.

O mestre pode recolher uma pista do inventário a qualquer momento, e uma pista pode estar com mais de um jogador.

| Código | Requisito |
| --- | --- |
| RF-40 | Com a ferramenta Pista, o mestre clica no mapa para criar uma pista com título, texto para o jogador e nota só do mestre |
| RF-41 | O marcador da pista fica oculto até o mestre ligar “visível para os jogadores”; pistas sob o breu não aparecem |
| RF-42 | No painel da pista, o mestre envia ou recolhe a pista do inventário de cada jogador com um clique no nome |
| RF-43 | O jogador guarda no inventário uma pista visível que encontrou no mapa |
| RF-44 | A aba Inventário do jogador lista as pistas com a origem (enviada pelo mestre ou encontrada no mapa), Apresentar ao grupo e Ver no mapa |
| RF-45 | Ao apresentar, a aba Acontecimentos mostra “\[Jogador\] compartilhou uma pista” com o cartão da pista, e ela entra na aba Pistas do grupo |
| RF-46 | A aba Acontecimentos registra a sessão: movimentos, breu, pistas entregues e apresentadas, trilhas e rodadas, com contador de novidades |
| RF-47 | As pistas do inventário também aparecem na ficha do personagem |

## Investigação, testes, dados e chat

A investigação acontece pelos pontos de interesse, no formato do livro: cabeçalho, quadro de perícias com DT e uma descrição contextual que só o mestre lê.

| Código | Requisito |
| --- | --- |
| RF-30 | Ao abrir um ponto de interesse, o jogador escolhe a perícia e Investiga: recebe as informações cuja DT é menor ou igual ao valor do dado |
| RF-31 | Depois de investigar, o jogador Examina (teste; sem informação nova, perde 1 PD) ou Interage (ações sugeridas ou texto livre) |
| RF-32 | Informações ainda não descobertas aparecem como tarjas pretas, sem o texto |
| RF-33 | Desafios de acesso abrem janelas próprias: destrancar (senha em d6), arrombar (barra de progresso), hack social (terminal) e alcançar |
| RF-34 | Recapitular (Intuição DT 10) e Compartilhar (aliado faz Pesquisa DT 10) geram pistas de grupo |
| RF-35 | Cada jogador tem uma ação importante por rodada; o mestre encerra a rodada |
| RF-36 | Teste livre (atributo + perícia) e dados avulsos de d4 a d20, com o resultado em destaque e no chat |
| RF-37 | Chat da mesa com narração do mestre em caixa própria |
| RF-38 | Marcar um ponto faz um pulso no mapa para todos; medir mostra quadrados e metros |

## Ferramentas do mestre

O mestre tem dois apoios: o guia de cena, numa aba lateral da própria mesa, para narrar sem trocar de tela; e o escudo do mestre, uma tela de referência com quatro painéis, como um escudo físico.

### Guia de cena (aba Guia da mesa)

| Código | Requisito |
| --- | --- |
| RF-50 | A aba Guia mostra a cena atual e a leitura de abertura, editável, com botão para narrar no chat |
| RF-51 | Roteiro do ato com as cenas em ordem, marcáveis como feitas |
| RF-52 | Lista de pontos de interesse do mapa: descrição, nota só do mestre, quadro de perícias com o que o grupo já descobriu (verde) e o que falta (amarelo), e os botões Narrar descrição e Abrir no mapa |
| RF-53 | Lista de pistas do mapa: se estão visíveis e com quem estão, com atalho para abrir cada uma |
| RF-54 | Lista de salas com Narrar leitura e Notas |

### Salas e notas

| Código | Requisito |
| --- | --- |
| RF-55 | O mestre desenha a área de uma sala no mapa e anota leitura em voz alta, atmosfera, perigos e testes, segredos, NPCs e notas livres |
| RF-56 | Salas aparecem só para o mestre, com contorno e etiqueta clicável; os jogadores não recebem nada delas |

### Escudo do mestre (tela Mestre)

| Código | Requisito |
| --- | --- |
| RF-57 | Quatro painéis: Regras na mão, Cena e salas, Ameaças e NPCs, Segredos e relógios |
| RF-58 | Todo texto é editável no lugar, incluindo títulos; cada painel aceita novas anotações e tabelas |
| RF-59 | As salas do escudo são as mesmas da mesa: editar num lugar muda no outro |
| RF-60 | Fichas de ameaças com PV, atributos, perícias que rolam ao clicar, ações e táticas |
| RF-61 | Segredos com chave de revelado, relógio de perigo com segmentos, PV e PD do grupo e ganchos de cada jogador |
| RF-62 | Botão Virar o escudo mostra o lado que os jogadores veem |
| RF-63 | Editor de pontos de interesse com prévia no formato do livro |

## Trilha sonora

O mestre escolhe o que toca, e toca para a mesa inteira. Cada jogador controla só o próprio volume.

| Código | Requisito |
| --- | --- |
| RF-70 | Quatro ambientes prontos, gerados no navegador sem arquivo: Estática de rádio, Drone do Outro Lado, Chuva na janela e Coração acelerado |
| RF-71 | O mestre envia músicas próprias (MP3, OGG, WAV), que tocam em repetição |
| RF-72 | Tocar e parar ficam na aba Mestre; só uma trilha toca por vez |
| RF-73 | O mestre define o volume da mesa; cada jogador ajusta o próprio volume e silencia no topo da mesa, onde aparece o nome da faixa |
| RF-74 | Trocar de trilha fica no registro de Acontecimentos |

## Arquivo e perfil

| Código | Requisito |
| --- | --- |
| RF-80 | O Arquivo reúne as 20 perícias, os perfis, as ocupações, itens, ameaças, desafios de acesso e a tabela de falha crítica, com busca |
| RF-81 | Itens vão para o inventário de um personagem, limitado por espaços conforme o Físico |
| RF-82 | O Perfil tem nome, cor, conquistas, histórico de rolagens e configurações: tema escuro ou papel, estilo dos dados, som, notificações, privacidade, avisos de conteúdo e conta |

## Matriz de permissões

Toda permissão é decidida no servidor. Esconder algo só na tela não conta como permissão.

| Ação | Mestre | Jogador, no que é dele | Jogador, no que é de outro |
| --- | --- | --- | --- |
| Mover token | Sim | Sim, fora do breu | Não |
| Trocar imagem e tamanho do token | Sim | Sim | Não |
| Ocultar token, criar ou remover NPC | Sim | Não | Não |
| Colocar, mover e girar props | Sim | Não | Não |
| Enviar mapa e mudar a grade | Sim | Não | Não |
| Desenhar e remover o breu | Sim | Não | Não |
| Ver o que está sob o breu | Sim | Não | Não |
| Mudar o nível da névoa | Sim | Não | Não |
| Criar, editar e enviar pistas | Sim | Não | Não |
| Guardar pista visível no mapa | Não se aplica | Sim | Não se aplica |
| Apresentar pista ao grupo | Não se aplica | Sim | Não |
| Ver notas de salas e contexto de pontos de interesse | Sim | Não | Não |
| Tocar trilha e mudar o volume da mesa | Sim | Não | Não |
| Mudar o próprio volume ou silenciar | Sim | Sim | Não se aplica |
| Editar ficha | Sim | Sim | Ver, se a campanha permitir |
| Escudo do mestre e guia de cena | Sim | Não | Não |

## Fluxos principais

### Preparar uma sessão (mestre)

1. Na Mesa, envie o mapa e ajuste a grade.
2. Cubra com o breu o que o grupo ainda não conhece.
3. Desenhe as salas e preencha as notas, ou edite as salas pelo escudo.
4. Coloque props e os tokens de NPCs e ameaças, deixando ocultos os que forem surpresa.
5. Coloque as pistas no mapa, com o texto do jogador e a nota do mestre.
6. No escudo, revise ameaças, segredos e o relógio de perigo.
7. Na aba Guia, escreva a leitura de abertura.

### Jogar uma cena de investigação

1. O mestre toca a trilha e narra a abertura pela aba Guia.
2. Cada jogador move o próprio token e abre um ponto de interesse.
3. O jogador investiga, depois examina ou interage; as pistas reveladas vão para a aba Pistas.
4. Quando o grupo chega a uma área nova, o mestre revela o breu ou a sala.
5. O mestre envia pistas ao inventário de quem as encontrou.
6. Quem tem uma pista decide quando apresentá-la; ela aparece em Acontecimentos para todos.
7. O mestre encerra a rodada, e o ciclo recomeça.

## Status no protótipo

Todas as funcionalidades pedidas estão no protótipo navegável do Claude Design. O que muda na versão real é a sincronização entre pessoas, que no protótipo é simulada.

| Funcionalidade | Protótipo | Onde |
| --- | --- | --- |
| Artes próprias: mapas, props, tokens e arte da ficha | Sim | Mesa (aba Mestre, painel do token, painel do prop), Ficha |
| Pistas no mapa com descrição e envio ao inventário de um jogador | Sim | Mesa: ferramenta Pista e painel da pista |
| Jogador apresenta a pista em Acontecimentos | Sim | Mesa: aba Inventário e aba Acontecimentos |
| Ficha em branco, sem o passo a passo | Sim | Criar personagem |
| Breu | Sim | Mesa: ferramentas Breu e Revelar |
| Jogadores movem os próprios tokens | Sim | Mesa e Mesa no celular |
| Escudo do mestre | Sim | Mestre |
| Guia lateral para narrar cenas com pontos de interesse e pistas | Sim | Mesa: aba Guia |
| Trilha sonora para todos | Sim | Mesa: aba Mestre e topo da mesa |
| Abas Ordem Paranormal e RPGs inventados | Sim | Casos e Novo caso |
| Ficha manual com dados físicos e modal de sucesso ou fracasso | Sim | Ficha, Mesa, Mesa no celular e Criar personagem |

### Limitações conhecidas do protótipo

- **Multiplayer simulado:** os outros jogadores são simulados. Para ver as permissões, troque entre Jogador e Mestre no topo da mesa.
- **Dados no navegador:** mapas, breu, tokens, props, pistas, salas e o escudo ficam salvos no navegador de quem usa, não num servidor. Imagens grandes podem não caber e valem só na sessão.
- **Músicas enviadas:** tocam só até recarregar a página; os ambientes prontos sempre funcionam.
- **Celular:** a mesa no celular move o token e investiga, mas ainda não tem props, pistas no mapa, breu editável nem controles de trilha.
- **RPGs inventados:** o caso guarda o sistema configurado e aparece na aba própria, mas a ficha ainda é a de Ordem Paranormal; a ficha com os atributos configurados fica para a versão real.
- **Dados físicos:** o app confia no resultado que o jogador informa. No celular, a falha crítica é registrada, mas ainda não pede o d8 da tabela.
- **Regras provisórias:** as habilidades de Analista, Vigilante e das ocupações foram criadas para o protótipo e devem ser trocadas pelas do manual completo.
- **Propriedade intelectual:** Ordem Paranormal pertence a terceiros. Uso privado entre amigos tem risco baixo; publicar ou cobrar exige licença.
