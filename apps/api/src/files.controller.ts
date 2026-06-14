import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TextExtractionService } from './text-extraction.service';

@Controller('files')
export class FilesController {
  constructor(private readonly textExtractionService: TextExtractionService) {}

  @Post('extract')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 30 * 1024 * 1024,
      },
    }),
  )
  async extract(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Upload a .txt, .md, .pdf, or .pptx file.');
    }

    const text = await this.textExtractionService.extract(file);

    if (!text) {
      throw new BadRequestException('No readable text was found in the uploaded file.');
    }

    return {
      fileName: file.originalname,
      mimeType: file.mimetype,
      text,
      characterCount: text.length,
    };
  }
}
