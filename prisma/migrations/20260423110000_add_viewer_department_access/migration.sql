-- Add viewer-to-department assignments so viewers can be scoped to one or more departments.
CREATE TABLE "ViewerDepartmentAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViewerDepartmentAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ViewerDepartmentAccess_userId_locationId_key"
ON "ViewerDepartmentAccess"("userId", "locationId");

CREATE INDEX "ViewerDepartmentAccess_userId_idx"
ON "ViewerDepartmentAccess"("userId");

CREATE INDEX "ViewerDepartmentAccess_locationId_idx"
ON "ViewerDepartmentAccess"("locationId");

ALTER TABLE "ViewerDepartmentAccess"
ADD CONSTRAINT "ViewerDepartmentAccess_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ViewerDepartmentAccess"
ADD CONSTRAINT "ViewerDepartmentAccess_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
