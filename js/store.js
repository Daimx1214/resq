// LifeTag data layer: cloud-first (Firebase, shared project) with a
// local-device fallback used when no Firebase config is present.
// Screens only use the Store facade; every method returns a Promise.
//
// Cloud data model (Firestore):
//   lifetag_tags/{code}      public emergency fields + ownerUid
//   lifetag_contacts/{code}  contact numbers (fetched only after the gate)
//   lifetag_scans/{autoId}   append-only scan log, owner-readable
(function () {
  const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function genCode() {
    let code = '';
    const buf = new Uint8Array(12);
    crypto.getRandomValues(buf);
    for (let i = 0; i < 12; i++) code += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
    return code;
  }
  const PUBLIC_FIELDS = ['firstName', 'bloodGroup', 'allergiesMode', 'allergies', 'conditions', 'meds', 'note'];
  function pickPublic(data) {
    const out = {};
    PUBLIC_FIELDS.forEach(k => { if (data[k] !== undefined) out[k] = data[k]; });
    return out;
  }

  // ================= Local adapter (fallback / offline demo) =================
  const LK = { profiles: 'lt.profiles.v1', tags: 'lt.tags.v1', scans: 'lt.scans.v1', session: 'lt.session.v1' };
  const lread = (k, f) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch (e) { return f; } };
  const lwrite = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  async function hashPin(pin, salt) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin));
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  const LocalStore = {
    mode: 'local',
    async createAccount(data, pin) {
      const profiles = lread(LK.profiles, []);
      const id = 'p_' + genCode().toLowerCase();
      const profile = Object.assign({}, data, { id, pinHash: await hashPin(pin, id), createdAt: Date.now() });
      profiles.push(profile); lwrite(LK.profiles, profiles);
      const tags = lread(LK.tags, []);
      const tag = { code: genCode(), profileId: id, status: 'active', todayRider: null, informedAt: null, reportCount: 0, lastReportAt: null, createdAt: Date.now() };
      tags.push(tag); lwrite(LK.tags, tags);
      localStorage.setItem(LK.session, id);
      return { profile, tag };
    },
    listLocalProfiles() { return lread(LK.profiles, []); },
    async unlock(profileId, pin) {
      const p = this.listLocalProfiles().find(x => x.id === profileId);
      if (!p) return false;
      const ok = (await hashPin(pin, profileId)) === p.pinHash;
      if (ok) localStorage.setItem(LK.session, profileId);
      return ok;
    },
    async ownerData() {
      const pid = localStorage.getItem(LK.session);
      if (!pid) return null;
      const profile = this.listLocalProfiles().find(x => x.id === pid) || null;
      const tag = lread(LK.tags, []).find(x => x.profileId === pid) || null;
      if (!profile || !tag) return null;
      const contacts = await this.getContacts(tag.code);
      return { profile: Object.assign({}, profile, { contacts }), tag };
    },
    async getTag(code) {
      const tag = lread(LK.tags, []).find(x => x.code === String(code || '').toUpperCase()) || null;
      if (!tag) return null;
      const profile = this.listLocalProfiles().find(x => x.id === tag.profileId) || null;
      return profile ? Object.assign({}, tag, pickPublic(profile), { contacts: undefined }) : null;
    },
    async getContacts(code) {
      const tag = lread(LK.tags, []).find(x => x.code === String(code || '').toUpperCase());
      if (!tag) return [];
      const profile = this.listLocalProfiles().find(x => x.id === tag.profileId);
      if (!profile) return [];
      const map = lread('lt.consent.v1', {});
      return profile.contacts.map(c => {
        if (c.consentToken && map[c.consentToken]) return Object.assign({}, c, { consent: map[c.consentToken].status });
        return c;
      });
    },
    async createConsent(code, contactIndex, ownerFirstName, contactName) {
      const token = genCode() + genCode();
      const map = lread('lt.consent.v1', {});
      map[token] = { code, contactIndex, ownerFirstName, contactName, status: 'pending', createdAt: Date.now() };
      lwrite('lt.consent.v1', map);
      return token;
    },
    async getConsent(token) {
      const map = lread('lt.consent.v1', {});
      return map[token] ? Object.assign({ token }, map[token]) : null;
    },
    async decideConsent(token, decision) {
      const map = lread('lt.consent.v1', {});
      if (!map[token]) return null;
      map[token] = Object.assign({}, map[token], { status: decision, decidedAt: Date.now() });
      lwrite('lt.consent.v1', map);
      return map[token];
    },
    async updateTag(code, data) {
      const tags = lread(LK.tags, []);
      const i = tags.findIndex(x => x.code === code);
      if (i < 0) return null;
      tags[i] = Object.assign({}, tags[i], data); lwrite(LK.tags, tags);
      return tags[i];
    },
    async saveProfile(data) {
      const od = await this.ownerData();
      if (!od) return null;
      const profiles = lread(LK.profiles, []);
      const i = profiles.findIndex(x => x.id === od.profile.id);
      profiles[i] = Object.assign({}, profiles[i], data); lwrite(LK.profiles, profiles);
      return profiles[i];
    },
    async regenerate() {
      const od = await this.ownerData();
      if (!od) return null;
      const tags = lread(LK.tags, []).filter(x => x.profileId !== od.profile.id);
      const tag = { code: genCode(), profileId: od.profile.id, status: 'active', todayRider: null, informedAt: null, reportCount: 0, lastReportAt: null, createdAt: Date.now() };
      tags.push(tag); lwrite(LK.tags, tags);
      return tag;
    },
    async logScan(code, kind, scannerPhone, ownerUid) {
      const scans = lread(LK.scans, []);
      scans.push({ code, kind, scannerPhone: scannerPhone || '', at: Date.now() });
      lwrite(LK.scans, scans);
    },
    async scansForOwner(code) {
      return lread(LK.scans, []).filter(s => s.code === code).sort((a, b) => b.at - a.at);
    },
    async exportData() {
      const od = await this.ownerData();
      if (!od) return '{}';
      return JSON.stringify({ profile: od.profile, tag: od.tag, scans: await this.scansForOwner(od.tag.code) }, null, 2);
    },
    async deleteEverything() {
      const od = await this.ownerData();
      if (!od) return;
      lwrite(LK.profiles, lread(LK.profiles, []).filter(x => x.id !== od.profile.id));
      lwrite(LK.tags, lread(LK.tags, []).filter(x => x.profileId !== od.profile.id));
      localStorage.removeItem(LK.session);
    },
    async signOut() { localStorage.removeItem(LK.session); }
  };

  // ================= Cloud adapter (Firebase) =================
  let fb = null; // { auth, db }
  let authUser = null;
  let authReadyResolve;
  const authReady = new Promise(r => { authReadyResolve = r; });

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  async function initCloud(config) {
    const base = 'https://www.gstatic.com/firebasejs/10.12.2/';
    await loadScript(base + 'firebase-app-compat.js');
    await loadScript(base + 'firebase-auth-compat.js');
    await loadScript(base + 'firebase-firestore-compat.js');
    firebase.initializeApp(config);
    fb = { auth: firebase.auth(), db: firebase.firestore() };
    fb.auth.onAuthStateChanged(u => { authUser = u; authReadyResolve(u); });
    return true;
  }

  const codeCacheKey = uid => 'lt.cloud.code.' + uid;
  const CloudStore = {
    mode: 'cloud',
    async currentUser() { await authReady; return authUser; },
    async createAccount(data, email, password) {
      const cred = await fb.auth.createUserWithEmailAndPassword(email, password);
      const uid = cred.user.uid;
      let code = genCode();
      let exists = (await fb.db.doc('lifetag_tags/' + code).get()).exists;
      while (exists) { code = genCode(); exists = (await fb.db.doc('lifetag_tags/' + code).get()).exists; }
      const batch = fb.db.batch();
      batch.set(fb.db.doc('lifetag_tags/' + code), Object.assign(pickPublic(data), {
        ownerUid: uid, status: 'active', todayRider: null, informedAt: null, reportCount: 0, lastReportAt: null, createdAt: Date.now()
      }));
      batch.set(fb.db.doc('lifetag_contacts/' + code), { contacts: data.contacts || [] });
      await batch.commit();
      localStorage.setItem(codeCacheKey(uid), code);
      const tag = await this.getTag(code);
      return { profile: Object.assign({}, data, { id: uid }), tag };
    },
    async unlock(email, password) {
      await fb.auth.signInWithEmailAndPassword(email, password);
      return true;
    },
    async verifyCode(code) {
      const user = await this.currentUser();
      if (!user) return false;
      const tag = await this.getTag(code);
      if (tag && tag.ownerUid === user.uid) {
        localStorage.setItem(codeCacheKey(user.uid), code);
        return true;
      }
      return false;
    },
    cachedCode() { return authUser ? localStorage.getItem(codeCacheKey(authUser.uid)) : null; },
    async ownerData() {
      const user = await this.currentUser();
      if (!user) return null;
      const code = this.cachedCode();
      if (!code) return { needsCode: true };
      const tag = await this.getTag(code);
      if (!tag || tag.ownerUid !== user.uid) { localStorage.removeItem(codeCacheKey(user.uid)); return { needsCode: true }; }
      const contacts = await this.getContacts(code);
      const profile = Object.assign(pickPublic(tag), { id: user.uid, contacts });
      return { profile, tag };
    },
    async getTag(code) {
      const snap = await fb.db.doc('lifetag_tags/' + String(code || '').toUpperCase()).get();
      return snap.exists ? Object.assign({ code: snap.id }, snap.data()) : null;
    },
    async getContacts(code) {
      const snap = await fb.db.doc('lifetag_contacts/' + String(code || '').toUpperCase()).get();
      const contacts = snap.exists ? (snap.data().contacts || []) : [];
      // The consent record is authoritative when a consent link exists.
      for (const c of contacts) {
        if (c.consentToken) {
          const rec = await this.getConsent(c.consentToken).catch(() => null);
          if (rec) c.consent = rec.status;
        }
      }
      return contacts;
    },
    async createConsent(code, contactIndex, ownerFirstName, contactName) {
      const user = await this.currentUser();
      const token = genCode() + genCode();
      await fb.db.doc('lifetag_consent/' + token).set({
        code, contactIndex, ownerUid: user.uid, ownerFirstName, contactName,
        status: 'pending', createdAt: Date.now()
      });
      return token;
    },
    async getConsent(token) {
      const snap = await fb.db.doc('lifetag_consent/' + token).get();
      return snap.exists ? Object.assign({ token: snap.id }, snap.data()) : null;
    },
    async decideConsent(token, decision) {
      await fb.db.doc('lifetag_consent/' + token).update({ status: decision, decidedAt: Date.now() });
      return this.getConsent(token);
    },
    async updateTag(code, data) {
      await fb.db.doc('lifetag_tags/' + code).update(data);
      return Object.assign({}, data);
    },
    async saveProfile(data) {
      const od = await this.ownerData();
      if (!od || !od.tag) return null;
      await fb.db.doc('lifetag_tags/' + od.tag.code).update(pickPublic(data));
      await fb.db.doc('lifetag_contacts/' + od.tag.code).set({ contacts: data.contacts || [] });
      return data;
    },
    async regenerate() {
      const od = await this.ownerData();
      if (!od || !od.tag) return null;
      const user = await this.currentUser();
      const old = od.tag.code;
      const code = genCode();
      const batch = fb.db.batch();
      batch.set(fb.db.doc('lifetag_tags/' + code), Object.assign(pickPublic(od.profile), {
        ownerUid: user.uid, status: 'active', todayRider: null, informedAt: null, reportCount: 0, lastReportAt: null, createdAt: Date.now()
      }));
      batch.set(fb.db.doc('lifetag_contacts/' + code), { contacts: od.profile.contacts || [] });
      batch.delete(fb.db.doc('lifetag_tags/' + old));
      batch.delete(fb.db.doc('lifetag_contacts/' + old));
      await batch.commit();
      localStorage.setItem(codeCacheKey(user.uid), code);
      return this.getTag(code);
    },
    async logScan(code, kind, scannerPhone, ownerUid) {
      await fb.db.collection('lifetag_scans').add({
        code, ownerUid: ownerUid || '', kind, scannerPhone: scannerPhone || '', at: Date.now()
      });
    },
    async scansForOwner(code) {
      const user = await this.currentUser();
      if (!user) return [];
      const snap = await fb.db.collection('lifetag_scans')
        .where('ownerUid', '==', user.uid).where('code', '==', code).get();
      return snap.docs.map(d => d.data()).sort((a, b) => b.at - a.at);
    },
    async exportData() {
      const od = await this.ownerData();
      if (!od || !od.tag) return '{}';
      return JSON.stringify({ profile: od.profile, tag: od.tag, scans: await this.scansForOwner(od.tag.code) }, null, 2);
    },
    async deleteEverything() {
      const od = await this.ownerData();
      const user = await this.currentUser();
      if (od && od.tag) {
        await fb.db.doc('lifetag_contacts/' + od.tag.code).delete().catch(() => {});
        await fb.db.doc('lifetag_tags/' + od.tag.code).delete().catch(() => {});
      }
      if (user) { localStorage.removeItem(codeCacheKey(user.uid)); await user.delete(); }
    },
    async signOut() { await fb.auth.signOut(); }
  };

  // ================= Facade =================
  let active = LocalStore;
  const Store = {
    get mode() { return active.mode; },
    _impl: () => active,
    async init() {
      const cfg = window.LT_FIREBASE_CONFIG;
      if (cfg && cfg.apiKey) {
        try { await initCloud(cfg); active = CloudStore; }
        catch (e) { active = LocalStore; }
      }
      return active.mode;
    }
  };
  ['createAccount', 'unlock', 'ownerData', 'getTag', 'getContacts', 'updateTag',
   'saveProfile', 'regenerate', 'logScan', 'scansForOwner', 'exportData',
   'deleteEverything', 'signOut', 'listLocalProfiles', 'verifyCode', 'currentUser', 'cachedCode',
   'createConsent', 'getConsent', 'decideConsent'
  ].forEach(name => {
    Store[name] = function () {
      const impl = active[name];
      if (!impl) return Promise.resolve(null);
      return impl.apply(active, arguments);
    };
  });

  window.Store = Store;
  window.LT = { genCode, pickPublic, PUBLIC_FIELDS };
})();
