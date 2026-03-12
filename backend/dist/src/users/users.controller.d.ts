import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
declare class ResetPasswordDto {
    temporaryPassword: string;
}
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    create(createUserDto: CreateUserDto): Promise<{
        id: string;
        active: boolean;
        createdAt: Date;
        email: string;
        nombre: string;
        role: string;
        medicoId: string | null;
        isAdmin: boolean;
    }>;
    findAll(): Promise<{
        id: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        nombre: string;
        role: string;
        medicoId: string | null;
        isAdmin: boolean;
    }[]>;
    findOne(id: string): Promise<{
        id: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        nombre: string;
        role: string;
        medicoId: string | null;
        isAdmin: boolean;
    } | null>;
    update(id: string, updateUserDto: UpdateUserDto): Promise<{
        id: string;
        active: boolean;
        updatedAt: Date;
        email: string;
        nombre: string;
        role: string;
        medicoId: string | null;
        isAdmin: boolean;
    }>;
    remove(id: string): Promise<{
        id: string;
        active: boolean;
        email: string;
    }>;
    resetPassword(id: string, dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
}
export {};
