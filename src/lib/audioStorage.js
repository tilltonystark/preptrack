// Firebase Storage helpers for audio file uploads
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

const ALLOWED_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/x-m4a'];
const MAX_SIZE_MB = 20;

/**
 * Upload an audio file to Firebase Storage.
 * Path: users/{userId}/audio/{questionId}_{timestamp}.{ext}
 * @param {string} userId
 * @param {string} questionId
 * @param {File|Blob} file
 * @param {function} onProgress - called with 0–100
 * @returns {Promise<string>} download URL
 */
export const uploadAudio = (userId, questionId, file, onProgress) => {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      reject(new Error(`FILE_TOO_LARGE:${MAX_SIZE_MB}`));
      return;
    }

    const ext = file.name ? file.name.split('.').pop() : 'webm';
    const path = `users/${userId}/audio/${questionId}_${Date.now()}.${ext}`;
    const storageRef = ref(storage, path);

    const task = uploadBytesResumable(storageRef, file, { contentType: file.type });

    task.on(
      'state_changed',
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        onProgress?.(pct);
      },
      (err) => reject(err),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
};

/**
 * Delete an audio file by its storage URL.
 * Silently ignores errors (file may already be deleted).
 */
export const deleteAudio = async (downloadUrl) => {
  try {
    const fileRef = ref(storage, downloadUrl);
    await deleteObject(fileRef);
  } catch {
    // ignore — file may not exist
  }
};

export { ALLOWED_TYPES, MAX_SIZE_MB };
