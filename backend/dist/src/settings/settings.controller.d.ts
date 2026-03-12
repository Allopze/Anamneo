import { SettingsService } from './settings.service';
declare class UpdateSettingsDto {
    clinicName?: string;
    clinicAddress?: string;
    clinicPhone?: string;
    clinicEmail?: string;
}
export declare class SettingsController {
    private readonly settingsService;
    constructor(settingsService: SettingsService);
    getAll(): Promise<Record<string, string>>;
    update(dto: UpdateSettingsDto): Promise<{
        id: string;
        updatedAt: Date;
        value: string;
        key: string;
    }[]>;
}
export {};
