import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    private assertNotLeavingSystemWithoutAdmin;
    countUsers(): Promise<number>;
    create(createUserDto: CreateUserDto & {
        isAdmin?: boolean;
    }): Promise<{
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
    findById(id: string): Promise<{
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
    findByEmail(email: string): Promise<{
        id: string;
        active: boolean;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        nombre: string;
        role: string;
        medicoId: string | null;
        isAdmin: boolean;
        passwordHash: string;
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
    updateProfile(id: string, data: {
        nombre?: string;
        email?: string;
    }): Promise<{
        id: string;
        email: string;
        nombre: string;
        role: string;
        medicoId: string | null;
        isAdmin: boolean;
    }>;
    changePassword(id: string, currentPassword: string, newPassword: string): Promise<void>;
    resetPassword(id: string, temporaryPassword: string): Promise<{
        message: string;
    }>;
}
