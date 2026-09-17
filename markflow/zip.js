/* Minimal ZIP writer/reader for MarkFlow backups (stored entries, CRC-32 checked, no external library). */
(function (root) {
  var TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  var CHUNK = 8 * 1024 * 1024, LIMIT = 0xFFFFFFFF;

  function crcUpdate(crc, bytes) {
    for (var i = 0; i < bytes.length; i++) crc = TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return crc;
  }
  function readBytes(blob) {
    if (blob.arrayBuffer) return blob.arrayBuffer().then(function (b) { return new Uint8Array(b); });
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(new Uint8Array(r.result)); };
      r.onerror = function () { reject(r.error); };
      r.readAsArrayBuffer(blob);
    });
  }
  // Large media is read in chunks so a phone does not need the whole video in memory at once.
  function crc32(blob) {
    var crc = 0xFFFFFFFF, offset = 0;
    function step() {
      if (offset >= blob.size) return Promise.resolve((crc ^ 0xFFFFFFFF) >>> 0);
      var part = blob.slice(offset, Math.min(blob.size, offset + CHUNK));
      offset += CHUNK;
      return readBytes(part).then(function (bytes) { crc = crcUpdate(crc, bytes); return step(); });
    }
    return step();
  }
  function utf8(text) { return new TextEncoder().encode(text); }
  function toBlob(data, type) {
    if (data instanceof Blob) return data;
    return new Blob([typeof data === 'string' ? utf8(data) : data], { type: type || 'application/octet-stream' });
  }
  function dosTime(date) {
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
      date: ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    };
  }

  // entries: [{name, data: string|Uint8Array|Blob}]
  function build(entries, onProgress) {
    var parts = [], central = [], offset = 0, stamp = dosTime(new Date()), names = {};
    var list = entries.map(function (e) { return { name: e.name, blob: toBlob(e.data, e.type) }; });
    var i = 0;
    function next() {
      if (i >= list.length) return Promise.resolve(finish());
      var e = list[i++];
      if (names[e.name]) return Promise.reject(new Error('ZIP 안에 같은 이름이 두 번 있습니다: ' + e.name));
      names[e.name] = 1;
      if (e.blob.size >= LIMIT || offset >= LIMIT) return Promise.reject(new Error('백업이 4GB를 넘어 ZIP 하나로 만들 수 없습니다.'));
      return crc32(e.blob).then(function (crc) {
        var name = utf8(e.name), head = new DataView(new ArrayBuffer(30));
        head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint16(6, 0x0800, true);
        head.setUint16(8, 0, true); head.setUint16(10, stamp.time, true); head.setUint16(12, stamp.date, true);
        head.setUint32(14, crc, true); head.setUint32(18, e.blob.size, true); head.setUint32(22, e.blob.size, true);
        head.setUint16(26, name.length, true); head.setUint16(28, 0, true);
        var cd = new DataView(new ArrayBuffer(46));
        cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true);
        cd.setUint16(10, 0, true); cd.setUint16(12, stamp.time, true); cd.setUint16(14, stamp.date, true);
        cd.setUint32(16, crc, true); cd.setUint32(20, e.blob.size, true); cd.setUint32(24, e.blob.size, true);
        cd.setUint16(28, name.length, true); cd.setUint32(42, offset, true);
        central.push(cd.buffer, name);
        parts.push(head.buffer, name, e.blob);
        offset += 30 + name.length + e.blob.size;
        if (onProgress) onProgress(i / list.length);
        return next();
      });
    }
    function finish() {
      var cdSize = central.reduce(function (n, p) { return n + (p.byteLength || p.length); }, 0);
      if (offset + cdSize >= LIMIT) throw new Error('백업이 4GB를 넘어 ZIP 하나로 만들 수 없습니다.');
      var end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true); end.setUint16(8, list.length, true); end.setUint16(10, list.length, true);
      end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
      return new Blob(parts.concat(central, [end.buffer]), { type: 'application/zip' });
    }
    return next();
  }

  function read(blob) {
    var tailSize = Math.min(blob.size, 65557);
    return readBytes(blob.slice(blob.size - tailSize)).then(function (tail) {
      var view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength), at = -1;
      for (var p = tail.length - 22; p >= 0; p--) { if (view.getUint32(p, true) === 0x06054b50) { at = p; break; } }
      if (at < 0) throw new Error('ZIP 파일이 아니거나 손상되었습니다.');
      var count = view.getUint16(at + 10, true), cdSize = view.getUint32(at + 12, true), cdOffset = view.getUint32(at + 16, true);
      if (cdOffset + cdSize > blob.size) throw new Error('ZIP 목록이 손상되었습니다.');
      return readBytes(blob.slice(cdOffset, cdOffset + cdSize)).then(function (cd) {
        var v = new DataView(cd.buffer, cd.byteOffset, cd.byteLength), pos = 0, out = [], dec = new TextDecoder();
        for (var n = 0; n < count; n++) {
          if (v.getUint32(pos, true) !== 0x02014b50) throw new Error('ZIP 목록이 손상되었습니다.');
          var method = v.getUint16(pos + 10, true), crc = v.getUint32(pos + 16, true), csize = v.getUint32(pos + 20, true),
            usize = v.getUint32(pos + 24, true), nlen = v.getUint16(pos + 28, true), xlen = v.getUint16(pos + 30, true),
            clen = v.getUint16(pos + 32, true), local = v.getUint32(pos + 42, true);
          out.push({ name: dec.decode(cd.subarray(pos + 46, pos + 46 + nlen)), method: method, crc: crc, compressedSize: csize, size: usize, localOffset: local });
          pos += 46 + nlen + xlen + clen;
        }
        return out.map(function (e) { e.blob = function () { return entryBlob(blob, e); }; return e; });
      });
    });
  }
  function entryBlob(zip, e) {
    return readBytes(zip.slice(e.localOffset, e.localOffset + 30)).then(function (h) {
      var v = new DataView(h.buffer, h.byteOffset, h.byteLength);
      if (v.getUint32(0, true) !== 0x04034b50) throw new Error('ZIP 항목이 손상되었습니다: ' + e.name);
      var start = e.localOffset + 30 + v.getUint16(26, true) + v.getUint16(28, true);
      var raw = zip.slice(start, start + e.compressedSize);
      if (e.method === 0) return raw;
      if (e.method === 8 && typeof DecompressionStream === 'function') {
        return new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
      }
      throw new Error('지원하지 않는 ZIP 압축 방식입니다: ' + e.name);
    }).then(function (data) {
      if (data.size !== e.size) throw new Error('ZIP 항목 크기가 맞지 않습니다: ' + e.name);
      return crc32(data).then(function (crc) {
        if (crc !== e.crc) throw new Error('ZIP 항목이 손상되었습니다(CRC 불일치): ' + e.name);
        return data;
      });
    });
  }

  root.markflowZip = { crc32: crc32, build: build, read: read };
})(typeof window !== 'undefined' ? window : globalThis);
