import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PatientsController } from '../../patients/patients.controller';
import { ConditionsController } from '../../conditions/conditions.controller';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { AdminGuard } from '../guards/admin.guard';

function collectControllerFiles(dirPath: string): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      return collectControllerFiles(fullPath);
    }

    if (entry.isFile() && entry.name.endsWith('.controller.ts')) {
      return [fullPath];
    }

    return [];
  });
}

function getControllerClasses() {
  const srcRoot = path.resolve(__dirname, '../..');
  const controllerFiles = collectControllerFiles(srcRoot);

  return controllerFiles.flatMap((filePath) => {
    const moduleExports = require(filePath) as Record<string, unknown>;

    return Object.values(moduleExports).filter((value): value is new (...args: unknown[]) => object => {
      return typeof value === 'function' && Reflect.hasMetadata(PATH_METADATA, value);
    });
  });
}

function getGuards(target: object, propertyKey?: string) {
  if (propertyKey) {
    const handler = (target as Record<string, unknown>)[propertyKey];

    if (typeof handler !== 'function') {
      return [];
    }

    return Reflect.getMetadata(GUARDS_METADATA, handler as object) ?? [];
  }

  return Reflect.getMetadata(GUARDS_METADATA, target) ?? [];
}

function hasGuard(guards: unknown[], guardType: Function) {
  return guards.some((guard) => guard === guardType);
}

describe('controller role metadata', () => {
  it('marks patient list as explicit admin and clinician access', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, PatientsController.prototype.findAll);
    expect(roles).toEqual(['ADMIN', 'MEDICO', 'ASISTENTE']);
  });

  it('marks patient duplicate checks as clinician-only', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, PatientsController.prototype.findPossibleDuplicates);
    expect(roles).toEqual(['MEDICO', 'ASISTENTE']);
  });

  it('marks condition reads and suggestions with explicit access', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ConditionsController.prototype.findAll)).toEqual([
      'ADMIN',
      'MEDICO',
      'ASISTENTE',
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, ConditionsController.prototype.findOne)).toEqual([
      'ADMIN',
      'MEDICO',
      'ASISTENTE',
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, ConditionsController.prototype.suggest)).toEqual([
      'ADMIN',
      'MEDICO',
      'ASISTENTE',
    ]);
  });

  it('requires explicit authorization metadata on every route protected by RolesGuard', () => {
    const failures: string[] = [];

    for (const controllerClass of getControllerClasses()) {
      const classGuards = getGuards(controllerClass);
      const classRoles = Reflect.getMetadata(ROLES_KEY, controllerClass) as string[] | undefined;
      const classIsPublic = Reflect.getMetadata(IS_PUBLIC_KEY, controllerClass) === true;
      const prototype = controllerClass.prototype;
      const methodNames = Object.getOwnPropertyNames(prototype).filter((name) => name !== 'constructor');

      for (const methodName of methodNames) {
        if (!Reflect.hasMetadata(METHOD_METADATA, prototype[methodName])) {
          continue;
        }

        const methodGuards = getGuards(prototype, methodName);
        const effectiveGuards = [...classGuards, ...methodGuards];
        const usesJwtAuthGuard = hasGuard(effectiveGuards, JwtAuthGuard);
        const usesRolesGuard = hasGuard(effectiveGuards, RolesGuard);
        const usesAdminGuard = hasGuard(effectiveGuards, AdminGuard);
        const methodRoles = Reflect.getMetadata(ROLES_KEY, prototype[methodName]) as string[] | undefined;
        const methodIsPublic = Reflect.getMetadata(IS_PUBLIC_KEY, prototype[methodName]) === true;
        const isPublic = classIsPublic || methodIsPublic;
        const hasExplicitRoles = Boolean((methodRoles && methodRoles.length > 0) || (classRoles && classRoles.length > 0));

        if (usesJwtAuthGuard && usesRolesGuard && !usesAdminGuard && !isPublic && !hasExplicitRoles) {
          failures.push(`${controllerClass.name}.${methodName}`);
        }
      }
    }

    expect(failures).toEqual([]);
  });
});