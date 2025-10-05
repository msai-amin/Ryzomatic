/**
 * Comprehensive Validation System
 * Provides input validation, sanitization, and type checking
 */

import { logger, LogContext } from './logger';
import { errorHandler, ErrorType, ErrorSeverity } from './errorHandler';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedValue?: any;
}

export interface ValidationRule {
  name: string;
  validate: (value: any, context?: any) => ValidationResult;
  sanitize?: (value: any) => any;
}

export interface ValidationSchema {
  [key: string]: ValidationRule | ValidationRule[];
}

class ValidationService {
  private static instance: ValidationService;
  private rules: Map<string, ValidationRule> = new Map();

  private constructor() {
    this.setupDefaultRules();
  }

  public static getInstance(): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService();
    }
    return ValidationService.instance;
  }

  private setupDefaultRules(): void {
    // String validation rules
    this.addRule('required', {
      name: 'required',
      validate: (value: any) => ({
        isValid: value !== null && value !== undefined && value !== '',
        errors: value === null || value === undefined || value === '' ? ['Field is required'] : [],
        warnings: []
      })
    });

    this.addRule('string', {
      name: 'string',
      validate: (value: any) => ({
        isValid: typeof value === 'string',
        errors: typeof value !== 'string' ? ['Value must be a string'] : [],
        warnings: []
      }),
      sanitize: (value: any) => String(value)
    });

    this.addRule('email', {
      name: 'email',
      validate: (value: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return {
          isValid: emailRegex.test(value),
          errors: !emailRegex.test(value) ? ['Invalid email format'] : [],
          warnings: []
        };
      },
      sanitize: (value: string) => value.toLowerCase().trim()
    });

    this.addRule('minLength', {
      name: 'minLength',
      validate: (value: string, minLength: number) => ({
        isValid: value.length >= minLength,
        errors: value.length < minLength ? [`Minimum length is ${minLength} characters`] : [],
        warnings: []
      })
    });

    this.addRule('maxLength', {
      name: 'maxLength',
      validate: (value: string, maxLength: number) => ({
        isValid: value.length <= maxLength,
        errors: value.length > maxLength ? [`Maximum length is ${maxLength} characters`] : [],
        warnings: []
      })
    });

    // Number validation rules
    this.addRule('number', {
      name: 'number',
      validate: (value: any) => ({
        isValid: typeof value === 'number' && !isNaN(value),
        errors: typeof value !== 'number' || isNaN(value) ? ['Value must be a number'] : [],
        warnings: []
      }),
      sanitize: (value: any) => Number(value)
    });

    this.addRule('min', {
      name: 'min',
      validate: (value: number, min: number) => ({
        isValid: value >= min,
        errors: value < min ? [`Value must be at least ${min}`] : [],
        warnings: []
      })
    });

    this.addRule('max', {
      name: 'max',
      validate: (value: number, max: number) => ({
        isValid: value <= max,
        errors: value > max ? [`Value must be at most ${max}`] : [],
        warnings: []
      })
    });

    // File validation rules
    this.addRule('file', {
      name: 'file',
      validate: (value: any) => ({
        isValid: value instanceof File,
        errors: !(value instanceof File) ? ['Value must be a file'] : [],
        warnings: []
      })
    });

    this.addRule('fileType', {
      name: 'fileType',
      validate: (value: File, allowedTypes: string[]) => ({
        isValid: allowedTypes.includes(value.type),
        errors: !allowedTypes.includes(value.type) ? [`File type must be one of: ${allowedTypes.join(', ')}`] : [],
        warnings: []
      })
    });

    this.addRule('fileSize', {
      name: 'fileSize',
      validate: (value: File, maxSize: number) => ({
        isValid: value.size <= maxSize,
        errors: value.size > maxSize ? [`File size must be at most ${maxSize} bytes`] : [],
        warnings: []
      })
    });

    // PDF specific validation
    this.addRule('pdfFile', {
      name: 'pdfFile',
      validate: (value: File) => ({
        isValid: value.type === 'application/pdf',
        errors: value.type !== 'application/pdf' ? ['File must be a PDF'] : [],
        warnings: []
      })
    });

    // URL validation
    this.addRule('url', {
      name: 'url',
      validate: (value: string) => {
        try {
          new URL(value);
          return {
            isValid: true,
            errors: [],
            warnings: []
          };
        } catch {
          return {
            isValid: false,
            errors: ['Invalid URL format'],
            warnings: []
          };
        }
      }
    });

    // Array validation
    this.addRule('array', {
      name: 'array',
      validate: (value: any) => ({
        isValid: Array.isArray(value),
        errors: !Array.isArray(value) ? ['Value must be an array'] : [],
        warnings: []
      })
    });

    this.addRule('minItems', {
      name: 'minItems',
      validate: (value: any[], minItems: number) => ({
        isValid: value.length >= minItems,
        errors: value.length < minItems ? [`Array must have at least ${minItems} items`] : [],
        warnings: []
      })
    });

    this.addRule('maxItems', {
      name: 'maxItems',
      validate: (value: any[], maxItems: number) => ({
        isValid: value.length <= maxItems,
        errors: value.length > maxItems ? [`Array must have at most ${maxItems} items`] : [],
        warnings: []
      })
    });

    // Object validation
    this.addRule('object', {
      name: 'object',
      validate: (value: any) => ({
        isValid: typeof value === 'object' && value !== null && !Array.isArray(value),
        errors: typeof value !== 'object' || value === null || Array.isArray(value) ? ['Value must be an object'] : [],
        warnings: []
      })
    });

    // Custom validation for document content
    this.addRule('documentContent', {
      name: 'documentContent',
      validate: (value: string) => {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!value || value.trim().length === 0) {
          errors.push('Document content cannot be empty');
        }

        if (value.length > 1000000) { // 1MB text limit
          errors.push('Document content is too large');
        }

        if (value.length > 100000) { // 100KB warning
          warnings.push('Document content is very large and may affect performance');
        }

        return {
          isValid: errors.length === 0,
          errors,
          warnings
        };
      },
      sanitize: (value: string) => value.trim()
    });

    // Custom validation for AI prompts
    this.addRule('aiPrompt', {
      name: 'aiPrompt',
      validate: (value: string) => {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!value || value.trim().length === 0) {
          errors.push('Prompt cannot be empty');
        }

        if (value.length > 10000) {
          errors.push('Prompt is too long');
        }

        if (value.length > 5000) {
          warnings.push('Long prompts may affect AI response quality');
        }

        // Check for potentially harmful content
        const harmfulPatterns = [
          /ignore\s+previous\s+instructions/i,
          /system\s+prompt/i,
          /jailbreak/i
        ];

        for (const pattern of harmfulPatterns) {
          if (pattern.test(value)) {
            warnings.push('Prompt may contain potentially harmful content');
            break;
          }
        }

        return {
          isValid: errors.length === 0,
          errors,
          warnings
        };
      },
      sanitize: (value: string) => value.trim()
    });
  }

  public addRule(name: string, rule: ValidationRule): void {
    this.rules.set(name, rule);
  }

  public getRule(name: string): ValidationRule | undefined {
    return this.rules.get(name);
  }

  public validate(value: any, rules: (ValidationRule | string)[], context?: LogContext): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let sanitizedValue = value;

    for (const rule of rules) {
      const ruleObj = typeof rule === 'string' ? this.getRule(rule) : rule;
      
      if (!ruleObj) {
        logger.warn(`Validation rule not found: ${typeof rule === 'string' ? rule : rule.name}`, context);
        continue;
      }

      try {
        const result = ruleObj.validate(value, context);
        
        if (!result.isValid) {
          errors.push(...result.errors);
        }
        
        warnings.push(...result.warnings);

        // Apply sanitization if available
        if (ruleObj.sanitize && result.isValid) {
          sanitizedValue = ruleObj.sanitize(sanitizedValue);
        }
      } catch (error) {
        logger.error(`Validation rule error: ${ruleObj.name}`, context, error as Error);
        errors.push(`Validation error: ${ruleObj.name}`);
      }
    }

    const isValid = errors.length === 0;

    if (!isValid) {
      logger.warn(`Validation failed`, context, undefined, {
        value: typeof value === 'string' ? value.substring(0, 100) : value,
        errors,
        warnings
      });
    }

    return {
      isValid,
      errors,
      warnings,
      sanitizedValue: isValid ? sanitizedValue : undefined
    };
  }

  public validateSchema(data: any, schema: ValidationSchema, context?: LogContext): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const sanitizedData: any = {};

    for (const [field, rules] of Object.entries(schema)) {
      const fieldRules = Array.isArray(rules) ? rules : [rules];
      const fieldValue = data[field];
      
      const result = this.validate(fieldValue, fieldRules, {
        ...context,
        component: 'ValidationService',
        action: 'validateSchema',
        field
      });

      if (!result.isValid) {
        errors.push(...result.errors.map(error => `${field}: ${error}`));
      }

      warnings.push(...result.warnings.map(warning => `${field}: ${warning}`));

      if (result.sanitizedValue !== undefined) {
        sanitizedData[field] = result.sanitizedValue;
      } else {
        sanitizedData[field] = fieldValue;
      }
    }

    const isValid = errors.length === 0;

    if (!isValid) {
      logger.warn(`Schema validation failed`, context, undefined, {
        errors,
        warnings,
        fields: Object.keys(schema)
      });
    }

    return {
      isValid,
      errors,
      warnings,
      sanitizedValue: isValid ? sanitizedData : undefined
    };
  }

  // Convenience methods for common validations
  public validateEmail(email: string, context?: LogContext): ValidationResult {
    return this.validate(email, ['required', 'string', 'email'], context);
  }

  public validatePassword(password: string, context?: LogContext): ValidationResult {
    return this.validate(password, [
      'required',
      'string',
      { name: 'minLength', validate: (value: string) => this.getRule('minLength')!.validate(value, 8) }
    ], context);
  }

  public validateFile(file: File, options: { maxSize?: number; allowedTypes?: string[] } = {}, context?: LogContext): ValidationResult {
    const rules: (ValidationRule | string)[] = ['required', 'file'];

    if (options.maxSize) {
      rules.push({ name: 'fileSize', validate: (value: File) => this.getRule('fileSize')!.validate(value, options.maxSize!) });
    }

    if (options.allowedTypes) {
      rules.push({ name: 'fileType', validate: (value: File) => this.getRule('fileType')!.validate(value, options.allowedTypes!) });
    }

    return this.validate(file, rules, context);
  }

  public validatePDFFile(file: File, context?: LogContext): ValidationResult {
    return this.validate(file, [
      'required',
      'file',
      'pdfFile',
      { name: 'fileSize', validate: (value: File) => this.getRule('fileSize')!.validate(value, 50 * 1024 * 1024) } // 50MB limit
    ], context);
  }

  public validateDocumentContent(content: string, context?: LogContext): ValidationResult {
    return this.validate(content, ['required', 'string', 'documentContent'], context);
  }

  public validateAIPrompt(prompt: string, context?: LogContext): ValidationResult {
    return this.validate(prompt, ['required', 'string', 'aiPrompt'], context);
  }

  // Sanitization methods
  public sanitizeString(value: string): string {
    return value.trim().replace(/[<>]/g, '');
  }

  public sanitizeHTML(value: string): string {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  }

  public sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  }
}

// Export singleton instance
export const validationService = ValidationService.getInstance();

// Convenience functions
export const validate = (value: any, rules: (ValidationRule | string)[], context?: LogContext) =>
  validationService.validate(value, rules, context);

export const validateSchema = (data: any, schema: ValidationSchema, context?: LogContext) =>
  validationService.validateSchema(data, schema, context);

export const validateEmail = (email: string, context?: LogContext) =>
  validationService.validateEmail(email, context);

export const validateFile = (file: File, options?: { maxSize?: number; allowedTypes?: string[] }, context?: LogContext) =>
  validationService.validateFile(file, options, context);

export const validatePDFFile = (file: File, context?: LogContext) =>
  validationService.validatePDFFile(file, context);

export const validateDocumentContent = (content: string, context?: LogContext) =>
  validationService.validateDocumentContent(content, context);

export const validateAIPrompt = (prompt: string, context?: LogContext) =>
  validationService.validateAIPrompt(prompt, context);
