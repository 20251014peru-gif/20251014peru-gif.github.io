/* Full ZIP backup / non-destructive restore: documents, photo originals, device video originals.
   API keys, tokens and sync settings live in localStorage and are never read here. */
(function (root) {
  var PH = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  var FORMAT = 'markflow-backup', VERSION = 1;
  var EXCLUDED = ['Anthropic API 키', 'GitHub 토큰·Gist 연결 정보', 'Google 클라이언트 ID·로그인 토큰'];

  function hash(s) { return root.markflowSyncMerge.hash(s); }
  function displayKey(url) { return 'photo-original:' + hash(url); }

  function openDb() {
    return new Promise(function (resolve, reject) {
      var r = indexedDB.open('markflow_db', 2);
      r.onupgradeneeded = function () { ['kv', 'media'].forEach(function (n) { if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n); }); };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      r.onblocked = function () { reject(new Error('다른 MarkFlow 창을 닫고 다시 시도해 주세요.')); };
    });
  }
  function all(db, store, filter) {
    return new Promise(function (resolve, reject) {
      var out = [], tx = db.transaction(store), rq = tx.objectStore(store).openCursor();
      rq.onsuccess = function () { var c = rq.result; if (!c) return; if (!filter || filter(String(c.key))) out.push({ key: String(c.key), value: c.value }); c.continue(); };
      tx.oncomplete = function () { resolve(out); };
      tx.onerror = tx.onabort = function () { reject(tx.error); };
    });
  }
  function get(db, store, key) {
    return new Promise(function (resolve, reject) {
      var rq = db.transaction(store).objectStore(store).get(key);
      rq.onsuccess = function () { resolve(rq.result); };
      rq.onerror = function () { reject(rq.error); };
    });
  }
  function put(db, store, key, value) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(value, key);
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = tx.onabort = function () { reject(tx.error || new Error('저장 실패')); };
    });
  }
  function decodeVid(b64) { try { return decodeURIComponent(escape(atob(b64))); } catch (e) { return ''; } }
  function driveId(url) { var m = (url || '').match(/drive\.google\.com\/(?:file\/d\/([A-Za-z0-9_-]+)|open\?id=([A-Za-z0-9_-]+))/); return m && (m[1] || m[2]); }
  function ext(type, name) {
    var m = (name || '').match(/\.([A-Za-z0-9]{1,5})$/); if (m) return m[1].toLowerCase();
    var t = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/heic': 'heic' }[type || ''];
    return t || 'bin';
  }
  function scanDocs(docs) {
    var photos = [], placeholders = 0, localVideos = [], driveVideos = [];
    docs.forEach(function (d) {
      var c = d.content || '', m, re = /!\[[^\]]*\]\((data:image\/[^\s)]+)/g;
      while ((m = re.exec(c))) { if (m[1] === PH) placeholders++; else photos.push({ docId: d.id, url: m[1] }); }
      re = /⟦vidfile:([A-Za-z0-9]+)⟧/g;
      while ((m = re.exec(c))) localVideos.push({ docId: d.id, key: m[1] });
      re = /⟦vid ([^⟧]+)⟧/g;
      while ((m = re.exec(c))) { var url = decodeVid(m[1]), id = driveId(url); if (id) driveVideos.push({ docId: d.id, id: id, url: url }); }
    });
    return { photos: photos, placeholders: placeholders, localVideos: localVideos, driveVideos: driveVideos };
  }
  function stamp(d) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  function create(opts) {
    var state = JSON.parse(JSON.stringify(opts.state));
    var progress = opts.onProgress || function () {};
    var db;
    return openDb().then(function (d) {
      db = d;
      return Promise.all([all(db, 'media'), all(db, 'kv', function (k) { return k.indexOf('drive-original:') === 0 || k.indexOf('photo-original:') === 0; })]);
    }).then(function (res) {
      var media = res[0].filter(function (m) { return m.value instanceof Blob; }), links = {};
      res[1].forEach(function (x) { links[x.key] = x.value; });
      var mediaByKey = {}; media.forEach(function (m) { mediaByKey[m.key] = m.value; });
      var scan = scanDocs(state.docs || []), roles = {};
      function role(key, r) { (roles[key] = roles[key] || []).indexOf(r) < 0 && roles[key].push(r); }
      var photoSeen = {}, photoSummary = { total: 0, withOriginal: 0, displayOnly: 0, placeholders: scan.placeholders };
      scan.photos.forEach(function (p) {
        if (photoSeen[p.url]) return; photoSeen[p.url] = 1; photoSummary.total++;
        var link = links[displayKey(p.url)];
        if (link && link.key && mediaByKey[link.key]) { photoSummary.withOriginal++; role(link.key, 'photo-original'); } else photoSummary.displayOnly++;
      });
      var local = { total: 0, included: 0, missing: [] };
      scan.localVideos.forEach(function (v) { local.total++; if (mediaByKey[v.key]) { local.included++; role(v.key, 'video-local'); } else local.missing.push(v.key); });
      var drive = [], driveSeen = {};
      scan.driveVideos.forEach(function (v) {
        if (driveSeen[v.id]) return; driveSeen[v.id] = 1;
        var key = links['drive-original:' + v.id] || ('drive' + v.id), has = !!mediaByKey[key];
        if (has) role(key, 'drive-original');
        drive.push({ driveId: v.id, url: v.url, original: has ? 'included' : 'link-only', mediaKey: has ? key : null });
      });
      var entries = [], manifestMedia = [], i = 0;
      media.forEach(function (m) {
        var blob = m.value, path = 'media/' + m.key.replace(/[^A-Za-z0-9_-]/g, '_') + '.' + ext(blob.type, blob.name);
        manifestMedia.push({ key: m.key, path: path, size: blob.size, type: blob.type || '', name: blob.name || '', roles: roles[m.key] || ['unreferenced'] });
        entries.push({ name: path, data: blob });
      });
      var manifest = {
        format: FORMAT, version: VERSION, createdAt: new Date().toISOString(), app: opts.appVersion || '',
        documents: (state.docs || []).length, folders: (state.folders || []).length,
        photos: photoSummary, localVideos: local, driveVideos: drive, media: manifestMedia,
        excluded: EXCLUDED
      };
      var readme = [
        'MarkFlow 전체 백업',
        '만든 시각: ' + manifest.createdAt,
        '문서 ' + manifest.documents + '개',
        '사진 ' + photoSummary.total + '장 (원본 포함 ' + photoSummary.withOriginal + ' / 화면용 축소본만 ' + photoSummary.displayOnly + ')',
        '기기 저장 영상 ' + local.total + '개 (원본 포함 ' + local.included + ')',
        'Drive 영상 ' + drive.length + '개 (원본 포함 ' + drive.filter(function (d) { return d.original === 'included'; }).length + ' / 링크만 ' + drive.filter(function (d) { return d.original !== 'included'; }).length + ')',
        '백업에서 뺀 정보: ' + EXCLUDED.join(', '),
        '',
        '복원: MarkFlow > 내보내기 > 백업 복원(ZIP). 기존 문서는 지우거나 덮어쓰지 않습니다.'
      ].join('\r\n');
      entries.unshift(
        { name: 'manifest.json', data: JSON.stringify(manifest, null, 2) },
        { name: 'README.txt', data: readme },
        { name: 'data/state.json', data: JSON.stringify({ docs: state.docs || [], folders: state.folders || [], collapsed: state.collapsed || [], theme: state.theme, numHeadings: state.numHeadings, currentId: state.currentId, savedAt: state.savedAt }) },
        { name: 'data/links.json', data: JSON.stringify(links) }
      );
      return root.markflowZip.build(entries, progress).then(function (blob) {
        return { blob: blob, filename: 'markflow-backup-' + stamp(new Date()) + '.zip', manifest: manifest };
      });
    }).then(function (r) { db.close(); return r; }, function (e) { if (db) db.close(); throw e; });
  }

  function readText(entry) { return entry.blob().then(function (b) { return b.text(); }); }

  function restore(file, opts) {
    var current = JSON.parse(JSON.stringify(opts.state));
    var progress = opts.onProgress || function () {};
    var db, entries, manifest, backupState, links, blobs = {};
    return root.markflowZip.read(file).then(function (list) {
      entries = {}; list.forEach(function (e) { entries[e.name] = e; });
      if (!entries['manifest.json'] || !entries['data/state.json']) throw new Error('MarkFlow 백업 ZIP이 아닙니다.');
      return readText(entries['manifest.json']);
    }).then(function (text) {
      manifest = JSON.parse(text);
      if (manifest.format !== FORMAT) throw new Error('MarkFlow 백업 ZIP이 아닙니다.');
      if (manifest.version > VERSION) throw new Error('더 새로운 MarkFlow에서 만든 백업입니다. 앱을 새로고침한 뒤 다시 시도해 주세요.');
      return Promise.all([readText(entries['data/state.json']), entries['data/links.json'] ? readText(entries['data/links.json']) : '{}']);
    }).then(function (texts) {
      backupState = JSON.parse(texts[0]); links = JSON.parse(texts[1] || '{}');
      if (!backupState || !Array.isArray(backupState.docs)) throw new Error('백업의 문서 데이터가 손상되었습니다.');
      // Read and CRC-check every media file before writing anything, so a damaged ZIP changes nothing.
      var media = manifest.media || [], n = 0;
      return media.reduce(function (p, m) {
        return p.then(function () {
          if (!entries[m.path]) throw new Error('백업에 원본 파일이 빠져 있습니다: ' + m.path);
          return entries[m.path].blob().then(function (b) { blobs[m.key] = new Blob([b], { type: m.type || '' }); progress(++n / Math.max(1, media.length) / 2); });
        });
      }, Promise.resolve());
    }).then(function () {
      return openDb();
    }).then(function (d) {
      db = d;
      return put(db, 'kv', 'zip-restore-safety-v1', JSON.stringify({ time: Date.now(), state: current }));
    }).then(function () {
      var remap = {}, report = { mediaAdded: 0, mediaSame: 0, mediaRenamed: 0, linksAdded: 0, docsAdded: 0, docsSame: 0, docsCopied: 0 };
      var media = manifest.media || [], n = 0;
      return media.reduce(function (p, m) {
        return p.then(function () {
          var blob = blobs[m.key];
          return get(db, 'media', m.key).then(function (existing) {
            if (!existing) return put(db, 'media', m.key, blob).then(function () { report.mediaAdded++; });
            return Promise.all([root.markflowZip.crc32(existing), root.markflowZip.crc32(blob)]).then(function (c) {
              if (existing.size === blob.size && c[0] === c[1]) { report.mediaSame++; return; }
              var key = m.key.replace(/[^A-Za-z0-9]/g, '') + 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
              remap[m.key] = key;
              return put(db, 'media', key, blob).then(function () { report.mediaRenamed++; });
            });
          }).then(function () { progress(0.5 + ++n / Math.max(1, media.length) / 2); });
        });
      }, Promise.resolve()).then(function () {
        return Object.keys(links).reduce(function (p, k) {
          return p.then(function () {
            var value = links[k];
            if (typeof value === 'string' && remap[value]) value = remap[value];
            else if (value && value.key && remap[value.key]) { value = JSON.parse(JSON.stringify(value)); value.key = remap[value.key]; }
            return get(db, 'kv', k).then(function (existing) {
              var existingKey = existing && (typeof existing === 'string' ? existing : existing.key);
              if (existing) return existingKey ? get(db, 'media', existingKey).then(function (b) { if (!b) return put(db, 'kv', k, value).then(function () { report.linksAdded++; }); }) : null;
              return put(db, 'kv', k, value).then(function () { report.linksAdded++; });
            });
          });
        }, Promise.resolve());
      }).then(function () {
        var localById = {}, docs = [], folders = [];
        current.docs.forEach(function (d) { localById[d.id] = d; });
        backupState.docs.forEach(function (d) {
          if (!d || typeof d.id !== 'string') return;
          d = JSON.parse(JSON.stringify(d));
          d.content = String(d.content || '').replace(/⟦vidfile:([A-Za-z0-9]+)⟧/g, function (w, k) { return remap[k] ? '⟦vidfile:' + remap[k] + '⟧' : w; });
          var mine = localById[d.id];
          if (!mine) { docs.push(d); report.docsAdded++; }
          else if ((mine.content || '') === d.content) report.docsSame++;
          else {
            var id = d.id + '-r' + hash(d.content).slice(0, 8);
            if (localById[id]) { report.docsSame++; return; }
            d.restoredCopyOf = d.id; d.id = id; d.restoredAt = Date.now();
            docs.push(d); report.docsCopied++;
          }
          if (d.folder && folders.indexOf(d.folder) < 0) folders.push(d.folder);
        });
        (backupState.folders || []).forEach(function (f) { if (typeof f === 'string' && folders.indexOf(f) < 0) folders.push(f); });
        db.close();
        return { docs: docs, folders: folders, report: report, manifest: manifest };
      });
    }).catch(function (e) { if (db) db.close(); throw e; });
  }

  root.markflowBackup = { create: create, restore: restore, displayKey: displayKey, scanDocs: scanDocs, EXCLUDED: EXCLUDED };
})(window);
