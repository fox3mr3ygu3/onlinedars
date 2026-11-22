/**
 * Authorization metadata of every backend-learning controller (CLAUDE.md rule 7): the global
 * RolesGuard enforces these on the server. Students only reach /me/*, staff routes need
 * ADMIN (or ADMIN + CONTENT_MANAGER for exam content), and only verify is public.
 */
import { Role } from '@onlinedars/shared';
import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../../common/decorators';
import {
  AdminCertificateTemplatesController,
  CertificatesPublicController,
  MeCertificatesController,
} from '../certificates/certificates.controller';
import { AdminExamsController, MeExamsController } from '../exams/exams.controller';
import { ReportsController } from '../reports/reports.controller';
import { StudentsController } from '../students/students.controller';
import { ProgressController } from './progress.controller';

const roles = (target: object) => Reflect.getMetadata(ROLES_KEY, target) as Role[] | undefined;

describe('learning controllers: roles', () => {
  it.each([
    ['ProgressController', ProgressController],
    ['MeExamsController', MeExamsController],
    ['MeCertificatesController', MeCertificatesController],
  ])('%s is STUDENT-only', (_n, ctrl) => {
    expect(roles(ctrl)).toEqual([Role.STUDENT]);
  });

  it.each([
    ['AdminCertificateTemplatesController', AdminCertificateTemplatesController],
    ['ReportsController', ReportsController],
    ['StudentsController', StudentsController],
  ])('%s is ADMIN-only', (_n, ctrl) => {
    expect(roles(ctrl)).toEqual([Role.ADMIN]);
  });

  it('exam configuration is ADMIN + CONTENT_MANAGER', () => {
    expect(roles(AdminExamsController)).toEqual([Role.ADMIN, Role.CONTENT_MANAGER]);
  });

  it('only certificate verification is public', () => {
    const verify = Object.getOwnPropertyDescriptor(
      CertificatesPublicController.prototype,
      'verify',
    )!.value as object;
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, verify)).toBe(true);
    for (const ctrl of [
      ProgressController,
      MeExamsController,
      MeCertificatesController,
      ReportsController,
    ]) {
      for (const name of Object.getOwnPropertyNames(ctrl.prototype)) {
        const fn = (ctrl.prototype as Record<string, unknown>)[name];
        if (typeof fn === 'function')
          expect(Reflect.getMetadata(IS_PUBLIC_KEY, fn)).toBeUndefined();
      }
    }
  });
});
