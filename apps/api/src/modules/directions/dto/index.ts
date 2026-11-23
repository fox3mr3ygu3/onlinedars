import {
  directionInputSchema,
  directionUpdateSchema,
  publicDirectionListSchema,
} from '@onlinedars/shared';
import { createZodDto } from 'nestjs-zod';

export { AdminListQueryDto, PublicListQueryDto } from '../../courses/dto/common';

export class DirectionInputDto extends createZodDto(directionInputSchema) {}
export class DirectionUpdateDto extends createZodDto(directionUpdateSchema) {}
export class PublicDirectionListDto extends createZodDto(publicDirectionListSchema) {}
