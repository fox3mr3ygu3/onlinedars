import { z } from 'zod';

export const idSchema = z.string().trim().min(1).max(64);
export const idParamSchema = z.object({ id: idSchema });
export type IdParam = z.infer<typeof idParamSchema>;

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'validation.slug' });

export const positionSchema = z.number().int().min(1);

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const paginated = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  });

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Body for reordering children: ids in their new order. */
export const reorderSchema = z.object({ ids: z.array(idSchema).min(1) });
export type ReorderInput = z.infer<typeof reorderSchema>;
