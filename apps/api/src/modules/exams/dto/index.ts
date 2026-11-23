import {
  examAutosaveSchema,
  examConfigSchema,
  examSubmitSchema,
  questionInputSchema,
} from '@onlinedars/shared';
import { createZodDto } from 'nestjs-zod';

export class ExamConfigDto extends createZodDto(examConfigSchema) {}
export class ExamSubmitDto extends createZodDto(examSubmitSchema) {}
export class ExamAutosaveDto extends createZodDto(examAutosaveSchema) {}
export class ExamQuestionDto extends createZodDto(questionInputSchema) {}
