/**
 * Validation rules for login form.
 * Centralized to ensure consistency across the app.
 */

import { normalizeEmail, isValidEmail } from '../../../lib/authHelpers';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export const MINIMO_PASSWORD = 6;
export const APODO_MINIMO = 3;
export const APODO_MAXIMO = 30;
export const INTENTOS_MAX_LOGIN = 5;
export const LOCKOUT_MINUTOS = 15;

/**
 * Validate email format.
 */
export function validateEmail(email: string | undefined): ValidationResult {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return { valid: false, error: 'Email requerido' };
  }

  if (!isValidEmail(normalized)) {
    return { valid: false, error: 'Email inválido. Ejemplo: usuario@ejemplo.com' };
  }

  return { valid: true };
}

/**
 * Validate password strength.
 */
export function validatePassword(password: string | undefined): ValidationResult {
  if (!password) {
    return { valid: false, error: 'Contraseña requerida' };
  }

  if (password.length < MINIMO_PASSWORD) {
    return {
      valid: false,
      error: `Contraseña debe tener al menos ${MINIMO_PASSWORD} caracteres`,
    };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Contraseña muy larga' };
  }

  return { valid: true };
}

/**
 * Validate username/apodo.
 */
export function validateUsername(username: string | undefined): ValidationResult {
  if (!username) {
    return { valid: false, error: 'Nombre de usuario requerido' };
  }

  const trimmed = username.trim();

  if (trimmed.length < APODO_MINIMO) {
    return {
      valid: false,
      error: `Mínimo ${APODO_MINIMO} caracteres`,
    };
  }

  if (trimmed.length > APODO_MAXIMO) {
    return {
      valid: false,
      error: `Máximo ${APODO_MAXIMO} caracteres`,
    };
  }

  // Only alphanumeric, dash, underscore
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Solo letras, números, _ y - permitidos',
    };
  }

  return { valid: true };
}

/**
 * Validate login credentials.
 */
export function validateLoginForm(email: string, password: string): ValidationResult {
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    return emailValidation;
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return passwordValidation;
  }

  return { valid: true };
}

/**
 * Validate signup form.
 */
export function validateSignupForm(
  email: string,
  password: string,
  username: string,
): ValidationResult {
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    return emailValidation;
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return passwordValidation;
  }

  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    return usernameValidation;
  }

  return { valid: true };
}

/**
 * Check if user is locked out due to too many failed attempts.
 */
export function isLockedOut(attemptTimestamps: number[]): boolean {
  if (attemptTimestamps.length < INTENTOS_MAX_LOGIN) {
    return false;
  }

  // Keep only attempts from last LOCKOUT_MINUTOS
  const now = Date.now();
  const recentAttempts = attemptTimestamps.filter((ts) => now - ts < LOCKOUT_MINUTOS * 60 * 1000);

  return recentAttempts.length >= INTENTOS_MAX_LOGIN;
}

/**
 * Get remaining lockout time in minutes.
 */
export function getLockoutRemainingMinutes(
  attemptTimestamps: number[],
): number {
  if (attemptTimestamps.length === 0) {
    return 0;
  }

  const oldestAttempt = Math.min(...attemptTimestamps);
  const now = Date.now();
  const elapsed = now - oldestAttempt;
  const lockoutMs = LOCKOUT_MINUTOS * 60 * 1000;

  if (elapsed >= lockoutMs) {
    return 0;
  }

  return Math.ceil((lockoutMs - elapsed) / 60 / 1000);
}
