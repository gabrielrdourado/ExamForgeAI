import { Injectable } from '@nestjs/common';
import { AnswerMap, Exam, ExamConfig } from './types';

const MAX_STUDY_TEXT_CHARS = 60000;

@Injectable()
export class PromptsService {
  buildExamPrompt(studyText: string, config: ExamConfig): string {
    const trimmedText = studyText.slice(0, MAX_STUDY_TEXT_CHARS);

    return [
      'You are StudyForge, an exam generator for personal study.',
      'Return only valid JSON. Do not include markdown, comments, or surrounding text.',
      '',
      'Create one exam from the study material.',
      `Language: ${config.language}`,
      `Difficulty: ${config.difficulty}`,
      `Number of questions: ${config.numberOfQuestions}`,
      `Question type mix: ${config.questionType}`,
      `Time limit minutes: ${config.timeLimitMinutes}`,
      '',
      'Use this exact JSON shape:',
      '{"title":"string","description":"string","language":"en|pt-BR","difficulty":"easy|medium|hard","timeLimitMinutes":number,"questions":[{"id":"q1","type":"multiple_choice|open_ended","question":"string","points":1,"topic":"string","options":[{"id":"A","text":"string"},{"id":"B","text":"string"},{"id":"C","text":"string"},{"id":"D","text":"string"}],"correctOptionId":"A","expectedAnswer":"string","rubric":"string","explanation":"string"}]}',
      '',
      'Rules:',
      '- Multiple-choice questions must include exactly options A, B, C, D, correctOptionId, and explanation.',
      '- Open-ended questions must omit options/correctOptionId or set options to an empty array, and must include expectedAnswer, rubric, and explanation.',
      '- Points should normally be 1 per question unless a question should weigh more.',
      '- Keep wording clear and answerable from the study material.',
      '- If mixed is requested, include both multiple-choice and open-ended questions.',
      '',
      'Study material:',
      trimmedText,
    ].join('\n');
  }

  buildGradingPrompt(exam: Exam, answers: AnswerMap): string {
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
}
