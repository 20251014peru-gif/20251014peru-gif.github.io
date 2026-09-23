// Pure helpers for the event-photo upload/delete routes in server/index.mjs. Kept separate and
// side-effect-free so the path/URL shape and limits are unit-testable without mocking Storage.
export const MAX_PHOTOS = 8;
export const MAX_PHOTO_BYTES = 6 * 1024 * 1024; // per photo, after client-side compression
export const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export function photoPath(space, eventId, photoId) {
  return `dalnimPhotos/${space}/${eventId}/${photoId}`;
}
export function photoDownloadUrl(bucket, path, token) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}
