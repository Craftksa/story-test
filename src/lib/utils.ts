import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function hasRole(user: any, roles: string[] = []) {
  return !!user?.role && roles.includes(user.role);
}

/**
 * Checks if the ID is a valid UUID or a positive integer string
 */
export function isValidId(id: string): string {
  return id;
}

export const formatStatus = (status?: string) => {
  if (!status) return '';

  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const capitalizeWords = (type: string) => {
  return type.charAt(0).toUpperCase() + type.slice(1);
};

export const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
};

export const getFirstInitial = (name: string) => {
  return name.trim().charAt(0).toUpperCase();
};
