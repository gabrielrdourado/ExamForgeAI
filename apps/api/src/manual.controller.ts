import { Body, Controller, Post } from '@nestjs/common';
import { AnswerMap, Exam } from './types';
import { PromptsService } from './prompts.service';
import { ValidationService } from './validation.service';

@Controller('manual')
export class ManualController {
  constructor(
    private readonly promptsService: PromptsService,
    private readonly validationService: ValidationService,
  ) {}

  @Post('build-exam-prompt')
  buildExamPrompt(@Body() body: { extractedText?: string; config?: unknown }) {
    const config = this.validationService.validateConfig(body.config);

    return {
      prompt: this.promptsService.buildExamPrompt(body.extractedText ?? '', config),
    };
  }

  @Post('validate-exam-json')
  validateExamJson(@Body() body: { rawJson?: unknown }) {
    return {
      exam: this.validationService.parseExamJson(body.rawJson),
    };
  }

  @Post('build-grading-prompt')
  buildGradingPrompt(@Body() body: { exam?: Exam; answers?: AnswerMap }) {
    const exam = this.validationService.validateExam(body.exam);

    return {
      prompt: this.promptsService.buildGradingPrompt(exam, body.answers ?? {}),
    };
  }

  @Post('validate-grading-json')
  validateGradingJson(@Body() body: { rawJson?: unknown; exam?: Exam }) {
    const exam = body.exam ? this.validationService.validateExam(body.exam) : undefined;

    return {
      items: this.validationService.parseGradingJson(body.rawJson, exam),
    };
  }
}
