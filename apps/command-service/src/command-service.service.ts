import { Injectable } from '@nestjs/common';

@Injectable()
export class CommandServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
