-- AlterTable
ALTER TABLE "condition_catalog" ADD COLUMN "normalized_name" TEXT NOT NULL DEFAULT '';

-- Backfill existing rows with a normalized key close to app-level normalization
UPDATE "condition_catalog"
SET "normalized_name" = lower(trim(
  replace(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(
                          replace(
                            replace(
                              replace(
                                replace(
                                  replace(
                                    replace(
                                      replace(
                                        replace(name, 'Á', 'A'),
                                      'É', 'E'),
                                    'Í', 'I'),
                                  'Ó', 'O'),
                                'Ú', 'U'),
                              'á', 'a'),
                            'é', 'e'),
                          'í', 'i'),
                        'ó', 'o'),
                      'ú', 'u'),
                    'Ä', 'A'),
                  'Ë', 'E'),
                'Ï', 'I'),
              'Ö', 'O'),
            'Ü', 'U'),
          'ä', 'a'),
        'ë', 'e'),
      'ï', 'i'),
    'ö', 'o'),
  'ü', 'u')
));

UPDATE "condition_catalog"
SET "normalized_name" = replace(replace(replace(replace("normalized_name", 'Ñ', 'N'), 'ñ', 'n'), '  ', ' '), '  ', ' ')
WHERE "normalized_name" IS NOT NULL;

-- Enforce uniqueness at database level
CREATE UNIQUE INDEX "condition_catalog_normalized_name_key" ON "condition_catalog"("normalized_name");
