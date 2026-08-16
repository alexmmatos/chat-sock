import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

const HEADER = 'x-request-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId =
      (req.headers[HEADER] as string | undefined) ?? randomUUID();
    req.headers[HEADER] = requestId;
    res.setHeader(HEADER, requestId);
    next();
  }
}
