import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { Roles, Audit } from '../common/decorators/metadata.decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MAX_IMPORT_BYTES } from './import.constants';
import { WatchesImportService } from './watches-import.service';

@Controller({ path: 'watches', version: '1' })
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@UseGuards(RolesGuard)
export class WatchesImportController {
  constructor(private readonly importService: WatchesImportService) {}

  @Post('import/preview')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMPORT_BYTES },
    }),
  )
  preview(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { role: Role },
  ) {
    if (!file) throw new BadRequestException('Adjunta un archivo (campo file).');
    return this.importService.preview(file, user.role);
  }

  @Post('import/commit')
  @Audit('CREATE', 'Watch')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMPORT_BYTES },
    }),
  )
  commit(
    @UploadedFile() file: Express.Multer.File,
    @Body('confirm') confirm: string | boolean,
    @CurrentUser() user: { role: Role },
  ) {
    if (!file) throw new BadRequestException('Adjunta un archivo (campo file).');
    const ok =
      confirm === true ||
      confirm === 'true' ||
      confirm === '1' ||
      confirm === 'yes';
    return this.importService.commit(file, user.role, ok);
  }

  @Get('by-import-key')
  byImportKey(@Query('keys') keys?: string) {
    const list = String(keys ?? '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    return this.importService.findByImportKeys(list);
  }
}
