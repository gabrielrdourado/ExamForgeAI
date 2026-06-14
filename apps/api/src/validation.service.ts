import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Difficulty,
  Exam,
  ExamConfig,
  ExamLanguage,
  GradeStatus,
  OpenAnswerGrade,
  QuestionKind,
  QuestionOption,
  RequestedQuestionType,
} from './types';

const languages: ExamLanguage[] = ['en', 'pt-BR'];
const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
const requestedQuestionTypes: RequestedQuestionType[] = [
  'multiple_choice',
  'open_ended',
  'mixed',
];
const questionKinds: QuestionKind[] = ['multiple_choice', 'open_ended'];
const gradeStatuses: GradeStatus[] = ['correct', 'partially_correct', 'wrong'];
const optionIds = ['A', 'B', 'C', 'D'] as const;

@Injectable()
export class ValidationService {
  validateConfig(input: unknown): ExamConfig {
    const config = this.requireObject(input, 'Exam config is required.');
    const language = this.requireString(config.language, 'Exam language is required.');
    const difficulty = this.requireString(config.difficulty, 'Difficulty is required.');
    const questionType = this.requireString(config.questionType, 'Question type is required.');
    const numberOfQuestions = Number(config.numberOfQuestions);
    const timeLimitMinutes = Number(config.timeLimitMinutes);

    if (!languages.includes(language as ExamLanguage)) {
      throw new BadRequestException('Exam language must be en or pt-BR.');
    }

    if (!difficulties.includes(difficulty as Difficulty)) {
      throw new BadRequestException('Difficulty must be easy, medium, or hard.');
    }

    if (!requestedQuestionTypes.includes(questionType as RequestedQuestionType)) {
      throw new BadRequestException('Question type must be multiple_choice, open_ended, or mixed.');
    }

    if (!Number.isInteger(numberOfQuestions) || numberOfQuestions < 1 || numberOfQuestions > 100) {
      throw new BadRequestException('Number of questions must be between 1 and 100.');
    }

    if (!Number.isInteger(timeLimitMinutes) || timeLimitMinutes < 1 || timeLimitMinutes > 240) {
      throw new BadRequestException('Time limit must be between 1 and 240 minutes.');
    }

    return {
      language: language as ExamLanguage,
      difficulty: difficulty as Difficulty,
      questionType: questionType as RequestedQuestionType,
      numberOfQuestions,
      timeLimitMinutes,
    };
  }

  parseExamJson(raw: unknown): Exam {
    return this.validateExam(this.parseJsonLike(raw, 'Exam JSON is required.'));
  }

  validateExam(input: unknown): Exam {
    const exam = this.requireObject(input, 'Exam JSON must be an object.');
    const questions = Array.isArray(exam.questions) ? exam.questions : null;

    if (!questions?.length) {
      throw new BadRequestException('Exam JSON must include at least one question.');
    }

    const language = this.requireString(exam.language, 'Exam language is required.');
    const difficulty = this.requireString(exam.difficulty, 'Exam difficulty is required.');
    const timeLimitMinutes = Number(exam.timeLimitMinutes);

    if (!languages.includes(language as ExamLanguage)) {
      throw new BadRequestException('Exam language must be en or pt-BR.');
    }

    if (!difficulties.includes(difficulty as Difficulty)) {
      throw new BadRequestException('Exam difficulty must be easy, medium, or hard.');
    }

    if (!Number.isFinite(timeLimitMinutes) || timeLimitMinutes <= 0) {
      throw new BadRequestException('Exam timeLimitMinutes must be a positive number.');
    }

    return {
      title: this.requireString(exam.title, 'Exam title is required.'),
      description: this.requireString(exam.description, 'Exam description is required.'),
      language: language as ExamLanguage,
      difficulty: difficulty as Difficulty,
      timeLimitMinutes,
      questions: questions.map((question, index) => this.validateQuestion(question, index)),
    };
  }

  parseGradingJson(raw: unknown, exam?: Exam): OpenAnswerGrade[] {
    const parsed = this.parseJsonLike(raw, 'Grading JSON is required.');
    return this.validateGradingJson(parsed, exam);
  }

  validateGradingJson(input: unknown, exam?: Exam): OpenAnswerGrade[] {
    const grading = this.requireObject(input, 'Grading JSON must be an object.');
    const items = Array.isArray(grading.items) ? grading.items : null;

    if (!items) {
      throw new BadRequestException('Grading JSON must include an items array.');
    }

    const allowedQuestionIds = new Set(
      exam?.questions.filter((question) => question.type === 'open_ended').map((question) => question.id),
    );

    return items.map((item, index) => {
      const grade = this.requireObject(item, `Grading item ${index + 1} must be an object.`);
      const questionId = this.requireString(grade.questionId, `Grading item ${index + 1} needs questionId.`);
      const status = this.requireString(grade.status, `Grading item ${index + 1} needs status.`);
      const score = Number(grade.score);
      const maxPoints = Number(grade.maxPoints);

      if (exam && !allowedQuestionIds.has(questionId)) {
        throw new BadRequestException(`Grading item ${index + 1} references an unknown open-ended question.`);
      }

      if (!gradeStatuses.includes(status as GradeStatus)) {
        throw new BadRequestException(`Grading item ${index + 1} has an invalid status.`);
      }

      if (!Number.isFinite(score) || score < 0) {
        throw new BadRequestException(`Grading item ${index + 1} score must be zero or greater.`);
      }

      if (!Number.isFinite(maxPoints) || maxPoints <= 0) {
        throw new BadRequestException(`Grading item ${index + 1} maxPoints must be positive.`);
      }

      if (score > maxPoints) {
        throw new BadRequestException(`Grading item ${index + 1} score cannot exceed maxPoints.`);
      }

      return {
        questionId,
        score,
        maxPoints,
        status: status as GradeStatus,
        feedback: this.requireString(grade.feedback, `Grading item ${index + 1} needs feedback.`),
      };
    });
  }

  private validateQuestion(input: unknown, index: number) {
    const question = this.requireObject(input, `Question ${index + 1} must be an object.`);
    const type = this.requireString(question.type, `Question ${index + 1} needs type.`);
    const points = Number(question.points);

    if (!questionKinds.includes(type as QuestionKind)) {
      throw new BadRequestException(`Question ${index + 1} type must be multiple_choice or open_ended.`);
    }

    if (!Number.isFinite(points) || points <= 0) {
      throw new BadRequestException(`Question ${index + 1} points must be positive.`);
    }

    const base = {
      id: this.requireString(question.id, `Question ${index + 1} needs id.`),
      type: type as QuestionKind,
      question: this.requireString(question.question, `Question ${index + 1} needs question text.`),
      points,
      topic: this.requireString(question.topic, `Question ${index + 1} needs topic.`),
      explanation: this.requireString(question.explanation, `Question ${index + 1} needs explanation.`),
    };

    if (type === 'multiple_choice') {
      return {
        ...base,
        options: this.validateOptions(question.options, index),
        correctOptionId: this.validateCorrectOption(question.correctOptionId, index),
      };
    }

    return {
      ...base,
      options: [],
      expectedAnswer: this.requireString(question.expectedAnswer, `Question ${index + 1} needs expectedAnswer.`),
      rubric: this.requireString(question.rubric, `Question ${index + 1} needs rubric.`),
    };
  }

  private validateOptions(input: unknown, questionIndex: number): QuestionOption[] {
    if (!Array.isArray(input) || input.length !== 4) {
      throw new BadRequestException(`Question ${questionIndex + 1} must include exactly four options.`);
    }

    const options = input.map((option, index) => {
      const item = this.requireObject(option, `Question ${questionIndex + 1} option ${index + 1} must be an object.`);
      const id = this.requireString(item.id, `Question ${questionIndex + 1} option ${index + 1} needs id.`);

      if (!optionIds.includes(id as QuestionOption['id'])) {
        throw new BadRequestException(`Question ${questionIndex + 1} options must use IDs A, B, C, and D.`);
      }

      return {
        id: id as QuestionOption['id'],
        text: this.requireString(item.text, `Question ${questionIndex + 1} option ${id} needs text.`),
      };
    });

    const ids = options.map((option) => option.id).sort().join('');
    if (ids !== 'ABCD') {
      throw new BadRequestException(`Question ${questionIndex + 1} options must include A, B, C, and D once.`);
    }

    return options.sort((a, b) => a.id.localeCompare(b.id));
  }

  private validateCorrectOption(input: unknown, questionIndex: number): QuestionOption['id'] {
    const correctOptionId = this.requireString(input, `Question ${questionIndex + 1} needs correctOptionId.`);

    if (!optionIds.includes(correctOptionId as QuestionOption['id'])) {
      throw new BadRequestException(`Question ${questionIndex + 1} correctOptionId must be A, B, C, or D.`);
    }

    return correctOptionId as QuestionOption['id'];
  }

  private parseJsonLike(raw: unknown, errorMessage: string): unknown {
    if (typeof raw === 'object' && raw !== null) {
      return raw;
    }

    const source = this.requireString(raw, errorMessage);
    const withoutFence = source
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    const candidate = start >= 0 && end > start ? withoutFence.slice(start, end + 1) : withoutFence;

    try {
      return JSON.parse(candidate);
    } catch {
      throw new BadRequestException('The provided JSON could not be parsed.');
    }
  }

  private requireObject(input: unknown, message: string): Record<string, any> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException(message);
    }

    return input as Record<string, any>;
  }

  private requireString(input: unknown, message: string): string {
    if (typeof input !== 'string' || !input.trim()) {
      throw new BadRequestException(message);
    }

    return input.trim();
  }
}
