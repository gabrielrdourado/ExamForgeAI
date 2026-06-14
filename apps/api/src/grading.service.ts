import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AnswerMap,
  Exam,
  FinalScoreResult,
  GradeStatus,
  OpenAnswerGrade,
  QuestionReview,
} from './types';

@Injectable()
export class GradingService {
  gradeMultipleChoice(exam: Exam, answers: AnswerMap): OpenAnswerGrade[] {
    return exam.questions
      .filter((question) => question.type === 'multiple_choice')
      .map((question) => {
        const isCorrect = answers[question.id] === question.correctOptionId;

        return {
          questionId: question.id,
          score: isCorrect ? question.points : 0,
          maxPoints: question.points,
          status: isCorrect ? 'correct' : 'wrong',
          feedback: isCorrect ? 'Correct answer.' : 'Wrong answer.',
        };
      });
  }

  calculateFinalScore(
    exam: Exam,
    answers: AnswerMap,
    openAnswerGrades: OpenAnswerGrade[] = [],
  ): FinalScoreResult {
    const multipleChoiceGrades = this.gradeMultipleChoice(exam, answers);
    const gradeByQuestionId = new Map<string, OpenAnswerGrade>();

    [...multipleChoiceGrades, ...openAnswerGrades].forEach((grade) => {
      gradeByQuestionId.set(grade.questionId, grade);
    });

    const review: QuestionReview[] = exam.questions.map((question) => {
      const grade = gradeByQuestionId.get(question.id);

      if (!grade && question.type === 'open_ended') {
        throw new BadRequestException('Open-ended grading JSON is required before final scoring.');
      }

      const earnedPoints = grade
        ? this.scaleEarnedPoints(grade.score, grade.maxPoints, question.points)
        : 0;
      const status = grade?.status ?? 'wrong';

      return {
        questionId: question.id,
        question: question.question,
        type: question.type,
        topic: question.topic,
        userAnswer: this.formatUserAnswer(exam, question.id, answers[question.id]),
        correctAnswer: this.formatCorrectAnswer(question),
        explanation: question.explanation,
        feedback: grade?.feedback ?? '',
        status,
        earnedPoints: this.roundOne(earnedPoints),
        maxPoints: question.points,
      };
    });

    const earnedPoints = review.reduce((total, item) => total + item.earnedPoints, 0);
    const possiblePoints = exam.questions.reduce((total, question) => total + question.points, 0);
    const finalScore = possiblePoints > 0 ? this.roundOne((earnedPoints / possiblePoints) * 10) : 0;

    return {
      finalScore,
      earnedPoints: this.roundOne(earnedPoints),
      possiblePoints: this.roundOne(possiblePoints),
      totalQuestions: exam.questions.length,
      correctQuestions: review.filter((item) => item.status === 'correct').length,
      wrongQuestions: review.filter((item) => item.status === 'wrong').length,
      partiallyCorrectQuestions: review.filter((item) => item.status === 'partially_correct').length,
      review,
    };
  }

  private scaleEarnedPoints(score: number, maxPoints: number, questionPoints: number): number {
    if (maxPoints <= 0) {
      return 0;
    }

    return Math.min(questionPoints, Math.max(0, (score / maxPoints) * questionPoints));
  }

  private formatCorrectAnswer(question: Exam['questions'][number]): string {
    if (question.type === 'open_ended') {
      return question.expectedAnswer ?? '';
    }

    const correct = question.options?.find((option) => option.id === question.correctOptionId);
    return correct ? `${correct.id}. ${correct.text}` : question.correctOptionId ?? '';
  }

  private formatUserAnswer(exam: Exam, questionId: string, answer = ''): string {
    const question = exam.questions.find((item) => item.id === questionId);

    if (question?.type !== 'multiple_choice') {
      return answer;
    }

    const option = question.options?.find((item) => item.id === answer);
    return option ? `${option.id}. ${option.text}` : answer;
  }

  private roundOne(value: number): number {
    return Math.round(value * 10) / 10;
  }
}
