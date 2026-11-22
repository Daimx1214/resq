// LifeTag data layer.
// Local-first adapter (localStorage). A Firebase adapter with the same
// interface replaces this in the wiring phase; screens only use Store.*.
(function () {
  const K = { profiles: 'lt.profiles.v1', tags: 'lt.tags.v1', scans: 'lt.scans.v1', session: 'lt.session.v1' };
  const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L lookalikes

  function read(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

  function genCode() {
    let code = '';
    const buf = new Uint8Array(12);
    crypto.getRandomValues(buf);
    for (let i = 0; i < 12; i++) code += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
    return code;
  }

  async function hashPin(pin, salt) {
    const enc = new TextEncoder().encode(salt + ':' + pin);
    const digest = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const Store = {
    // ---- profiles (owner accounts, local prototype) ----
    async createProfile(data, pin) {
      const profiles = read(K.profiles, []);
      const id = 'p_' + genCode().toLowerCase();
      const profile = Object.assign({}, data, {
        id, pinHash: await hashPin(pin, id), createdAt: Date.now()
      });
      profiles.push(profile);
      write(K.profiles, profiles);
      const tag = this.createTag(id);
      this.setSession(id);
      return { profile, tag };
    },
    getProfile(id) { return read(K.profiles, []).find(p => p.id === id) || null; },
    updateProfile(id, data) {
      const profiles = read(K.profiles, []);
      const i = profiles.findIndex(p => p.id === id);
      if (i < 0) return null;
      profiles[i] = Object.assign({}, profiles[i], data);
      write(K.profiles, profiles);
      return profiles[i];
    },
    deleteProfile(id) {
      write(K.profiles, read(K.profiles, []).filter(p => p.id !== id));
      write(K.tags, read(K.tags, []).filter(t => t.profileId !== id));
      if (this.getSession() === id) this.setSession(null);
    },
    async checkPin(id, pin) {
      const p = this.getProfile(id);
      if (!p) return false;
      return (await hashPin(pin, id)) === p.pinHash;
    },
    listProfiles() { return read(K.profiles, []); },

    // ---- session ----
    setSession(id) { if (id) localStorage.setItem(K.session, id); else localStorage.removeItem(K.session); },
    getSession() { return localStorage.getItem(K.session) || null; },

    // ---- tags ----
    createTag(profileId) {
      const tags = read(K.tags, []);
      let code = genCode();
      while (tags.some(t => t.code === code)) code = genCode();
      const tag = { code, profileId, status: 'active', todayRider: null, informedAt: null, createdAt: Date.now() };
      tags.push(tag);
      write(K.tags, tags);
      return tag;
    },
    getTag(code) { return read(K.tags, []).find(t => t.code === String(code || '').toUpperCase()) || null; },
    getTagForProfile(profileId) { return read(K.tags, []).find(t => t.profileId === profileId) || null; },
    updateTag(code, data) {
      const tags = read(K.tags, []);
      const i = tags.findIndex(t => t.code === code);
      if (i < 0) return null;
      tags[i] = Object.assign({}, tags[i], data);
      write(K.tags, tags);
      return tags[i];
    },
    regenerateTag(profileId) {
      const old = this.getTagForProfile(profileId);
      if (old) this.updateTag(old.code, { status: 'revoked' });
      const tags = read(K.tags, []).filter(t => t.profileId !== profileId);
      write(K.tags, tags);
      return this.createTag(profileId);
    },

    // ---- scans ----
    logScan(code, kind, scannerPhone) {
      const scans = read(K.scans, []);
      scans.push({ code, kind, scannerPhone: scannerPhone || '', at: Date.now() });
      write(K.scans, scans);
    },
    scansFor(code) { return read(K.scans, []).filter(s => s.code === code).sort((a, b) => b.at - a.at); },

    exportAll(profileId) {
      const profile = this.getProfile(profileId);
      const tag = this.getTagForProfile(profileId);
      return JSON.stringify({ profile, tag, scans: tag ? this.scansFor(tag.code) : [] }, null, 2);
    }
  };

  window.Store = Store;
})();
