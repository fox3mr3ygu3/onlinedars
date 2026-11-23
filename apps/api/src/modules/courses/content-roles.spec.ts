/**
 * Authorization is declared on the server for every content route (CLAUDE.md rule 7):
 * admin content controllers → ADMIN + CONTENT_MANAGER, settings → ADMIN only, and the
 * public catalog routes are the only @Public() ones. Checked against the real decorators.
 */
import { Role } from '@onlinedars/shared';
import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../../common/decorators';
import {
  AdminDirectionsController,
  DirectionsController,
} from '../directions/directions.controller';
import { AdminFaqController, FaqController } from '../faq/faq.controller';
import { AdminFilesController, PublicFilesController } from '../files/files.controller';
import { LessonsController } from '../lessons/lessons.controller';
import { ModulesController } from '../modules/modules.controller';
import { PracticesController } from '../practices/practices.controller';
import { QuestionsController } from '../questions/questions.controller';
import { AdminSettingsController, PublicSettingsController } from '../settings/settings.controller';
import { AdminTeachersController, TeachersController } from '../teachers/teachers.controller';
import { AdminCoursesController, CoursesController } from './courses.controller';

type Ctor = { prototype: object; name: string };

function handlers(ctrl: Ctor): string[] {
  return Object.getOwnPropertyNames(ctrl.prototype).filter((n) => n !== 'constructor');
}

const handlerMeta = (ctrl: Ctor, key: string, name: string) =>
  Reflect.getMetadata(key, (ctrl.prototype as Record<string, object>)[name]!);

const CONTENT: Ctor[] = [
  AdminCoursesController,
  ModulesController,
  LessonsController,
  PracticesController,
  QuestionsController,
  AdminDirectionsController,
  AdminTeachersController,
  AdminFaqController,
  AdminFilesController,
];
const PUBLIC: Ctor[] = [
  CoursesController,
  DirectionsController,
  TeachersController,
  FaqController,
  PublicSettingsController,
  PublicFilesController,
];

describe('content route authorization', () => {
  it.each(CONTENT.map((c) => [c.name, c] as const))(
    '%s is ADMIN + CONTENT_MANAGER only, no public handlers',
    (_n, ctrl) => {
      expect(Reflect.getMetadata(ROLES_KEY, ctrl)).toEqual([Role.ADMIN, Role.CONTENT_MANAGER]);
      for (const h of handlers(ctrl)) {
        expect(handlerMeta(ctrl, IS_PUBLIC_KEY, h)).toBeUndefined();
        // No handler widens access with its own @Roles.
        expect(handlerMeta(ctrl, ROLES_KEY, h)).toBeUndefined();
      }
    },
  );

  it('settings admin controller is ADMIN only', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminSettingsController)).toEqual([Role.ADMIN]);
    for (const h of handlers(AdminSettingsController)) {
      expect(handlerMeta(AdminSettingsController, IS_PUBLIC_KEY, h)).toBeUndefined();
    }
  });

  it.each(PUBLIC.map((c) => [c.name, c] as const))('%s handlers are all @Public()', (_n, ctrl) => {
    for (const h of handlers(ctrl)) {
      expect(handlerMeta(ctrl, IS_PUBLIC_KEY, h)).toBe(true);
    }
  });
});
