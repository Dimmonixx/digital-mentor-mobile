import { firestore } from '@/constants/firebase';
import { ArchiveItem, ArchiveItemData, ArchiveItemType } from '@/types/archive';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';
import { addDoc, collection } from 'firebase/firestore';

export const ARCHIVE_COLLECTION = 'archives';
export const LOCAL_ARCHIVE_KEY = 'local_archive_mine';

export async function saveToArchive(
  type: ArchiveItemType,
  patientName: string,
  data: ArchiveItemData,
): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem('user');
    if (!raw) {
      console.warn('[saveToArchive] no user in AsyncStorage');
      return null;
    }
    const user = JSON.parse(raw);
    const userId: string = user.id || user.uid || user.email || 'unknown';

    console.log('ARCHIVE_DEBUG: saveToArchive userId =', userId, 'type =', type);

    const createdAt = Date.now();

    const payload = {
      userId,
      patientName,
      type,
      createdAt,
      sharedWith: [] as string[],
      data,
    };

    // ── Локальный резерв (мгновенно, с оригинальным file:// путём) ──────────
    const localRaw = await AsyncStorage.getItem(LOCAL_ARCHIVE_KEY);
    const localList: ArchiveItem[] = localRaw ? JSON.parse(localRaw) : [];
    const localId = `local_${createdAt}_${Math.random().toString(36).slice(2)}`;
    localList.unshift({ id: localId, ...payload });
    await AsyncStorage.setItem(LOCAL_ARCHIVE_KEY, JSON.stringify(localList));
    console.log('ARCHIVE_DEBUG: saved to local cache, total local items =', localList.length);

    // ── Сжимаем imageUri в base64 для Firestore ────────────────────────────
    const rawImageUri: string = (data as any).imageUri || '';
    let firestoreImageUri = '';
    if (rawImageUri.startsWith('file://') || rawImageUri.startsWith('content://')) {
      try {
        console.log('ARCHIVE_BASE64: Сжимаем фото для Firestore...');
        const compressed = await ImageManipulator.manipulateAsync(
          rawImageUri,
          [{ resize: { width: 250 } }],
          { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true },
        );
        if (compressed.base64) {
          firestoreImageUri = `data:image/jpeg;base64,${compressed.base64}`;
          console.log('ARCHIVE_BASE64_SUCCESS: длина строки =', firestoreImageUri.length, '| ~', Math.round(firestoreImageUri.length * 0.75 / 1024), 'KB');
        }
      } catch (imgErr) {
        console.log('ARCHIVE_BASE64_ERROR:', (imgErr as any)?.message ?? imgErr);
      }
    } else {
      firestoreImageUri = rawImageUri;
    }

    // Payload для Firestore — imageUri заменён на base64 (или пустую строку)
    const firestoreData = { ...(data as any), imageUri: firestoreImageUri };
    const firestorePayload = { ...payload, data: firestoreData, imageUri: firestoreImageUri };

    // ── Firestore (фоновая запись) ─────────────────────────────────────────
    const doc = await addDoc(collection(firestore, ARCHIVE_COLLECTION), firestorePayload);
    console.log('ARCHIVE_DEBUG: saved to Firestore, docId =', doc.id);

    // Обновляем локальный id на реальный Firestore id
    const updatedList = localList.map((it) =>
      it.id === localId ? { ...it, id: doc.id } : it,
    );
    await AsyncStorage.setItem(LOCAL_ARCHIVE_KEY, JSON.stringify(updatedList));

    return doc.id;
  } catch (e) {
    console.error('[saveToArchive] error:', e);
    return null;
  }
}
