import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarrantyTemplateDto, UpdateWarrantyTemplateDto } from './dto/warranty.dto';

@Injectable()
export class WarrantiesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.warrantyTemplate.findMany({ orderBy: { name: 'asc' } });
  }

  create(dto: CreateWarrantyTemplateDto) {
    return this.prisma.warrantyTemplate.create({ data: dto });
  }

  async update(id: string, dto: UpdateWarrantyTemplateDto) {
    await this.ensureExists(id);
    return this.prisma.warrantyTemplate.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.warrantyTemplate.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const item = await this.prisma.warrantyTemplate.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Plantilla de garantía no encontrada');
    return item;
  }
}
