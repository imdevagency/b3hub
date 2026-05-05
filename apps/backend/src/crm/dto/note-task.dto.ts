import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  dueAt?: string; // ISO date string

  @IsOptional()
  @IsString()
  assignedTo?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  dueAt?: string;

  @IsOptional()
  done?: boolean;

  @IsOptional()
  @IsString()
  assignedTo?: string;
}
