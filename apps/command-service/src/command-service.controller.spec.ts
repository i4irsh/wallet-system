import { Test, TestingModule } from '@nestjs/testing';
import { CommandServiceController } from './command-service.controller';
import { CommandServiceService } from './command-service.service';

describe('CommandServiceController', () => {
  let commandServiceController: CommandServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [CommandServiceController],
      providers: [CommandServiceService],
    }).compile();

    commandServiceController = app.get<CommandServiceController>(
      CommandServiceController,
    );
  });

  describe('root', () => {
    it('should return "pong from command-service"', () => {
      expect(commandServiceController.ping()).toBe('pong from command-service');
    });
  });
});
