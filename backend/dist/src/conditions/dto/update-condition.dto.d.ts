import { CreateConditionDto } from './create-condition.dto';
declare const UpdateConditionDto_base: import("@nestjs/mapped-types").MappedType<Partial<CreateConditionDto>>;
export declare class UpdateConditionDto extends UpdateConditionDto_base {
    active?: boolean;
}
export {};
