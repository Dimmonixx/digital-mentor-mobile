import { getFirebaseFirestore } from '@/constants/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useRef } from 'react';

const SOUND_FILE = require('@/assets/sounds/bell.mp3');

export default function IncomingArchiveWatcher() {
  const prevCountRef = useRef<number>(-1);

  useEffect(() => {
    let unsub: (() => void) | null = null;

    const start = async () => {
      const raw = await AsyncStorage.getItem('user');
      if (!raw) return;
      const user = JSON.parse(raw);
      const rawUid: string = user.uid || user.id || user.email || '';
      const uid = rawUid.replace(/\./g, '_');
      if (!uid) return;

      console.log('ROOT_WATCHER: Запуск сквозного слушателя входящих. uid =', uid);

      const q = query(
        collection(getFirebaseFirestore(), 'archives'),
        where('sharedWith', 'array-contains', uid),
      );

      unsub = onSnapshot(q, async (snap) => {
        const current = snap.docs.filter((d) => {
          const data = d.data();
          if (data.userId === uid) return false; // свои не считаем
          const readBy: Record<string, boolean> = data.readBy || {};
          return !readBy[uid];
        }).length;
        console.log('ROOT_WATCHER: unread =', current, '| prev =', prevCountRef.current);

        if (prevCountRef.current !== -1 && current > prevCountRef.current) {
          console.log('ROOT_WATCHER: Новый входящий анализ — играем звук!');
          try {
            await Audio.setAudioModeAsync({
              playsInSilentModeIOS: true,
              staysActiveInBackground: false,
            });
            const { sound } = await Audio.Sound.createAsync(SOUND_FILE, { shouldPlay: true });
            sound.setOnPlaybackStatusUpdate((status) => {
              if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
            });
          } catch (e) {
            console.log('ROOT_WATCHER SOUND_ERROR:', e);
          }
        }

        prevCountRef.current = current;
      }, (err) => console.log('ROOT_WATCHER ERROR:', err?.message));
    };

    start();

    return () => { unsub?.(); };
  }, []);

  return null;
}
