import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AdminDirection,
  CONTENT_ROLES,
  type Paginated,
  type PublicDirection,
} from '@onlinedars/shared';
import { Public, Roles } from '../../common/decorators';
import { DirectionsService } from './directions.service';
import {
  AdminListQueryDto,
  DirectionInputDto,
  DirectionUpdateDto,
  PublicDirectionListDto,
  PublicListQueryDto,
} from './dto';

@ApiTags('catalog')
@Controller('directions')
export class DirectionsController {
  constructor(private readonly directions: DirectionsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Active directions with published course counts' })
  @ApiOkResponse({ type: PublicDirectionListDto })
  list(@Query() query: PublicListQueryDto): Promise<Paginated<PublicDirection>> {
    return this.directions.listPublic(query);
  }
}

@ApiTags('admin: directions')
@ApiBearerAuth()
@Roles(...CONTENT_ROLES)
@Controller('admin/directions')
export class AdminDirectionsController {
  constructor(private readonly directions: DirectionsService) {}

  @Get()
  @ApiOperation({ summary: 'All directions (incl. inactive)' })
  list(@Query() query: AdminListQueryDto): Promise<Paginated<AdminDirection>> {
    return this.directions.listAdmin(query);
  }

  @Post()
  create(@Body() dto: DirectionInputDto): Promise<AdminDirection> {
    return this.directions.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<AdminDirection> {
    return this.directions.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: DirectionUpdateDto): Promise<AdminDirection> {
    return this.directions.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a direction (its courses keep existing, without direction)' })
  remove(@Param('id') id: string): Promise<void> {
    return this.directions.remove(id);
  }
}
