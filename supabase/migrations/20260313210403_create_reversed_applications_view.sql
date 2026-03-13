-- View to make it easier to query for applications with reversed text inputs
CREATE OR REPLACE VIEW reversed_student_applications AS
SELECT 
    id AS application_id, 
    user_id, 
    partner_id,
    created_at,
    -- Campos comuns que ajudam a bater o olho rápido no erro:
    answers->>'Nome Completo' AS nome_completo,
    answers->>'Nome de preferência' AS nome_preferencia,
    COALESCE(answers->>'Email candidato', answers->>'Email') AS email,
    answers->>'Profissão do pai' AS profissao_pai,
    answers->>'Nome responsável' AS nome_responsavel,
    answers AS formato_original_json
FROM student_applications
WHERE 
    -- 1. E-mails preenchidos incorretamente devido à inversão (texto extra após o ".com"). 
    (
        COALESCE(answers->>'Email candidato', answers->>'Email') ~ '@.+\.(com|br|net|org)[a-zA-Z0-9]+' 
        AND 
        COALESCE(answers->>'Email candidato', answers->>'Email') !~ '@.+\.(com|br|net|org)$'
    )
    
    -- 2. Padrão de Nomes Invertidos diretos nas chaves principais
    OR (answers->>'Nome de preferência' ~ '^[a-z].*[A-Z]$') 
    OR (answers->>'Nome Completo' ~ '^[a-z].*[A-Z]$')
    
    -- 3. Palavras comuns nas respostas que claramente estão invertidas.
    OR answers::text ILIKE ANY (ARRAY['%margatsnI%', '%ipazstahW%', '%koobecaF%', '%eniwodniL%', '%rotlucirGA%', '%oriehnegnE%'])

    -- 4. Qualquer letra Maiúscula que apareça no MEIO ou FIM de uma palavra.
    -- O regex '[a-zçáàâãéêíóôõú][A-ZÇÁÀÂÃÉÊÍÓÔÕÚ]' procura por qualquer letra 
    -- minúscula que seja seguida imediatamente por uma letra maiúscula.
    -- (Ex: "n" minúsculo seguido de "A" maiúsculo no caso de "anA").
    OR answers::text ~ '[a-zçáàâãéêíóôõú][A-ZÇÁÀÂÃÉÊÍÓÔÕÚ]';
