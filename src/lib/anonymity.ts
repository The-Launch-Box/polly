import { QuestionType } from "@prisma/client";
import type { NpsAnswer } from "@/lib/types";
import { isNpsAnswer } from "@/lib/types";

export type AnonymousAnswerInput = {
  questionId: string;
  value: unknown;
  durationMs?: number;
};

export type AnonymousSubmitBody = {
  answers: AnonymousAnswerInput[];
  totalDurationMs?: number;
};

/** Strip timing metadata that can fingerprint respondents. */
export function stripSubmissionTiming(
  body: AnonymousSubmitBody,
  anonymous: boolean,
): AnonymousSubmitBody {
  if (!anonymous) {
    return body;
  }

  return {
    answers: body.answers.map((answer) => ({
      questionId: answer.questionId,
      value: answer.value,
    })),
  };
}

/** Remove system-linked or voluntarily collected identity fields for anonymous surveys. */
export function sanitizeAnswerValueForAnonymous(
  type: QuestionType,
  value: unknown,
): unknown {
  if (type === QuestionType.NPS && isNpsAnswer(value)) {
    const answer = value as NpsAnswer;
    return {
      score: answer.score,
      path: answer.path,
      ...(answer.followUpText?.trim()
        ? { followUpText: answer.followUpText.trim() }
        : {}),
    };
  }

  return value;
}
