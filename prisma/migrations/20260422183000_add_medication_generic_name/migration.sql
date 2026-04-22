ALTER TABLE "Medication"
ADD COLUMN "genericName" TEXT NOT NULL DEFAULT '';

CREATE INDEX "Medication_genericName_idx" ON "Medication"("genericName");
