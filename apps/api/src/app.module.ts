import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { FilesController } from './files.controller';
import { GeminiController } from './gemini.controller';
import { GeminiService } from './gemini.service';
import { GradeController } from './grade.controller';
import { GradingService } from './grading.service';
import { ManualController } from './manual.controller';
import { PromptsService } from './prompts.service';
import { TextExtractionService } from './text-extraction.service';
import { ValidationService } from './validation.service';

@Module({
  imports: [],
  controllers: [
    AppController,
    FilesController,
    GeminiController,
    GradeController,
    ManualController,
  ],
  providers: [
    GeminiService,
    GradingService,
    PromptsService,
    TextExtractionService,
    ValidationService,
  ],
})
export class AppModule {}
