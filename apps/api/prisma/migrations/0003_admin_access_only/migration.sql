-- Courses are no longer sold: access is granted only by admins, directly or by approving a
-- student's access request. Drops orders, payments and course prices; adds AccessRequest.
-- Contract step taken in one go on purpose: no deployed environment has payment data yet
-- (see docs/DECISIONS.md, 2026-11-24).

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
BEGIN;
CREATE TYPE "EnrollmentSource_new" AS ENUM ('ADMIN', 'ACCESS_REQUEST');
ALTER TABLE "Enrollment" ALTER COLUMN "source" TYPE "EnrollmentSource_new" USING (
  CASE "source"::text
    -- Purchased and free self-enrolments become admin-granted access (payments are gone).
    WHEN 'PURCHASE' THEN 'ADMIN'
    WHEN 'FREE' THEN 'ADMIN'
    ELSE "source"::text
  END::"EnrollmentSource_new"
);
ALTER TYPE "EnrollmentSource" RENAME TO "EnrollmentSource_old";
ALTER TYPE "EnrollmentSource_new" RENAME TO "EnrollmentSource";
DROP TYPE "public"."EnrollmentSource_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('ACCESS_GRANTED', 'ACCESS_REJECTED', 'CERTIFICATE_ISSUED', 'SYSTEM');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING (
  CASE "type"::text
    -- Old "payment received" notifications stay readable as plain system notifications.
    WHEN 'PAYMENT_SUCCESS' THEN 'SYSTEM'
    ELSE "type"::text
  END::"NotificationType_new"
);
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "public"."NotificationType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_orderId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_courseId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_userId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_orderId_fkey";

-- DropIndex
DROP INDEX "Enrollment_orderId_key";

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "currency",
DROP COLUMN "isFree",
DROP COLUMN "price";

-- AlterTable
ALTER TABLE "Enrollment" DROP COLUMN "orderId";

-- DropTable
DROP TABLE "Order";

-- DropTable
DROP TABLE "Payment";

-- DropEnum
DROP TYPE "PaymentProvider";

-- DropEnum
DROP TYPE "PaymentStatus";

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "decisionReason" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessRequest_status_createdAt_idx" ON "AccessRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AccessRequest_courseId_idx" ON "AccessRequest"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_userId_courseId_key" ON "AccessRequest"("userId", "courseId");

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Payment settings are gone (unknown keys are ignored anyway; this keeps the table clean).
DELETE FROM "Setting" WHERE "key" IN ('orderTtlMinutes', 'refundPolicy');
