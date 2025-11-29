import { Test, TestingModule } from '@nestjs/testing';
import { QueryServiceController } from './query-service.controller';
import { QueryServiceService } from './query-service.service';

describe('QueryServiceController', () => {
  let queryServiceController: QueryServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [QueryServiceController],
      providers: [QueryServiceService],
    }).compile();

    queryServiceController = app.get<QueryServiceController>(
      QueryServiceController,
    );
  });

  describe('root', () => {
    it('should return "pong from query-service"', () => {
      expect(queryServiceController.ping()).toBe('pong from query-service');
    });
  });
});
