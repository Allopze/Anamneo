import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { IsString, MaxLength } from 'class-validator';
import { IsOptional } from 'class-validator';

class UpdateSettingsDto {
  @IsString() @MaxLength(200) @IsOptional() clinicName?: string;
  @IsString() @MaxLength(500) @IsOptional() clinicAddress?: string;
  @IsString() @MaxLength(50) @IsOptional() clinicPhone?: string;
  @IsString() @MaxLength(200) @IsOptional() clinicEmail?: string;
}

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Roles('ADMIN')
  getAll() {
    return this.settingsService.getAll();
  }

  @Put()
  @Roles('ADMIN')
  update(@Body() dto: UpdateSettingsDto) {
    const data: Record<string, string> = {};
    if (dto.clinicName !== undefined) data['clinic.name'] = dto.clinicName;
    if (dto.clinicAddress !== undefined) data['clinic.address'] = dto.clinicAddress;
    if (dto.clinicPhone !== undefined) data['clinic.phone'] = dto.clinicPhone;
    if (dto.clinicEmail !== undefined) data['clinic.email'] = dto.clinicEmail;
    return this.settingsService.setMany(data);
  }
}
