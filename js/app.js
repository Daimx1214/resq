// LifeTag app: landing, owner flow (create / login / dashboard / print),
// and the public bystander scan flow at #/t/CODE.
(function () {
  const app = document.getElementById('app');
  const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Not known'];
  const t = k => window.I18N.t(k);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function baseUrl() { return location.origin + location.pathname; }
  function activeRider(tag, profile) {
    if (tag.todayRider && tag.todayRider.until > Date.now()) {
      return { name: tag.todayRider.name, bloodGroup: tag.todayRider.bloodGroup, guest: true };
    }
    return { name: profile.firstName, bloodGroup: profile.bloodGroup, guest: false };
  }
  function tagPayload(tag, profile) {
    const rider = activeRider(tag, profile);
    return baseUrl() + '#/t/' + tag.code +
      '\nLifeTag emergency info\nName: ' + rider.name +
      '\nBlood group: ' + (rider.bloodGroup || 'Not known');
  }
  function qrSvg(text, cell) {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: cell || 5, margin: 8, scalable: true });
  }
  function fmtTime(ts) { return new Date(ts).toLocaleString(); }

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
      </div>
      <p class="small">Demo: after creating a tag, open its scan link in another browser tab to see exactly what a bystander sees.</p>`;
  }

  // ---------------- Create / edit profile ----------------
  function profileForm(editProfile) {
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
    app.innerHTML = `
      <h1>${editProfile ? 'Edit my LifeTag profile' : 'Create my LifeTag'}</h1>
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
        ${editProfile ? '' : `<label>Choose a PIN (4 to 6 digits) for your dashboard</label>
        <input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,6}" required>
        <p class="hint">In this prototype your profile is stored on this device. The PIN only guards this device copy.</p>`}
        <button class="btn btn-primary" type="submit">${editProfile ? 'Save changes' : 'Create my LifeTag'}</button>
      </form>`;
    document.getElementById('pf').addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = new FormData(ev.target);
      const split = v => String(v || '').split(',').map(s => s.trim()).filter(Boolean);
      const data = {
        firstName: String(f.get('firstName')).trim(),
        bloodGroup: f.get('bloodGroup'),
        allergiesMode: f.get('allergiesMode') || 'notset',
        allergies: split(f.get('allergies')),
        conditions: split(f.get('conditions')),
        meds: split(f.get('meds')),
        note: String(f.get('note') || '').trim(),
        contacts: [0, 1].map(i => ({
          name: String(f.get(`c${i}_name`) || '').trim(),
          relation: String(f.get(`c${i}_relation`) || '').trim(),
          phone: String(f.get(`c${i}_phone`) || '').trim(),
          consent: (editProfile && editProfile.contacts[i] && editProfile.contacts[i].phone === String(f.get(`c${i}_phone`) || '').trim())
            ? editProfile.contacts[i].consent : 'pending'
        })).filter(c => c.name || c.phone)
      };
      if (!data.contacts.length || !data.contacts[0].phone) { alert('Please add at least one family contact with a phone number.'); return; }
      if (editProfile) {
        Store.updateProfile(editProfile.id, data);
        location.hash = '#/dashboard';
      } else {
        await Store.createProfile(data, String(f.get('pin')));
        location.hash = '#/dashboard';
      }
    });
  }

  // ---------------- Login ----------------
  function login() {
    const profiles = Store.listProfiles();
    if (!profiles.length) {
      app.innerHTML = `<h1>No LifeTag on this device yet</h1><a class="btn btn-primary" href="#/create">${esc(t('cta_create'))}</a>`;
      return;
    }
    app.innerHTML = `<h1>Open my LifeTag</h1>` + profiles.map(p => {
      const tag = Store.getTagForProfile(p.id);
      return `<div class="card"><b>${esc(p.firstName)}</b> <span class="small">tag ${tag ? esc(tag.code) : ''}</span>
        <form data-pin="${p.id}" style="margin-top:10px">
          <label>PIN</label><input name="pin" type="password" inputmode="numeric" required>
          <button class="btn btn-primary" type="submit">Open dashboard</button>
        </form></div>`;
    }).join('');
    app.querySelectorAll('form[data-pin]').forEach(form => {
      form.addEventListener('submit', async ev => {
        ev.preventDefault();
        const id = form.getAttribute('data-pin');
        const pin = new FormData(form).get('pin');
        if (await Store.checkPin(id, String(pin))) { Store.setSession(id); location.hash = '#/dashboard'; }
        else alert('Wrong PIN.');
      });
    });
  }

  // ---------------- Dashboard ----------------
  function dashboard() {
    const pid = Store.getSession();
    if (!pid) { location.hash = '#/login'; return; }
    const p = Store.getProfile(pid);
    const tag = Store.getTagForProfile(pid);
    if (!p || !tag) { location.hash = '#/create'; return; }
    const rider = activeRider(tag, p);
    const scans = Store.scansFor(tag.code);
    const payload = tagPayload(tag, p);
    const scanUrl = baseUrl() + '#/t/' + tag.code;
    app.innerHTML = `
      <h1>${esc(p.firstName)}'s LifeTag</h1>
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
          ${c.consent !== 'confirmed' ? `<a class="btn btn-small" target="_blank" rel="noopener" href="https://wa.me/${esc(c.phone.replace(/[^0-9]/g, ''))}?text=${encodeURIComponent('Assalam-o-Alaikum, I am adding your number as my LifeTag emergency contact. If I am in an accident, a bystander can reach you through my helmet sticker. Your number is never shown publicly. Please reply YES if you agree.')}">Ask on WhatsApp</a>
          <button class="btn btn-small" data-confirm="${i}">They agreed: mark confirmed</button>` : ''}`).join('')}
        <p class="hint">A contact only becomes active after they agree. That is their privacy right, and it also proves the number is real.</p>
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
        ${scans.length ? scans.slice(0, 20).map(s => `<div class="kv"><span>${esc(s.kind)}</span><b>${esc(fmtTime(s.at))}</b></div>`).join('') : '<p class="small">No scans yet.</p>'}
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
    app.querySelectorAll('[data-confirm]').forEach(btn => btn.addEventListener('click', () => {
      const contacts = p.contacts.slice();
      contacts[Number(btn.getAttribute('data-confirm'))].consent = 'confirmed';
      Store.updateProfile(pid, { contacts });
      dashboard();
    }));
    const rf = document.getElementById('riderForm');
    rf.addEventListener('submit', ev => {
      ev.preventDefault();
      const f = new FormData(rf);
      const name = String(f.get('rname') || '').trim();
      if (!name) { alert('Enter the rider name.'); return; }
      Store.updateTag(tag.code, { todayRider: { name, bloodGroup: f.get('rblood'), until: Date.now() + Number(f.get('rhours')) * 3600 * 1000 } });
      dashboard();
    });
    const cr = document.getElementById('clearRider');
    if (cr) cr.addEventListener('click', () => { Store.updateTag(tag.code, { todayRider: null }); dashboard(); });
    const rb = document.getElementById('revokeBtn');
    if (rb) rb.addEventListener('click', () => { Store.updateTag(tag.code, { status: 'revoked' }); dashboard(); });
    const ab = document.getElementById('activateBtn');
    if (ab) ab.addEventListener('click', () => { Store.updateTag(tag.code, { status: 'active' }); dashboard(); });
    document.getElementById('regenBtn').addEventListener('click', () => {
      if (confirm('The old sticker will stop working. Continue?')) { Store.regenerateTag(pid); dashboard(); }
    });
    document.getElementById('exportBtn').addEventListener('click', () => {
      const blob = new Blob([Store.exportAll(pid)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'lifetag-my-data.json'; a.click();
      URL.revokeObjectURL(a.href);
    });
    document.getElementById('logoutBtn').addEventListener('click', () => { Store.setSession(null); location.hash = '#/'; });
    document.getElementById('deleteBtn').addEventListener('click', () => {
      if (confirm('Delete your profile, tag and scan history from this device?')) { Store.deleteProfile(pid); location.hash = '#/'; }
    });
  }

  // ---------------- Print sticker ----------------
  function printView() {
    const pid = Store.getSession();
    if (!pid) { location.hash = '#/login'; return; }
    const p = Store.getProfile(pid);
    const tag = Store.getTagForProfile(pid);
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
        <div class="s-code">LIFETAG · ${esc(tag.code)}</div>
      </div>
      <button class="btn btn-primary no-print" onclick="window.print()">Print</button>
      <a class="btn no-print" href="#/dashboard">Back to dashboard</a>`;
  }

  // ---------------- Public scan flow ----------------
  function scanPage(code) {
    const tag = Store.getTag(code);
    if (!tag) {
      app.innerHTML = `<div class="scan-hero"><div class="cross">✚</div><h1>LifeTag</h1></div><div class="danger-note">${esc(t('tag_notfound'))}</div><a class="btn btn-emergency" href="tel:1122">${esc(t('call_ambulance'))}</a>`;
      return;
    }
    const p = Store.getProfile(tag.profileId);
    if (!p || tag.status !== 'active') {
      app.innerHTML = `<div class="scan-hero"><div class="cross">✚</div><h1>LifeTag</h1></div><div class="warn">${esc(t('tag_revoked'))}</div><a class="btn btn-emergency" href="tel:1122">${esc(t('call_ambulance'))}</a>`;
      return;
    }
    const recent = Store.scansFor(tag.code).filter(s => Date.now() - s.at < 3600 * 1000 && s.kind === 'view').length;
    const locked = recent >= 8;
    Store.logScan(tag.code, 'view');
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
      app.innerHTML = `<div class="scan-hero"><div class="cross">✚</div><h1>LifeTag</h1></div>
        <div class="card"><h2 style="margin-top:0">${esc(t('looking_title'))}</h2><p>${esc(t('looking_body'))}</p></div>
        <a class="btn" href="#/t/${esc(tag.code)}">Back</a>`;
    });
    document.getElementById('gateYes').addEventListener('click', () => {
      const phone = document.getElementById('scannerPhone').value.trim();
      emergencyView(tag, p, phone, locked);
    });
  }

  function emergencyView(tag, p, scannerPhone, locked) {
    const first = !tag.informedAt;
    if (first) Store.updateTag(tag.code, { informedAt: Date.now() });
    Store.logScan(tag.code, 'emergency', scannerPhone);
    const rider = activeRider(tag, p);
    const allergiesHtml = locked ? `<span class="small">Hidden after repeated non-emergency scans.</span>`
      : p.allergiesMode === 'none' ? esc(t('allergies_none'))
      : p.allergiesMode === 'list' && p.allergies.length ? esc(p.allergies.join(', '))
      : esc(t('not_provided'));
    const listOrUnknown = arr => locked ? '<span class="small">Hidden after repeated scans.</span>'
      : (arr && arr.length ? esc(arr.join(', ')) : esc(t('not_provided')));
    const contacts = locked ? '' : p.contacts.filter(c => c.consent === 'confirmed').map(c =>
      `<a class="btn btn-green" href="tel:${esc(c.phone.replace(/[^0-9+]/g, ''))}">📞 ${esc(t('call_family'))}: ${esc(c.name)} (${esc(c.relation || 'family')})</a>`).join('');
    const pendingNote = !locked && p.contacts.some(c => c.consent !== 'confirmed')
      ? `<p class="hint">Some contacts have not confirmed yet and are not shown.</p>` : '';
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
      ${contacts}
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
       'Numbers are never printed and never displayed as text. They sit behind an emergency gate, and a contact is only reachable after that contact personally agreed to be listed. Every emergency scan is logged and the family is told.'],
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
       'They might, at first. LifeTag does not replace them and says so everywhere. Its job is narrower: identify the person and reach the family in the first minutes, which is the gap that exists today.']
    ];
    app.innerHTML = `
      <h1>How LifeTag works, honestly</h1>
      <p class="lede">Before building LifeTag we attacked our own idea and wrote down 40 ways it could fail or be misused. Here are the worst ones, and what the design does about each. What cannot be fixed is stated, not hidden.</p>
      ${risks.map(r => `<details class="risk"><summary>${esc(r[0])}</summary><p>${esc(r[1])}</p></details>`).join('')}
      <div class="warn"><b>Honest limitations of this prototype:</b> profiles are stored on the owner's device in this build, so a scan resolves only where the tag data is available; the production design moves tag records to a small server with the same privacy rules. Alerts in this build appear in the owner's dashboard and through the call buttons; SMS alerts need a paid gateway and are a roadmap item, not a claim. LifeTag is a prototype and is not a replacement for emergency services.</div>
      <a class="btn btn-primary" href="#/create">${esc(t('cta_create'))}</a>
      <a class="btn" href="#/">Back to home</a>`;
  }

  // ---------------- Router ----------------
  function route() {
    const hash = location.hash || '#/';
    document.documentElement.lang = window.I18N.lang === 'ur' ? 'ur' : 'en';
    if (hash.startsWith('#/t/')) scanPage(hash.slice(4));
    else if (hash === '#/create') profileForm(null);
    else if (hash === '#/edit') {
      const pid = Store.getSession();
      if (!pid) { location.hash = '#/login'; return; }
      profileForm(Store.getProfile(pid));
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
  route();
})();
