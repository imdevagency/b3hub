import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /** GET /api/v1/documents — list all documents for the current user */
  @Get()
  findAll(@CurrentUser() user: RequestingUser, @Query() query: QueryDocumentsDto) {
    return this.documentsService.findAll(user.userId, query);
  }

  /** GET /api/v1/documents/summary — count by type */
  @Get('summary')
  summary(@CurrentUser() user: RequestingUser) {
    return this.documentsService.summary(user.userId);
  }

  /** GET /api/v1/documents/:id — single document */
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestingUser) {
    return this.documentsService.findOne(id, user.userId);
  }

  /** POST /api/v1/documents — upload / register a document */
  @Post()
  create(@CurrentUser() user: RequestingUser, @Body() dto: CreateDocumentDto) {
    return this.documentsService.create(user.userId, dto);
  }
}
