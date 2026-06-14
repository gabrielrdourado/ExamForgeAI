export type ExamLanguage = 'en' | 'pt-BR';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type RequestedQuestionType = 'multiple_choice' | 'open_ended' | 'mixed';
export type QuestionKind = 'multiple_choice' | 'open_ended';
export type GradeStatus = 'correct' | 'partially_correct' | 'wrong';
export type KnowledgeScope = 'strict' | 'expanded';

export interface ExamConfig {
  language: ExamLanguage;
  numberOfQuestions: number;
  questionType: RequestedQuestionType;
  difficulty: Difficulty;
  timeLimitEnabled: boolean;
  timeLimitMinutes: number;
  knowledgeScope: KnowledgeScope;
}

export interface QuestionOption {
  id: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface ExamQuestion {
  id: string;
  type: QuestionKind;
  question: string;
  points: number;
  topic: string;
  options?: QuestionOption[];
  correctOptionId?: 'A' | 'B' | 'C' | 'D';
  expectedAnswer?: string;
  rubric?: string;
  explanation: string;
}

export interface Exam {
  title: string;
  description: string;
  language: ExamLanguage;
  difficulty: Difficulty;
  timeLimitEnabled: boolean;
  timeLimitMinutes: number;
  questions: ExamQuestion[];
}

export type AnswerMap = Record<string, string>;

export interface OpenAnswerGrade {
  questionId: string;
  score: number;
  maxPoints: number;
  status: GradeStatus;
  feedback: string;
}

export interface QuestionReview {
  questionId: string;
  question: string;
  type: QuestionKind;
  topic: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  feedback: string;
  status: GradeStatus;
  earnedPoints: number;
  maxPoints: number;
}

export interface FinalScoreResult {
  finalScore: number;
  earnedPoints: number;
  possiblePoints: number;
  totalQuestions: number;
  correctQuestions: number;
  wrongQuestions: number;
  partiallyCorrectQuestions: number;
  review: QuestionReview[];
}
