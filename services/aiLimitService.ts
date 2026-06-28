const API_BASE_URL = 'http://62.238.13.160:8000';

export async function checkAndDeductDailyLimit(email: string): Promise<boolean> {
  if (!email) {
    console.warn('[aiLimitService] email is empty — allowing request');
    return true;
  }
  try {
    const response = await fetch(`${API_BASE_URL}/ai/verify-and-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });

    const data = await response.json().catch(() => ({}));
    console.log('[aiLimitService] server response:', data);

    if (!response.ok) {
      console.log('[aiLimitService] server denied AI request:', data.detail || response.status);
      return false;
    }

    return data.status === 'allowed';
  } catch (e) {
    console.error('[aiLimitService] checkAndDeductDailyLimit error:', e);
    return false;
  }
}
