-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "includeAnswers" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Webhook_formId_idx" ON "Webhook"("formId");

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
