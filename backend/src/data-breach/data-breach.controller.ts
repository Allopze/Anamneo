import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { DataBreachService } from './data-breach.service';
import {
  AssessDataBreachDto,
  CloseDataBreachDto,
  CreateDataBreachDto,
  NotifyAgencyDto,
  NotifySubjectsDto,
} from './dto/data-breach.dto';

@Controller('admin/data-breaches')
@UseGuards(JwtAuthGuard, AdminGuard)
export class DataBreachController {
  constructor(private readonly service: DataBreachService) {}

  @Get()
  async list(
    @Query('status') status: string | undefined,
    @Query('severity') severity: string | undefined,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.service.list({ status, severity }, user);
  }

  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: CurrentUserData) {
    return this.service.getById(id, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateDataBreachDto, @CurrentUser() user: CurrentUserData) {
    return this.service.create(dto, user);
  }

  @Post(':id/assess')
  @HttpCode(HttpStatus.OK)
  async assess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssessDataBreachDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.service.assess(id, dto, user);
  }

  @Post(':id/notify-agency')
  @HttpCode(HttpStatus.OK)
  async notifyAgency(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NotifyAgencyDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.service.notifyAgency(id, dto, user);
  }

  @Post(':id/notify-subjects')
  @HttpCode(HttpStatus.OK)
  async notifySubjects(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NotifySubjectsDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.service.notifySubjects(id, dto, user);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  async close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseDataBreachDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.service.close(id, dto, user);
  }
}
