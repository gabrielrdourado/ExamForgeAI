import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  AnswerMap,
  Exam,
  ExamConfig,
  ExtractFileResponse,
  FinalScoreResult,
  OpenAnswerGrade,
} from './studyforge.types';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly baseUrl = 'http://localhost:3000';

  constructor(private readonly http: HttpClient) {}

  extractFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<ExtractFileResponse>(`${this.baseUrl}/files/extract`, formData);
  }

  buildExamPrompt(extractedText: string, config: ExamConfig) {
    return this.http.post<{ prompt: string }>(`${this.baseUrl}/manual/build-exam-prompt`, {
      extractedText,
      config,
    });
  }

  validateExamJson(rawJson: string) {
    return this.http.post<{ exam: Exam }>(`${this.baseUrl}/manual/validate-exam-json`, {
      rawJson,
    });
  }

  buildGradingPrompt(exam: Exam, answers: AnswerMap) {
    return this.http.post<{ prompt: string }>(`${this.baseUrl}/manual/build-grading-prompt`, {
      exam,
      answers,
    });
  }

  validateGradingJson(rawJson: string, exam: Exam) {
    return this.http.post<{ items: OpenAnswerGrade[] }>(
      `${this.baseUrl}/manual/validate-grading-json`,
      {
        rawJson,
        exam,
      },
    );
  }

  generateExamWithGemini(apiKey: string, extractedText: string, config: ExamConfig) {
    return this.http.post<{ exam: Exam }>(`${this.baseUrl}/gemini/generate-exam`, {
      apiKey,
      extractedText,
      config,
    });
  }

  gradeOpenAnswersWithGemini(apiKey: string, exam: Exam, answers: AnswerMap) {
    return this.http.post<{ items: OpenAnswerGrade[] }>(
      `${this.baseUrl}/gemini/grade-open-answers`,
      {
        apiKey,
        exam,
        answers,
      },
    );
  }

  calculateFinalScore(exam: Exam, answers: AnswerMap, openEndedGrades: OpenAnswerGrade[]) {
    return this.http.post<FinalScoreResult>(`${this.baseUrl}/grade/final-score`, {
      exam,
      answers,
      openEndedGrades,
    });
  }
}
