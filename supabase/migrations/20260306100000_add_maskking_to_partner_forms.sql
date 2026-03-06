-- Add maskking column to partner_forms
ALTER TABLE partner_forms ADD COLUMN maskking text;

-- Add comment for documentation
COMMENT ON COLUMN partner_forms.maskking IS 'Input mask and validation type: cpf, cnpj, phone, cep, brl, email, date, number';
