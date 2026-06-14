import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { AnswerMap, Exam } from './types';
import { GeminiService } from './gemini.service';
import { PromptsService } from './prompts.service';
import { ValidationService } from './validation.service';

@Controller('gemini')
export class GeminiController {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly promptsService: PromptsService,
    private readonly validationService: ValidationService,
  ) {}

  @Post('generate-exam')
  async generateExam(
    @Body() body: { apiKey?: string; extractedText?: string; config?: unknown },
  ) {
    const config = this.validationService.validateConfig(body.config);
    const extractedText = body.extractedText?.trim();

    if (!extractedText) {
      throw new BadRequestException('Extracted study file text is required for Gemini API Mode.');
    }

    const prompt = this.promptsService.buildExamPrompt(extractedText, config);
    const rawExamJson = await this.geminiService.generateJson(body.apiKey ?? '', prompt);

    return {
      exam: this.validationService.parseExamJson(rawExamJson),
    };
  }

  @Post('grade-open-answers')
  async gradeOpenAnswers(
    @Body() body: { apiKey?: string; exam?: Exam; answers?: AnswerMap },
  ) {
    const exam = this.validationService.validateExam(body.exam);
    const prompt = this.promptsService.buildGradingPrompt(exam, body.answers ?? {});
    const rawGradingJson = await this.geminiService.generateJson(body.apiKey ?? '', prompt);

    return {
      items: this.validationService.parseGradingJson(rawGradingJson, exam),
    };
  }
}
