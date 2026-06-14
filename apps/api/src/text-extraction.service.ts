import { BadRequestException, Injectable } from '@nestjs/common';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';
import pdfParse from 'pdf-parse';

const supportedExtensions = ['.txt', '.md', '.pdf', '.pptx'];

@Injectable()
export class TextExtractionService {
  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
  });

  async extract(file: Express.Multer.File): Promise<string> {
    const fileName = file.originalname.toLowerCase();
    const extension = supportedExtensions.find((item) => fileName.endsWith(item));

    if (!extension) {
      throw new BadRequestException('Supported file types are .txt, .md, .pdf, and .pptx.');
    }

    if (!file.buffer?.length) {
      throw new BadRequestException('The uploaded file is empty.');
    }

    if (extension === '.txt' || extension === '.md') {
      return this.cleanText(file.buffer.toString('utf8'));
    }

    if (extension === '.pdf') {
      const parsed = await pdfParse(file.buffer);
      return this.cleanText(parsed.text);
    }

    return this.extractPptx(file.buffer);
  }

  cleanText(text: string): string {
    return text
      .replace(/\r/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private extractPptx(buffer: Buffer): string {
    const zip = new AdmZip(buffer);
    const slideEntries = zip
      .getEntries()
      .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry.entryName))
      .sort((a, b) => this.slideNumber(a.entryName) - this.slideNumber(b.entryName));

    if (!slideEntries.length) {
      throw new BadRequestException('No slide text could be found in the PowerPoint file.');
    }

    const slideTexts = slideEntries
      .map((entry, index) => {
        const parsed = this.xmlParser.parse(entry.getData().toString('utf8'));
        const texts: string[] = [];
        this.collectDrawingText(parsed, texts);
        return `Slide ${index + 1}\n${texts.join(' ')}`;
      })
      .filter((text) => text.trim().length > 0);

    return this.cleanText(slideTexts.join('\n\n'));
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
}
