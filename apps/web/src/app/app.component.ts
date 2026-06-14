import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from './api.service';
import {
  AiMode,
  AnswerMap,
  Exam,
  ExamConfig,
  ExamQuestion,
  ExtractFileResponse,
  FinalScoreResult,
  OpenAnswerGrade,
} from './studyforge.types';

type Screen =
  | 'setup'
  | 'manual'
  | 'gemini'
  | 'ready'
  | 'exam'
  | 'manual-grading'
  | 'result';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnDestroy {
  readonly defaultConfig: ExamConfig = {
    language: 'en',
    numberOfQuestions: 10,
    questionType: 'mixed',
    difficulty: 'medium',
    timeLimitEnabled: true,
    timeLimitMinutes: 30,
    knowledgeScope: 'strict',
  };

  screen: Screen = 'setup';
  config: ExamConfig = { ...this.defaultConfig };
  selectedFile: File | null = null;
  extractedFile: ExtractFileResponse | null = null;
  extractedText = '';
  aiMode: AiMode | null = null;
  apiKey = '';
  manualExamPrompt = '';
  manualExamJson = '';
  manualGradingPrompt = '';
  manualGradingJson = '';
  exam: Exam | null = null;
  answers: AnswerMap = {};
  result: FinalScoreResult | null = null;
  loading = '';
  error = '';
  copyStatus = '';
  startedAt = 0;
  elapsedSeconds = 0;
  remainingSeconds = 0;

  private timerId: number | null = null;

  constructor(private readonly api: ApiService) {}

  ngOnDestroy(): void {
    this.clearTimer();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
    this.error = '';
  }

  async chooseMode(mode: AiMode): Promise<void> {
    this.aiMode = mode;
    this.error = '';
    this.selectedFile = null;
    this.extractedFile = null;
    this.extractedText = '';

    if (mode === 'manual') {
      const response = await this.runAction('Building manual prompt...', () =>
        this.api.buildExamPrompt('', this.config).toPromise(),
      );

      if (response) {
        this.manualExamPrompt = response.prompt;
        this.screen = 'manual';
      }

      return;
    }

    this.screen = 'gemini';
  }

  async importManualExam(): Promise<void> {
    const response = await this.runAction('Validating exam JSON...', () =>
      this.api.validateExamJson(this.manualExamJson).toPromise(),
    );

    if (response) {
      this.setExam(response.exam);
    }
  }

  async generateWithGemini(): Promise<void> {
    if (!this.apiKey.trim()) {
      this.error = 'Enter a Gemini API key.';
      return;
    }

    if (!this.selectedFile) {
      this.error = 'Choose a study file for Gemini API Mode.';
      return;
    }

    const extracted = await this.runAction('Extracting file text...', () =>
      this.api.extractFile(this.selectedFile as File).toPromise(),
    );

    if (!extracted) {
      return;
    }

    this.extractedFile = extracted;
    this.extractedText = extracted.text;

    const response = await this.runAction('Generating exam with Gemini...', () =>
      this.api.generateExamWithGemini(this.apiKey, extracted.text, this.config).toPromise(),
    );

    if (response) {
      this.setExam(response.exam);
    }
  }

  startExam(): void {
    if (!this.exam) {
      return;
    }

    this.startedAt = Date.now();
    this.elapsedSeconds = 0;
    this.remainingSeconds = this.exam.timeLimitEnabled ? this.exam.timeLimitMinutes * 60 : 0;
    this.screen = 'exam';
    this.clearTimer();
    this.timerId = window.setInterval(() => this.tickTimer(), 1000);
  }

  async finishExam(): Promise<void> {
    if (!this.exam || this.loading) {
      return;
    }

    this.tickTimer();
    this.clearTimer();

    if (this.hasOpenEndedQuestions()) {
      if (this.aiMode === 'manual') {
        const response = await this.runAction('Building grading prompt...', () =>
          this.api.buildGradingPrompt(this.exam as Exam, this.answers).toPromise(),
        );

        if (response) {
          this.manualGradingPrompt = response.prompt;
          this.screen = 'manual-grading';
        }

        return;
      }

      const grading = await this.runAction('Grading open-ended answers...', () =>
        this.api
          .gradeOpenAnswersWithGemini(this.apiKey, this.exam as Exam, this.answers)
          .toPromise(),
      );

      if (!grading) {
        return;
      }

      await this.calculateFinalScore(grading.items);
      return;
    }

    await this.calculateFinalScore([]);
  }

  async importManualGrading(): Promise<void> {
    if (!this.exam) {
      return;
    }

    const response = await this.runAction('Validating grading JSON...', () =>
      this.api.validateGradingJson(this.manualGradingJson, this.exam as Exam).toPromise(),
    );

    if (response) {
      await this.calculateFinalScore(response.items);
    }
  }

  async copyToClipboard(value: string): Promise<void> {
    await navigator.clipboard.writeText(value);
    this.copyStatus = 'Copied';
    window.setTimeout(() => {
      this.copyStatus = '';
    }, 1400);
  }

  reset(): void {
    this.clearTimer();
    this.screen = 'setup';
    this.config = { ...this.defaultConfig };
    this.selectedFile = null;
    this.extractedFile = null;
    this.extractedText = '';
    this.aiMode = null;
    this.apiKey = '';
    this.manualExamPrompt = '';
    this.manualExamJson = '';
    this.manualGradingPrompt = '';
    this.manualGradingJson = '';
    this.exam = null;
    this.answers = {};
    this.result = null;
    this.loading = '';
    this.error = '';
    this.copyStatus = '';
    this.startedAt = 0;
    this.elapsedSeconds = 0;
    this.remainingSeconds = 0;
  }

  setAnswer(questionId: string, value: string): void {
    this.answers = {
      ...this.answers,
      [questionId]: value,
    };
  }

  answerFor(questionId: string): string {
    return this.answers[questionId] ?? '';
  }

  answeredCount(): number {
    return Object.values(this.answers).filter((answer) => answer.trim().length > 0).length;
  }

  answerProgressPercent(): number {
    if (!this.exam?.questions.length) {
      return 0;
    }

    return Math.round((this.answeredCount() / this.exam.questions.length) * 100);
  }

  formatClock(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      const minutesRemainder = minutes % 60;
      return `${hours}:${minutesRemainder.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}`;
    }

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours} hr ${minutes} min`;
    }

    if (minutes > 0) {
      return `${minutes} min ${seconds.toString().padStart(2, '0')} sec`;
    }

    return `${seconds} sec`;
  }

  formatMinutes(minutes: number): string {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  }

  knowledgeScopeLabel(): string {
    return this.config.knowledgeScope === 'expanded' ? 'Expanded theme' : 'Strict file';
  }

  statusLabel(status: string): string {
    return status.replace('_', ' ');
  }

  trackQuestion(_: number, question: ExamQuestion): string {
    return question.id;
  }

  private setExam(exam: Exam): void {
    this.exam = {
      ...exam,
      timeLimitEnabled: this.config.timeLimitEnabled,
      timeLimitMinutes: this.config.timeLimitMinutes,
    };
    this.answers = {};
    this.result = null;
    this.manualGradingJson = '';
    this.manualGradingPrompt = '';
    this.screen = 'ready';
  }

  private hasOpenEndedQuestions(): boolean {
    return this.exam?.questions.some((question) => question.type === 'open_ended') ?? false;
  }

  private async calculateFinalScore(openEndedGrades: OpenAnswerGrade[]): Promise<void> {
    if (!this.exam) {
      return;
    }

    const response = await this.runAction('Calculating score...', () =>
      this.api
        .calculateFinalScore(this.exam as Exam, this.answers, openEndedGrades)
        .toPromise(),
    );

    if (response) {
      this.result = response;
      this.screen = 'result';
    }
  }

  private tickTimer(): void {
    if (!this.startedAt || !this.exam) {
      return;
    }

    this.elapsedSeconds = Math.floor((Date.now() - this.startedAt) / 1000);

    if (!this.exam.timeLimitEnabled) {
      this.remainingSeconds = 0;
      return;
    }

    this.remainingSeconds = Math.max(0, this.exam.timeLimitMinutes * 60 - this.elapsedSeconds);

    if (this.remainingSeconds === 0) {
      void this.finishExam();
    }
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private async runAction<T>(label: string, action: () => Promise<T>): Promise<T | null> {
    this.loading = label;
    this.error = '';

    try {
      return await action();
    } catch (error) {
      this.error = this.readError(error);
      return null;
    } finally {
      this.loading = '';
    }
  }

  private readError(error: unknown): string {
    if (typeof error === 'object' && error && 'error' in error) {
      const body = (error as { error?: { message?: string | string[] } }).error;
      const message = body?.message;

      if (Array.isArray(message)) {
        return message.join(' ');
      }

      if (message) {
        return message;
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Something went wrong.';
  }
}
