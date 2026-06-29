import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto, UpdateAppointmentDto, CancelAppointmentDto } from './dto/appointment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  @Roles('MEDICO', 'ASISTENTE')
  findByRange(
    @Query('medicoId') medicoId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.appointmentsService.findByRange(medicoId, startDate, endDate, user);
  }

  @Post()
  @Roles('MEDICO', 'ASISTENTE')
  create(@Body() dto: CreateAppointmentDto, @CurrentUser() user: CurrentUserData) {
    return this.appointmentsService.create(dto, user);
  }

  @Put(':id')
  @Roles('MEDICO', 'ASISTENTE')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.appointmentsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('MEDICO', 'ASISTENTE')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.appointmentsService.cancel(id, dto, user);
  }
}
