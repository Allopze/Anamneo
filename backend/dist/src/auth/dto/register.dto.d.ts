import { Role } from '../../common/types';
export { Role };
export declare class RegisterDto {
    email: string;
    password: string;
    nombre: string;
    role?: Role;
}
