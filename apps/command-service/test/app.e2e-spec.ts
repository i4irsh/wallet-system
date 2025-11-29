import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { CommandServiceModule } from './../src/command-service.module';

describe('CommandServiceController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CommandServiceModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });
});
