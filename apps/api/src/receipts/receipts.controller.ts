import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ReceiptsService } from './receipts.service';

@Controller({ path: 'receipts', version: '1' })
@UseGuards(RolesGuard)
export class ReceiptsController {
  constructor(
    private readonly receiptsService: ReceiptsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('order/:orderId/pdf')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.VENDEDOR_LOCAL)
  async pdfByOrder(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const receipt = await this.receiptsService.ensureForOrder(orderId);
    if (!receipt) {
      throw new BadRequestException(
        'Este pedido aún no tiene pago confirmado; el comprobante se genera al confirmar el pago.',
      );
    }
    if (user.role === Role.VENDEDOR_LOCAL) {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { source: true, sellerId: true },
      });
      if (
        !order ||
        order.source !== 'LOCAL' ||
        order.sellerId !== user.id
      ) {
        throw new ForbiddenException();
      }
    }
    const { filename, buffer } = await this.receiptsService.getPdf(receipt.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(buffer);
  }

  @Get(':id/pdf')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.VENDEDOR_LOCAL)
  async pdfById(@Param('id') id: string, @Res() res: Response) {
    const exists = await this.prisma.saleReceipt.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Comprobante no encontrado');
    const { filename, buffer } = await this.receiptsService.getPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(buffer);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.VENDEDOR_LOCAL)
  async getOne(@Param('id') id: string) {
    const dto = await this.receiptsService.findById(id);
    if (!dto) throw new NotFoundException('Comprobante no encontrado');
    return dto;
  }
}
