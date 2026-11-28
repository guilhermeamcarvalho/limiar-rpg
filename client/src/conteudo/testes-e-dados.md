<!-- Seção do Arquivo. O formato está em client/src/conteudo/index.ts. -->

# Testes e dados

icone: dice
ordem: 1

Como o app resolve um teste de Ordem Paranormal II, as ações de investigação e os desafios de acesso.

## Como funciona um teste

categoria: Teste
resumo: atributo + perícia contra a DT
etiquetas: DT padrão 7

Um teste soma o dado do **atributo** e o dado da **perícia**. Se o total for igual ou maior que a DT, deu certo. A DT padrão é **7**; o mestre pode mudar a de cada caso.

## Dados extras

categoria: Teste
resumo: bônus somam dados; com 4, contam os 3 maiores
etiquetas: Máximo de 4 dados

Ímpeto e habilidades somam dados ao teste. Com 4 dados, só os 3 maiores contam: sai o menor. Se dois empatam no menor valor, sai o que veio por último. O total é o mesmo de qualquer jeito.

## Sucesso crítico

categoria: Teste
resumo: dois dados iguais, de valor 6 ou mais
etiquetas: Passa sempre

Dois dados iguais com valor 6 ou mais, entre os que contaram, fazem um sucesso crítico: o teste passa sempre e, numa investigação, revela uma informação extra. Um 6 descartado não forma par com outro 6.

## Falha crítica

categoria: Teste
resumo: todos os dados em 1; rola 1d8 na tabela
etiquetas: Inclui o dado descartado

Quando todos os dados saem 1, inclusive o descartado, o teste falha e você rola 1d8 na tabela de falha crítica (seção **Falha crítica** do Arquivo).

## RA e RB

categoria: Dados
resumo: rolagem alta e rolagem baixa
etiquetas: Usadas em dano e desafios

A **RA** (rolagem alta) é o maior dado que contou no teste; a **RB** (rolagem baixa), o menor. Desafios de acesso e dano usam uma ou outra.

## Passos de dado

categoria: Dados
resumo: d4 → d6 → d8 → d10 → d12
etiquetas: Nunca abaixo de d4; Nunca acima de d12

Subir ou descer um passo troca o dado pelo vizinho na escada d4, d6, d8, d10, d12. No teste, um dado nunca passa de d12 nem fica abaixo de d4, mesmo somando vários efeitos (Machucado, Ímpeto, Ajuda).

## Ajuda

categoria: Dados
resumo: aliado com d6+ sobe a perícia em +1 ou +2 passos
etiquetas: +1 passo (d4–d8); +2 passos (d10–d12)

Um aliado com pelo menos **d6** na perícia pode ajudar: quem testa sobe a perícia em **+1 passo** (se estiver em d4, d6 ou d8) ou **+2 passos** (se estiver em d10 ou d12). A ajuda troca o dado, não soma dados extras.

## Dados físicos

categoria: Dados
resumo: você rola na mão e o app confere
etiquetas: As regras não mudam

Marque **Dados físicos** na criação, na ficha ou na mesa. O app mostra os dados a rolar, já com Ajuda, Ímpeto e Gambiarra, e a DT. Você digita o valor de cada dado (ou só diz se passou) e o app soma, confere a DT e os críticos. Na falha crítica, ele pede o d8 da tabela e, em Acidente ou Frustração, o d4 da perda.

## Investigar

categoria: Investigação
resumo: recebe as informações sem rolar
etiquetas: 1 ação

Escolha uma perícia: você recebe, sem rolar, as informações do ponto cuja DT é menor ou igual ao valor do dado dela.

## Examinar

categoria: Investigação
resumo: teste contra as DTs do ponto
etiquetas: 1 ação; −1 PD se não achar nada novo

Depois de investigar, faça um teste da perícia contra as DTs do ponto. Se não achar nada novo, perde 1 PD.

## Recapitular

categoria: Investigação
resumo: Intuição contra DT 10
etiquetas: Intuição; DT 10

Teste de Intuição contra DT 10 para tirar uma conclusão das pistas do grupo.

## Compartilhar

categoria: Investigação
resumo: aliado faz Pesquisa contra DT 10
etiquetas: Pesquisa; DT 10

Você explica uma pista; um aliado faz Pesquisa contra DT 10 para entendê-la.

## Destrancar

categoria: Desafio
resumo: Crime; adivinhe a senha em d6
etiquetas: Crime; Tentativas pelo dado

O mestre define uma senha em d6. A cada tentativa, diga um valor por dado e ouça baixo, alto ou exato. Tentativas por rodada pelo dado de Crime: d4 = 1, d6 = 2, d8 = 3, d10 = 4, d12 = 5. Há um máximo de tentativas.

## Arrombar

categoria: Desafio
resumo: Atletismo; cada sucesso soma a RA
etiquetas: Atletismo; −1 PV por tentativa

Cada tentativa custa 1 PV. Teste contra a DT; cada sucesso soma a RA até chegar aos pontos de arrombamento (PA).

## Hack social

categoria: Desafio
resumo: Intuição; passou, adivinha a senha
etiquetas: Intuição; +1 chance a cada 3 acima da DT

Teste de Intuição contra a DT. Se passar, você tenta adivinhar a senha, com uma chance extra a cada 3 pontos acima da DT.

## Alcançar

categoria: Desafio
resumo: Acrobacia, seguro ou arriscado
etiquetas: Acrobacia

| Jeito     | Ações         | Se falhar       |
| --------- | ------------- | --------------- |
| Seguro    | 2 ações       | Dano igual à RB |
| Arriscado | 1 ação, DT +3 | Dano igual à RA |
