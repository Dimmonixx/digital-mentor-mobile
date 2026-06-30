import AsyncStorage from '@react-native-async-storage/async-storage';
import { get, onValue, ref } from 'firebase/database';
import { useEffect, useState } from 'react';
import { getCurrentUser } from '../constants/auth';
import { getFirebaseDB } from '../constants/firebase';

export const useAuth = () => {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const loadUser = async () => {
      try {
        const data = await AsyncStorage.getItem('user');
        console.log('[Auth Debug] AsyncStorage user:', data);

        const currentUser = await getCurrentUser();
        console.log('[Auth Debug] Custom Auth currentUser:', currentUser?.uid || 'null');

        if (data) {
          const parsed = JSON.parse(data);
          console.log('[Auth Debug] Parsed user ID:', parsed?.id || parsed?.uid || parsed?.email);

          const targetDbKey = currentUser?.uid || parsed?.uid || parsed?.id || parsed?.email?.replace(/\./g, '_') || '';
          console.log('[Auth Debug] Formatted DB path key used for /users/:', targetDbKey);

          if (targetDbKey) {
            const currentDb = getFirebaseDB();
            const userRef = ref(currentDb, `users/${targetDbKey}`);

            // --- Одноразовое чтение: ждём первый snapshot перед setLoading(false) ---
            try {
              const snap = await get(userRef);
              console.log('[Auth Debug] Initial get snapshot:', snap.val());
              console.log('DEBUG useAuth firebase data:', JSON.stringify(snap.val()));
              if (snap.exists()) {
                const fresh = snap.val();
                const merged = { ...parsed, ...fresh };
                console.log('[Auth Debug] Merged user:', merged);
                setUser(merged);
                setRole(merged.role);
                AsyncStorage.setItem('user', JSON.stringify(merged)).catch(() => {});
              } else {
                console.log('[Auth Debug] No Firebase data at', `users/${targetDbKey}`, '— using AsyncStorage');
                setUser(parsed);
                setRole(parsed.role);
              }
            } catch (fbError) {
              console.error('[Auth Debug] Firebase get error, falling back to AsyncStorage:', fbError);
              setUser(parsed);
              setRole(parsed.role);
            }

            // --- Live-обновления после первого рендера ---
            unsubscribe = onValue(userRef, (snap) => {
              console.log('[Auth Debug] Live update snapshot:', snap.val());
              if (snap.exists()) {
                const fresh = snap.val();
                const merged = { ...parsed, ...fresh };
                setUser(merged);
                setRole(merged.role);
                AsyncStorage.setItem('user', JSON.stringify(merged)).catch(() => {});
              }
            }, (error) => {
              console.error('[Firebase Error Check]:', error);
            });
          } else {
            setUser(parsed);
            setRole(parsed.role);
          }
        }
      } catch (error) {
        console.error('Error loading user from AsyncStorage:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const logout = async () => {
    await AsyncStorage.removeItem('user');
    setUser(null);
    setRole(null);
  };

  return { user, role, loading, logout };
};
