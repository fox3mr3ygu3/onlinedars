-- Course intro video + free preview lessons (additive only: safe to roll back the app).
ALTER TABLE "Course" ADD COLUMN "introVideoUrl" TEXT;
ALTER TABLE "Lesson" ADD COLUMN "isPreview" BOOLEAN NOT NULL DEFAULT false;
