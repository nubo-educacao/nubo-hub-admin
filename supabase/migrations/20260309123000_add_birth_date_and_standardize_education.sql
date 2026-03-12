-- Add birth_date column and standardize education data
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Standardize education values
UPDATE user_profiles
SET education = CASE 
    WHEN education ILIKE 'Ensino Medio Completo' THEN 'Ensino Médio Completo'
    WHEN education ILIKE 'Superior Completo' THEN 'Ensino Superior Completo'
    WHEN education ILIKE 'Pós-graduação' THEN 'Pós-Gradução'
    WHEN education ILIKE 'Ensino Medio Incompleto' THEN 'Ensino Médio Incompleto'
    WHEN education ILIKE 'Superior Incompleto' THEN 'Ensino Superior Incompleto'
    ELSE education
END;

-- Default education_year to N/A where it's missing
UPDATE user_profiles
SET education_year = 'N/A'
WHERE education_year IS NULL OR education_year = '';
