
# Plano: Exportação CSV dos Power Users

## Objetivo
Adicionar um botão de exportação CSV no modal de Power Users, permitindo baixar a lista completa com informações detalhadas de cada usuário recorrente.

## Campos do CSV
O arquivo exportado incluirá:
- **Nome** - Nome completo do usuário
- **Telefone** - Número formatado (XX) XXXXX-XXXX
- **Cidade de Residência** - Cidade informada no perfil
- **Local de Interesse** - Preferência de localização para estudo
- **Curso de Interesse** - Cursos selecionados
- **Etapa do Funil** - Estágio atual no funil de conversão
- **Favoritos** - Quantidade de itens salvos
- **Total de Acessos** - Número de sessões (critério de Power User)

## Alterações Necessárias

### 1. Nova Edge Function: `analytics-power-users-export`
Criar uma função dedicada que:
- Busca todos os Power Users usando o mesmo critério da `analytics-stats` (2+ sessões com gap de 30 min)
- Enriquece os dados com informações de `user_profiles`, `user_preferences`, `user_favorites`
- Recupera telefones via Auth Admin API
- Determina a etapa do funil de cada usuário
- Retorna dados formatados para CSV

### 2. Atualização do `PowerUsersCard.tsx`
- Adicionar botão de exportação no header do modal
- Implementar função de geração do CSV com BOM para compatibilidade Excel
- Mostrar estado de loading durante exportação
- Feedback via toast de sucesso/erro

### 3. Configuração do Supabase
- Registrar a nova função em `supabase/config.toml` com `verify_jwt = false`

## Detalhes Técnicos

A lógica de identificação de Power Users será replicada da `analytics-stats`:
1. Buscar todas as mensagens com paginação
2. Agrupar por usuário e ordenar timestamps
3. Calcular sessões usando gap de 30 minutos entre mensagens
4. Filtrar usuários com 2+ sessões
5. Enriquecer com dados de perfil, preferências e favoritos
6. Ordenar por quantidade de sessões (decrescente)
