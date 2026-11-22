// ResQ app: landing, owner flow (create / login / dashboard / print),
// and the public bystander scan flow at #/t/CODE. All data via Store.
(function () {
  const app = document.getElementById('app');
  // Judges' demo tag (synthetic data). Filled in once the demo tag exists.
  const DEMO_CODE = '';
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
      <a class="btn btn-rescue" href="#/create">${esc(t('cta_create'))}</a>
      <a class="btn" href="#/login">${esc(t('cta_have'))}</a>
      <h2>${esc(t('how_title'))}</h2>
      <div class="card">
        <p>1. ${esc(t('how_1'))}</p>
        <p>2. ${esc(t('how_2'))}</p>
        <p>3. ${esc(t('how_3'))}</p>
      </div>
      <h2>What is on the sticker, and what is never on it</h2>
      <div class="vs-grid">
        <div class="vs-yes"><b>On the sticker</b>
          <ul class="tight"><li>The QR code</li><li>First name</li><li>Blood group</li></ul>
          <p class="small">That is all. It works with no internet and no server.</p></div>
        <div class="vs-no"><b>Never on the sticker</b>
          <ul class="tight"><li>Phone numbers</li><li>CNIC / national ID</li><li>Home address</li></ul>
          <p class="small">A photograph of the sticker gives a scammer nothing they can use.</p></div>
      </div>
      ${DEMO_CODE ? `<h2>Try the demo tag</h2>
      <div class="card center">
        <p>Scan this demo tag with your phone, exactly as a bystander would. The rider "Ahmed" is not real; all demo data is synthetic.</p>
        <div class="qr-box">${qrSvg(baseUrl() + '#/t/' + DEMO_CODE, 5)}</div>
        <a class="btn btn-primary" href="#/t/${DEMO_CODE}">Open the demo scan page</a>
      </div>` : ''}
      <h2>Common questions</h2>
      ${[
        ['Does the sticker show my family\'s phone numbers?', 'No. Numbers are never printed and never shown as text on the scan page. They are stored separately and used only for the call buttons after a bystander confirms a real emergency.'],
        ['What if I do not know my blood group?', 'Choose "Not known". A wrong group is more dangerous than none, and the scan page always says the group is self-reported and must be tested before a transfusion.'],
        ['What if someone scans my tag as a joke?', 'They first meet a gate asking if it is a real emergency, and every scan is logged for you to see. Repeated "just looking" scans lock the tag down: the emergency path then needs a 3-second hold, and only the blood group and 1122 stay visible.'],
        ['Someone else rides my bike. What then?', 'Set "today\'s rider" in your dashboard. The tag shows their name and blood group until the time you choose ends.'],
        ['What if my helmet is stolen?', 'Deactivate the tag in one tap, or regenerate the code. The old sticker stops working immediately.'],
        ['Is ResQ a replacement for the ambulance service?', 'No. ResQ only helps identify you and reach your family in the first minutes. Always call 1122 first.']
      ].map(q => `<details class="risk"><summary>${esc(q[0])}</summary><p>${esc(q[1])}</p></details>`).join('')}
      <div class="stripe"></div>
      <p class="center"><a href="#/safety">How ResQ stays safe</a> · <a href="#/privacy">Privacy</a> · <a href="#/judges">For judges</a></p>`;
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
        ${p.contacts.map((c, i) => {
          const consentUrl = c.consentToken ? baseUrl() + '#/consent/' + c.consentToken : '';
          return `<div class="kv"><span>${esc(c.name)} (${esc(c.relation || 'family')})</span>
          <b><span class="pill ${c.consent === 'confirmed' ? 'pill-active' : 'pill-pending'}">${esc(c.consent)}</span></b></div>
          ${c.consent !== 'confirmed' ? (c.consentToken
            ? `<a class="btn btn-small" target="_blank" rel="noopener" href="https://wa.me/${esc(c.phone.replace(/[^0-9]/g, ''))}?text=${encodeURIComponent('Assalam-o-Alaikum, I am adding you as my ResQ emergency contact. Please open this link and tap "Yes, I agree": ' + consentUrl + ' Your number is never shown publicly.')}">Send consent link on WhatsApp</a>
               <button class="btn btn-small" data-copylink="${esc(consentUrl)}">Copy consent link</button>`
            : `<button class="btn btn-small" data-makelink="${i}">Create consent link for ${esc(c.name)}</button>
               <button class="btn btn-small" data-confirm="${i}">They agreed in person: mark confirmed</button>`) : ''}`;
        }).join('')}
        <p class="hint">A contact only becomes reachable after they agree, ideally through their own consent link. That is their privacy right, and it also proves the number is real.</p>
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
    app.querySelectorAll('[data-makelink]').forEach(btn => btn.addEventListener('click', async () => {
      const i = Number(btn.getAttribute('data-makelink'));
      try {
        const token = await Store.createConsent(tag.code, i, p.firstName, p.contacts[i].name);
        const contacts = p.contacts.slice();
        contacts[i] = Object.assign({}, contacts[i], { consentToken: token, consent: 'pending' });
        await Store.saveProfile(Object.assign({}, p, { contacts }));
        dashboard();
      } catch (e) { alert('Could not create the link: ' + errText(e)); }
    }));
    app.querySelectorAll('[data-copylink]').forEach(btn => btn.addEventListener('click', async () => {
      const url = btn.getAttribute('data-copylink');
      try { await navigator.clipboard.writeText(url); btn.textContent = 'Copied'; }
      catch (e) { prompt('Copy this link:', url); }
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
        <div class="s-band">
          <div class="s-title">IN CASE OF ACCIDENT — SCAN ME</div>
          <div class="urdu" dir="rtl" style="font-size:17px;line-height:1.9">حادثے کی صورت میں اسکین کریں — زندگی بچائیں</div>
        </div>
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
    // Lockdown has two triggers: the server-side counter (3 "just looking"
    // reports in 24 hours, set on the tag itself) and a per-device counter.
    const serverLocked = (tag.reportCount || 0) >= 3 && (Date.now() - (tag.lastReportAt || 0) < 24 * 3600 * 1000);
    let deviceLocked = false;
    if (Store.mode === 'local') {
      const recent = (await Store.scansForOwner(tag.code)).filter(s => Date.now() - s.at < 3600 * 1000 && s.kind === 'view').length;
      deviceLocked = recent >= 8;
    } else {
      const key = 'lt.views.' + tag.code;
      const views = JSON.parse(localStorage.getItem(key) || '[]').filter(ts => Date.now() - ts < 3600 * 1000);
      views.push(Date.now());
      localStorage.setItem(key, JSON.stringify(views));
      deviceLocked = views.length > 8;
    }
    const locked = serverLocked || deviceLocked;
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
      Store.updateTag(tag.code, { reportCount: (tag.reportCount || 0) + 1, lastReportAt: Date.now() }).catch(() => {});
      Store.logScan(tag.code, 'not_emergency', '', tag.ownerUid || '').catch(() => {});
      app.innerHTML = `<div class="scan-hero"><div class="cross">✚</div><h1>ResQ</h1></div>
        <div class="card"><h2 style="margin-top:0">${esc(t('looking_title'))}</h2><p>${esc(t('looking_body'))}</p></div>
        <a class="btn" href="#/t/${esc(tag.code)}">Back</a>`;
    });
    const yesBtn = document.getElementById('gateYes');
    const goEmergency = () => {
      const phone = document.getElementById('scannerPhone').value.trim();
      emergencyView(tag, phone, locked);
    };
    if (locked) {
      // In lockdown the emergency path needs a deliberate 3-second hold,
      // which stops casual misuse without ever blocking a real emergency.
      yesBtn.textContent = 'Hold for 3 seconds if this is a real emergency';
      let holdTimer = null;
      yesBtn.addEventListener('pointerdown', () => { holdTimer = setTimeout(goEmergency, 3000); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(evName =>
        yesBtn.addEventListener(evName, () => { if (holdTimer) clearTimeout(holdTimer); }));
    } else {
      yesBtn.addEventListener('click', goEmergency);
    }
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
      // Recorded audio first: many phones have no Urdu TTS voice at all.
      const lang = window.I18N.lang === 'ur' ? 'ur' : 'en';
      const audio = new Audio('audio/guide-' + lang + '.mp3');
      audio.play().catch(() => {
        try {
          const u = new SpeechSynthesisUtterance(t('voice_text'));
          u.lang = window.I18N.lang === 'ur' ? 'ur-PK' : 'en-US';
          speechSynthesis.cancel();
          speechSynthesis.speak(u);
        } catch (e) { /* no audio available on this device */ }
      });
    });
  }

  // ---------------- Consent page (family contact decides) ----------------
  async function consentPage(token) {
    loading();
    let rec = null;
    try { rec = await Store.getConsent(token); } catch (e) { rec = null; }
    if (!rec) {
      app.innerHTML = `<div class="scan-hero"><div class="cross">✚</div><h1>ResQ</h1></div>
        <div class="danger-note">${esc(t('consent_notfound'))}</div>
        <a class="btn btn-emergency" href="tel:1122">${esc(t('call_ambulance'))}</a>`;
      return;
    }
    const statusPill = `<span class="pill ${rec.status === 'confirmed' ? 'pill-active' : 'pill-pending'}">${esc(rec.status)}</span>`;
    app.innerHTML = `
      <div class="scan-hero"><div class="cross">✚</div><h1>${esc(t('consent_heading'))}</h1></div>
      <div class="card">
        <p><b>${esc(rec.ownerFirstName)}</b> ${esc(t('consent_explain'))}</p>
        <p>${esc(t('consent_points'))}</p>
        <div class="kv"><span>${esc(t('consent_status'))}</span><b>${statusPill}</b></div>
      </div>
      ${rec.status === 'confirmed'
        ? `<button class="btn" id="revokeBtn2">${esc(t('consent_revoke'))}</button>`
        : `<button class="btn btn-green" id="acceptBtn">${esc(t('consent_accept'))}</button>
           <button class="btn" id="declineBtn">${esc(t('consent_decline'))}</button>`}
      <p class="small center">ResQ · SafeSpace Hacks 2026 prototype</p>`;
    const decide = async decision => {
      try { await Store.decideConsent(token, decision); } catch (e) { alert(errText(e)); return; }
      app.innerHTML = `
        <div class="scan-hero"><div class="cross">✚</div><h1>ResQ</h1></div>
        <div class="ok-note">${esc(t('consent_thanks'))}</div>
        <div class="card"><div class="kv"><span>${esc(t('consent_status'))}</span><b>${esc(decision)}</b></div>
        <p class="small">You can change your answer any time by opening this same link again.</p></div>`;
    };
    const acc = document.getElementById('acceptBtn');
    if (acc) acc.addEventListener('click', () => decide('confirmed'));
    const dec = document.getElementById('declineBtn');
    if (dec) dec.addEventListener('click', () => decide('declined'));
    const rev = document.getElementById('revokeBtn2');
    if (rev) rev.addEventListener('click', () => decide('revoked'));
  }

  // ---------------- Safety / Privacy / Judges pages ----------------
  function safetyPage() {
    app.innerHTML = `
      <h1>How ResQ stays safe</h1>
      <p class="lede">ResQ was designed by attacking it first. We wrote down 40 ways the idea could fail or be misused, then designed against each one. The full list is on the <a href="#/about">About page</a>. This page explains the machinery.</p>
      <h2>Three separate records, on purpose</h2>
      <div class="card"><b>1. The public tag record.</b> First name, blood group, allergies, conditions, medicines, note. Readable only by someone who has the tag's random 12-character code. There is no list of tags anywhere, so nothing can be browsed or scraped in bulk.</div>
      <div class="card"><b>2. The contacts record.</b> Family names and phone numbers live in a different record, fetched only after a bystander passes the emergency gate. Numbers are never displayed as text, and a contact is reachable only after they personally accept through their own consent link.</div>
      <div class="card"><b>3. The scan log.</b> Every view, "just looking" report and emergency is appended to a log that only the owner can read. Nobody, including the owner, can edit or delete individual entries.</div>
      <h2>The gate and the lockdown</h2>
      <div class="card">
        <p>Scanning shows nothing private. The bystander must first confirm a real emergency, and is told the scan is reported. Three "just looking" reports in 24 hours put the tag into lockdown: the emergency path then needs a deliberate 3-second hold, and medical details beyond blood group are hidden. The 1122 button and the name and blood group inside the QR are never blocked, for anyone, ever.</p>
      </div>
      <h2>What we could not fully solve, stated plainly</h2>
      <div class="warn">A determined technical attacker who already knows a tag code could query the database directly for the contacts record. The production fix is a calling relay so numbers never leave the server; that needs paid telephony and is a roadmap item, not a claim. Bystanders may still choose not to scan. A self-reported blood group may still be wrong, which is why the page orders a test before any transfusion.</div>
      <a class="btn" href="#/">Back to home</a>`;
  }

  function privacyPage() {
    app.innerHTML = `
      <h1>Privacy, in plain words</h1>
      <h2>What ResQ stores</h2>
      <div class="card"><ul class="tight">
        <li>Your first name and blood group</li>
        <li>Allergies, conditions and regular medicines, if you provide them</li>
        <li>Up to two family contacts: name, relation, phone number, and whether they agreed</li>
        <li>A log of scans of your tag</li>
        <li>Your email address, for signing in</li>
      </ul></div>
      <h2>What ResQ never asks for</h2>
      <div class="card"><ul class="tight">
        <li>No CNIC or national ID number</li>
        <li>No home address</li>
        <li>No location tracking, ever</li>
        <li>No contacts from your phone book</li>
      </ul></div>
      <h2>Who can see what</h2>
      <div class="card">
        <p>Anyone holding your sticker can see your first name and blood group; they are printed in the QR itself so they work offline. Medical details appear only after the emergency gate. Family numbers are never displayed; they only power call buttons, and only for contacts who accepted their consent link. Only you can see your scan log.</p>
      </div>
      <h2>Your controls</h2>
      <div class="card">
        <p>From your dashboard you can edit everything, deactivate your tag, regenerate its code, download all of your data as a file, and delete everything permanently. Family contacts can decline or revoke their consent at any time from their own link, without asking you.</p>
      </div>
      <a class="btn" href="#/">Back to home</a>`;
  }

  function judgesPage() {
    app.innerHTML = `
      <h1>For the SafeSpace Hacks judges</h1>
      <p class="lede">ResQ is a QR emergency tag for motorcycle helmets and vehicles, built solo for SafeSpace Hacks 2026. This page collects everything needed to evaluate it in a few minutes.</p>
      ${DEMO_CODE ? `<h2>Try it yourself (2 minutes)</h2>
      <div class="card center">
        <p>Scan the demo tag, or open it here. Rider "Ahmed, B+" is synthetic. Pass the gate as a bystander would, listen to the Urdu guidance, and notice that no phone number ever appears on screen.</p>
        <div class="qr-box">${qrSvg(baseUrl() + '#/t/' + DEMO_CODE, 5)}</div>
        <a class="btn btn-rescue" href="#/t/${DEMO_CODE}">Open the demo scan page</a>
      </div>` : ''}
      <h2>One safer outcome</h2>
      <div class="card"><p>A rider is knocked unconscious at night. Today: his phone is locked, nobody knows his blood group or who to call, and the hospital loses the golden hour to identification. With ResQ: a bystander scans the helmet sticker, sees B+ and a penicillin allergy in seconds, calls 1122 with the location, and reaches his sister through a button, without her number ever being exposed. The family learns within minutes, from a person who was there, that a help request came from his tag.</p></div>
      <h2>One honest limitation</h2>
      <div class="card"><p>ResQ cannot make a bystander scan. The sticker teaches in two languages and the page speaks Urdu aloud, but willingness to help is a social problem software can only lower the cost of, not solve. The full risk audit and the remaining technical limitations are on the <a href="#/safety">Safety page</a>.</p></div>
      <h2>What was built for this event</h2>
      <div class="card"><p>The idea, the 40-point risk audit, the hardened design, and this working product (accounts, consent links, scan log, lockdown, recorded Urdu audio, bilingual interface) were all created during the SafeSpace Hacks window. The only pre-existing piece is the vendored MIT-licensed QR library, credited below.</p></div>
      <h2>Credits</h2>
      <div class="card"><ul class="tight">
        <li>Designed and built by Daim Ali (solo).</li>
        <li>AI assistance: Claude (Muse), used for design review, the risk audit and code.</li>
        <li>QR generation: qrcode-generator by Kazuhiko Arase (MIT).</li>
        <li>Fonts: Source Sans 3 and Bricolage Grotesque (SIL Open Font License).</li>
        <li>All demo data is synthetic. No real person's information appears anywhere.</li>
      </ul></div>
      <a class="btn" href="#/">Back to home</a>`;
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
    else if (hash.startsWith('#/consent/')) consentPage(hash.slice(10));
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
    else if (hash === '#/safety') safetyPage();
    else if (hash === '#/privacy') privacyPage();
    else if (hash === '#/judges') judgesPage();
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
