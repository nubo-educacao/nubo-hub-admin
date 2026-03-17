-- View para identificar aplicações de estudantes com texto invertido (bug de input)
DROP VIEW IF EXISTS reversed_student_applications;
CREATE VIEW reversed_student_applications AS
SELECT 
    sa.id AS application_id, 
    sa.user_id, 
    sa.partner_id,
    sa.status,
    sa.created_at,
    u.phone AS user_phone,
    -- Campos comuns que ajudam a bater o olho rápido no erro:
    sa.answers->>'Nome Completo' AS nome_completo,
    sa.answers->>'Nome de preferência' AS nome_preferencia,
    COALESCE(sa.answers->>'Email candidato', sa.answers->>'Email') AS email,
    sa.answers->>'Profissão do pai' AS profissao_pai,
    sa.answers->>'Nome responsável' AS nome_responsavel,
    sa.answers AS formato_original_json
FROM student_applications sa
LEFT JOIN auth.users u ON u.id = sa.user_id
WHERE 
    -- 1. E-mails preenchidos incorretamente devido à inversão (texto extra após o ".com"). 
    (
        COALESCE(sa.answers->>'Email candidato', sa.answers->>'Email') ~ '@.+\.(com|br|net|org)[a-zA-Z0-9]+' 
        AND 
        COALESCE(sa.answers->>'Email candidato', sa.answers->>'Email') !~ '@.+\.(com|br|net|org)$'
    )
    
    -- 2. Padrão de Nomes Invertidos diretos nas chaves principais
    OR (sa.answers->>'Nome de preferência' ~ '^[a-z].*[A-Z]$') 
    OR (sa.answers->>'Nome Completo' ~ '^[a-z].*[A-Z]$')
    
    -- 3. Palavras comuns nas respostas que claramente estão invertidas.
    OR sa.answers::text ILIKE ANY (ARRAY['%margatsnI%', '%ipazstahW%', '%koobecaF%', '%eniwodniL%', '%rotlucirGA%', '%oriehnegnE%'])

    -- 4. Qualquer letra Maiúscula que apareça no MEIO ou FIM de uma palavra.
    OR sa.answers::text ~ '[a-zçáàâãéêíóôõú][A-ZÇÁÀÂÃÉÊÍÓÔÕÚ]';
