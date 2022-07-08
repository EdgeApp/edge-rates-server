import { Cleaner, CleanerShape } from 'cleaners'

export declare function asHealingObject<T>(
  cleaner: Cleaner<T>
): Cleaner<{ [keys: string]: T }>
export declare function asHealingObject<T extends object>(
  shape: CleanerShape<T>,
  fallback: T
): Cleaner<T>
