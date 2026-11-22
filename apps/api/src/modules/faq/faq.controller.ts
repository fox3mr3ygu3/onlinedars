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
import { type AdminFaq, CONTENT_ROLES, type Paginated, type PublicFaq } from '@onlinedars/shared';
import { Public, Roles } from '../../common/decorators';
import { AdminListQueryDto, FaqInputDto, FaqUpdateDto, PublicFaqListDto, PublicListQueryDto } from './dto';
import { FaqService } from './faq.service';

@ApiTags('catalog')
@Controller('faq')
export class FaqController {
  constructor(private readonly faq: FaqService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Active FAQ entries in display order' })
  @ApiOkResponse({ type: PublicFaqListDto })
  list(@Query() query: PublicListQueryDto): Promise<Paginated<PublicFaq>> {
    return this.faq.listPublic(query);
  }
}

@ApiTags('admin: faq')
@ApiBearerAuth()
@Roles(...CONTENT_ROLES)
@Controller('admin/faq')
export class AdminFaqController {
  constructor(private readonly faq: FaqService) {}

  @Get()
  list(@Query() query: AdminListQueryDto): Promise<Paginated<AdminFaq>> {
    return this.faq.listAdmin(query);
  }

  @Post()
  create(@Body() dto: FaqInputDto): Promise<AdminFaq> {
    return this.faq.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<AdminFaq> {
    return this.faq.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: FaqUpdateDto): Promise<AdminFaq> {
    return this.faq.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.faq.remove(id);
  }
}
