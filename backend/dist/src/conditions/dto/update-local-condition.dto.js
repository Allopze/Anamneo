"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateLocalConditionDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_local_condition_dto_1 = require("./create-local-condition.dto");
class UpdateLocalConditionDto extends (0, mapped_types_1.PartialType)(create_local_condition_dto_1.CreateLocalConditionDto) {
}
exports.UpdateLocalConditionDto = UpdateLocalConditionDto;
//# sourceMappingURL=update-local-condition.dto.js.map