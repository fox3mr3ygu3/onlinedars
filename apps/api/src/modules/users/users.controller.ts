import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { type AuthPrincipal, type AuthUser, Role } from '@onlinedars/shared';
import { CurrentUser, Roles } from '../../common/decorators';
import { AuthUserDto } from '../auth/dto';
import { ChangePasswordDto, UpdateProfileDto } from './dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Roles(Role.STUDENT, Role.CONTENT_MANAGER, Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOkResponse({ type: AuthUserDto })
  getMe(@CurrentUser() user: AuthPrincipal): Promise<AuthUser> {
    return this.users.getOwnProfile(user);
  }

  @Patch('me')
  @ApiOkResponse({ type: AuthUserDto })
  updateMe(@CurrentUser() user: AuthPrincipal, @Body() dto: UpdateProfileDto): Promise<AuthUser> {
    return this.users.updateOwnProfile(user, dto);
  }

  @Post('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.users.changeOwnPassword(user, dto);
  }
}
