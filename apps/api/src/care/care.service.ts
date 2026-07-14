import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCareTemplateDto, UpdateCareTemplateDto } from './dto/care.dto';

@Injectable()
export class CareService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.careTemplate.findMany({ orderBy: { name: 'asc' } });
  }

  create(dto: CreateCareTemplateDto) {
    return this.prisma.careTemplate.create({ data: dto });
  }

  async update(id: string, dto: UpdateCareTemplateDto) {
    await this.ensureExists(id);
    return this.prisma.careTemplate.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.careTemplate.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const item = await this.prisma.careTemplate.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Plantilla de cuidado no encontrada');
    return item;
  }
}
