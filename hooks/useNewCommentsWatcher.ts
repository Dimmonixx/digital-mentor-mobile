import AsyncStorage from '@react-native-async-storage/async-storage';
import { onValue, ref } from 'firebase/database';
import { useEffect, useRef, useState } from 'react';
import { getFirebaseDB } from '../constants/firebase';
import { playSuccessSound } from '../utils/audio';

export const useNewCommentsWatcher = () => {
  const [newCommentPostIds, setNewCommentPostIds] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<any>(null);
  const hasLoadedOnce = useRef(false);
  const prevCounts = useRef<Record<string, number>>({});

  useEffect(() => {
    AsyncStorage.getItem('user').then((data) => {
      if (data) setUser(JSON.parse(data));
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const userId = user.uid || user.id;
    if (!userId) return;

    const postsRef = ref(getFirebaseDB(), 'case_club');
    const unsub = onValue(postsRef, async (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const myPosts = Object.entries(data).filter(
        ([, post]: [string, any]) => post?.authorId === userId
      );

      const seenRaw = await AsyncStorage.getItem('seenCommentsCounts');
      const seenCounts: Record<string, number> = seenRaw ? JSON.parse(seenRaw) : {};

      const newSet = new Set<string>();
      let shouldPlaySound = false;

      myPosts.forEach(([postId, post]: [string, any]) => {
        const currentCount = post.commentsCount || 0;
        const seenCount = seenCounts[postId] ?? currentCount;

        if (currentCount > seenCount) {
          newSet.add(postId);

          if (hasLoadedOnce.current && (prevCounts.current[postId] ?? currentCount) < currentCount) {
            shouldPlaySound = true;
          }
        }

        prevCounts.current[postId] = currentCount;
      });

      if (shouldPlaySound) {
        playSuccessSound();
      }

      hasLoadedOnce.current = true;
      setNewCommentPostIds(newSet);
    });

    return () => unsub();
  }, [user]);

  const markPostCommentsSeen = async (postId: string, currentCount: number) => {
    const seenRaw = await AsyncStorage.getItem('seenCommentsCounts');
    const seenCounts: Record<string, number> = seenRaw ? JSON.parse(seenRaw) : {};
    seenCounts[postId] = currentCount;
    await AsyncStorage.setItem('seenCommentsCounts', JSON.stringify(seenCounts));
    setNewCommentPostIds(prev => {
      const next = new Set(prev);
      next.delete(postId);
      return next;
    });
  };

  return {
    hasNewComments: newCommentPostIds.size > 0,
    newCommentPostIds,
    markPostCommentsSeen,
  };
};
