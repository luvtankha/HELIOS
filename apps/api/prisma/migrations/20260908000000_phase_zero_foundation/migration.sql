-- Phase 0 uses one non-sensitive system entity to validate migration and connectivity infrastructure.
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");
