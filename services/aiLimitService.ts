import { getFirebaseDB } from '@/constants/firebase';
import { get, ref, runTransaction } from 'firebase/database';

export async function checkAndDeductDailyLimit(emailKey: string): Promise<boolean> {
  if (!emailKey) {
    console.warn('[aiLimitService] emailKey is empty — allowing request');
    return true;
  }
  try {
    const db = getFirebaseDB();
    const aiLimitsRef = ref(db, `users/${emailKey}/aiLimits`);
    const today = new Date().toISOString().split('T')[0];
    console.log('[aiLimitService] running transaction for:', emailKey, '| today:', today);

    // Читаем credits отдельно — вне транзакции, чтобы не конфликтовать с _layout
    const creditsSnap = await get(ref(db, `users/${emailKey}/credits`));
    const credits = creditsSnap.val() ?? 0;
    if (credits > 50000) {
      console.log('[aiLimitService] admin user — unlimited');
      return true;
    }

    const result = await runTransaction(aiLimitsRef, (limitsData) => {
      console.log('[aiLimitService] transaction limitsData:', JSON.stringify(limitsData));

      // Первый запуск или null — инициализируем
      if (!limitsData) {
        return {
          lastAiUsageDate: today,
          aiDailyLimit: 14,
        };
      }

      // Новый день — сбрасываем лимит
      if (!limitsData.lastAiUsageDate || limitsData.lastAiUsageDate !== today) {
        limitsData.lastAiUsageDate = today;
        limitsData.aiDailyLimit = 14;
        return limitsData;
      }

      // Лимит исчерпан — abort
      if (limitsData.aiDailyLimit === undefined || limitsData.aiDailyLimit <= 0) {
        console.log('[aiLimitService] limit exhausted for:', emailKey);
        return undefined;
      }

      // Списываем 1 запрос
      limitsData.aiDailyLimit -= 1;
      console.log('[aiLimitService] deducted 1, remaining:', limitsData.aiDailyLimit);
      return limitsData;
    });

    console.log('[aiLimitService] committed:', result.committed);
    return result.committed;
  } catch (e) {
    console.error('[aiLimitService] checkAndDeductDailyLimit error:', e);
    return false;
  }
}
