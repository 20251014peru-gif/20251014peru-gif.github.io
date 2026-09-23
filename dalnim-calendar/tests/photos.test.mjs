import test from 'node:test';import assert from 'node:assert/strict';
import {MAX_PHOTOS,MAX_PHOTO_BYTES,ALLOWED_CONTENT_TYPES,photoPath,photoDownloadUrl} from '../server/photos.mjs';
test('photoPath scopes a photo under its space and event, never crossing them',()=>{
 assert.equal(photoPath('space1','evt1','pic1'),'dalnimPhotos/space1/evt1/pic1');
 assert.notEqual(photoPath('space1','evt1','pic1'),photoPath('space2','evt1','pic1'));
});
test('photoDownloadUrl encodes the storage path and carries the download token',()=>{
 const url=photoDownloadUrl('my-system-25497.appspot.com','dalnimPhotos/a/b c/d','tok123');
 assert.equal(url,'https://firebasestorage.googleapis.com/v0/b/my-system-25497.appspot.com/o/dalnimPhotos%2Fa%2Fb%20c%2Fd?alt=media&token=tok123');
});
test('limits are sane: a positive photo cap, a byte cap under the Cloud Function body limit, and only image types',()=>{
 assert.ok(MAX_PHOTOS>0&&MAX_PHOTOS<=20);
 assert.ok(MAX_PHOTO_BYTES>0&&MAX_PHOTO_BYTES<=10*1024*1024);
 assert.ok(ALLOWED_CONTENT_TYPES.every(t=>t.startsWith('image/')));
});
