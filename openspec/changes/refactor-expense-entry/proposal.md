# Change: Nova tela de lançamento de gastos

## Why
O lançamento atual é um único campo de texto em que o usuário digita descrição e
valor juntos ("mercado 120"). Ele cumpre o objetivo de poucas interações, mas tem
problemas de UX:
- o usuário precisa conhecer o "formato" esperado, o que não é óbvio para quem está
  começando;
- não há retorno visual do valor, do balde nem do efeito do gasto no orçamento;
- o teclado do sistema cobre metade da tela e a experiência parece inacabada
  perto dos apps financeiros que o público já usa.

O objetivo é manter a baixa fricção (3 passos) com acabamento de produto.

## What Changes
- Tela com o valor primeiro: valor em destaque e teclado numérico próprio,
  com digitação no estilo maquininha (dígitos entram pelos centavos)
- Chips com as descrições mais usadas pelo usuário, que preenchem descrição e balde
  com um toque; sugestões iniciais para quem ainda não tem histórico; opção "Outro"
  para texto livre
- Seletor visual de balde com cor e ícone, com a sugestão pré-selecionada e marcada
- Linha de impacto ao vivo mostrando o efeito do gasto no orçamento (valor diário de
  lazer ou disponível do balde)
- Data como chip: Hoje, Ontem ou outra data dentro do mês atual
- Lançamento em painel deslizante (bottom sheet) a partir do painel, mantendo
  `/novo` como tela cheia para links diretos e notificações
- Confirmação visual ao salvar, com "Desfazer"
- Novas propriedades no evento `expense_created` (uso de chip e tempo até salvar) e
  duas métricas novas no `/admin`

## Impact
- Capability alterada: `expense-entry` (requirement de lançamento substituído,
  novos requirements)
- Capability alterada: `usage-analytics` (novas métricas do lançamento)
- Código: novos componentes de UI, rotas paralela/interceptada para o sheet, query
  de descrições frequentes, validação de data no `createExpense`
- Sem mudança de schema
- Fora do escopo: edição de gasto existente, anexos/foto de comprovante, lançamento
  por voz, categorias além dos baldes, gastos parcelados
