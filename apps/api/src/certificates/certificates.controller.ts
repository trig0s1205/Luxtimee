import { Controller, Get, Param } from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { Public } from '../common/decorators/metadata.decorators';

@Controller({ path: 'certificates', version: '1' })
export class CertificatesController {
  constructor(private certificatesService: CertificatesService) {}

  @Public()
  @Get('public/:slug')
  findPublic(@Param('slug') slug: string) {
    return this.certificatesService.findPublicBySlug(slug);
  }
}
