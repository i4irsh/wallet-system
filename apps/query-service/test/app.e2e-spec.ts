import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { QueryServiceModule } from './../src/query-service.module';

describe('QueryServiceController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [QueryServiceModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });
});
