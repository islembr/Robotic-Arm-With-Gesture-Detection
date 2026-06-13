import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      name: 'Aidant API',
      status: 'ok',
      endpoints: [
        'POST /auth/login',
        'GET /dashboard/stats',
        'GET /monitoring/live',
        'GET /mappings',
        'GET /history',
        'GET /alerts',
        'PATCH /alerts/:id/resolve',
        'GET /settings/profile',
      ],
    };
  }
}
