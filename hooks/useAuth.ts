import { useEffect, useState } from 'react';
import { auth } from '@/constants/firebase';
import { database } from '@/constants/firebase';
import { ref, get } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';

export const useAuth = () => {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<'doctor' | 'technician' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const snap = await get(ref(database, `users/${firebaseUser.uid}`));
        if (snap.exists()) {
          setRole(snap.val().role);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return { user, role, loading };
};
