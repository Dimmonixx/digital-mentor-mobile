import AsyncStorage from '@react-native-async-storage/async-storage';
import { onValue, ref } from 'firebase/database';
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
          setUser(parsed);
          setRole(parsed.role);

          const targetDbKey = currentUser?.uid || parsed?.uid || parsed?.id || parsed?.email?.replace(/\./g, '_') || '';
          console.log('[Auth Debug] Formatted DB path key used for /users/:', targetDbKey);

          if (targetDbKey) {
            const currentDb = getFirebaseDB();
            const userRef = ref(currentDb, `users/${targetDbKey}`);
            console.log('[Auth Debug] Subscribing to:', `users/${targetDbKey}`);
            unsubscribe = onValue(userRef, (snap) => {
              console.log('[Auth Debug] Database Rules snapshot value:', snap.val());
              if (snap.exists()) {
                const fresh = snap.val();
                const merged = { ...parsed, ...fresh };
                console.log('[Auth Debug] Merged user:', merged);
                setUser(merged);
                setRole(merged.role);
                AsyncStorage.setItem('user', JSON.stringify(merged)).catch(() => {});
              } else {
                console.log('[Auth Debug] Snapshot does not exist at', `users/${targetDbKey}`);
              }
              setLoading(false);
            }, (error) => {
              console.error('[Firebase Error Check]:', error);
              setLoading(false);
            });
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading user from AsyncStorage:', error);
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
