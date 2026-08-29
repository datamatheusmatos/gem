-- Migração 0003 — adiciona a flag de onboarding concluído.
-- Necessária para o assistente de primeira configuração (seção 58) saber se
-- deve aparecer no próximo login ou não.

ALTER TABLE user_settings ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0;
