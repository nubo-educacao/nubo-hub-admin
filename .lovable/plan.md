

## Plano de Implementacao

Este plano implementa duas funcionalidades solicitadas:

1. **Botao de Exportar Usuarios Inativos** - no card "Usuarios Cadastrados"
2. **Visao Historica Total no Grafico de Atividade** - desde o primeiro dia de atividade

---

## Funcionalidade 1: Exportar Usuarios Inativos

### O que sao "Usuarios Inativos"?
- Usuarios cadastrados (auth.users) que **nao** tiveram atividade nos ultimos 7 dias
- Nao enviaram mensagens
- Nao atualizaram preferencias
- Nao salvaram favoritos

### Componentes a criar/modificar:

**1.1 Nova Edge Function: `analytics-export-inactive`**
- Busca todos os usuarios do auth.users
- Identifica quais NAO tiveram atividade nos ultimos 7 dias
- Retorna: nome, telefone, cidade, curso de interesse, etapa do funil, data de cadastro
- Usa a mesma logica de paginacao e formatacao do `analytics-segmented-export`

**1.2 Atualizar `supabase/config.toml`**
- Adicionar configuracao para nova funcao

**1.3 Modificar `TotalUsersCard.tsx`**
- Adicionar botao de download na linha "Inativos (7d)"
- Ao clicar, abre modal similar ao `SegmentedExportButton`
- Permite baixar CSV com todos os usuarios inativos

**1.4 Novo Componente: `InactiveUsersExportButton.tsx`**
- Modal com preview da quantidade e opcao de download
- Reutiliza logica de download CSV do SegmentedExportButton

---

## Funcionalidade 2: Grafico de Atividade - Visao Historica

### Comportamento atual:
- "Semana": ultimos 7 dias
- "Hoje": hora a hora do dia atual

### Novo comportamento:
- Adicionar terceira opcao: **"Historico"** ou **"Total"**
- Mostra atividade desde o primeiro registro ate hoje
- Agrupado por dia (label: dd/mm)

### Componentes a modificar:

**2.1 Modificar `ActivityChart.tsx`**
- Adicionar opcao "Total" no ToggleGroup (3 opcoes: Semana, Hoje, Total)
- Novo modo `ViewMode = "week" | "day" | "total"`
- Quando "Total" selecionado, chama edge function com mode "total"

**2.2 Modificar Edge Function `analytics-activity`**
- Adicionar suporte ao modo `"total"`
- Busca todas as mensagens desde a primeira
- Agrupa por data (dd/mm/yyyy)
- Retorna array ordenado cronologicamente

---

## Diagrama de Fluxo

```text
+---------------------------+
|   TotalUsersCard          |
|   +-------------------+   |
|   | Inativos (7d): X  |   | -> [Botao Download]
|   +-------------------+   |        |
+---------------------------+        v
                              +------------------+
                              | Modal Exportacao |
                              | - Preview qtd    |
                              | - Botao CSV      |
                              +------------------+
                                     |
                                     v
                              +------------------+
                              | Edge Function    |
                              | export-inactive  |
                              +------------------+
```

```text
+---------------------------+
|   ActivityChart           |
|   [Semana][Hoje][Total]   |  <- Nova opcao
+---------------------------+
        |
        v (mode="total")
+---------------------------+
| Edge Function             |
| analytics-activity        |
| - Agrupa por dia          |
| - Desde primeiro registro |
+---------------------------+
```

---

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `supabase/functions/analytics-export-inactive/index.ts` | Criar | Edge function para exportar inativos |
| `supabase/config.toml` | Modificar | Adicionar config da nova funcao |
| `src/components/analytics/TotalUsersCard.tsx` | Modificar | Adicionar botao de exportar |
| `src/components/analytics/InactiveUsersExportButton.tsx` | Criar | Componente do modal de exportacao |
| `src/components/analytics/ActivityChart.tsx` | Modificar | Adicionar opcao "Total" |
| `supabase/functions/analytics-activity/index.ts` | Modificar | Suportar modo "total" |

---

## Detalhes Tecnicos

### Edge Function `analytics-export-inactive`
```
Logica:
1. Buscar todos auth.users (paginado)
2. Buscar mensagens dos ultimos 7 dias
3. Buscar preferencias atualizadas nos ultimos 7 dias  
4. Buscar favoritos dos ultimos 7 dias
5. Identificar users que NAO aparecem em nenhum dos 3 sets
6. Enriquecer com: profile, preferences, funnel stage
7. Retornar CSV-ready data
```

### Edge Function `analytics-activity` (modo total)
```
Logica:
1. Buscar TODAS as mensagens (paginado)
2. Identificar data da primeira mensagem
3. Criar map de todas as datas ate hoje
4. Agregar mensagens e usuarios unicos por dia
5. Retornar array ordenado cronologicamente
```

### Formato CSV Inativos
```
Nome, Telefone, Cidade, Curso, Etapa do Funil, Data de Cadastro
```

