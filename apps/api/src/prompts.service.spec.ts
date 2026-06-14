import { PromptsService } from './prompts.service';
import { ExamConfig } from './types';

describe('PromptsService', () => {
  const baseConfig: ExamConfig = {
    language: 'en',
    numberOfQuestions: 5,
    questionType: 'mixed',
    difficulty: 'medium',
    timeLimitEnabled: true,
    timeLimitMinutes: 30,
    knowledgeScope: 'strict',
  };

  it('builds a strict prompt that stays inside the study material', () => {
    const prompt = new PromptsService().buildExamPrompt('', baseConfig);

    expect(prompt).toContain('Knowledge scope: strict');
    expect(prompt).toContain(
      'Use only the study material as the source of truth.',
    );
    expect(prompt).toContain(
      'Do not add facts, examples, or claims from outside',
    );
    expect(prompt).not.toContain('You may add closely related');
  });

  it('builds an expanded prompt that allows related theme knowledge', () => {
    const prompt = new PromptsService().buildExamPrompt('', {
      ...baseConfig,
      knowledgeScope: 'expanded',
    });

    expect(prompt).toContain('Knowledge scope: expanded');
    expect(prompt).toContain(
      'Use the study material as the primary reference.',
    );
    expect(prompt).toContain(
      'You may add closely related, generally accepted knowledge',
    );
    expect(prompt).toContain(
      'keep every question connected to the study material or its main theme.',
    );
  });
});
