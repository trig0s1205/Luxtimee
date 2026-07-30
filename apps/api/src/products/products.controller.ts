import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { ProductsService } from './products.service';
import { CreateWatchDto, UpdateWatchDto } from './dto/watch.dto';
import { Roles, Audit, Financial } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { FinancialGuard } from '../common/guards/financial.guard';
import { FinancialStripInterceptor } from '../common/interceptors/financial-strip.interceptor';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ImageProcessingService } from '../integrations/image-processing.service';
import { assertMediaFile, MAX_IMAGE_BYTES } from '../common/utils/file-magic.util';

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

function productImageFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
    cb(new BadRequestException('Solo se permiten imágenes JPEG, PNG o WEBP'), false);
    return;
  }
  cb(null, true);
}

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
      fileFilter: productImageFilter,
      limits: { fileSize: MAX_IMAGE_BYTES },
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

    for (const file of files) {
      assertMediaFile(file, 'image');
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
