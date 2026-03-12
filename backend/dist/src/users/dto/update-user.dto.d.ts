import { Role } from '../../common/types';
export declare class UpdateUserDto {
    email?: string;
    password?: string;
    nombre?: string;
    role?: Role;
    active?: boolean;
    medicoId?: string | null;
}
