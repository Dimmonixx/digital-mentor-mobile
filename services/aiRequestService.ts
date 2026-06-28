import { checkAndDeductDailyLimit } from './aiLimitService';

export async function executeWithAiLimit<T>(
  email: string,
  aiTask: () => Promise<T>
): Promise<T | null> {
  try {
    const allowed = await checkAndDeductDailyLimit(email);
    if (!allowed) {
      (globalThis as any).showAiLimitAlert?.();
      return null;
    }
    const result = await aiTask();
    return result;
  } catch (e) {
    console.error('[aiRequestService] executeWithAiLimit error:', e);
    return null;
  }
}
