import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

// Fuente de verdad: solo role==='ADMIN' otorga acceso admin.
// isAdmin es un flag de bootstrap (el primer usuario creado lo recibe junto al role ADMIN).
// Ningún usuario con role !== 'ADMIN' debe pasar este guard aunque tenga isAdmin=true.
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    if (!user.isAdmin || user.role !== 'ADMIN') {
      throw new ForbiddenException('No tiene permisos de administración');
    }

    return true;
  }
}
