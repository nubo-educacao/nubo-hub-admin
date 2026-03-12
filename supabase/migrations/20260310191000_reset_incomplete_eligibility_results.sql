-- Migration: Reset incomplete eligibility_results to force recalculation
-- These 10 users had their eligibility calculated by the old RPC that silently dropped partners.
-- Setting to NULL forces ProgramMatchSection to call the new RPC on next visit.
--
-- Affected users:
-- 1. Laura Lopes Guercio        (26e1b569) - only Fundação Estudar
-- 2. Eva Mirelly Barbosa Ramos  (81d011e6) - only Instituto Ponte
-- 3. Rafaela Lorany De O. Pires (b0f90141) - only Instituto Sol
-- 4. Hevany Cristina P. Andrade (0874c5bd) - only Instituto Sol
-- 5. Catharina De Sousa Almeida (c2d2ba96) - only Instituto Ponte
-- 6. Milena Maria Vieira Silva  (3062b376) - only Instituto Ponte
-- 7. Gabriela Torrezin          (4b11b3af) - only Instituto Sol
-- 8. Evellyn Vieira Galvão      (744b3d69) - only Instituto Sol
-- 9. Stefany Caroliny A. Silva  (f83bc499) - only Instituto Ponte
-- 10. Ana Beatriz Albuquerque   (4d996ae9) - only Instituto Ponte

UPDATE user_profiles
SET eligibility_results = NULL
WHERE eligibility_results IS NOT NULL
  AND jsonb_array_length(eligibility_results::jsonb) < (
    SELECT COUNT(*) FROM partners
  );
