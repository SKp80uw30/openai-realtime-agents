-- AlterTable
ALTER TABLE "OnboardingProgress" ADD COLUMN     "lastActiveDate" TIMESTAMP(3),
ADD COLUMN     "streakDays" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "UserCapabilityProgress" ADD COLUMN     "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "useCount" INTEGER NOT NULL DEFAULT 1;

