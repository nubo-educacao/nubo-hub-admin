
# Plano: Corrigir Três Problemas na Aba "Conversas Recentes"

## Resumo dos Problemas Identificados

| Problema | Causa | Impacto |
|:---------|:------|:--------|
| **Usuários anônimos** | Limite de 1.000 rows do Supabase não paginado | ~715 usuários aparecem sem nome |
| **Sem "Match Realizado"** | Estágio não implementado na função | 919 usuários não categorizados corretamente |
| **Ordenação de mensagens** | Timestamps idênticos sem desempate | Conversa aparece desordenada |

---

## Correção 1: Resolver Limite de 1.000 Usuários

### Problema Técnico
A query de busca de perfis usa `.in('id', uniqueUserIds)` sem paginação:
```typescript
// Linha 332-335 - Retorna máximo 1000 registros
const { data: profiles } = await supabase
  .from('user_profiles')
  .select('id, full_name, city, age, onboarding_completed')
  .in('id', uniqueUserIds)
```

### Solução
Implementar paginação em lotes de 500 IDs:
```typescript
// Buscar profiles em lotes para superar limite de 1000
const BATCH_SIZE = 500
const profileMap = new Map<string, {...}>()

for (let i = 0; i < uniqueUserIds.length; i += BATCH_SIZE) {
  const batchIds = uniqueUserIds.slice(i, i + BATCH_SIZE)
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, full_name, city, age, onboarding_completed')
    .in('id', batchIds)
  
  for (const profile of profiles || []) {
    profileMap.set(profile.id, {...})
  }
}
```

Aplicar o mesmo padrão para `preferences` e `favorites`.

---

## Correção 2: Adicionar Estágio "Match Realizado"

### Problema Técnico
- A função `determineFunnelStage()` não verifica `workflow_data`
- O frontend não lista "Match Realizado" nos filtros

### Solução Backend (analytics-chats/index.ts)

1. **Buscar workflow_data nas preferences:**
```typescript
// Linha 352-356 - Adicionar workflow_data à query
const { data: preferences } = await supabase
  .from('user_preferences')
  .select('user_id, enem_score, workflow_data')
  .in('user_id', batchIds)

// Criar set para match realizado
const hasMatchRealized = new Set<string>()
for (const pref of preferences || []) {
  if (pref.workflow_data && Object.keys(pref.workflow_data).length > 0) {
    hasMatchRealized.add(pref.user_id)
  }
}
```

2. **Atualizar função de estágios:**
```typescript
function determineFunnelStage(
  userId: string,
  profile: { onboarding_completed?: boolean } | null,
  hasPreferences: boolean,
  hasMatchMessages: boolean,
  hasMatchRealized: boolean, // NOVO PARÂMETRO
  hasFavorites: boolean,
  hasSpecificFlow: boolean
): string {
  if (hasSpecificFlow) return 'Fluxo Específico';
  if (hasFavorites) return 'Salvaram Favoritos';
  if (hasMatchRealized) return 'Match Realizado'; // NOVA ETAPA
  if (hasMatchMessages) return 'Match Iniciado';
  if (hasPreferences) return 'Preferências Definidas';
  if (profile?.onboarding_completed) return 'Onboarding Completo';
  return 'Cadastrados';
}
```

### Solução Frontend (ChatExamplesPanel.tsx)

```typescript
// Linha 73-81 - Adicionar opção Match Realizado
const funnelStages = [
  { value: 'all', label: 'Todas as etapas' },
  { value: 'Cadastrados', label: 'Cadastrados' },
  { value: 'Onboarding Completo', label: 'Onboarding Completo' },
  { value: 'Preferências Definidas', label: 'Preferências Definidas' },
  { value: 'Match Iniciado', label: 'Match Iniciado' },
  { value: 'Match Realizado', label: 'Match Realizado' }, // NOVO
  { value: 'Salvaram Favoritos', label: 'Salvaram Favoritos' },
  { value: 'Fluxo Específico', label: 'Fluxo Específico' },
];

// Linha 83-90 - Adicionar cor
const funnelStageColors: Record<string, string> = {
  // ...existentes...
  'Match Realizado': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
};
```

---

## Correção 3: Ordenar Mensagens Corretamente

### Problema Técnico
Mensagens do usuário e bot têm **timestamps idênticos**, causando ordem inconsistente.

### Solução
Adicionar ordenação secundária por sender após reverter as mensagens:
```typescript
// Linha 210-211 - Ordenar com desempate
const orderedMessages = (messages || [])
  .reverse()
  .sort((a, b) => {
    const timeA = new Date(a.created_at).getTime()
    const timeB = new Date(b.created_at).getTime()
    
    // Ordenação primária por tempo
    if (timeA !== timeB) return timeA - timeB
    
    // Desempate: user antes de cloudinha
    const senderOrder = (s: string) => s === 'user' ? 0 : 1
    return senderOrder(a.sender) - senderOrder(b.sender)
  })
```

---

## Arquivos a Modificar

| Arquivo | Alterações |
|:--------|:-----------|
| `supabase/functions/analytics-chats/index.ts` | Paginação de profiles, adicionar Match Realizado, ordenação de mensagens |
| `src/components/analytics/ChatExamplesPanel.tsx` | Adicionar filtro e cor para Match Realizado |

---

## Resultado Esperado

Após as correções:
- **100% dos usuários** com nome preenchido aparecerão com seu nome (não mais anônimos)
- **919 usuários** serão categorizados como "Match Realizado"
- **Mensagens** sempre aparecerão na ordem correta (pergunta → resposta)
- **Filtro por "Match Realizado"** disponível na interface
