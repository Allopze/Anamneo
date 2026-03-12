import { Role } from '../../common/types';
export declare class CreateUserDto {
    email: string;
    password: string;
    nombre: string;
    role?: Role;
    medicoId?: string;
}
