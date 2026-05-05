import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BuContext, LeadStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { CreateNoteDto, CreateTaskDto, UpdateTaskDto } from './dto/note-task.dto';

@Injectable()
export class CrmService {
  constructor(private prisma: PrismaService) {}

  // ─── Leads ────────────────────────────────────────────────────────────────

  async listLeads(filters?: {
    status?: LeadStatus;
    buContext?: BuContext;
    search?: string;
  }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.buContext) where.buContext = filters.buContext;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
        { company: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.crmLead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { notes: true, tasks: true } },
        tasks: {
          where: { done: false },
          orderBy: { dueAt: 'asc' },
          take: 1,
          select: { id: true, title: true, dueAt: true },
        },
      },
    });
  }

  async getLead(id: string) {
    const lead = await this.prisma.crmLead.findUnique({
      where: { id },
      include: {
        notes: { orderBy: { createdAt: 'desc' } },
        tasks: { orderBy: [{ done: 'asc' }, { dueAt: 'asc' }] },
        linkedUser: { select: { id: true, email: true, phone: true } },
        linkedCompany: { select: { id: true, name: true, companyType: true } },
      },
    });
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    return lead;
  }

  async createLead(dto: CreateLeadDto, authorId: string) {
    return this.prisma.crmLead.create({
      data: {
        ...dto,
        assignedTo: dto.assignedTo ?? authorId,
      },
    });
  }

  async updateLead(id: string, dto: UpdateLeadDto) {
    await this.assertLead(id);
    return this.prisma.crmLead.update({ where: { id }, data: dto });
  }

  async deleteLead(id: string) {
    await this.assertLead(id);
    await this.prisma.crmLead.delete({ where: { id } });
  }

  // ─── Notes ────────────────────────────────────────────────────────────────

  async addNote(leadId: string, dto: CreateNoteDto, authorId: string) {
    await this.assertLead(leadId);
    return this.prisma.crmNote.create({
      data: { leadId, content: dto.content, authorId },
    });
  }

  async deleteNote(leadId: string, noteId: string, requesterId: string, isAdmin: boolean) {
    const note = await this.prisma.crmNote.findUnique({ where: { id: noteId } });
    if (!note || note.leadId !== leadId) throw new NotFoundException();
    if (!isAdmin && note.authorId !== requesterId) throw new ForbiddenException();
    await this.prisma.crmNote.delete({ where: { id: noteId } });
  }

  // ─── Tasks ────────────────────────────────────────────────────────────────

  async addTask(leadId: string, dto: CreateTaskDto) {
    await this.assertLead(leadId);
    return this.prisma.crmTask.create({
      data: {
        leadId,
        title: dto.title,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        assignedTo: dto.assignedTo,
      },
    });
  }

  async updateTask(leadId: string, taskId: string, dto: UpdateTaskDto) {
    const task = await this.prisma.crmTask.findUnique({ where: { id: taskId } });
    if (!task || task.leadId !== leadId) throw new NotFoundException();
    return this.prisma.crmTask.update({
      where: { id: taskId },
      data: {
        ...dto,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        doneAt: dto.done === true ? new Date() : dto.done === false ? null : undefined,
      },
    });
  }

  async deleteTask(leadId: string, taskId: string) {
    const task = await this.prisma.crmTask.findUnique({ where: { id: taskId } });
    if (!task || task.leadId !== leadId) throw new NotFoundException();
    await this.prisma.crmTask.delete({ where: { id: taskId } });
  }

  // ─── Pipeline summary ─────────────────────────────────────────────────────

  async getPipelineSummary() {
    const counts = await this.prisma.crmLead.groupBy({
      by: ['status'],
      _count: { _all: true },
      _sum: { value: true },
    });
    return counts.map((c) => ({
      status: c.status,
      count: c._count._all,
      totalValue: c._sum.value ?? 0,
    }));
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async assertLead(id: string) {
    const lead = await this.prisma.crmLead.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
  }
}
