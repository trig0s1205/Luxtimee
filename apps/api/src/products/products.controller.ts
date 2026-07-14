import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { memoryStorage } from 'multer';
import { ProductsService } from './products.service';
import { CreateWatchDto, UpdateWatchDto } from './dto/watch.dto';
import { Roles, Audit, Financial } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { FinancialGuard } from '../common/guards/financial.guard';
import { FinancialStripInterceptor } from '../common/interceptors/financial-strip.interceptor';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ImageProcessingService } from '../integrations/image-processing.service';

@Controller({ path: 'products', version: '1' })
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@UseGuards(RolesGuard, FinancialGuard)
@UseInterceptors(FinancialStripInterceptor)
export class ProductsController {
  constructor(
    private productsService: ProductsService,
    private imageProcessing: ImageProcessingService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: { role: Role }) {
    return this.productsService.findAllStaff(user.role);
  }

  @Get('financial/summary')
  @Financial()
  financialSummary(@CurrentUser() user: { role: Role }) {
    return this.productsService.findAllStaff(user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: { role: Role }) {
    return this.productsService.findOneStaff(id, user.role);
  }

  @Post()
  @Audit('CREATE', 'Watch')
  create(@Body() dto: CreateWatchDto, @CurrentUser() user: { role: Role }) {
    return this.productsService.create(dto, user.role);
  }

  @Patch(':id')
  @Audit('UPDATE', 'Watch')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWatchDto,
    @CurrentUser() user: { role: Role },
  ) {
    return this.productsService.update(id, dto, user.role);
  }

  @Delete(':id')
  @Audit('DEACTIVATE', 'Watch')
  deactivate(@Param('id') id: string, @CurrentUser() user: { role: Role }) {
    return this.productsService.deactivate(id, user.role);
  }

  @Post(':id/images')
  @UseInterceptors(
    FilesInterceptor('images', 2, {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @Audit('UPLOAD_IMAGES', 'Watch')
  async uploadImages(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: { role: Role },
  ) {
    if (!files?.length) {
      return this.productsService.findOneStaff(id, user.role);
    }

    const updates: {
      frontImageUrl?: string;
      backImageUrl?: string;
      imageNeedsReview?: boolean;
    } = {};

    const sides: Array<'front' | 'back'> = ['front', 'back'];

    for (let i = 0; i < Math.min(files.length, 2); i++) {
      const file = files[i];
      const side = sides[i];

      try {
        const processed = await this.imageProcessing.processWithMicroservice(file);
        const url = await this.imageProcessing.uploadToCloudinary(
          processed,
          `${id}-${side}-${Date.now()}`,
        );

        if (side === 'front') updates.frontImageUrl = url;
        else updates.backImageUrl = url;
      } catch {
        const fallbackUrl = await this.imageProcessing.uploadToCloudinary(
          file.buffer,
          `${id}-${side}-raw-${Date.now()}`,
        );
        if (side === 'front') updates.frontImageUrl = fallbackUrl;
        else updates.backImageUrl = fallbackUrl;
        updates.imageNeedsReview = true;
      }
    }

    return this.productsService.updateImages(id, updates, user.role);
  }
}
