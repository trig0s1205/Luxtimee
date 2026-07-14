import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ShippingService {
  constructor(private prisma: PrismaService) {}

  findAllPublic() {
    return this.prisma.shippingZone.findMany({ orderBy: { cost: 'asc' } });
  }

  findAll() {
    return this.findAllPublic();
  }

  async update(id: string, cost: number) {
    return this.prisma.shippingZone.update({
      where: { id },
      data: { cost },
    });
  }
}
