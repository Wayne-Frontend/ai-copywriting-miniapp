import { isDeepStrictEqual } from 'node:util';
import { defaultFormSchema, defaultOutputSchema, type ManagedTemplateCode } from './template-definitions';

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validShape(value: unknown, baseline: unknown, depth = 0): boolean {
  if (depth > 8 || !record(value) || !record(baseline)) return false;
  if (!isDeepStrictEqual(value.type, baseline.type)) return false;
  if (baseline.type === 'object') {
    if (Object.keys(value).some((key) => !['type', 'additionalProperties', 'required', 'properties', 'title'].includes(key))) return false;
    if (value.additionalProperties !== false || !record(value.properties) || !record(baseline.properties) ||
      !isDeepStrictEqual(Object.keys(value.properties).sort(), Object.keys(baseline.properties).sort()) ||
      !isDeepStrictEqual(value.required, baseline.required)) return false;
    return Object.keys(baseline.properties).every((key) =>
      validShape((value.properties as Record<string, unknown>)[key],
        (baseline.properties as Record<string, unknown>)[key], depth + 1));
  }
  if (baseline.type === 'array') {
    if (Object.keys(value).some((key) => !['type', 'items', 'minItems', 'maxItems', 'title'].includes(key))) return false;
    return validShape(value.items, baseline.items, depth + 1) &&
      (baseline.minItems === undefined || value.minItems === baseline.minItems) &&
      (baseline.maxItems === undefined || value.maxItems === baseline.maxItems) &&
      (value.minItems === undefined || (Number.isSafeInteger(value.minItems) && Number(value.minItems) >= 0)) &&
      (value.maxItems === undefined || (Number.isSafeInteger(value.maxItems) && Number(value.maxItems) >= Number(value.minItems ?? 0) && Number(value.maxItems) <= 100));
  }
  if (baseline.enum !== undefined && !isDeepStrictEqual(value.enum, baseline.enum)) return false;
  if (baseline.minItems !== undefined && value.minItems !== baseline.minItems) return false;
  if (baseline.maxItems !== undefined && value.maxItems !== baseline.maxItems) return false;
  if (baseline.minLength !== undefined &&
    (value.minLength === undefined || Number(value.minLength) < Number(baseline.minLength))) return false;
  if (value.minLength !== undefined && (!Number.isSafeInteger(value.minLength) || Number(value.minLength) < Number(baseline.minLength ?? 0))) return false;
  if (value.maxLength !== undefined && (!Number.isSafeInteger(value.maxLength) || Number(value.maxLength) < Number(value.minLength ?? 0) || Number(value.maxLength) > Number(baseline.maxLength ?? 10000))) return false;
  if (value.title !== undefined && (typeof value.title !== 'string' || value.title.length > 80)) return false;
  if (value.default !== undefined && !validateValue(value.default, { type: value.type, enum: value.enum })) return false;
  if (value.pattern !== undefined && (typeof value.pattern !== 'string' || value.pattern !== baseline.pattern)) return false;
  return Object.keys(value).every((key) => ['type', 'enum', 'minLength', 'maxLength', 'title', 'default', 'pattern'].includes(key));
}

export function validTemplateSchemas(code: ManagedTemplateCode, form: unknown, output: unknown): boolean {
  if (JSON.stringify(form)?.length > 20000 || JSON.stringify(output)?.length > 20000) return false;
  return validShape(form, defaultFormSchema(code)) && validShape(output, defaultOutputSchema(code));
}

export function validateValue(value: unknown, schema: unknown, depth = 0): boolean {
  if (depth > 8 || !record(schema)) return false;
  const type = schema.type;
  if (type === 'object') {
    if (!record(value) || !record(schema.properties) || !Array.isArray(schema.required)) return false;
    if (Object.keys(value).some((key) => !(key in (schema.properties as Record<string, unknown>)))) return false;
    if (schema.required.some((key) => typeof key !== 'string' || !(key in value))) return false;
    return Object.entries(value).every(([key, item]) =>
      validateValue(item, (schema.properties as Record<string, unknown>)[key], depth + 1));
  }
  if (type === 'array') {
    return Array.isArray(value) && value.length >= Number(schema.minItems ?? 0) &&
      value.length <= Number(schema.maxItems ?? 100) &&
      value.every((item) => validateValue(item, schema.items, depth + 1));
  }
  if (Array.isArray(type)) return type.includes('null') && value === null ||
    type.includes('string') && typeof value === 'string' && value.length <= 10000;
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value) &&
    (!Array.isArray(schema.enum) || schema.enum.includes(value));
  if (type === 'string') return typeof value === 'string' &&
    value.length >= Number(schema.minLength ?? 0) && value.length <= Number(schema.maxLength ?? 10000) &&
    (!Array.isArray(schema.enum) || schema.enum.includes(value)) &&
    (typeof schema.pattern !== 'string' || new RegExp(schema.pattern).test(value));
  return false;
}
