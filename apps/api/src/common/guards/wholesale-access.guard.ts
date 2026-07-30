import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { WHOLESALE_ACCESS_COOKIE } from '@luxtime/shared';
import { WholesaleAccessService } from '../../wholesale-access/wholesale-access.service';

@Injectable()
export class WholesaleAccessGuard implements CanActivate {
  constructor(private wholesaleAccessService: WholesaleAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = req.cookies?.[WHOLESALE_ACCESS_COOKIE] as string | undefined;
    const session = await this.wholesaleAccessService.requireAccessFromToken(token);
    (req as Request & { wholesaleSession?: typeof session }).wholesaleSession = session;
    return true;
  }
}

export function getWholesaleSession(req: Request) {
  return (req as Request & { wholesaleSession?: { id: string } }).wholesaleSession;
}
