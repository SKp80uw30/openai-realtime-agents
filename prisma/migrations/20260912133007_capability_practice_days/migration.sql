-- CreateTable
CREATE TABLE "CapabilityPracticeDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "uses" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CapabilityPracticeDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CapabilityPracticeDay_userId_groupId_day_idx" ON "CapabilityPracticeDay"("userId", "groupId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "CapabilityPracticeDay_userId_groupId_day_key" ON "CapabilityPracticeDay"("userId", "groupId", "day");

-- AddForeignKey
ALTER TABLE "CapabilityPracticeDay" ADD CONSTRAINT "CapabilityPracticeDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapabilityPracticeDay" ADD CONSTRAINT "CapabilityPracticeDay_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CapabilityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
