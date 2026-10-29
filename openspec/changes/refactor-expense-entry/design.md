# Design

## Context
Hoje `/(app)/novo` tem um input único com autofoco; `parseQuickEntry` extrai
descrição e valor, `suggestBucket` sugere o balde e um toggle permite trocar.
`createExpense` (Server Action) valida e grava no ciclo do mês atual; o toast tem
"Desfazer". A notificação do lembrete abre `/novo?src=notification`. O painel já
calcula o valor diário de lazer (`computeDailyAllowance`) e os saldos por balde.
Componentes de UI são shadcn sobre Base UI (sem `asChild`; usar `render`).

## Goals / Non-Goals

**Goals**
- Lançamento típico em 3 passos: valor → chip → salvar
- Visual de app financeiro: valor em destaque, teclado próprio, cores por balde
- Retorno do efeito do gasto no orçamento antes de salvar
- Medir se a nova tela é mais rápida e se os chips são usados

**Non-Goals**
- Editar gastos já lançados
- Categorias além dos três baldes
- Teste A/B entre a tela antiga e a nova (a antiga é removida)

## Decisions

### D1 — Sheet no painel, tela cheia em `/novo`
- **Rotas paralelas + interceptadas** do App Router:
  - `app/(app)/@sheet/(.)novo/page.tsx`: ao navegar do painel (botão flutuante),
    `/novo` abre como bottom sheet sobre o painel.
  - `app/(app)/novo/page.tsx`: acesso direto (link, notificação, refresh) abre em
    tela cheia.
  - `app/(app)/@sheet/default.tsx` retorna `null`.
- As duas rotas renderizam o mesmo componente `ExpenseEntry`, com a prop
  `variant: 'sheet' | 'page'`.
- Sheet: componente de drawer/sheet que já exista no projeto, com arrastar para
  fechar e altura de ~92% da viewport no mobile. Fechar = `router.back()`.
- **Por que interceptar:** a URL continua `/novo` (o fluxo da notificação e o
  `src=notification` não mudam) e o painel permanece por trás, preservando o
  contexto.

### D2 — Teclado de valor
- Estado do valor em centavos (inteiro). Redutor puro em
  `lib/domain/amount-keypad.ts`:
  - `digit(d)`: `cents = cents * 10 + d`;
  - `doubleZero`: `cents = cents * 100`;
  - `backspace`: `cents = Math.floor(cents / 10)`;
  - `clear`: `cents = 0` (pressionar e segurar o apagar).
  - Limite de 9 dígitos (R$ 9.999.999,99): entradas além disso são ignoradas.
- Layout 3×4: `1–9`, linha final `00 · 0 · ⌫`. Botões com no mínimo 56px de altura.
- Sem `<input>` para o valor: o teclado do sistema não abre. O display é um
  elemento com `aria-live="polite"` e `role="status"`.
- Teclado físico também funciona (dígitos, Backspace, Enter salva), para desktop.
- Vibração curta (`navigator.vibrate?.(8)`) ao tocar, quando disponível; ignorada
  com `prefers-reduced-motion`.
- Valor zero exibido como "R$ 0,00" em cor secundária; ao digitar, cor principal.

### D3 — Chips de descrição
- `server/entry-context.ts` → `getFrequentDescriptions(userId, limit = 6)`:
  gastos **manuais** (`recurring_expense_id IS NULL`) dos últimos 90 dias,
  agrupados por `normalizeText(description)`. Para cada grupo: rótulo = grafia
  mais frequente sem números; balde = o do gasto **mais recente** do grupo;
  ordenação por quantidade e, no empate, pelo mais recente.
- Usuário com menos de 6 grupos: completar com `STARTER_CHIPS` de
  `lib/domain/entry-chips.ts`, pulando os já presentes após normalização:
  Mercado (needs), Transporte (needs), Farmácia (needs), Restaurante (wants),
  Delivery (wants), Assinaturas (wants).
- Combinação em função pura `buildEntryChips(history, starters, limit)`.
- Tocar no chip preenche a descrição e seleciona o balde do chip; tocar de novo
  desmarca. Um chip selecionado por vez.
- Último chip é sempre "+ Outro": abre campo de texto com autofoco. O teclado de
  valor fica oculto enquanto o campo tem foco e volta ao confirmar/desfocar.
- No campo "Outro", a sugestão de balde usa `suggestBucket` em tempo real. Se o
  texto contiver valor (`parseQuickEntry`, ex.: "padaria 12,50") e o valor do teclado
  estiver zerado, o valor é transferido para o teclado e removido do texto
  (compatibilidade com o hábito antigo).

### D4 — Seletor de balde
- Três opções lado a lado (segmented control), cada uma com ícone, rótulo e cor.
- Cores como tokens CSS (`--bucket-needs`, `--bucket-wants`, `--bucket-savings`),
  com variantes para modo escuro, em `components/bucket-meta.ts` + CSS do tema.
  `lib/domain/buckets.ts` continua só com dados (rótulos, proporções).
- Estado da sugestão:
  - balde vindo de chip do histórico → marca "como da última vez";
  - vindo de `suggestBucket` ou de chip inicial → marca "sugerido";
  - sem sugestão → Necessidades pré-selecionado, sem marca;
  - após toque manual no seletor, a marca some.

### D5 — Linha de impacto
- Função pura `previewImpact(context, draft)` em `lib/domain/entry-impact.ts`.
- `context` (carregado no servidor ao abrir a tela): disponível de cada balde no
  ciclo, valor diário de lazer (`DailyAllowance`) e `today` local.
- Regras:
  - Lazer com data de hoje → "Lazer hoje: resta R$ A → R$ B" (usa
    `remainingTodayCents`);
  - Lazer com data anterior → "Lazer no mês: R$ A → R$ B";
  - Necessidades → "Necessidades no mês: R$ A → R$ B disponível";
  - Investimentos → "Guardado no mês: R$ A → R$ B".
  - Resultado negativo: "R$ X acima do planejado", em tom neutro (sem vermelho).
  - Valor zero: linha mostra o estado atual sem a seta.
- Atualiza a cada tecla, sem chamada ao servidor.

### D6 — Data
- Chips "Hoje" (padrão), "Ontem" e "Outra data".
- "Outra data" abre um `<input type="date">` nativo estilizado em popover
  (melhor suporte em iOS/Android que um calendário próprio), com
  `min` = primeiro dia do mês atual e `max` = hoje.
- No dia 1 do mês, "Ontem" fica desabilitado com a dica "Ontem pertence ao mês
  anterior". Lançar em meses fechados fica fora do escopo.
- Datas futuras não são permitidas (agendamentos são contas fixas).
- **Servidor:** `createExpense` passa a validar que `occurredOn` está entre o primeiro
  dia do mês atual e hoje (data local do usuário); fora disso, erro de validação.

### D7 — Salvar
- Botão fixo no rodapé: "Salvar R$ 12,00" (valor no rótulo); desabilitado enquanto
  valor = 0 ou descrição vazia, com dica do que falta.
- Enter no teclado físico salva quando habilitado.
- Durante o envio: botão em estado de carregamento, interações bloqueadas.
- Sucesso no sheet: animação curta de check (~600ms, desligada com
  `prefers-reduced-motion`), fechamento do sheet e toast
  "Mercado · R$ 12,00 salvo" com "Desfazer". O painel atualiza (revalidação).
- Sucesso em `/novo` (tela cheia): estado de confirmação com "Lançar outro" (reseta
  valor e descrição, mantém a data) e "Ir para o painel".
- Erro: mensagem inline acima do botão; o rascunho é mantido.
- **Mudança em relação à proposta original:** "Lançar outro" fica só na tela cheia.
  No sheet, fechar após salvar evita um toque extra no caso mais comum (um gasto por
  vez), e o botão flutuante reabre o sheet.

### D8 — Analytics
- `expense_created` (source `quick_entry`/`notification`) ganha:
  - `usedChip: boolean`;
  - `chipSource: 'history' | 'starter' | null`;
  - `durationMs: number` — do primeiro render da tela até o envio, arredondado
    para 100ms e limitado a 600000 (10 min).
- `durationMs` vem do cliente: validado com zod (inteiro, 0–600000). Só afeta
  métricas.
- `/admin` ganha:
  - **Tempo mediano até salvar** (`percentile_cont(0.5)` de `durationMs`) na janela;
  - **Lançamentos com chip** (`usedChip = true` ÷ manuais da janela), com a divisão
    histórico × sugestões iniciais.
  Gastos sem `durationMs` (anteriores a este change) ficam fora da mediana.

### D9 — Remoção da tela antiga
- O input único é removido. `parseQuickEntry` continua em uso no campo "Outro".
- Componentes reaproveitados (toggle de balde atual) são substituídos pelo novo
  seletor; remover o que ficar sem uso.

## Componentes (novos)

```
components/expense-entry/
  expense-entry.tsx        # composição; variant 'sheet' | 'page'
  amount-display.tsx       # valor grande + aria-live
  amount-keypad.tsx        # teclado 3×4
  description-chips.tsx    # chips + "Outro"
  bucket-selector.tsx      # segmented control com cores
  date-chips.tsx           # Hoje / Ontem / Outra data
  impact-line.tsx          # linha de impacto
components/bucket-meta.ts  # ícones e tokens de cor por balde
lib/domain/
  amount-keypad.ts         # redutor puro
  entry-chips.ts           # STARTER_CHIPS, buildEntryChips()
  entry-impact.ts          # previewImpact()
  entry-date.ts            # allowedDateRange(today), isYesterdayAllowed(today)
server/entry-context.ts    # getFrequentDescriptions(), getEntryContext()
app/(app)/@sheet/(.)novo/page.tsx
app/(app)/@sheet/default.tsx
```

## Risks / Trade-offs
- **Rotas interceptadas têm armadilhas** (refresh, voltar, slot sem `default.tsx`
  quebrando o build) → testar refresh dentro do sheet, botão voltar do Android e
  acesso direto; `default.tsx` nos slots.
- **Teclado próprio quebra o colar valor** → o campo "Outro" aceita "descrição valor"
  e transfere o valor (D3).
- **Chips do histórico mostram descrições do usuário na tela** → dado do próprio
  usuário, sem problema de privacidade; nada disso vai para eventos.
- **Linha de impacto com dados desatualizados** se o sheet ficar aberto muito tempo
  → aceitável; o painel revalida após salvar.
- **Mais elementos na tela** → hierarquia clara: valor > chips > balde > data;
  data e impacto em tipografia secundária.

## Migration Plan
Sem migration. Deploy normal; métricas novas começam a contar a partir do deploy.

## Open Questions
- Mostrar o valor médio daquele chip como dica ("Mercado · média R$ 180")? Proposta:
  não no v1, para não poluir.
