export class PayloadValidationError extends Error {
  constructor(
    public code: 'VALIDATION_ERROR',
    public field: string,
    public message: string,
    public expected?: string,
    public received?: string
  ) {
    super(message);
    this.name = 'PayloadValidationError';
  }
}

export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'object' | 'boolean';
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;
  enum?: string[];
  min?: number;
  max?: number;
}

export interface ValidationRules {
  [field: string]: ValidationRule;
}

function getTypeName(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  return typeof value;
}

function checkRequired(field: string, value: any, rule: ValidationRule): void {
  if (rule.required && (value === undefined || value === null)) {
    throw new PayloadValidationError(
      'VALIDATION_ERROR',
      field,
      `Field '${field}' is required`,
      'present',
      value === undefined ? 'missing' : 'null'
    );
  }
}

function checkType(field: string, value: any, rule: ValidationRule): void {
  if (rule.type && value !== undefined && value !== null) {
    if (rule.type === 'object') {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new PayloadValidationError(
          'VALIDATION_ERROR',
          field,
          `Field '${field}' must be an object`,
          'object',
          Array.isArray(value) ? 'array' : getTypeName(value)
        );
      }
    } else if (typeof value !== rule.type) {
      throw new PayloadValidationError(
        'VALIDATION_ERROR',
        field,
        `Field '${field}' must be of type ${rule.type}`,
        rule.type,
        getTypeName(value)
      );
    }
  }
}

function checkStringLength(field: string, value: any, rule: ValidationRule): void {
  if (typeof value === 'string') {
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      throw new PayloadValidationError(
        'VALIDATION_ERROR',
        field,
        `Field '${field}' must be at least ${rule.minLength} characters`,
        `minLength: ${rule.minLength}`,
        `length: ${value.length}`
      );
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      throw new PayloadValidationError(
        'VALIDATION_ERROR',
        field,
        `Field '${field}' must be at most ${rule.maxLength} characters`,
        `maxLength: ${rule.maxLength}`,
        `length: ${value.length}`
      );
    }
  }
}

function checkPattern(field: string, value: any, rule: ValidationRule): void {
  if (typeof value === 'string' && rule.pattern) {
    if (!rule.pattern.test(value)) {
      throw new PayloadValidationError(
        'VALIDATION_ERROR',
        field,
        `Field '${field}' has an invalid format`,
      );
    }
  }
}

function checkEnum(field: string, value: any, rule: ValidationRule): void {
  if (typeof value === 'string' && rule.enum) {
    if (!rule.enum.includes(value)) {
      throw new PayloadValidationError(
        'VALIDATION_ERROR',
        field,
        `Field '${field}' has an invalid value`,
      );
    }
  }
}

function checkNumericRange(field: string, value: any, rule: ValidationRule): void {
  if (typeof value === 'number') {
    if (rule.min !== undefined && value < rule.min) {
      throw new PayloadValidationError(
        'VALIDATION_ERROR',
        field,
        `Field '${field}' is below the minimum allowed value`,
      );
    }
    if (rule.max !== undefined && value > rule.max) {
      throw new PayloadValidationError(
        'VALIDATION_ERROR',
        field,
        `Field '${field}' exceeds the maximum allowed value`,
      );
    }
  }
}

export function validatePayload(data: any, rules: ValidationRules): void {
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

export function validateSocketPayload(
  socket: any,
  data: any,
  rules: ValidationRules,
  eventName: string
): boolean {
  try {
    validatePayload(data, rules);
    return true;
  } catch (error) {
    if (error instanceof PayloadValidationError) {
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
