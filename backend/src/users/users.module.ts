import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { UsersService } from './users.service';
import { UsersSessionService } from './users-session.service';
import { UsersInvitationService } from './users-invitation.service';
import { UsersController } from './users.controller';
import { UsersLookupController } from './users-lookup.controller';

@Module({
  imports: [MailModule],
  controllers: [UsersLookupController, UsersController],
  providers: [UsersService, UsersSessionService, UsersInvitationService],
  exports: [UsersService, UsersSessionService, UsersInvitationService],
})
export class UsersModule {}
