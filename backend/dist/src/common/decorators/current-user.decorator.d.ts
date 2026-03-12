export interface CurrentUserData {
    id: string;
    email: string;
    nombre: string;
    role: string;
    isAdmin?: boolean;
    medicoId?: string | null;
}
export declare const CurrentUser: (...dataOrPipes: (keyof CurrentUserData | import("@nestjs/common").PipeTransform<any, any> | import("@nestjs/common").Type<import("@nestjs/common").PipeTransform<any, any>> | undefined)[]) => ParameterDecorator;
