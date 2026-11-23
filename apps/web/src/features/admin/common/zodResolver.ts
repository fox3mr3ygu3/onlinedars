import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';

/**
 * react-hook-form resolver that maps form values to an API body before validating with a shared zod
 * schema (e.g. so'm → tiyin, textarea lines → string[]). Issue paths are mapped back to form fields
 * with `fieldFor` (defaults to the first path segment). Messages stay i18n keys.
 */
export function mappedZodResolver<TForm extends FieldValues, TSchema extends z.ZodType>(
  schema: TSchema,
  toInput: (values: TForm) => unknown,
  fieldFor: (path: PropertyKey[]) => string = (p) => String(p[0] ?? 'root'),
): Resolver<TForm> {
  return async (values) => {
    const parsed = schema.safeParse(toInput(values));
    if (parsed.success) return { values, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of parsed.error.issues) {
      const field = fieldFor(issue.path);
      if (!errors[field]) errors[field] = { type: issue.code, message: issue.message };
    }
    return { values: {}, errors: errors as unknown as FieldErrors<TForm> };
  };
}
