// ResQ app: landing, owner flow (create / login / dashboard / print),
// and the public bystander scan flow at #/t/CODE. All data via Store.
(function () {
  const app = document.getElementById('app');
  const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Not known'];
  const t = k => window.I18N.t(k);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function baseUrl() { return location.origin + location.pathname; }
  function activeRider(tag, person) {
    if (tag.todayRider && tag.todayRider.until > Date.now()) {
      return { name: tag.todayRider.name, bloodGroup: tag.todayRider.bloodGroup, guest: true };
    }
    return { name: person.firstName, bloodGroup: person.bloodGroup, guest: false };
  }
  function tagPayload(tag, person) {
    const rider = activeRider(tag, person);
    return baseUrl() + '#/t/' + tag.code +
      '\nResQ emergency info\nName: ' + rider.name +
      '\nBlood group: ' + (rider.bloodGroup || 'Not known');
  }
  function qrSvg(text, cell) {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: cell || 5, margin: 8, scalable: true });
  }
  function fmtTime(ts) { return new Date(ts).toLocaleString(); }
  function loading() { app.innerHTML = '<p class="lede" style="margin-top:40px">Loading…</p>'; }
  function errText(e) { return (e && e.message) ? e.message : String(e); }

  // ---------------- Landing ----------------
  function landing() {
    app.innerHTML = `
      <h1>${esc(t('hero_title'))}</h1>
      <p class="lede">${esc(t('hero_lede'))}</p>
      <div class="card">
        <ul class="tight">
          <li>${esc(t('hero_point1'))}</li>
          <li>${esc(t('hero_point2'))}</li>
          <li>${esc(t('hero_point3'))}</li>
        </ul>
      </div>
      <a class="btn btn-primary" href="#/create">${esc(t('cta_create'))}</a>
      <a class="btn" href="#/login">${esc(t('cta_have'))}</a>
      <h2>${esc(t('how_title'))}</h2>
      <div class="card">
        <p>1. ${esc(t('how_1'))}</p>
        <p>2. ${esc(t('how_2'))}</p>
        <p>3. ${esc(t('how_3'))}</p>
      </div>`;
  }

  // ---------------- Create / edit profile ----------------
  function profileForm(editProfile) {
    const cloud = Store.mode === 'cloud';
    const p = editProfile || { firstName: '', bloodGroup: 'Not known', allergiesMode: 'notset', allergies: [], conditions: [], meds: [], note: '', contacts: [{ name: '', relation: '', phone: '' }, { name: '', relation: '', phone: '' }] };
    const contacts = [0, 1].map(i => {
      const c = p.contacts[i] || { name: '', relation: '', phone: '' };
      return `<fieldset style="border:1px solid var(--line);border-radius:10px;margin:12px 0">
        <legend>Family contact ${i + 1}${i === 0 ? ' (required)' : ' (optional)'}</legend>
        <label>Name</label><input name="c${i}_name" value="${esc(c.name)}" autocomplete="off">
        <label>Relation (e.g. Father, Wife, Brother)</label><input name="c${i}_relation" value="${esc(c.relation)}" autocomplete="off">
        <label>Phone (with country code, e.g. +92 3xx xxxxxxx)</label><input name="c${i}_phone" value="${esc(c.phone)}" inputmode="tel" autocomplete="off">
      </fieldset>`;
    }).join('');
    const creds = editProfile ? '' : (cloud
      ? `<label>Your email (for signing in to your dashboard)</label>
         <input name="email" type="email" required autocomplete="email">
         <label>Choose a password (at least 6 characters)</label>
         <input name="password" type="password" required minlength="6" autocomplete="new-password">`
      : `<label>Choose a PIN (4 to 6 digits) for your dashboard</label>
         <input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,6}" required>
         <p class="hint">Demo mode: your profile is stored on this device only.</p>`);
    app.innerHTML = `
      <h1>${editProfile ? 'Edit my ResQ profile' : 'Create my ResQ'}</h1>
      <p class="lede">Only what helps in the first minutes after an accident. No CNIC. No home address. Nothing else is asked.</p>
      <form id="pf">
        <label>Your first name (this is printed on the sticker)</label>
        <input name="firstName" required value="${esc(p.firstName)}" autocomplete="off">
        <label>Blood group</label>
        <select name="bloodGroup">${BLOOD.map(b => `<option ${b === p.bloodGroup ? 'selected' : ''}>${b}</option>`).join('')}</select>
        <p class="hint">If you are not sure, choose "Not known". A wrong group is worse than none.</p>
        <label>Allergies</label>
        <label class="radio-row"><input type="radio" name="allergiesMode" value="none" ${p.allergiesMode === 'none' ? 'checked' : ''}> I have no known allergies</label>
        <label class="radio-row"><input type="radio" name="allergiesMode" value="list" ${p.allergiesMode === 'list' ? 'checked' : ''}> I have allergies (list below)</label>
        <label class="radio-row"><input type="radio" name="allergiesMode" value="notset" ${p.allergiesMode === 'notset' ? 'checked' : ''}> Leave as not provided</label>
        <input name="allergies" placeholder="e.g. Penicillin, Peanuts" value="${esc((p.allergies || []).join(', '))}">
        <label>Conditions (optional, e.g. Diabetes, Asthma, Epilepsy)</label>
        <input name="conditions" value="${esc((p.conditions || []).join(', '))}">
        <label>Regular medicines (optional)</label>
        <input name="meds" value="${esc((p.meds || []).join(', '))}">
        <label>Short note for rescuers (optional)</label>
        <textarea name="note" placeholder="Anything a first responder should know">${esc(p.note || '')}</textarea>
        ${contacts}
        ${creds}
        <button class="btn btn-primary" type="submit">${editProfile ? 'Save changes' : 'Create my ResQ'}</button>
      </form>`;
    document.getElementById('pf').addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = new FormData(ev.target);
      const split = v => String(v || '').split(',').map(s => s.trim()).filter(Boolean);
      const prevContacts = editProfile ? editProfile.contacts : [];
      const data = {
        firstName: String(f.get('firstName')).trim(),
        bloodGroup: f.get('bloodGroup'),
        allergiesMode: f.get('allergiesMode') || 'notset',
        allergies: split(f.get('allergies')),
        conditions: split(f.get('conditions')),
        meds: split(f.get('meds')),
        note: String(f.get('note') || '').trim(),
        contacts: [0, 1].map(i => {
          const phone = String(f.get(`c${i}_phone`) || '').trim();
          const prev = prevContacts[i];
          return {
            name: String(f.get(`c${i}_name`) || '').trim(),
            relation: String(f.get(`c${i}_relation`) || '').trim(),
            phone,
            consent: (prev && prev.phone === phone) ? prev.consent : 'pending'
          };
        }).filter(c => c.name || c.phone)
      };
      if (!data.contacts.length || !data.contacts[0].phone) { alert('Please add at least one family contact with a phone number.'); return; }
      try {
        if (editProfile) {
          await Store.saveProfile(data);
          location.hash = '#/dashboard';
        } else if (cloud) {
          await Store.createAccount(data, String(f.get('email')).trim(), String(f.get('password')));
          location.hash = '#/dashboard';
        } else {
          await Store.createAccount(data, String(f.get('pin')));
          location.hash = '#/dashboard';
        }
      } catch (e) { alert('Could not save: ' + errText(e)); }
    });
  }

  // ---------------- Login ----------------
  function login() {
    if (Store.mode === 'cloud') {
      app.innerHTML = `
        <h1>Open my ResQ</h1>
        <form id="lf">
          <label>Email</label><input name="email" type="email" required autocomplete="email">
          <label>Password</label><input name="password" type="password" required autocomplete="current-password">
          <button class="btn btn-primary" type="submit">Sign in</button>
        </form>
        <p class="small">New here? <a href="#/create">Create my ResQ</a></p>`;
      document.getElementById('lf').addEventListener('submit', async ev => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        try {
          await Store.unlock(String(f.get('email')).trim(), String(f.get('password')));
          location.hash = '#/dashboard';
        } catch (e) { alert('Sign-in failed: ' + errText(e)); }
      });
      return;
    }
    const profiles = Store.listLocalProfiles();
    if (!profiles.length) {
      app.innerHTML = `<h1>No ResQ on this device yet</h1><a class="btn btn-primary" href="#/create">${esc(t('cta_create'))}</a>`;
      return;
    }
    app.innerHTML = `<h1>Open my ResQ</h1>` + profiles.map(p => {
      return `<div class="card"><b>${esc(p.firstName)}</b>
        <form data-pin="${p.id}" style="margin-top:10px">
          <label>PIN</label><input name="pin" type="password" inputmode="numeric" required>
          <button class="btn btn-primary" type="submit">Open dashboard</button>
        </form></div>`;
    }).join('');
    app.querySelectorAll('form[data-pin]').forEach(form => {
      form.addEventListener('submit', async ev => {
        ev.preventDefault();
        const ok = await Store.unlock(form.getAttribute('data-pin'), String(new FormData(form).get('pin')));
        if (ok) location.hash = '#/dashboard'; else alert('Wrong PIN.');
      });
    });
  }

  function codeEntry() {
    app.innerHTML = `
      <h1>One more step</h1>
      <p class="lede">Enter the 12-letter code printed on your ResQ sticker. This connects your account to your tag on this device.</p>
      <form id="cf">
        <label>Tag code</label><input name="code" required style="text-transform:uppercase" autocomplete="off">
        <button class="btn btn-primary" type="submit">Connect my tag</button>
      </form>
      <button class="btn btn-ghost" id="lo">Sign out</button>`;
    document.getElementById('cf').addEventListener('submit', async ev => {
      ev.preventDefault();
      const code = String(new FormData(ev.target).get('code')).trim().toUpperCase();
      try {
        if (await Store.verifyCode(code)) route();
        else alert('That code does not belong to this account.');
      } catch (e) { alert(errText(e)); }
    });
    document.getElementById('lo').addEventListener('click', async () => { await Store.signOut(); location.hash = '#/'; });
  }

  // ---------------- Dashboard ----------------
  async function dashboard() {
    loading();
    let od;
    try { od = await Store.ownerData(); } catch (e) { od = null; }
    if (!od) { location.hash = '#/login'; return; }
    if (od.needsCode) { codeEntry(); return; }
    const { profile: p, tag } = od;
    const rider = activeRider(tag, p);
    const scans = await Store.scansForOwner(tag.code).catch(() => []);
    const payload = tagPayload(tag, p);
    const scanUrl = baseUrl() + '#/t/' + tag.code;
    app.innerHTML = `
      <h1>${esc(p.firstName)}'s ResQ</h1>
      <div class="card">
        <div class="kv"><span>Status</span><b><span class="pill ${tag.status === 'active' ? 'pill-active' : 'pill-revoked'}">${esc(tag.status)}</span></b></div>
        <div class="kv"><span>Tag code</span><b>${esc(tag.code)}</b></div>
        <div class="kv"><span>Showing now</span><b>${esc(rider.name)}${rider.guest ? ' (guest rider)' : ''} · ${esc(rider.bloodGroup || 'Not known')}</b></div>
        <div class="qr-box">${qrSvg(payload, 5)}<span class="small">${esc(scanUrl)}</span></div>
        <a class="btn btn-primary" href="#/print">Print my sticker</a>
        <a class="btn" href="${esc(scanUrl)}">Preview what a bystander sees</a>
      </div>
      <div class="card">
        <h2 style="margin-top:0">Family contacts</h2>
        ${p.contacts.map((c, i) => `<div class="kv"><span>${esc(c.name)} (${esc(c.relation || 'family')})</span>
          <b><span class="pill ${c.consent === 'confirmed' ? 'pill-active' : 'pill-pending'}">${esc(c.consent)}</span></b></div>
          ${c.consent !== 'confirmed' ? `<a class="btn btn-small" target="_blank" rel="noopener" href="https://wa.me/${esc(c.phone.replace(/[^0-9]/g, ''))}?text=${encodeURIComponent('Assalam-o-Alaikum, I am adding your number as my ResQ emergency contact. If I am in an accident, a bystander can reach you through my helmet sticker. Your number is never shown publicly. Please reply YES if you agree.')}">Ask on WhatsApp</a>
          <button class="btn btn-small" data-confirm="${i}">They agreed: mark confirmed</button>` : ''}`).join('')}
        <p class="hint">A contact only becomes reachable after they agree. That is their privacy right, and it also proves the number is real.</p>
      </div>
      <div class="card">
        <h2 style="margin-top:0">Someone else riding today?</h2>
        <p class="small">Borrowed bikes are normal. Set today's rider and the tag shows their name and blood group until the time you choose.</p>
        <form id="riderForm">
          <label>Rider's first name</label><input name="rname" value="${tag.todayRider ? esc(tag.todayRider.name) : ''}">
          <label>Rider's blood group</label>
          <select name="rblood">${BLOOD.map(b => `<option ${tag.todayRider && tag.todayRider.bloodGroup === b ? 'selected' : ''}>${b}</option>`).join('')}</select>
          <label>For how many hours?</label><input name="rhours" type="number" min="1" max="72" value="12">
          <button class="btn" type="submit">Set today's rider</button>
          ${tag.todayRider ? '<button class="btn btn-ghost" type="button" id="clearRider">Clear (owner is riding)</button>' : ''}
        </form>
      </div>
      <div class="card">
        <h2 style="margin-top:0">Scan history</h2>
        ${scans.length ? scans.slice(0, 20).map(s => `<div class="kv"><span>${esc(s.kind)}${s.scannerPhone ? ' · ' + esc(s.scannerPhone) : ''}</span><b>${esc(fmtTime(s.at))}</b></div>`).join('') : '<p class="small">No scans yet.</p>'}
      </div>
      <div class="card">
        <h2 style="margin-top:0">Tag controls</h2>
        ${tag.status === 'active'
          ? '<button class="btn" id="revokeBtn">Deactivate this tag (lost or stolen)</button>'
          : '<button class="btn btn-green" id="activateBtn">Reactivate this tag</button>'}
        <button class="btn" id="regenBtn">Get a new code (old sticker stops working)</button>
        <a class="btn" href="#/edit">Edit profile</a>
        <button class="btn" id="exportBtn">Download my data (JSON)</button>
        <button class="btn btn-ghost" id="logoutBtn">Log out of dashboard</button>
        <button class="btn btn-ghost" id="deleteBtn" style="color:var(--red)">Delete everything</button>
      </div>`;
    app.querySelectorAll('[data-confirm]').forEach(btn => btn.addEventListener('click', async () => {
      const contacts = p.contacts.slice();
      contacts[Number(btn.getAttribute('data-confirm'))].consent = 'confirmed';
      await Store.saveProfile(Object.assign({}, p, { contacts }));
      dashboard();
    }));
    const rf = document.getElementById('riderForm');
    rf.addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = new FormData(rf);
      const name = String(f.get('rname') || '').trim();
      if (!name) { alert('Enter the rider name.'); return; }
      await Store.updateTag(tag.code, { todayRider: { name, bloodGroup: f.get('rblood'), until: Date.now() + Number(f.get('rhours')) * 3600 * 1000 } });
      dashboard();
    });
    const cr = document.getElementById('clearRider');
    if (cr) cr.addEventListener('click', async () => { await Store.updateTag(tag.code, { todayRider: null }); dashboard(); });
    const rb = document.getElementById('revokeBtn');
    if (rb) rb.addEventListener('click', async () => { await Store.updateTag(tag.code, { status: 'revoked' }); dashboard(); });
    const ab = document.getElementById('activateBtn');
    if (ab) ab.addEventListener('click', async () => { await Store.updateTag(tag.code, { status: 'active' }); dashboard(); });
    document.getElementById('regenBtn').addEventListener('click', async () => {
      if (confirm('The old sticker will stop working. Continue?')) { await Store.regenerate(); dashboard(); }
    });
    document.getElementById('exportBtn').addEventListener('click', async () => {
      const blob = new Blob([await Store.exportData()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'lifetag-my-data.json'; a.click();
      URL.revokeObjectURL(a.href);
    });
    document.getElementById('logoutBtn').addEventListener('click', async () => { await Store.signOut(); location.hash = '#/'; });
    document.getElementById('deleteBtn').addEventListener('click', async () => {
      if (confirm('Delete your profile, tag and scan history permanently?')) {
        try { await Store.deleteEverything(); } catch (e) { alert('Delete needs a fresh sign-in: ' + errText(e)); return; }
        location.hash = '#/';
      }
    });
  }

  // ---------------- Print sticker ----------------
  async function printView() {
    loading();
    const od = await Store.ownerData().catch(() => null);
    if (!od || od.needsCode) { location.hash = '#/login'; return; }
    const { profile: p, tag } = od;
    const rider = activeRider(tag, p);
    app.innerHTML = `
      <h1 class="no-print">Your sticker</h1>
      <p class="no-print">Print this page and cut out the sticker. Put it on the side of your helmet, or on the vehicle where a helper will see it.</p>
      <div class="sticker">
        <div class="s-title">IN CASE OF ACCIDENT — SCAN ME</div>
        <div class="urdu" dir="rtl" style="font-size:17px">حادثے کی صورت میں اسکین کریں — زندگی بچائیں</div>
        <div class="qr-box">${qrSvg(tagPayload(tag, p), 6)}</div>
        <div class="s-name">${esc(rider.name)}</div>
        <div class="s-blood">Blood: ${esc(rider.bloodGroup || 'Not known')}</div>
        <div class="s-code">RESQ · ${esc(tag.code)}</div>
      </div>
      <button class="btn btn-primary no-print" onclick="window.print()">Print</button>
      <a class="btn no-print" href="#/dashboard">Back to dashboard</a>`;
  }

  // ---------------- Public scan flow ----------------
  async function scanPage(code) {
    loading();
    let tag = null;
    try { tag = await Store.getTag(code); } catch (e) { tag = null; }
    if (!tag) {
      app.innerHTML = `<div class="scan-hero"><div class="cross">✚</div><h1>ResQ</h1></div><div class="danger-note">${esc(t('tag_notfound'))}</div><a class="btn btn-emergency" href="tel:1122">${esc(t('call_ambulance'))}</a>`;
      return;
    }
    if (tag.status !== 'active') {
      app.innerHTML = `<div class="scan-hero"><div class="cross">✚</div><h1>ResQ</h1></div><div class="warn">${esc(t('tag_revoked'))}</div><a class="btn btn-emergency" href="tel:1122">${esc(t('call_ambulance'))}</a>`;
      return;
    }
    // Per-device soft lockdown in cloud mode (the log is owner-only there);
    // local mode counts real views for this tag.
    let locked = false;
    if (Store.mode === 'local') {
      const recent = (await Store.scansForOwner(tag.code)).filter(s => Date.now() - s.at < 3600 * 1000 && s.kind === 'view').length;
      locked = recent >= 8;
    } else {
      const key = 'lt.views.' + tag.code;
      const views = JSON.parse(localStorage.getItem(key) || '[]').filter(ts => Date.now() - ts < 3600 * 1000);
      views.push(Date.now());
      localStorage.setItem(key, JSON.stringify(views));
      locked = views.length > 8;
    }
    Store.logScan(tag.code, 'view', '', tag.ownerUid || '').catch(() => {});
    app.innerHTML = `
      <div class="scan-hero"><div class="cross">✚</div><h1>${esc(t('gate_title'))}</h1></div>
      <div class="card">
        <h2 style="margin-top:0">${esc(t('gate_q'))}</h2>
        <p>${esc(t('gate_note'))}</p>
        <label>${esc(t('gate_phone_label'))}</label>
        <input id="scannerPhone" inputmode="tel" placeholder="+92 ...">
        <p class="hint">${esc(t('gate_phone_hint'))}</p>
        <button class="btn btn-emergency" id="gateYes">${esc(t('gate_yes'))}</button>
        <button class="btn" id="gateNo">${esc(t('gate_no'))}</button>
      </div>
      <a class="btn btn-emergency" href="tel:1122">${esc(t('call_ambulance'))}</a>`;
    document.getElementById('gateNo').addEventListener('click', () => {
      app.innerHTML = `<div class="scan-hero"><div class="cross">✚</div><h1>ResQ</h1></div>
        <div class="card"><h2 style="margin-top:0">${esc(t('looking_title'))}</h2><p>${esc(t('looking_body'))}</p></div>
        <a class="btn" href="#/t/${esc(tag.code)}">Back</a>`;
    });
    document.getElementById('gateYes').addEventListener('click', async () => {
      const phone = document.getElementById('scannerPhone').value.trim();
      emergencyView(tag, phone, locked);
    });
  }

  async function emergencyView(tag, scannerPhone, locked) {
    loading();
    const first = !tag.informedAt;
    if (first) { try { await Store.updateTag(tag.code, { informedAt: Date.now() }); } catch (e) {} }
    Store.logScan(tag.code, 'emergency', scannerPhone, tag.ownerUid || '').catch(() => {});
    let contacts = [];
    if (!locked) { try { contacts = await Store.getContacts(tag.code); } catch (e) { contacts = []; } }
    const p = tag; // public fields live on the tag record in both modes
    const rider = activeRider(tag, p);
    const allergiesHtml = locked ? `<span class="small">Hidden after repeated non-emergency scans.</span>`
      : p.allergiesMode === 'none' ? esc(t('allergies_none'))
      : p.allergiesMode === 'list' && p.allergies && p.allergies.length ? esc(p.allergies.join(', '))
      : esc(t('not_provided'));
    const listOrUnknown = arr => locked ? '<span class="small">Hidden after repeated scans.</span>'
      : (arr && arr.length ? esc(arr.join(', ')) : esc(t('not_provided')));
    const callBtns = contacts.filter(c => c.consent === 'confirmed').map(c =>
      `<a class="btn btn-green" href="tel:${esc(c.phone.replace(/[^0-9+]/g, ''))}">📞 ${esc(t('call_family'))}: ${esc(c.name)} (${esc(c.relation || 'family')})</a>`).join('');
    const pendingNote = !locked && contacts.some(c => c.consent !== 'confirmed')
      ? `<p class="hint">Some contacts have not confirmed yet and are not reachable here.</p>` : '';
    app.innerHTML = `
      <div class="scan-hero"><div class="cross">✚</div><h1>${esc(rider.name)}</h1>
      ${rider.guest ? `<p class="pill pill-pending">${esc(t('rider_today'))}</p>` : ''}</div>
      ${first ? `<div class="ok-note">${esc(t('informed_now'))}</div>` : `<div class="warn">${esc(t('informed_already'))} ${esc(fmtTime(tag.informedAt))}.</div>`}
      <div class="card">
        <div class="small">${esc(t('blood_label'))}</div>
        <div class="blood">${esc(rider.bloodGroup || '—')}</div>
        <p class="small">${esc(t('blood_unverified'))}</p>
        <div class="kv"><span>${esc(t('allergies_label'))}</span><b>${allergiesHtml}</b></div>
        <div class="kv"><span>${esc(t('conditions_label'))}</span><b>${listOrUnknown(p.conditions)}</b></div>
        <div class="kv"><span>${esc(t('meds_label'))}</span><b>${listOrUnknown(p.meds)}</b></div>
        ${p.note ? `<div class="kv"><span>${esc(t('note_label'))}</span><b>${esc(p.note)}</b></div>` : ''}
      </div>
      <div class="card">
        <b>First, do this:</b>
        <ul class="tight">
          <li>${esc(t('emg_first_aid_1'))}</li>
          <li>${esc(t('emg_first_aid_2'))}</li>
          <li>${esc(t('emg_first_aid_3'))}</li>
          <li>${esc(t('emg_first_aid_4'))}</li>
        </ul>
        <button class="btn" id="listenBtn">🔊 ${esc(t('listen'))}</button>
      </div>
      <a class="btn btn-emergency" href="tel:1122">${esc(t('call_ambulance'))}</a>
      ${callBtns}
      ${pendingNote}
      <p class="small center">Numbers are never shown on this screen. Calls connect directly from these buttons.</p>`;
    document.getElementById('listenBtn').addEventListener('click', () => {
      try {
        const u = new SpeechSynthesisUtterance(t('voice_text'));
        u.lang = window.I18N.lang === 'ur' ? 'ur-PK' : 'en-US';
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      } catch (e) { /* TTS not available on this device */ }
    });
  }

  // ---------------- About: how it works + risks we found ----------------
  function about() {
    const risks = [
      ['"Anyone can photograph the sticker and scam the family."',
       'True for a badly designed tag, so the sticker carries no phone number at all: only a first name, a blood group, and the scan link. A photograph of the sticker gives a scammer nothing they can call.'],
      ['"Family numbers will leak and be misused."',
       'Numbers are never printed and never displayed as text. They are stored separately and fetched only after a bystander passes the emergency gate, and a contact is only reachable after that contact personally agreed to be listed. Every emergency scan is logged and visible to the owner.'],
      ['"People will scan it as a joke and panic the family."',
       'The scan page first asks "Is this a real emergency?" and warns that the scan is reported. The family alert says "a help request came from the tag", not "an accident happened". Repeated non-emergency scans lock the tag down to blood group and 1122 only.'],
      ['"The blood group might be wrong."',
       'It might. It is self-reported, and the scan page says so in plain words: always test before a transfusion. Owners are pushed to choose "Not known" instead of guessing. Empty fields show as "Not provided, treat as unknown", never as "none".'],
      ['"Bystanders will not know to scan, or will fear police involvement."',
       'Partly true, and no software fully solves it. The sticker teaches in two languages: "In case of accident, scan me." Scanning asks for no name and no statement; the optional phone number is only so the family can call back. The page also speaks its instructions aloud in Urdu for bystanders who cannot read.'],
      ['"The bike is borrowed, or the helmet is shared or stolen."',
       'The owner can set "today\'s rider" so the tag shows the actual rider. If a helmet or tag is lost, one tap deactivates it and a new code replaces the old sticker.'],
      ['"If your server dies, every sticker dies."',
       'The most vital facts, name and blood group, are inside the QR itself and work with no internet and no server. Owners can download all of their data at any time.'],
      ['"Hospitals and 1122 may ignore it."',
       'They might, at first. ResQ does not replace them and says so everywhere. Its job is narrower: identify the person and reach the family in the first minutes, which is the gap that exists today.']
    ];
    app.innerHTML = `
      <h1>How ResQ works, honestly</h1>
      <p class="lede">Before building ResQ we attacked our own idea and wrote down 40 ways it could fail or be misused. Here are the worst ones, and what the design does about each. What cannot be fixed is stated, not hidden.</p>
      ${risks.map(r => `<details class="risk"><summary>${esc(r[0])}</summary><p>${esc(r[1])}</p></details>`).join('')}
      <div class="warn"><b>Honest limitations of this prototype:</b> contact numbers are protected by the unguessable tag code and are only fetched after the emergency gate; a determined technical attacker who already knows a code could query the database directly. The production design closes this with a small calling relay so numbers never leave the server. SMS alerts need a paid gateway and are a roadmap item, not a claim: in this build the family is reached through the call buttons and the owner's scan log. ResQ is a prototype and is not a replacement for emergency services.</div>
      <a class="btn btn-primary" href="#/create">${esc(t('cta_create'))}</a>
      <a class="btn" href="#/">Back to home</a>`;
  }

  // ---------------- Router ----------------
  async function route() {
    const hash = location.hash || '#/';
    document.documentElement.lang = window.I18N.lang === 'ur' ? 'ur' : 'en';
    if (hash.startsWith('#/t/')) scanPage(hash.slice(4));
    else if (hash === '#/create') profileForm(null);
    else if (hash === '#/edit') {
      const od = await Store.ownerData().catch(() => null);
      if (!od || od.needsCode) { location.hash = '#/dashboard'; return; }
      profileForm(od.profile);
    }
    else if (hash === '#/login') login();
    else if (hash === '#/dashboard') dashboard();
    else if (hash === '#/print') printView();
    else if (hash === '#/about') about();
    else landing();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  const langBtn = document.getElementById('langBtn');
  function syncLangBtn() { langBtn.textContent = window.I18N.lang === 'ur' ? 'English' : 'اردو'; }
  langBtn.addEventListener('click', () => { window.I18N.toggle(); syncLangBtn(); route(); });
  syncLangBtn();
  Store.init().then(() => route());
})();
