import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export const useAuth = () => {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('user').then((data) => {
      if (data) {
        const parsed = JSON.parse(data);
        setUser(parsed);
        setRole(parsed.role);
      }
      setLoading(false);
    });
  }, []);

  const logout = async () => {
    await AsyncStorage.removeItem('user');
    setUser(null);
    setRole(null);
  };

  return { user, role, loading, logout };
};
