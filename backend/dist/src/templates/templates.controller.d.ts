import { TemplatesService } from './templates.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';
export declare class TemplatesController {
    private readonly templatesService;
    constructor(templatesService: TemplatesService);
    findAll(user: CurrentUserData): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        medicoId: string;
        sectionKey: string | null;
        category: string;
        content: string;
    }[]>;
    create(user: CurrentUserData, dto: CreateTemplateDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        medicoId: string;
        sectionKey: string | null;
        category: string;
        content: string;
    }>;
    update(id: string, user: CurrentUserData, dto: UpdateTemplateDto): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        medicoId: string;
        sectionKey: string | null;
        category: string;
        content: string;
    }>;
    delete(id: string, user: CurrentUserData): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        medicoId: string;
        sectionKey: string | null;
        category: string;
        content: string;
    }>;
}
