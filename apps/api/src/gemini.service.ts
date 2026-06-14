import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';

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

@Injectable()
export class GeminiService {
  private readonly model = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash';

  async generateJson(apiKey: string, prompt: string): Promise<string> {
    if (!apiKey?.trim()) {
      throw new BadRequestException('Gemini API key is required.');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        this.model,
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
      throw new BadGatewayException(data.error?.message ?? 'Gemini request failed.');
    }

    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join('\n')
      .trim();

    if (!text) {
      throw new BadGatewayException('Gemini did not return JSON text.');
    }

    return text;
  }
}
