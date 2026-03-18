import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateUserInvitationDto } from './dto/create-user-invitation.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';

class ResetPasswordDto {
  @IsString()
  @MinLength(8, { message: 'La contraseña temporal debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña temporal no puede exceder 72 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'La contraseña temporal debe contener mayúscula, minúscula y número',
  })
  @Matches(/^\S+$/, {
    message: 'La contraseña temporal no puede contener espacios',
  })
  temporaryPassword: string;
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, AdminGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Post('invitations')
  createInvitation(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateUserInvitationDto,
  ) {
    return this.usersService.createInvitation(user.id, dto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }

  @Post(':id/reset-password')
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.usersService.resetPassword(id, dto.temporaryPassword);
  }
}
