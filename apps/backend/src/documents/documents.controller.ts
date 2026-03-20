/**
 * Documents controller — /api/v1/documents
 * Endpoints to upload, list, download (signed URL), and admin approve/reject documents.
 */
import {
  Controller,
  Delete,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import {
  CreateDocumentDto,
  CreateDocumentLinkDto,
} from './dto/create-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { DocumentEntityType } from '@prisma/client';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /** GET /api/v1/documents — list all documents for the current user */
  @Get()
  findAll(
    @CurrentUser() user: RequestingUser,
    @Query() query: QueryDocumentsDto,
  ) {
    return this.documentsService.findAll(user.userId, query);
  }

  /** GET /api/v1/documents/summary — count by type */
  @Get('summary')
  summary(@CurrentUser() user: RequestingUser) {
    return this.documentsService.summary(user.userId);
  }

  /** GET /api/v1/documents/context/:entityType/:entityId — docs for a business entity */
  @Get('context/:entityType/:entityId')
  findByContext(
    @CurrentUser() user: RequestingUser,
    @Param('entityType') entityType: DocumentEntityType,
    @Param('entityId') entityId: string,
  ) {
    return this.documentsService.findByContext(
      user.userId,
      entityType,
      entityId,
    );
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

  /** POST /api/v1/documents/:id/links — attach document to another context */
  @Post(':id/links')
  addLink(
    @Param('id') id: string,
    @CurrentUser() user: RequestingUser,
    @Body() dto: CreateDocumentLinkDto,
  ) {
    return this.documentsService.addLink(
      user.userId,
      id,
      dto.entityType,
      dto.entityId,
      dto.role,
    );
  }

  /** DELETE /api/v1/documents/:id/links/:linkId — remove one context link */
  @Delete(':id/links/:linkId')
  removeLink(
    @Param('id') id: string,
    @Param('linkId') linkId: string,
    @CurrentUser() user: RequestingUser,
  ) {
    return this.documentsService.removeLink(user.userId, id, linkId);
  }
}
