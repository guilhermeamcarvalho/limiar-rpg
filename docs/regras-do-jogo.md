# Regras e sistemas de jogo

Esta aba descreve as regras que o motor implementa, com base no Playtest Alpha v1.1 de Ordem Paranormal II, e como um sistema inventado pelo grupo é resolvido. As regras marcadas como provisórias foram criadas para o protótipo.

## Como funciona um teste

Um teste soma o dado do atributo e o dado da perícia; se o total for igual ou maior que a DT, deu certo. A DT padrão é 7.

| Regra | Como o motor resolve |
| --- | --- |
| Rolagem | Dado do atributo + dado da perícia |
| Dados extras | Bônus (Ímpeto, habilidades) somam dados; com 4 dados, só os 3 maiores contam |
| Sucesso crítico | Dois dados iguais com valor 6 ou mais: passa sempre e, numa investigação, revela uma informação extra |
| Falha crítica | Todos os dados em 1: falha e rola 1d8 na tabela abaixo |
| RA e RB | Rolagem alta e rolagem baixa: o maior e o menor dado do teste, usados por desafios e dano |
| Passos de dado | d4 → d6 → d8 → d10 → d12; subir ou descer um passo troca o dado |
| Ajuda | Quem é ajudado sobe o dado da perícia em um passo |

### Detalhes que o motor decide

O código fica em `shared/src/regras/op2/`; a ficha (prévia) e o servidor (resultado oficial) usam a mesma função.

- **Com 4 dados, sai o menor.** Se dois empatam no menor valor, sai o que veio por último (um bônus antes do atributo). O total é o mesmo de qualquer jeito.
- **O sucesso crítico olha só os dados que contaram.** Um 6 descartado não forma par com outro 6.
- **A falha crítica pede todos os dados em 1**, inclusive o descartado.
- **No teste, um dado nunca passa de d12 nem fica abaixo de d4**, mesmo com vários efeitos somados (Machucado, Ímpeto, Ajuda).

### Falha crítica (1d8)

| d8 | Resultado |
| --- | --- |
| 1 | Vexame |
| 2 | Físico desce um passo até o fim da cena |
| 3 | Mente desce um passo até o fim da cena |
| 4 | Emoção desce um passo até o fim da cena |
| 5 | Perde d4 PV |
| 6 | Perde d4 PD |
| 7 | Perde um item |
| 8 | Nada acontece |

### Jogando com dados físicos

Quem prefere rolar dados de verdade marca **Dados físicos** na criação, na ficha ou na mesa. As regras não mudam; muda só quem rola.

1. O jogador clica na perícia (ou num teste da mesa, como examinar ou arrombar).
2. O app mostra os dados a rolar, já com Ajuda, Ímpeto e Gambiarra, e a DT.
3. O jogador rola na mão e digita o valor de cada dado; o app soma os três maiores, confere a DT e os críticos e diz se passou. Quem preferir pode só responder: sucesso, fracasso, sucesso crítico ou falha crítica.
4. Na falha crítica, o app pede o d8 da tabela acima e, em Acidente ou Frustração, o d4 de perda.
5. Quando o jogador só diz o resultado, a soma é opcional, exceto quando o teste depende dela: na investigação ela decide quantas informações aparecem, e arrombar e alcançar usam o maior ou o menor dado. Sem a soma, o sucesso conta como a DT exata.

O resultado vale como qualquer outro: preenche o ímpeto na falha, gasta os bônus armados e entra no histórico e no chat com a marca “dados físicos”. O mestre vê em Acontecimentos que o resultado foi informado pelo jogador.

## Atributos e perícias

Três atributos (Físico, Mente e Emoção) e 20 perícias, cada uma ligada a um atributo. Todos são dados, de d4 a d12.

| Atributo | Perícias |
| --- | --- |
| Físico | Acrobacia, Atletismo, Crime, Furtividade, Luta, Pontaria, Vigor |
| Mente | Aptidão, Máquinas, Medicina, Ocultismo, Percepção, Pesquisa, Sobrevivência, Tecnologia |
| Emoção | Disciplina, Enganação, Intimidação, Intuição, Persuasão |

Algumas perícias têm uso especial no sistema: Crime define as tentativas de destrancar por rodada, Acrobacia é usada para alcançar, Intuição para recapitular e para o hack social, e Pesquisa para compartilhar pistas.

## Vida, sanidade e limites

| Item | Regra |
| --- | --- |
| PV | 4 + o valor máximo do dado de Físico |
| PD | Valor máximo do dado de Mente + valor máximo do dado de Emoção |
| Chegar a 0 PV | Teste de Vigor contra DT 7, +3 para cada teste já feito; se falhar, o personagem morre |
| Chegar a 0 PD | Teste de Disciplina contra DT 7, +3 para cada teste já feito |
| Fim da cena | Efeitos que duram “até o fim da cena” são desfeitos pelo botão Fim da cena da ficha |

## Perfis e ocupações

O perfil define o estilo de jogo; a ocupação define o passado do personagem e traz uma habilidade.

| Perfil | Habilidade | Regra | Origem |
| --- | --- | --- | --- |
| Executor | Ímpeto | Barra com 3 espaços; cada teste que falha preenche 1. Gaste 1 para +d4 num teste, ou 3 para subir um atributo um passo até o fim da cena | Manual |
| Analista | Preparação | Gaste uma ação analisando para guardar até 2 marcadores; antes de rolar, gaste um para subir um dado em um passo | Provisória |
| Vigilante | Reflexo | Age antes de todos quando algo inesperado acontece; uma vez por cena, rola de novo a RB de um teste | Provisória |

| Ocupação | Habilidade | Regra |
| --- | --- | --- |
| Mecânico | Gambiarra | Uma vez por cena, gaste 2 PV para +d4 num teste de Máquinas ou Crime |
| Jornalista | Fontes | Uma vez por cena, gaste 1 PD para rolar Pesquisa ou Persuasão duas vezes e ficar com o melhor |
| Enfermeira | Plantão | Gaste uma ação e 1 PD: teste de Medicina; um aliado recupera PV igual à RA |
| Cientista | Foco mental | Num teste mental, gaste 2 PD para receber +d4 |
| Policial | Treinamento | Uma vez por cena, num teste de Pontaria ou Intimidação, suba o dado da perícia em um passo |
| Entregador | Conheço um atalho | Uma vez por cena, ao fugir ou se deslocar pela cidade, receba +d4 em Atletismo ou Acrobacia |

As habilidades das ocupações são provisórias do protótipo. No motor, cada uma é um modificador com custo, limite de uso e perícias afetadas, então trocar pelo texto do manual é só mudar dados.

## Investigação

Cada jogador tem uma ação importante por rodada. As ações de investigação são estas:

| Ação | Como funciona |
| --- | --- |
| Investigar | O jogador escolhe uma perícia e recebe, sem rolar, as informações do ponto cuja DT é menor ou igual ao valor do dado dela |
| Examinar | Depois de investigar: teste da perícia contra as DTs do ponto; se não achar nada novo, perde 1 PD |
| Interagir | Depois de investigar: uma ação descrita (sugerida ou livre), resolvida pelo mestre |
| Recapitular | Intuição contra DT 10 para tirar uma conclusão das pistas do grupo |
| Compartilhar | Um aliado faz Pesquisa contra DT 10 para entender uma pista explicada por você |

Pistas soltas, colocadas pelo mestre no mapa, não dependem de teste: o mestre as entrega quando fizer sentido na história, e quem as tem decide quando apresentá-las.

## Desafios de acesso

| Desafio | Perícia | Regra |
| --- | --- | --- |
| Destrancar | Crime | O mestre define uma senha em d6. A cada tentativa, o jogador diz um valor por dado e ouve baixo, alto ou exato (ou tic, toc e click, no modo imersivo). Tentativas por rodada: d4 = 1, d6 = 2, d8 = 3, d10 = 4, d12 = 5. Há um máximo de tentativas |
| Arrombar | Atletismo | Cada tentativa custa 1 PV. Teste contra a DT; cada sucesso soma a RA até chegar aos pontos de arrombamento (PA) |
| Hack social | Intuição | Teste contra a DT e, se passar, o jogador adivinha a senha. Ganha uma chance extra a cada 3 pontos acima da DT |
| Alcançar seguro | Acrobacia | Leva 2 ações; se falhar, sofre dano igual à RB |
| Alcançar arriscado | Acrobacia | Leva 1 ação, com DT +3; se falhar, sofre dano igual à RA |

## Criação de personagem

1. **Conceito:** nome, idade e ocupação, que traz uma habilidade e sugere perícias.
2. **Perfil:** Executor, Analista ou Vigilante.
3. **Atributos:** dois d8 e um d6; o jogador escolhe qual atributo fica com o d6.
4. **Perícias:** todas começam em d4; distribua seis d6 e um d8, ou use a sugestão da ocupação.
5. **Revisão:** PV e PD são calculados e a ficha fica pronta.

Na ficha em branco nada disso é obrigatório: atributos e perícias vão de d4 a d12, e a tela só avisa quando algo foge da regra.

## RPGs inventados

Um sistema inventado é descrito por configuração, não por código: o mestre preenche quatro campos ao criar o caso, e a mesa inteira (mapa, névoa, props, pistas, chat e trilha) funciona igual.

| Campo | Exemplo |
| --- | --- |
| Nome do sistema | Cinzas d20 |
| Dado principal | 1d20, 2d6, 1d100 ou parada de d6 |
| Atributos | Força, Astúcia, Espírito |
| Regras da casa | Texto livre, mostrado no escudo do mestre |

Como o motor resolve cada dado principal:

| Dado principal | Teste | Sucesso |
| --- | --- | --- |
| 1d20 | 1d20 + modificador do atributo | Total igual ou maior que a dificuldade |
| 2d6 | 2d6 + modificador do atributo | Total igual ou maior que a dificuldade |
| 1d100 | 1d100 | Resultado igual ou menor que o valor do atributo |
| Parada de d6 | Tantos d6 quanto o valor do atributo | Cada 5 ou 6 é um sucesso; o mestre define quantos são precisos |

A ficha de um sistema inventado mostra os atributos configurados, PV e PD livres, habilidades em texto e as mesmas áreas de itens, anotações e pistas. Críticos e tabelas especiais entram como regras da casa.
