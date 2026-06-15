import { Injectable } from '@angular/core';
import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';
import { from, Observable } from 'rxjs';
import {
  AnswerMap,
  Difficulty,
  Exam,
  ExamConfig,
  ExamLanguage,
  ExtractFileResponse,
  FinalScoreResult,
  GradeStatus,
  KnowledgeScope,
  OpenAnswerGrade,
  QuestionKind,
  QuestionOption,
  QuestionReview,
  RequestedQuestionType,
} from './studyforge.types';

const MAX_STUDY_TEXT_CHARS = 60000;
const GEMINI_MODEL = 'gemini-3.5-flash';
const supportedExtensions = ['.txt', '.md', '.pdf', '.pptx'];
const languages: ExamLanguage[] = ['en', 'pt-BR'];
const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
const requestedQuestionTypes: RequestedQuestionType[] = [
  'multiple_choice',
  'open_ended',
  'mixed',
];
const questionKinds: QuestionKind[] = ['multiple_choice', 'open_ended'];
const gradeStatuses: GradeStatus[] = ['correct', 'partially_correct', 'wrong'];
const knowledgeScopes: KnowledgeScope[] = ['strict', 'expanded'];
const optionIds = ['A', 'B', 'C', 'D'] as const;

interface GeminiResponsePart {
  text?: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiResponsePart[];
    };
  }>;
  error?: {
    message?: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
  });

  extractFile(file: File): Observable<ExtractFileResponse> {
    return from(this.extractFileText(file));
  }

  buildExamPrompt(extractedText: string, config: ExamConfig): Observable<{ prompt: string }> {
    return from(
      Promise.resolve({
        prompt: this.buildExamPromptText(extractedText, this.validateConfig(config)),
      }),
    );
  }

  validateExamJson(rawJson: string): Observable<{ exam: Exam }> {
    return from(
      Promise.resolve({
        exam: this.parseExamJson(rawJson),
      }),
    );
  }

  buildGradingPrompt(exam: Exam, answers: AnswerMap): Observable<{ prompt: string }> {
    return from(
      Promise.resolve({
        prompt: this.buildGradingPromptText(this.validateExam(exam), answers),
      }),
    );
  }

  validateGradingJson(rawJson: string, exam: Exam): Observable<{ items: OpenAnswerGrade[] }> {
    return from(
      Promise.resolve({
        items: this.parseGradingJson(rawJson, this.validateExam(exam)),
      }),
    );
  }

  generateExamWithGemini(
    apiKey: string,
    extractedText: string,
    config: ExamConfig,
  ): Observable<{ exam: Exam }> {
    return from(
      this.generateJson(apiKey, this.buildExamPromptText(extractedText, this.validateConfig(config))).then(
        (rawExamJson) => ({
          exam: this.parseExamJson(rawExamJson),
        }),
      ),
    );
  }

  gradeOpenAnswersWithGemini(
    apiKey: string,
    exam: Exam,
    answers: AnswerMap,
  ): Observable<{ items: OpenAnswerGrade[] }> {
    const validatedExam = this.validateExam(exam);

    return from(
      this.generateJson(apiKey, this.buildGradingPromptText(validatedExam, answers)).then((rawGradingJson) => ({
        items: this.parseGradingJson(rawGradingJson, validatedExam),
      })),
    );
  }

  calculateFinalScore(
    exam: Exam,
    answers: AnswerMap,
    openEndedGrades: OpenAnswerGrade[],
  ): Observable<FinalScoreResult> {
    return from(Promise.resolve(this.calculateScore(this.validateExam(exam), answers, openEndedGrades)));
  }

  private async extractFileText(file: File): Promise<ExtractFileResponse> {
    const fileName = file.name.toLowerCase();
    const extension = supportedExtensions.find((item) => fileName.endsWith(item));

    if (!extension) {
      throw new Error('Supported file types are .txt, .md, .pdf, and .pptx.');
    }

    if (!file.size) {
      throw new Error('The selected file is empty.');
    }

    let text = '';

    if (extension === '.txt' || extension === '.md') {
      text = this.cleanText(await file.text());
    } else if (extension === '.pdf') {
      text = await this.extractPdf(file);
    } else {
      text = await this.extractPptx(file);
    }

    if (!text) {
      throw new Error('No readable text was found in the selected file.');
    }

    return {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      text,
      characterCount: text.length,
    };
  }

  private async extractPdf(file: File): Promise<string> {
    const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');

    GlobalWorkerOptions.workerSrc = new URL('assets/pdfjs/pdf.worker.min.mjs', document.baseURI).toString();

    const loadingTask = getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      useWorkerFetch: false,
      isEvalSupported: false,
    });
    const pdf = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .filter(Boolean)
        .join(' ');
      pages.push(`Page ${pageNumber}\n${pageText}`);
    }

    return this.cleanText(pages.join('\n\n'));
  }

  private async extractPptx(file: File): Promise<string> {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slidePaths = Object.keys(zip.files)
      .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
      .sort((a, b) => this.slideNumber(a) - this.slideNumber(b));

    if (!slidePaths.length) {
      throw new Error('No slide text could be found in the PowerPoint file.');
    }

    const slides = await Promise.all(
      slidePaths.map(async (path, index) => {
        const xml = await zip.files[path].async('text');
        const parsed = this.xmlParser.parse(xml);
        const texts: string[] = [];
        this.collectDrawingText(parsed, texts);
        return `Slide ${index + 1}\n${texts.join(' ')}`;
      }),
    );

    return this.cleanText(slides.join('\n\n'));
  }

  private buildExamPromptText(studyText: string, config: ExamConfig): string {
    const trimmedText = studyText.trim().slice(0, MAX_STUDY_TEXT_CHARS);
    const knowledgeScopeInstruction =
      config.knowledgeScope === 'expanded'
        ? [
            'Knowledge scope:',
            'Use the study material as the primary reference.',
            'You may add closely related, generally accepted knowledge about the same theme when it improves exam quality.',
            'Do not drift into unrelated topics, and keep every question connected to the study material or its main theme.',
          ]
        : [
            'Knowledge scope:',
            'Use only the study material as the source of truth.',
            'Do not add facts, examples, or claims from outside the attached or pasted material.',
          ];
    const studyMaterialInstruction = trimmedText
      ? ['Study material:', trimmedText]
      : [
          'Study material:',
          'Use the document, notes, or text that the user attaches or pastes with this prompt.',
        ];

    return [
      'You are StudyForge, an exam generator for personal study.',
      'Return only valid JSON. Do not include markdown, comments, or surrounding text.',
      '',
      'Create one exam from the study material.',
      `Language: ${config.language}`,
      `Difficulty: ${config.difficulty}`,
      `Number of questions: ${config.numberOfQuestions}`,
      `Question type mix: ${config.questionType}`,
      `Time limit enabled: ${config.timeLimitEnabled ? 'true' : 'false'}`,
      `Time limit minutes: ${config.timeLimitMinutes}`,
      `Knowledge scope: ${config.knowledgeScope}`,
      '',
      'Use this exact JSON shape:',
      '{"title":"string","description":"string","language":"en|pt-BR","difficulty":"easy|medium|hard","timeLimitEnabled":boolean,"timeLimitMinutes":number,"questions":[{"id":"q1","type":"multiple_choice|open_ended","question":"string","points":1,"topic":"string","options":[{"id":"A","text":"string"},{"id":"B","text":"string"},{"id":"C","text":"string"},{"id":"D","text":"string"}],"correctOptionId":"A","expectedAnswer":"string","rubric":"string","explanation":"string"}]}',
      '',
      'Rules:',
      '- Multiple-choice questions must include exactly options A, B, C, D, correctOptionId, and explanation.',
      '- Open-ended questions must omit options/correctOptionId or set options to an empty array, and must include expectedAnswer, rubric, and explanation.',
      '- Points should normally be 1 per question unless a question should weigh more.',
      '- Keep wording clear and answerable under the selected knowledge scope.',
      '- If mixed is requested, include both multiple-choice and open-ended questions.',
      '- Set timeLimitEnabled exactly as requested. If false, keep timeLimitMinutes as metadata only; the app will not enforce it.',
      '',
      ...knowledgeScopeInstruction,
      '',
      ...studyMaterialInstruction,
    ].join('\n');
  }

  private buildGradingPromptText(exam: Exam, answers: AnswerMap): string {
    const gradingItems = exam.questions
      .filter((question) => question.type === 'open_ended')
      .map((question) => ({
        questionId: question.id,
        question: question.question,
        maxPoints: question.points,
        expectedAnswer: question.expectedAnswer,
        rubric: question.rubric,
        userAnswer: answers[question.id] ?? '',
      }));

    return [
      'You are StudyForge, grading open-ended exam answers.',
      'Return only valid JSON. Do not include markdown, comments, or surrounding text.',
      '',
      'Grade each answer against the expected answer and rubric.',
      'Use partial credit when the answer is incomplete but materially correct.',
      'Use this exact JSON shape:',
      '{"items":[{"questionId":"q1","score":0.75,"maxPoints":1,"status":"correct|partially_correct|wrong","feedback":"string"}]}',
      '',
      'Items to grade:',
      JSON.stringify(gradingItems, null, 2),
    ].join('\n');
  }

  private async generateJson(apiKey: string, prompt: string): Promise<string> {
    if (!apiKey?.trim()) {
      throw new Error('Gemini API key is required.');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        GEMINI_MODEL,
      )}:generateContent?key=${encodeURIComponent(apiKey.trim())}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
      },
    );

    const data = (await response.json().catch(() => ({}))) as GeminiResponse;

    if (!response.ok) {
      throw new Error(data.error?.message ?? 'Gemini request failed.');
    }

    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join('\n')
      .trim();

    if (!text) {
      throw new Error('Gemini did not return JSON text.');
    }

    return text;
  }

  private validateConfig(input: unknown): ExamConfig {
    const config = this.requireObject(input, 'Exam config is required.');
    const language = this.requireString(config['language'], 'Exam language is required.');
    const difficulty = this.requireString(config['difficulty'], 'Difficulty is required.');
    const questionType = this.requireString(config['questionType'], 'Question type is required.');
    const knowledgeScope =
      config['knowledgeScope'] === undefined
        ? 'strict'
        : this.requireString(config['knowledgeScope'], 'Knowledge scope is required.');
    const numberOfQuestions = Number(config['numberOfQuestions']);
    const timeLimitEnabled = config['timeLimitEnabled'] !== false;
    const timeLimitMinutes = this.readTimeLimitMinutes(
      config['timeLimitMinutes'],
      timeLimitEnabled,
      'Time limit must be between 1 and 240 minutes.',
    );

    if (!languages.includes(language as ExamLanguage)) {
      throw new Error('Exam language must be en or pt-BR.');
    }

    if (!difficulties.includes(difficulty as Difficulty)) {
      throw new Error('Difficulty must be easy, medium, or hard.');
    }

    if (!requestedQuestionTypes.includes(questionType as RequestedQuestionType)) {
      throw new Error('Question type must be multiple_choice, open_ended, or mixed.');
    }

    if (!knowledgeScopes.includes(knowledgeScope as KnowledgeScope)) {
      throw new Error('Knowledge scope must be strict or expanded.');
    }

    if (!Number.isInteger(numberOfQuestions) || numberOfQuestions < 1 || numberOfQuestions > 100) {
      throw new Error('Number of questions must be between 1 and 100.');
    }

    return {
      language: language as ExamLanguage,
      difficulty: difficulty as Difficulty,
      questionType: questionType as RequestedQuestionType,
      numberOfQuestions,
      timeLimitEnabled,
      timeLimitMinutes,
      knowledgeScope: knowledgeScope as KnowledgeScope,
    };
  }

  private parseExamJson(raw: unknown): Exam {
    return this.validateExam(this.parseJsonLike(raw, 'Exam JSON is required.'));
  }

  private validateExam(input: unknown): Exam {
    const exam = this.requireObject(input, 'Exam JSON must be an object.');
    const questions = Array.isArray(exam['questions']) ? exam['questions'] : null;

    if (!questions?.length) {
      throw new Error('Exam JSON must include at least one question.');
    }

    const language = this.requireString(exam['language'], 'Exam language is required.');
    const difficulty = this.requireString(exam['difficulty'], 'Exam difficulty is required.');
    const timeLimitEnabled = exam['timeLimitEnabled'] !== false;
    const timeLimitMinutes = this.readTimeLimitMinutes(
      exam['timeLimitMinutes'],
      timeLimitEnabled,
      'Exam timeLimitMinutes must be a positive number.',
    );

    if (!languages.includes(language as ExamLanguage)) {
      throw new Error('Exam language must be en or pt-BR.');
    }

    if (!difficulties.includes(difficulty as Difficulty)) {
      throw new Error('Exam difficulty must be easy, medium, or hard.');
    }

    return {
      title: this.requireString(exam['title'], 'Exam title is required.'),
      description: this.requireString(exam['description'], 'Exam description is required.'),
      language: language as ExamLanguage,
      difficulty: difficulty as Difficulty,
      timeLimitEnabled,
      timeLimitMinutes,
      questions: questions.map((question, index) => this.validateQuestion(question, index)),
    };
  }

  private parseGradingJson(raw: unknown, exam?: Exam): OpenAnswerGrade[] {
    const parsed = this.parseJsonLike(raw, 'Grading JSON is required.');
    return this.validateGradingItems(parsed, exam);
  }

  private validateGradingItems(input: unknown, exam?: Exam): OpenAnswerGrade[] {
    const grading = this.requireObject(input, 'Grading JSON must be an object.');
    const items = Array.isArray(grading['items']) ? grading['items'] : null;

    if (!items) {
      throw new Error('Grading JSON must include an items array.');
    }

    const allowedQuestionIds = new Set(
      exam?.questions.filter((question) => question.type === 'open_ended').map((question) => question.id),
    );

    return items.map((item, index) => {
      const grade = this.requireObject(item, `Grading item ${index + 1} must be an object.`);
      const questionId = this.requireString(grade['questionId'], `Grading item ${index + 1} needs questionId.`);
      const status = this.requireString(grade['status'], `Grading item ${index + 1} needs status.`);
      const score = Number(grade['score']);
      const maxPoints = Number(grade['maxPoints']);

      if (exam && !allowedQuestionIds.has(questionId)) {
        throw new Error(`Grading item ${index + 1} references an unknown open-ended question.`);
      }

      if (!gradeStatuses.includes(status as GradeStatus)) {
        throw new Error(`Grading item ${index + 1} has an invalid status.`);
      }

      if (!Number.isFinite(score) || score < 0) {
        throw new Error(`Grading item ${index + 1} score must be zero or greater.`);
      }

      if (!Number.isFinite(maxPoints) || maxPoints <= 0) {
        throw new Error(`Grading item ${index + 1} maxPoints must be positive.`);
      }

      if (score > maxPoints) {
        throw new Error(`Grading item ${index + 1} score cannot exceed maxPoints.`);
      }

      return {
        questionId,
        score,
        maxPoints,
        status: status as GradeStatus,
        feedback: this.requireString(grade['feedback'], `Grading item ${index + 1} needs feedback.`),
      };
    });
  }

  private validateQuestion(input: unknown, index: number): Exam['questions'][number] {
    const question = this.requireObject(input, `Question ${index + 1} must be an object.`);
    const type = this.requireString(question['type'], `Question ${index + 1} needs type.`);
    const points = Number(question['points']);

    if (!questionKinds.includes(type as QuestionKind)) {
      throw new Error(`Question ${index + 1} type must be multiple_choice or open_ended.`);
    }

    if (!Number.isFinite(points) || points <= 0) {
      throw new Error(`Question ${index + 1} points must be positive.`);
    }

    const base = {
      id: this.requireString(question['id'], `Question ${index + 1} needs id.`),
      type: type as QuestionKind,
      question: this.requireString(question['question'], `Question ${index + 1} needs question text.`),
      points,
      topic: this.requireString(question['topic'], `Question ${index + 1} needs topic.`),
      explanation: this.requireString(question['explanation'], `Question ${index + 1} needs explanation.`),
    };

    if (type === 'multiple_choice') {
      return {
        ...base,
        type: 'multiple_choice',
        options: this.validateOptions(question['options'], index),
        correctOptionId: this.validateCorrectOption(question['correctOptionId'], index),
      };
    }

    return {
      ...base,
      type: 'open_ended',
      options: [],
      expectedAnswer: this.requireString(question['expectedAnswer'], `Question ${index + 1} needs expectedAnswer.`),
      rubric: this.requireString(question['rubric'], `Question ${index + 1} needs rubric.`),
    };
  }

  private validateOptions(input: unknown, questionIndex: number): QuestionOption[] {
    if (!Array.isArray(input) || input.length !== 4) {
      throw new Error(`Question ${questionIndex + 1} must include exactly four options.`);
    }

    const options = input.map((option, index) => {
      const item = this.requireObject(option, `Question ${questionIndex + 1} option ${index + 1} must be an object.`);
      const id = this.requireString(item['id'], `Question ${questionIndex + 1} option ${index + 1} needs id.`);

      if (!optionIds.includes(id as QuestionOption['id'])) {
        throw new Error(`Question ${questionIndex + 1} options must use IDs A, B, C, and D.`);
      }

      return {
        id: id as QuestionOption['id'],
        text: this.requireString(item['text'], `Question ${questionIndex + 1} option ${id} needs text.`),
      };
    });

    const ids = options.map((option) => option.id).sort().join('');
    if (ids !== 'ABCD') {
      throw new Error(`Question ${questionIndex + 1} options must include A, B, C, and D once.`);
    }

    return options.sort((a, b) => a.id.localeCompare(b.id));
  }

  private validateCorrectOption(input: unknown, questionIndex: number): QuestionOption['id'] {
    const correctOptionId = this.requireString(input, `Question ${questionIndex + 1} needs correctOptionId.`);

    if (!optionIds.includes(correctOptionId as QuestionOption['id'])) {
      throw new Error(`Question ${questionIndex + 1} correctOptionId must be A, B, C, or D.`);
    }

    return correctOptionId as QuestionOption['id'];
  }

  private calculateScore(
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
        throw new Error('Open-ended grading JSON is required before final scoring.');
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

  private gradeMultipleChoice(exam: Exam, answers: AnswerMap): OpenAnswerGrade[] {
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

  private readTimeLimitMinutes(input: unknown, enabled: boolean, message: string): number {
    if (!enabled && input === undefined) {
      return 0;
    }

    const timeLimitMinutes = Number(input);

    if (!Number.isInteger(timeLimitMinutes) || timeLimitMinutes < 1 || timeLimitMinutes > 240) {
      throw new Error(message);
    }

    return timeLimitMinutes;
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
      throw new Error('The provided JSON could not be parsed.');
    }
  }

  private collectDrawingText(value: unknown, output: string[]): void {
    if (Array.isArray(value)) {
      value.forEach((item) => this.collectDrawingText(item, output));
      return;
    }

    if (!value || typeof value !== 'object') {
      return;
    }

    Object.entries(value).forEach(([key, child]) => {
      if (key === 'a:t') {
        this.pushXmlText(child, output);
        return;
      }

      this.collectDrawingText(child, output);
    });
  }

  private pushXmlText(value: unknown, output: string[]): void {
    if (typeof value === 'string' && value.trim()) {
      output.push(value.trim());
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => this.pushXmlText(item, output));
    }
  }

  private slideNumber(path: string): number {
    return Number(path.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
  }

  private cleanText(text: string): string {
    return text
      .replace(/\r/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private requireObject(input: unknown, message: string): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error(message);
    }

    return input as Record<string, unknown>;
  }

  private requireString(input: unknown, message: string): string {
    if (typeof input !== 'string' || !input.trim()) {
      throw new Error(message);
    }

    return input.trim();
  }

  private roundOne(value: number): number {
    return Math.round(value * 10) / 10;
  }
}
