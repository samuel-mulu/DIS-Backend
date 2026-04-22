-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_isActive_createdAt_idx" ON "User"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "Medication_updatedAt_idx" ON "Medication"("updatedAt");

-- CreateIndex
CREATE INDEX "Medication_locationId_status_updatedAt_idx" ON "Medication"("locationId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "StatusHistory_medicationId_changedAt_idx" ON "StatusHistory"("medicationId", "changedAt");
