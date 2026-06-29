import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersLookupController {
  constructor(private readonly usersService: UsersService) {}

  @Get('reassignment-medicos')
  @Roles('MEDICO', 'ADMIN')
  findActiveMedicosForReassignment() {
    return this.usersService.findActiveMedicosForReassignment();
  }
}
