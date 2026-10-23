UPDATE "agents"
SET "appearance" = jsonb_set("appearance", '{characterVersion}', '"photo-v1"', true)
WHERE "appearance" IS NOT NULL
  AND "appearance"->>'characterVersion' = 'cap-v1';
