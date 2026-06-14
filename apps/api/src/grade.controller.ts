import { Body, Controller, Post } from '@nestjs/common';
import { AnswerMap, Exam, OpenAnswerGrade } from './types';
import { GradingService } from './grading.service';
import { ValidationService } from './validation.service';

@Controller('grade')
export class GradeController {
  constructor(
    private readonly gradingService: GradingService,
    private readonly validationService: ValidationService,
  ) {}

  @Post('multiple-choice')
  gradeMultipleChoice(@Body() body: { exam?: Exam; answers?: AnswerMap }) {
    const exam = this.validationService.validateExam(body.exam);

    return {
      items: this.gradingService.gradeMultipleChoice(exam, body.answers ?? {}),
    };
  }

  @Post('final-score')
  finalScore(
    @Body()
    body: {
      exam?: Exam;
      answers?: AnswerMap;
      openEndedGrades?: OpenAnswerGrade[];
    },
  ) {
    const exam = this.validationService.validateExam(body.exam);
    const openEndedGrades = this.validationService.validateGradingJson(
      { items: body.openEndedGrades ?? [] },
      exam,
    );

    return this.gradingService.calculateFinalScore(
      exam,
      body.answers ?? {},
      openEndedGrades,
    );
  }
}
