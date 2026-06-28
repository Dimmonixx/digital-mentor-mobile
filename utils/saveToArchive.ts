import { getFirebaseFirestore } from '@/constants/firebase';
import { ArchiveItem, ArchiveItemData, ArchiveItemType } from '@/types/archive';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';
import { addDoc, collection } from 'firebase/firestore';

export const ARCHIVE_COLLECTION = 'archives';
export const LOCAL_ARCHIVE_KEY = 'local_archive_mine';

export const UPLOAD_MEDIA_URL = 'http://62.238.13.160:8000/archive/upload-media';

export async function uploadMediaToServer(uri: string): Promise<string | null> {
  try {
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
    );
    const compressedUri = compressed.uri;

    const formData = new FormData();
    formData.append('file', {
      uri: compressedUri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    } as any);

    const response = await fetch(UPLOAD_MEDIA_URL, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.log('UPLOAD_MEDIA_ERROR:', response.status, text);
      return null;
    }
    const data = await response.json();
    return data.url || null;
  } catch (e) {
    console.log('UPLOAD_MEDIA_EXCEPTION:', e);
    return null;
  }
}

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
    const userId: string = user.uid || user.id || user.email || 'unknown';

    console.log('ARCHIVE_DEBUG: saveToArchive userId =', userId, 'type =', type);

    const createdAt = Date.now();

    // Загружаем фото на сервер вместо base64
    const rawImageUri: string = (data as any).imageUri || '';
    let firestoreImageUri = '';
    if (rawImageUri.startsWith('file://') || rawImageUri.startsWith('content://')) {
      console.log('ARCHIVE_UPLOAD: Загружаем фото на сервер...');
      firestoreImageUri = await uploadMediaToServer(rawImageUri);
      if (firestoreImageUri) {
        console.log('ARCHIVE_UPLOAD_SUCCESS:', firestoreImageUri);
      } else {
        console.log('ARCHIVE_UPLOAD_FAILED: сохраняем без изображения');
      }
    } else if (rawImageUri.startsWith('http://') || rawImageUri.startsWith('https://')) {
      firestoreImageUri = rawImageUri;
    }

    const payload = {
      userId,
      patientName,
      type,
      createdAt,
      sharedWith: [] as string[],
      data,
    };

    // ── Локальный резерв (мгновенно, с URL изображения) ──────────
    const localRaw = await AsyncStorage.getItem(LOCAL_ARCHIVE_KEY);
    const localList: ArchiveItem[] = localRaw ? JSON.parse(localRaw) : [];
    const localId = `local_${createdAt}_${Math.random().toString(36).slice(2)}`;
    localList.unshift({ id: localId, ...payload });
    await AsyncStorage.setItem(LOCAL_ARCHIVE_KEY, JSON.stringify(localList));
    console.log('ARCHIVE_DEBUG: saved to local cache, total local items =', localList.length);

    // Payload для Firestore — imageUri заменён на URL сервера (или пустую строку)
    const firestoreData = { ...(data as any), imageUri: firestoreImageUri };
    const firestorePayload = { ...payload, data: firestoreData, imageUri: firestoreImageUri };

    // ── Firestore (фоновая запись) ─────────────────────────────────────────
    const doc = await addDoc(collection(getFirebaseFirestore(), ARCHIVE_COLLECTION), firestorePayload);
    console.log('ARCHIVE_DEBUG: saved to Firestore, docId =', doc.id);

    // Обновляем локальный id на реальный Firestore id и URL картинки
    const updatedList = localList.map((it) =>
      it.id === localId ? { ...it, id: doc.id, data: firestoreData, imageUri: firestoreImageUri } : it,
    );
    await AsyncStorage.setItem(LOCAL_ARCHIVE_KEY, JSON.stringify(updatedList));

    return doc.id;
  } catch (e) {
    console.error('[saveToArchive] error:', e);
    return null;
  }
}

