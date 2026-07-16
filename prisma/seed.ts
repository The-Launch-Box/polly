import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, QuestionType } from "../src/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const form = await prisma.form.upsert({
    where: { slug: "claude-comfort" },
    update: {
      title: "How comfortable with Claude are you?",
      description:
        "A quick internal survey about your experience with Claude.",
    },
    create: {
      slug: "claude-comfort",
      title: "How comfortable with Claude are you?",
      description:
        "A quick internal survey about your experience with Claude.",
      questions: {
        create: [
          {
            order: 1,
            type: QuestionType.SCALE,
            prompt: "How comfortable are you using Claude?",
            required: true,
            options: {
              min: 1,
              max: 5,
              minLabel: "Not comfortable",
              maxLabel: "Very comfortable",
            },
          },
          {
            order: 2,
            type: QuestionType.SINGLE_CHOICE,
            prompt: "How often do you use Claude?",
            required: true,
            options: {
              choices: [
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
                { value: "rarely", label: "Rarely" },
                { value: "never", label: "Never" },
              ],
            },
          },
          {
            order: 3,
            type: QuestionType.SINGLE_CHOICE,
            prompt: "What is your primary use of Claude?",
            required: true,
            options: {
              choices: [
                { value: "coding", label: "Coding & development" },
                { value: "writing", label: "Writing & content" },
                { value: "research", label: "Research & analysis" },
                { value: "brainstorming", label: "Brainstorming & ideation" },
                { value: "other", label: "Other" },
              ],
            },
          },
          {
            order: 4,
            type: QuestionType.SCALE,
            prompt:
              "How confident are you explaining Claude's capabilities to a colleague?",
            required: true,
            options: {
              min: 1,
              max: 5,
              minLabel: "Not confident",
              maxLabel: "Very confident",
            },
          },
          {
            order: 5,
            type: QuestionType.SHORT_TEXT,
            prompt:
              "Anything else you'd like to share about your experience? (optional)",
            required: false,
            options: {
              placeholder: "Your thoughts...",
              maxLength: 500,
            },
          },
        ],
      },
    },
  });

  console.log(`Seeded form: ${form.slug} (${form.id})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
