import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Validates if a string is a valid email address
 * @param email - The email string to validate
 * @returns true if valid email format, false otherwise
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  // Trim whitespace
  const trimmedEmail = email.trim();
  
  // Basic email regex pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  // Check if it matches the pattern
  if (!emailRegex.test(trimmedEmail)) {
    return false;
  }
  
  // Additional checks
  if (trimmedEmail.length > 254) { // RFC 5321 limit
    return false;
  }
  
  if (trimmedEmail.includes('..')) { // No consecutive dots
    return false;
  }
  
  return true;
}
