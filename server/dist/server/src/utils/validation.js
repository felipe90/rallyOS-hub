"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = void 0;
exports.validatePayload = validatePayload;
exports.validateSocketPayload = validateSocketPayload;
class ValidationError extends Error {
    constructor(code, field, message, expected, received) {
        super(message);
        this.code = code;
        this.field = field;
        this.message = message;
        this.expected = expected;
        this.received = received;
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
function getTypeName(value) {
    if (value === null)
        return 'null';
    if (value === undefined)
        return 'undefined';
    return typeof value;
}
function checkRequired(field, value, rule) {
    if (rule.required && (value === undefined || value === null)) {
        throw new ValidationError('VALIDATION_ERROR', field, `Field '${field}' is required`, 'present', value === undefined ? 'missing' : 'null');
    }
}
function checkType(field, value, rule) {
    if (rule.type && value !== undefined && value !== null) {
        if (rule.type === 'object') {
            if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                throw new ValidationError('VALIDATION_ERROR', field, `Field '${field}' must be an object`, 'object', Array.isArray(value) ? 'array' : getTypeName(value));
            }
        }
        else if (typeof value !== rule.type) {
            throw new ValidationError('VALIDATION_ERROR', field, `Field '${field}' must be of type ${rule.type}`, rule.type, getTypeName(value));
        }
    }
}
function checkStringLength(field, value, rule) {
    if (typeof value === 'string') {
        if (rule.minLength !== undefined && value.length < rule.minLength) {
            throw new ValidationError('VALIDATION_ERROR', field, `Field '${field}' must be at least ${rule.minLength} characters`, `minLength: ${rule.minLength}`, `length: ${value.length}`);
        }
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
            throw new ValidationError('VALIDATION_ERROR', field, `Field '${field}' must be at most ${rule.maxLength} characters`, `maxLength: ${rule.maxLength}`, `length: ${value.length}`);
        }
    }
}
function checkPattern(field, value, rule) {
    if (typeof value === 'string' && rule.pattern) {
        if (!rule.pattern.test(value)) {
            throw new ValidationError('VALIDATION_ERROR', field, `Field '${field}' does not match required pattern`, `pattern: ${rule.pattern.toString()}`, `value: ${value}`);
        }
    }
}
function checkEnum(field, value, rule) {
    if (typeof value === 'string' && rule.enum) {
        if (!rule.enum.includes(value)) {
            throw new ValidationError('VALIDATION_ERROR', field, `Field '${field}' must be one of: ${rule.enum.join(', ')}`, `enum: [${rule.enum.join(', ')}]`, `value: ${value}`);
        }
    }
}
function checkNumericRange(field, value, rule) {
    if (typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
            throw new ValidationError('VALIDATION_ERROR', field, `Field '${field}' must be at least ${rule.min}`, `min: ${rule.min}`, `value: ${value}`);
        }
        if (rule.max !== undefined && value > rule.max) {
            throw new ValidationError('VALIDATION_ERROR', field, `Field '${field}' must be at most ${rule.max}`, `max: ${rule.max}`, `value: ${value}`);
        }
    }
}
function validatePayload(data, rules) {
    for (const [field, rule] of Object.entries(rules)) {
        const value = data[field];
        checkRequired(field, value, rule);
        if (value !== undefined && value !== null) {
            checkType(field, value, rule);
            checkStringLength(field, value, rule);
            checkPattern(field, value, rule);
            checkEnum(field, value, rule);
            checkNumericRange(field, value, rule);
        }
    }
}
function validateSocketPayload(socket, data, rules, eventName) {
    try {
        validatePayload(data, rules);
        return true;
    }
    catch (error) {
        if (error instanceof ValidationError) {
            socket.emit('ERROR', {
                code: error.code,
                message: error.message,
                field: error.field,
                event: eventName
            });
            return false;
        }
        throw error;
    }
}
