import { Injectable } from '@nestjs/common';

@Injectable()
export class QueryServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
