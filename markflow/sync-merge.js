/* Per-document sync merge: never replaces the whole local list with the remote copy.
   If both sides edited the same document, the local version stays and the remote version is kept as a conflict copy. */
(function (root) {
  function hash(text) {
    text = String(text == null ? '' : text);
    var a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      a = Math.imul(a ^ c, 0x01000193) >>> 0;
      b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
      b = (b ^ (b >>> 15)) >>> 0;
    }
    return ('0000000' + a.toString(16)).slice(-8) + ('0000000' + b.toString(16)).slice(-8) + '-' + text.length.toString(36);
  }
  function clone(d) { return JSON.parse(JSON.stringify(d)); }
  function byId(docs) { var m = {}; (docs || []).forEach(function (d) { if (d && typeof d.id === 'string') m[d.id] = d; }); return m; }
  function baseFrom(docs) { var m = {}; (docs || []).forEach(function (d) { if (d && typeof d.id === 'string') m[d.id] = hash(d.content || ''); }); return m; }

  // local/remote: {docs, folders}; base: {id: contentHash} from the last successful sync, or null on first connection.
  function merge(local, remote, base, now) {
    now = now || Date.now();
    var L = (local && local.docs) || [], R = (remote && remote.docs) || [];
    var remoteById = byId(R), localById = byId(L), seen = {};
    var docs = [], report = { fromRemote: [], added: [], conflicts: [], keptDeleted: [], skippedDeleted: [] };
    // Every id already in play for this merge, mapped to the content hash it currently holds — used only to
    // find a free slot for a new conflict copy. An id existing here is NOT by itself a reason to drop the
    // remote version: only a MATCHING content hash means "this copy was already carried over, nothing to add".
    var used = {};
    L.forEach(function (d) { if (d && typeof d.id === 'string') used[d.id] = hash(d.content || ''); });
    R.forEach(function (d) { if (d && typeof d.id === 'string' && used[d.id] === undefined) used[d.id] = hash(d.content || ''); });
    function conflictSlot(baseId, contentHash) {
      var id = baseId + '-c' + contentHash.slice(0, 8), n = 2;
      while (used[id] !== undefined && used[id] !== contentHash && n < 1000) { id = baseId + '-c' + contentHash.slice(0, 8) + '-' + n; n++; }
      return id;
    }
    L.forEach(function (ld) {
      if (!ld || typeof ld.id !== 'string') return;
      var rd = remoteById[ld.id];
      if (!rd) { docs.push(ld); return; }
      var hl = hash(ld.content || ''), hr = hash(rd.content || ''), hb = base ? base[ld.id] : undefined;
      if (hl === hr) {
        // Same text: take folder/icon/colour from whichever side was touched last.
        docs.push(Number(rd.updated || 0) > Number(ld.updated || 0) ? clone(rd) : ld);
      } else if (hb !== undefined && hb === hl) {
        docs.push(clone(rd)); report.fromRemote.push(ld.id);
      } else if (hb !== undefined && hb === hr) {
        docs.push(ld);
      } else {
        docs.push(ld);
        var copyId = conflictSlot(ld.id, hr);
        if (used[copyId] !== hr) {
          // No existing copy (local or remote) already holds this exact remote content: create one.
          // If a copy with this id exists but its content has since changed (the user edited the
          // earlier conflict copy), conflictSlot found a fresh id instead of reusing it, so the
          // remote version is preserved separately rather than silently dropped.
          used[copyId] = hr;
          var copy = clone(rd);
          copy.id = copyId; copy.conflictOf = ld.id; copy.conflictAt = now;
          docs.push(copy); seen[copyId] = 1;
          report.conflicts.push({ id: ld.id, copyId: copyId });
        }
        // else: a copy with this exact remote content already exists in L or R and will be carried
        // through by its own entry in the loops below — nothing more to do here.
      }
    });
    R.forEach(function (rd) {
      if (!rd || typeof rd.id !== 'string' || localById[rd.id] || seen[rd.id]) return;
      var hb = base ? base[rd.id] : undefined;
      if (hb !== undefined && hb === hash(rd.content || '')) { report.skippedDeleted.push(rd.id); return; }
      docs.push(clone(rd));
      if (hb !== undefined) report.keptDeleted.push(rd.id); else report.added.push(rd.id);
    });
    var folders = [];
    [(local && local.folders) || [], (remote && remote.folders) || []].forEach(function (list) {
      list.forEach(function (f) { if (typeof f === 'string' && folders.indexOf(f) < 0) folders.push(f); });
    });
    docs.forEach(function (d) { if (d.folder && folders.indexOf(d.folder) < 0) folders.push(d.folder); });
    return { docs: docs, folders: folders, report: report };
  }

  var api = { hash: hash, merge: merge, baseFrom: baseFrom };
  root.markflowSyncMerge = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
