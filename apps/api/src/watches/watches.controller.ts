import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { WatchesService } from './watches.service';
import { CreateWatchDto, UpdateWatchDto, WatchQueryDto } from './dto';
import { Roles, Audit } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FinancialStripInterceptor } from '../common/interceptors/financial-strip.interceptor';
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from '../common/utils/file-magic.util';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'watches');
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

function imageFileFilter(
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

function isGenericUploadMime(mime?: string) {
  return !mime || mime === 'application/octet-stream' || mime === 'binary/octet-stream';
}

function mediaFileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  if (file.fieldname === 'video') {
    if (
      isGenericUploadMime(file.mimetype)
      || ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'].includes(file.mimetype)
    ) {
      cb(null, true);
      return;
    }
    cb(new BadRequestException('El video debe ser MP4, MOV o WEBM'), false);
    return;
  }

  if (isGenericUploadMime(file.mimetype) || ALLOWED_IMAGE_MIME.has(file.mimetype)) {
    cb(null, true);
    return;
  }

  cb(new BadRequestException('image1 e image2 deben ser JPEG, PNG o WEBP'), false);
}

@Controller({ path: 'watches', version: '1' })
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@UseGuards(RolesGuard)
@UseInterceptors(FinancialStripInterceptor)
export class WatchesController {
  constructor(private watchesService: WatchesService) {}

  @Get()
  findAll(@Query() query: WatchQueryDto) {
    return this.watchesService.findAll(query);
  }

  @Get('featured/count')
  countFeatured(@Query('excludeId') excludeId?: string) {
    return this.watchesService.countFeatured(excludeId);
  }

  @Get('pending-cost')
  @Roles(Role.SUPER_ADMIN)
  findPendingCost(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.watchesService.findPendingCost(Number(page) || 1, Number(limit) || 10);
  }

  @Get('inventory-insights')
  getInventoryInsights() {
    return this.watchesService.getInventoryInsights();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.watchesService.findOne(id);
  }

  @Post()
  @Audit('CREATE', 'Watch')
  create(@Body() dto: CreateWatchDto, @CurrentUser() user: { role: Role }) {
    return this.watchesService.create(dto, user.role);
  }

  @Patch(':id')
  @Audit('UPDATE', 'Watch')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWatchDto,
    @CurrentUser() user: { role: Role },
  ) {
    return this.watchesService.update(id, dto, user.role);
  }

  @Delete(':id')
  @Audit('DELETE', 'Watch')
  remove(@Param('id') id: string) {
    return this.watchesService.remove(id);
  }

  @Post(':id/upload-media')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'image1', maxCount: 1 },
        { name: 'image2', maxCount: 1 },
        { name: 'video', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        fileFilter: mediaFileFilter,
        limits: { fileSize: MAX_VIDEO_BYTES, files: 3 },
      },
    ),
  )
  @Audit('UPLOAD_MEDIA', 'Watch')
  async uploadMedia(
    @Param('id') id: string,
    @UploadedFiles()
    files: {
      image1?: Express.Multer.File[];
      image2?: Express.Multer.File[];
      video?: Express.Multer.File[];
    },
    @Req() req: Request,
  ) {
    const image1 = files?.image1?.[0];
    const image2 = files?.image2?.[0];
    const video = files?.video?.[0];

    if (!image1 && !image2 && !video) {
      throw new BadRequestException('Debes enviar al menos un archivo (foto o video)');
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return this.watchesService.uploadMedia(id, { image1, image2, video }, baseUrl);
  }

  @Post(':id/upload-images')
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname).toLowerCase()}`);
        },
      }),
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  @Audit('UPLOAD_IMAGES', 'Watch')
  async uploadImages(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
  ) {
    if (!files?.length) throw new BadRequestException('No se recibieron imágenes');
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return this.watchesService.uploadImages(id, files, baseUrl);
  }
}
