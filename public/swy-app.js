/* Still With You web app. Runs fully in the browser; entries are kept on this device (localStorage). */
const $ = (s) => document.querySelector(s);
const app = $('#app');
const device = $('#device');
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

let profile = { name: '', people: [], focus: -1 };
try {
  const saved = JSON.parse(localStorage.getItem('swy-profile') || 'null');
  if (saved && saved.name) {
    if (!saved.people) saved.people = saved.loved ? [{ name: saved.loved, relation: saved.relation, passed: saved.passed }] : [];
    profile = { name: saved.name, people: saved.people, focus: saved.focus ?? -1 };
  }
} catch (e) {}
const joinNames = (n) => n.length < 2 ? (n[0] || '') : n.length === 2 ? `${n[0]} and ${n[1]}` : `${n.slice(0, -1).join(', ')}, and ${n[n.length - 1]}`;
/* The loved one(s) the app is speaking about right now: one person if the user chose a focus, otherwise everyone. */
const L = () => { const f = profile.people[profile.focus]; return f ? f.name : joinNames(profile.people.map(p => p.name)); };
let draft = null;
let _tab = '';

const loadJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch (e) { return d; } };
const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} queueSync(); };
let settings = loadJSON('swy-settings', { pin: '', backup: false, quiet: true, quietFrom: '21:00', quietTo: '08:00', dateReminders: false });
const saveSettings = () => saveJSON('swy-settings', settings);

/* How their loved one died, offered optionally during setup. Each note shapes the gentler wording shown for that person. */
const CAUSES = {
  'A long illness': 'After a long illness, grief can be mixed with exhaustion, and sometimes with relief that their suffering is over. Relief is not a betrayal. Often it is love that watched them hurt.',
  'A sudden illness or event': 'When a death comes without warning, there is no chance to prepare or say goodbye. Shock can last longer than people expect. Be patient with yourself.',
  'An accident': 'An accident can leave so many “what ifs.” Those questions are a normal part of loss, even when they have no answers. You are allowed to carry them gently, or set them down for a while.',
  'Suicide': 'Losing someone to suicide can bring questions that may never be fully answered, and guilt that is not yours to carry. Their death was not your fault. Many people find it helps to talk with others who have lost someone to suicide.',
  'Overdose or addiction': 'Grief after an overdose can hold anger, sorrow, and sometimes years of worry that came before. Your loved one was so much more than how they died, and your grief deserves the same care as any other.',
  'Miscarriage, stillbirth, or infant loss': 'Your baby was real, and so is your grief, however short their life. You do not need anyone’s permission to mourn them or to speak their name.',
  'Violence': 'Losing someone to violence can bring fear, anger, and a long road through processes that are not about your healing. All of what you feel, anger included, is welcome here.',
};
const save = () => { try { localStorage.setItem('swy-profile', JSON.stringify(profile)); } catch (e) {} queueSync(); };

/* ---------- Account sync: only active when accounts are configured (see app/app/account-bridge.tsx) ---------- */
const acct = () => (window.swyAccount && window.swyAccount.enabled ? window.swyAccount : null);
const signedIn = () => !!(acct() && acct().email());
// The app lock code never leaves this device.
const snapshot = () => ({ v: 1, profile, settings: { ...settings, pin: '' }, tasks: loadJSON('swy-tasks', {}) });
let pushTimer = null;
function queueSync() {
  if (!signedIn()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => acct().push(snapshot()), 800);
}
function adopt(remote) {
  if (remote.profile) { profile = remote.profile; try { localStorage.setItem('swy-profile', JSON.stringify(profile)); } catch (e) {} }
  if (remote.settings) { settings = { ...settings, ...remote.settings, pin: settings.pin }; try { localStorage.setItem('swy-settings', JSON.stringify(settings)); } catch (e) {} }
  if (remote.tasks) { try { localStorage.setItem('swy-tasks', JSON.stringify(remote.tasks)); } catch (e) {} }
}
/* After signing in: the account's saved copy wins if it has anyone in it; otherwise this device's entries move into the account. */
async function syncAfterSignIn() {
  const remote = await acct().pull();
  if (remote && remote.profile && remote.profile.people && remote.profile.people.length) adopt(remote);
  else if (profile.people.length) await acct().push(snapshot());
}

const MARK = `<svg class="mark" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="27" fill="none" stroke="var(--gold)" stroke-width="1.2"/><path d="M28 40c-7-5-12-9.5-12-15a6 6 0 0 1 12-1.5A6 6 0 0 1 40 25c0 5.5-5 10-12 15z" fill="none" stroke="var(--blue)" stroke-width="1.6" stroke-linejoin="round"/><path d="M28 12v6M25 15h6" stroke="var(--gold)" stroke-width="1.4" stroke-linecap="round"/></svg>`;

const VERSES = [
  ['The LORD is nigh unto them that are of a broken heart.', 'Psalm 34:18 (KJV)'],
  ['Blessed are they that mourn: for they shall be comforted.', 'Matthew 5:4 (KJV)'],
  ['He healeth the broken in heart, and bindeth up their wounds.', 'Psalm 147:3 (KJV)'],
  ['Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee.', 'Isaiah 41:10 (KJV)'],
  ['Come unto me, all ye that labour and are heavy laden, and I will give you rest.', 'Matthew 11:28 (KJV)'],
];
const ENCOURAGE = [
  'There is no right way to carry this. Whatever today holds, you can take it one moment at a time.',
  'Missing someone is a sign of how much they mattered. Your love has not gone anywhere.',
  'You do not need to have the words today. Being here is enough.',
  'Some days are heavier than others. That is not a step backward.',
  'Rest is allowed. So is laughter, and so are tears, sometimes in the same hour.',
];
const day = Math.floor(Date.now() / 864e5);
const pick = (arr, off = 0) => arr[(day + off) % arr.length];

const prayerFor = (loved) => `Lord, You know the ache I carry today. Thank You for the gift of ${loved}, and for every moment we shared. Hold me close when the missing feels too heavy, and give me enough strength for this day. Amen.`;

const FEELINGS = {
  'Peaceful': 'Moments of peace are a gift, and you are allowed to rest in them. Feeling peaceful does not mean you love them any less.',
  'Sad': 'Sadness is love that has nowhere to go right now. You do not have to hide it or hurry through it today.',
  'Lonely': 'Loneliness can become especially noticeable after losing someone who was part of your everyday life. You don’t have to pretend today is easy.',
  'Angry': 'Anger is a common part of grief, even anger at God. He is big enough to hear all of it. You can bring Him exactly what you feel.',
  'Confused': 'Grief can make the world feel unfamiliar and hard to think through. It is okay not to have things figured out.',
  'Numb': 'Sometimes the heart goes quiet to protect itself. Feeling numb is not a failure. Feelings often return in their own time.',
  'Anxious': 'Loss can shake the ground under everything. Let’s slow down together for a moment. You only need to get through this next breath.',
  'Grateful': 'Gratitude and grief often sit side by side. Thank you for noticing something good today.',
  'Overwhelmed': 'When everything feels like too much, it helps to make the world smaller. Just one small thing at a time.',
  'Hopeful': 'Hope can be quiet and still be real. Hold onto it gently. It is welcome here, and so are harder days if they come.',
  'I don’t know': 'That is an honest answer. Grief can be hard to name. You don’t need a word for it to be cared for.',
};

const ICONS = {
  pray: '<path d="M12 21V11M8 21l4-10 4 10M9 6a3 3 0 0 1 6 0c0 2-3 4-3 4s-3-2-3-4z"/>',
  talk: '<path d="M4 5h16v11H9l-5 4z"/>',
  journal: '<path d="M6 3h11a1 1 0 0 1 1 1v16H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 8h6M8 12h6"/>',
  remember: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  support: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a4.5 4.5 0 0 1 7 0"/>',
  wave: '<path d="M2 15c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3M2 9c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3"/>',
  sun: '<circle cx="12" cy="13" r="4"/><path d="M12 4v2M4.5 13h-2M21.5 13h-2M6.3 7.3l1.4 1.4M17.7 7.3l-1.4 1.4M3 19h18"/>',
  breathe: '<path d="M4 9h10a3 3 0 1 0-3-3M4 13h14a3 3 0 1 1-3 3M4 17h6"/>',
  play: '<path d="M9 7.5v9l7.5-4.5z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M9 7v10M15 7v10" stroke-width="2.4"/>',
  heart: '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14s1.3 2 3.5 2 3.5-2 3.5-2"/>',
};
const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;

const DISCLAIMER = `<p class="note">Still With You is a companion for reflection and faith. It does not replace counseling, pastoral care, medical care, or crisis services. If you are in danger or thinking about ending your life, call or text <strong>988</strong> (US) or your local emergency number.</p>`;

const HILLS = `<svg class="hills" viewBox="0 0 400 110" preserveAspectRatio="none" aria-hidden="true"><path d="M0 62 C70 30 130 44 190 58 S320 34 400 50 V110 H0Z" fill="var(--hill-1)" opacity=".75"/><path d="M0 84 C90 60 170 78 250 72 S350 64 400 76 V110 H0Z" fill="var(--hill-2)" opacity=".85"/></svg>`;
$('#bgsky').insertAdjacentHTML('beforeend', HILLS);
const hr = new Date().getHours();
device.classList.add(hr < 11 ? 't-morning' : hr < 17 ? 't-day' : 't-evening');
$('#clock').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/i, '');

const TABS = [['today', 'Today', 'home()'], ['pray', 'Pray', 'prayer()'], ['journal', 'Journal', 'journal()'], ['remember', 'Remember', "later('Remember ' + L(), 'Your private Memory Vault for photos, stories, recipes, songs, favorite sayings, and letters to ' + L() + '.')"], ['support', 'Support', 'support()']];
const tabs = $('#tabs');

/* calm: hard-day night mode. opt.tab marks the active tab; opt.hero for the home sky header; opt.rising for the welcome sunrise. */
function render(html, calm = false, opt = {}) {
  const tab = opt.tab ?? _tab; _tab = '';
  const sky = /class="progress"|class="welcome"/.test(html) || !!draft;
  device.classList.toggle('night', calm === true);
  device.classList.toggle('sky-mode', sky);
  device.classList.toggle('plain', !sky && !calm && !opt.hero);
  device.classList.toggle('rising', !!opt.rising);
  tabs.hidden = sky || calm === true;
  tabs.innerHTML = TABS.map(([k, label, fn]) => `<button onclick="${fn.replace(/"/g, '&quot;')}" ${tab === k ? 'aria-current="page"' : ''}>${icon(k === 'today' ? 'sun' : k)}${label}</button>`).join('');
  app.innerHTML = `${calm === true ? '<div class="stars"></div>' : ''}<section class="screen ${opt.cls || ''}">${html}</section>`;
  app.scrollTop = 0;
  const f = app.querySelector('[autofocus]'); if (f) f.focus({ preventScroll: true });
}

/* ---------- Welcome & onboarding ---------- */
function welcome() {
  render(`<div class="welcome">
      <p class="eyebrow" style="color:var(--sky-ink-2)">A companion for grief and faith</p>
      <h1>Still <em>With</em> You</h1>
      <p class="lead">You don\u2019t have to grieve alone.</p>
      <p class="muted" style="max-width:30ch">Prayer, remembrance, and gentle support, at whatever pace you need.</p>
      <div class="actions">
        <button class="btn" onclick="stepName()">Begin</button>
        <button class="btn ghost" onclick="useSample()">Look around with an example first</button>
        ${profile.name && profile.people.length ? `<button class="btn link" onclick="home()">Continue as ${esc(profile.name)}</button>` : ''}
        ${acct() && !signedIn() ? `<button class="btn link" onclick="accountScreen('signin')">I already have an account</button>` : ''}
      </div>
    </div>`, false, { rising: true });
}
function useSample() { profile = { name: 'Sarah', focus: -1, people: [{ name: 'Michael', relation: 'Spouse', passed: '', cause: 'A sudden illness or event' }, { name: 'Ruth', relation: 'Parent', passed: '', cause: 'A long illness' }] }; home(); }
const prog = (n) => `<div class="progress" aria-label="Step ${n} of 5">${[1,2,3,4,5].map(i => `<span class="${i <= n ? 'on' : ''}"></span>`).join('')}</div>`;

function stepName() {
  render(`${prog(1)}<button class="back" onclick="welcome()">Back</button>
    <h2>What would you like us to call you?</h2>
    <div class="field"><label for="in-name">Your name</label><input id="in-name" autocomplete="given-name" value="${esc(profile.name)}" autofocus></div>
    <button class="btn" id="next">Continue</button>`);
  const inp = $('#in-name'), nx = $('#next');
  const ok = () => nx.disabled = !inp.value.trim(); ok();
  inp.oninput = ok;
  inp.onkeydown = (e) => { if (e.key === 'Enter' && inp.value.trim()) nx.click(); };
  nx.onclick = () => { profile.name = inp.value.trim(); profile.people = []; profile.focus = -1; draft = null; stepWho(); };
}
/* fromHome: adding someone later from the home screen rather than during first-time setup */
function stepWho(fromHome = false) {
  if (!draft) draft = { name: '', relation: '', passed: '', fromHome };
  const first = profile.people.length === 0;
  const opts = ['Spouse','Child','Baby (pregnancy or infant loss)','Parent','Grandparent','Sibling','Friend','Relative','Other'];
  render(`${fromHome ? '' : prog(2)}<button class="back" id="bk">Back</button>
    <h2>${first ? `Who are you grieving, ${esc(profile.name)}?` : 'Who else are you grieving?'}</h2>
    <p class="muted">${first ? 'Choose what fits best. If you are grieving more than one person, you can add each of them next.' : 'Choose what fits best.'}</p>
    <div class="chips">${opts.map(o => `<button class="chip" aria-pressed="${draft.relation === o}" data-o="${o}">${o}</button>`).join('')}</div>
    <button class="btn" id="next">Continue</button>`);
  $('#bk').onclick = () => { const h = draft.fromHome; draft = null; h ? home() : first ? stepName() : stepMore(); };
  const nx = $('#next'); nx.disabled = !draft.relation;
  app.querySelectorAll('.chip').forEach(c => c.onclick = () => {
    draft.relation = c.dataset.o;
    app.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x === c));
    nx.disabled = false;
  });
  nx.onclick = stepLoved;
}
function stepLoved() {
  render(`${draft.fromHome ? '' : prog(3)}<button class="back" onclick="stepWho()">Back</button>
    <h2>${isBaby(draft.relation) ? 'What is your baby’s name?' : 'What was their first name?'}</h2>
    <div class="field"><label for="in-loved">${isBaby(draft.relation) ? 'Your baby’s name' : `Your ${esc(draft.relation.toLowerCase())}’s first name`}</label><input id="in-loved" value="${esc(draft.name)}" autofocus></div>
    ${isBaby(draft.relation) ? '<p class="muted small">If your baby wasn’t named, you can write something like “my little one.”</p>' : ''}
    <button class="btn" id="next">Continue</button>`);
  const inp = $('#in-loved'), nx = $('#next');
  const ok = () => nx.disabled = !inp.value.trim(); ok();
  inp.oninput = ok;
  inp.onkeydown = (e) => { if (e.key === 'Enter' && inp.value.trim()) nx.click(); };
  nx.onclick = () => { draft.name = inp.value.trim(); stepDate(); };
}
function stepDate() {
  render(`${draft.fromHome ? '' : prog(4)}<button class="back" onclick="stepLoved()">Back</button>
    <h2>When did ${esc(draft.name)} pass away?</h2>
    <p class="muted">This helps us gently remember meaningful days with you. We will never send reminders unless you ask.</p>
    <div class="field"><label for="in-date">Date of passing</label><input id="in-date" type="date" value="${esc(draft.passed)}"></div>
    <button class="btn" id="next">Continue</button>
    <button class="btn link" id="skip">I’d rather not say right now</button>`);
  const add = (passed) => { draft.passed = passed; stepCause(); };
  $('#next').onclick = () => add($('#in-date').value); $('#skip').onclick = () => add('');
}
const isBaby = (r) => (r || '').startsWith('Baby');
function stepCause() {
  if (!draft.cause && isBaby(draft.relation)) draft.cause = 'Miscarriage, stillbirth, or infant loss';
  render(`${draft.fromHome ? '' : prog(4)}<button class="back" onclick="stepDate()">Back</button>
    <h2>If you’re comfortable sharing, how did ${esc(draft.name)} die?</h2>
    <p class="muted">This is optional. It helps us use words that fit what you’re going through. Only you can see it.</p>
    <div class="chips">${Object.keys(CAUSES).map(c => `<button class="chip" aria-pressed="${draft.cause === c}" data-c="${c}">${c}</button>`).join('')}</div>
    <button class="btn" id="next">Continue</button>
    <button class="btn link" id="skip">I’d rather not say</button>`);
  app.querySelectorAll('[data-c]').forEach(c => c.onclick = () => {
    draft.cause = draft.cause === c.dataset.c ? '' : c.dataset.c;
    app.querySelectorAll('[data-c]').forEach(x => x.setAttribute('aria-pressed', x.dataset.c === draft.cause));
  });
  const fin = (cause) => {
    const h = draft.fromHome;
    profile.people.push({ name: draft.name, relation: isBaby(draft.relation) ? 'Baby' : draft.relation, passed: draft.passed, cause });
    draft = null; if (h) profile.focus = -1; save(); h ? home() : stepMore();
  };
  $('#next').onclick = () => fin(draft.cause || ''); $('#skip').onclick = () => fin('');
}
function stepMore() {
  const many = profile.people.length > 1;
  render(`${prog(5)}
    <h2>${many ? 'You are carrying a lot.' : 'Is there anyone else you are grieving?'}</h2>
    <p class="muted">${many ? 'Grieving more than one person can feel like more than one heart can hold. Each of them has a place here.' : 'Some people are grieving more than one loss at once. You can add them now or anytime later.'}</p>
    <div class="options">${profile.people.map((p, i) => `<div class="person"><span><span class="name">${esc(p.name)}</span> <span class="muted small">· ${esc(p.relation)}</span></span><button class="tiny-btn" data-rm="${i}" aria-label="Remove ${esc(p.name)}">Remove</button></div>`).join('')}</div>
    <button class="btn ghost" onclick="stepWho()">Add someone else</button>
    <button class="btn" id="fin" ${profile.people.length ? '' : 'disabled'}>Continue</button>`);
  app.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { profile.people.splice(+b.dataset.rm, 1); save(); profile.people.length ? stepMore() : stepWho(); });
  $('#fin').onclick = () => { profile.focus = -1; save(); home(); };
}
function setFocus(i) { profile.focus = i; save(); home(); }

/* ---------- Home ---------- */
const FEEL_C = { 'Peaceful': '#9cc3b0', 'Sad': '#8ea9c6', 'Lonely': '#a9a3c7', 'Angry': '#d49a86', 'Confused': '#c9b48a', 'Numb': '#b5b9bf', 'Anxious': '#dcb98a', 'Grateful': '#e3c27c', 'Overwhelmed': '#9b90b3', 'Hopeful': '#f0cd8c', 'I don\u2019t know': '#c8c1b4' };
let speaking = false;
function listen(btn, text) {
  try {
    const synth = window.speechSynthesis;
    if (speaking) { synth.cancel(); speaking = false; btn.innerHTML = `${icon('play')}Listen`; return; }
    const u = new SpeechSynthesisUtterance(text); u.rate = .86; u.pitch = .95;
    u.onend = () => { speaking = false; btn.innerHTML = `${icon('play')}Listen`; };
    synth.speak(u); speaking = true; btn.innerHTML = `${icon('pause')}Pause`;
  } catch (e) { btn.textContent = 'Audio comes in the full app'; }
}
function home() {
  try { speechSynthesis.cancel(); } catch (e) {} speaking = false;
  const part = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const [verse, ref] = pick(VERSES);
  const pr = prayerFor(L());
  render(`
    <header class="hero">
      <div class="sky"><div class="sun"></div>${HILLS}</div>
      <p class="kicker">${date}</p>
      <h1>${part},<br>${esc(profile.name)}.</h1>
      <p class="sub">We\u2019re thinking about you as you continue remembering <span class="name">${esc(L())}</span>.</p>
      <button class="hard glass" onclick="hardDay()"><span class="dot" aria-hidden="true"></span><span><strong>I\u2019m having a hard day</strong><span class="sub2">A quieter space, one step at a time</span></span><span class="arrow" aria-hidden="true">\u203a</span></button>
    </header>

    <div class="body">
      ${profile.people.length > 1 ? `<div class="focus"><span class="eyebrow">Today I\u2019m thinking of</span>
        <div class="chips"><button class="chip" aria-pressed="${profile.focus < 0}" onclick="setFocus(-1)">All of them</button>${profile.people.map((p, i) => `<button class="chip" aria-pressed="${profile.focus === i}" onclick="setFocus(${i})">${esc(p.name)}</button>`).join('')}</div></div>` : ''}

      ${acct() && !signedIn() && !settings.acctDismissed ? `<div class="note-card"><span class="eyebrow">Keep everything safe</span>
        <p>Create a free account so ${esc(L())}’s place here, your check-ins, and your notes are kept safe and with you on any device.</p>
        <div class="row"><button class="play" style="padding-left:16px" onclick="accountScreen('signup')">Create a free account</button><button class="tiny-btn" onclick="settings.acctDismissed=true;saveSettings();home()">Not now</button></div></div>` : ''}

      <section class="sec">
        <div class="sec-head"><h3>How is your heart today?</h3></div>
        <div class="pebbles">${Object.keys(FEELINGS).map(f => `<button class="pebble" style="--c:${FEEL_C[f]}" onclick="feelingResponse('${f.replace(/'/g, "\\'")}')"><i></i>${f}</button>`).join('')}</div>
      </section>

      <section class="sec">
        <span class="eyebrow">Today\u2019s word</span>
        <div class="word"><blockquote>${verse}</blockquote><cite>${ref}</cite></div>
      </section>

      <div class="card prayer">
        <div class="sec-head"><span class="eyebrow">A prayer for today</span></div>
        <p class="text">${esc(pr)}</p>
        <div class="row">
          <button class="play" id="lis">${icon('play')}Listen</button>
          <button class="tiny-btn" onclick="prayer()">Pray another with me</button>
          <button class="tiny-btn" aria-pressed="false" onclick="const on=this.getAttribute('aria-pressed')!=='true'; this.setAttribute('aria-pressed', on); this.textContent = on ? 'Saved' : 'Save'">Save</button>
        </div>
      </div>

      <button class="wave" onclick="wave()">${icon('wave')}<span><strong>A wave of grief just hit me</strong><small>For sudden moments: a song, a smell, their handwriting</small></span></button>

      ${causeCards()}

      <p class="encourage">${pick(ENCOURAGE, 2)}</p>

      <section class="sec">
        <div class="sec-head"><h3>What would help?</h3></div>
        <div class="quick">
          <button onclick="prayer()"><span class="well">${icon('pray')}</span>Pray with me</button>
          <button onclick="later('Talk About My Grief', 'A gentle conversation space where you can say what\u2019s on your heart, like \u201cToday would have been our anniversary,\u201d and receive a caring response.')"><span class="well">${icon('talk')}</span>Talk about my grief</button>
          <button onclick="journal()"><span class="well">${icon('journal')}</span>Write in my journal</button>
          <button onclick="later('Remember ' + L(), 'Your private Memory Vault for photos, stories, recipes, songs, favorite sayings, and letters to ' + L() + '.')"><span class="well">${icon('remember')}</span>Remember ${esc(L())}</button>
          <button onclick="breathe()"><span class="well">${icon('breathe')}</span>Breathe with me</button>
          <button onclick="support()"><span class="well">${icon('support')}</span>I need support</button>
        </div>
      </section>

      <section class="sec">
        <div class="sec-head"><h3>More ways we can help</h3></div>
        <div class="options">
          <button onclick="practical()"><span class="t">Practical help after a death<span class="muted small">Paperwork, accounts, and belongings, at your pace</span></span></button>
          <button onclick="kidsGrief()"><span class="t">Helping children grieve<span class="muted small">For parents and caregivers who are grieving too</span></span></button>
          <button onclick="prayerRequest()"><span class="t">Ask my church to pray<span class="muted small">Only sent when you choose</span></span></button>
          <button onclick="settingsScreen()"><span class="t">Privacy, lock, and quiet hours<span class="muted small">${settings.pin ? 'App lock is on' : 'App lock is off'}${settings.quiet ? ` \u00b7 Quiet ${settings.quietFrom}\u2013${settings.quietTo}` : ''}</span></span></button>
        </div>
      </section>

      ${DISCLAIMER}
      <div class="row" style="justify-content:center"><button class="btn link small" onclick="draft=null;stepWho(true)">Add someone you\u2019re grieving</button><button class="btn link small" onclick="welcome()">Start over</button></div>
    </div>
  `, false, { hero: true, tab: 'today', cls: 'home' });
  $('#lis').onclick = function () { listen(this, pr); };
}

/* ---------- Check-in ---------- */
function checkIn() {
  render(`<button class="back" onclick="home()">Home</button>
    <h2>How is your heart today?</h2>
    <p class="muted">There are no wrong answers. Choose whatever feels closest.</p>
    <div class="feelings">${Object.keys(FEELINGS).map(f => `<button data-f="${f}" style="--c:${FEEL_C[f]}"><i></i>${f}</button>`).join('')}</div>`);
  app.querySelectorAll('.feelings button').forEach(b => b.onclick = () => feelingResponse(b.dataset.f));
}
function feelingResponse(f) {
  render(`<button class="back" onclick="checkIn()">Back</button>
    <span class="eyebrow" style="display:flex;align-items:center;gap:8px"><i style="width:10px;height:10px;border-radius:50%;background:${FEEL_C[f]};display:inline-block"></i>Feeling ${f.toLowerCase()}</span>
    <p class="response">${FEELINGS[f]}</p>
    <p class="muted">Would you like something to help right now?</p>
    <div class="options">
      <button onclick="prayer()">A prayer</button>
      <button onclick="scripture()">A Scripture</button>
      <button onclick="journal()">A journal prompt</button>
      <button onclick="breathe()">A breathing exercise</button>
      <button onclick="support()">Someone to contact</button>
    </div>
    <button class="btn link" onclick="home()">I’m okay for now</button>`);
}

/* ---------- Hard day mode ---------- */
function hardDay() {
  render(`<button class="back" onclick="home()">Leave quiet mode</button>
    <div class="moon" aria-hidden="true"></div>
    <h2>We’re here with you.</h2>
    <p class="response" style="font-size:1.3rem;color:var(--ink-2)">What would help most right now?</p>
    <div class="options">
      <button onclick="prayer(true)">Pray with me</button>
      <button onclick="scripture(true)">Give me a Scripture</button>
      <button onclick="breathe(true)">Help me breathe</button>
      <button onclick="later('Let me talk', 'You’ll be able to write whatever you feel, and receive a calm, caring response.', true)">Let me talk</button>
      <button onclick="later('Remember ' + L(), 'A single memory of ' + L() + ' from your Memory Vault, shown gently.', true)">Help me remember ${esc(L())}</button>
      <button onclick="support(true)">Call someone I trust</button>
      <button onclick="support(true)">Contact my pastor or counselor</button>
      <button onclick="crisis(true)">Find additional support</button>
    </div>`, true);
}

const backTo = (calm) => calm ? `<button class="back" onclick="hardDay()">Back</button>` : `<button class="back" onclick="home()">Home</button>`;

function breathe(calm = false) {
  render(`${backTo(calm)}
    <h2>Breathe with me</h2>
    <div class="breath"><div class="breath-circle"><span id="bt">Breathe in</span></div>
    <p class="muted" style="text-align:center;max-width:28ch">Follow the circle. Breathe in as it grows, and out slowly as it settles.</p></div>
    <p class="response" style="text-align:center;font-size:1.2rem">“Be still, and know that I am God.”<br><span class="small muted">Psalm 46:10 (KJV)</span></p>`, calm);
  let t = 0; const el = $('#bt');
  const tick = setInterval(() => { if (!document.body.contains(el)) return clearInterval(tick); t = (t + 1) % 10; el.textContent = t < 4 ? 'Breathe in' : t < 5 ? 'Hold' : 'Breathe out'; }, 1000);
}
function prayer(calm = false) { if (calm !== true) _tab = 'pray';
  const prayers = [
    ['When I miss them', `Lord, I miss ${L()} more than I can say. Meet me in the empty places today. Let me feel Your nearness where their absence feels loudest. Amen.`],
    ['When I need peace', 'God of peace, quiet my racing thoughts. I do not need all the answers today. Help me rest in You for the next few moments. Amen.'],
    ['When today is especially difficult', 'Father, today is hard. I don’t have the strength I need, so I am asking for Yours. Carry me through this hour, and then the next. Amen.'],
    ['When I feel like nobody understands', 'Jesus, You know sorrow, and You wept at the grave of a friend. Thank You for understanding what others cannot see in me. Amen.'],
  ];
  let i = Math.floor(Math.random() * prayers.length);
  const draw = () => {
    const [cat, text] = prayers[i];
    render(`${backTo(calm)}<span class="eyebrow">${cat}</span>
      <div class="card prayer"><p class="text">${esc(text)}</p></div>
      <button class="btn" id="again">Pray another prayer with me</button>
      <p class="muted small" style="text-align:center">In the full app, you can listen, save, and share prayers across twelve categories.</p>`, calm);
    $('#again').onclick = () => { i = (i + 1) % prayers.length; draw(); };
  };
  draw();
}
function scripture(calm = false) {
  let i = day % VERSES.length;
  const draw = () => {
    const [v, r] = VERSES[i];
    render(`${backTo(calm)}<span class="eyebrow">Scripture for this moment</span>
      <div class="card verse"><blockquote>“${v}”</blockquote><cite>${r}</cite></div>
      <button class="btn ghost" id="next">Another verse</button>`, calm);
    $('#next').onclick = () => { i = (i + 1) % VERSES.length; draw(); };
  };
  draw();
}
function journal() { _tab = 'journal';
  const prompts = ['What do you miss most today?', 'What is one memory that made you smile?', `What would you tell ${L()} if they were sitting beside you?`, 'What helped you make it through today?'];
  render(`<button class="back" onclick="home()">Home</button>
    <span class="eyebrow">Journal prompt</span>
    <h2>${esc(prompts[day % prompts.length])}</h2>
    <div class="field"><label for="jr" class="muted small" style="font-weight:600">Private to you. Nothing here is shared.</label>
    <textarea id="jr" rows="7" style="width:100%;font:inherit;padding:14px;border-radius:14px;border:1.5px solid var(--line);background:var(--card);color:var(--ink)" placeholder="Write as much or as little as you like…"></textarea></div>
    <button class="btn" id="sv">Save entry</button><p id="saved" class="muted small" hidden style="text-align:center">Saved in this sample only. The full app keeps a private journal with search and a calendar view.</p>`);
  $('#sv').onclick = () => { $('#saved').hidden = false; };
}
function support(calm = false) { if (calm !== true) _tab = 'support';
  render(`${backTo(calm)}
    <h2>Reach out to someone</h2>
    <p class="muted">Your support circle is private. Nothing is sent unless you choose to send it.</p>
    <div class="options">
      <button>Pastor James <span class="muted small">· Church</span></button>
      <button>Anna <span class="muted small">· Sister</span></button>
      <button>Dr. Lee <span class="muted small">· Grief counselor</span></button>
    </div>
    <p class="muted small">Example contacts for this sample.</p>
    <div class="sheet"><strong>A message you can send:</strong><br>“Today is a difficult grief day for me. I could use someone to talk to.”</div>
    <button class="btn ghost" onclick="crisis(${calm})">Find additional support</button>`, calm);
}
function crisis(calm = false) {
  render(`${backTo(calm)}
    <h2>More support is available</h2>
    <div class="card"><strong>If you are in danger or thinking about ending your life</strong><p>Call or text <strong>988</strong> (Suicide &amp; Crisis Lifeline, US), or call your local emergency number. You deserve immediate, real-world help.</p></div>
    ${profile.people.some(p => p.cause === 'Suicide') ? '<div class="card"><strong>For people who have lost someone to suicide</strong><p class="muted">Survivor of suicide loss groups bring together people who understand this specific grief. The American Foundation for Suicide Prevention lists groups by area at afsp.org.</p></div>' : ''}
    <div class="card"><strong>Ongoing grief support</strong><p class="muted">A licensed grief counselor, your pastor, or a local GriefShare group can walk with you over time.</p></div>
    <p class="note">Still With You does not replace counseling, pastoral care, medical care, or crisis services.</p>`, calm);
}
function later(title, desc, calm = false) { if (calm !== true && title.startsWith('Remember')) _tab = 'remember';
  render(`${backTo(calm)}<span class="eyebrow">Coming in the full app</span><h2>${esc(title)}</h2><p class="muted">${esc(desc)}</p>`, calm);
}

function causeCards() {
  const f = profile.people[profile.focus];
  const list = (f ? [f] : profile.people).filter(p => CAUSES[p.cause]);
  return list.map(p => `<div class="note-card"><span class="eyebrow">Remembering ${esc(p.name)}</span><p>${CAUSES[p.cause]}</p></div>`).join('');
}

function wave() {
  render(`<button class="back" onclick="home()">Home</button>
    <h2>Let it come. You’re safe here.</h2>
    <p class="muted">Grief often arrives in waves, set off by a song, a smell, or a familiar place. A wave is not a setback. It passes, even when it doesn’t feel like it will.</p>
    <div class="breath" style="padding-block:10px"><div class="breath-circle" style="width:140px;height:140px"><span id="bt">Breathe in</span></div></div>
    <div class="card prayer"><p class="text">Lord, this caught me by surprise. Hold me in this moment, and let me feel You near. Amen.</p></div>
    <div class="field"><label for="wv">What brought it on? <span class="muted small" style="font-weight:600">(optional)</span></label>
    <textarea id="wv" rows="3" class="ta" placeholder="Their song came on in the store…"></textarea></div>
    <button class="btn" id="sv">Save this as a memory</button>
    <p id="ok" class="muted small" hidden style="text-align:center">Saved to your Memory Vault (sample only).</p>
    <button class="btn link" onclick="hardDay()">I need more support right now</button>`);
  let t = 0; const el = $('#bt');
  const tick = setInterval(() => { if (!document.body.contains(el)) return clearInterval(tick); t = (t + 1) % 10; el.textContent = t < 4 ? 'Breathe in' : t < 5 ? 'Hold' : 'Breathe out'; }, 1000);
  $('#sv').onclick = () => { $('#ok').hidden = false; };
}

function practical() {
  const tasks = [
    ['Order copies of the death certificate', 'Many offices ask for an original. The funeral home can usually help.'],
    ['Notify Social Security and any employer', 'In the US, the funeral home often reports the death to Social Security for you.'],
    ['Contact banks, insurance, and pension providers', 'Ask what they need. You can do one call a day, or none today.'],
    ['Phone, email, and social media accounts', 'Some platforms offer memorial accounts. There is no rush to close anything.'],
    ['Belongings', 'There is no deadline for going through their things. Some people keep a room as it is for a long time, and that is okay.'],
    ['Ask someone to help', 'A friend or church member may be glad to make calls or sort mail with you.'],
  ];
  const done = loadJSON('swy-tasks', {});
  render(`<button class="back" onclick="home()">Home</button>
    <span class="eyebrow">Practical help</span>
    <h2>Things that may need doing</h2>
    <p class="muted">None of this has to happen today. Check things off only if it helps to see what’s done.</p>
    <div class="options">${tasks.map(([t, d], i) => `<label class="task"><input type="checkbox" id="task-${i}" ${done[i] ? 'checked' : ''}><span><strong>${t}</strong><br><span class="muted small">${d}</span></span></label>`).join('')}</div>
    <p class="note">This is general information, not legal or financial advice. Rules vary by place.</p>`);
  app.querySelectorAll('.task input').forEach((c, i) => c.onchange = () => { done[i] = c.checked; saveJSON('swy-tasks', done); });
}

function kidsGrief() {
  const ages = [
    ['Young children (under 6)', 'Use simple, honest words like “died” instead of “went to sleep” or “we lost them,” which can confuse or frighten. Expect the same questions many times. Keep routines steady and offer lots of closeness.'],
    ['School age (6–12)', 'Children this age may worry that they caused it or that someone else will die. Answer questions honestly, invite them to draw or tell stories about the person, and let teachers know what happened.'],
    ['Teenagers', 'Teens may grieve privately or through friends rather than with family. Stay available without pushing. Sharing your own feelings, in small doses, shows them grief is allowed.'],
  ];
  render(`<button class="back" onclick="home()">Home</button>
    <span class="eyebrow">Helping children grieve</span>
    <h2>Caring for them while you grieve too</h2>
    <p class="muted">Children often grieve in bursts, sad one moment and playing the next. That is normal. You don’t have to be strong all the time in front of them.</p>
    ${ages.map(([a, t]) => `<div class="card"><strong>${a}</strong><p>${t}</p></div>`).join('')}
    <div class="card verse"><blockquote>“Suffer little children, and forbid them not, to come unto me.”</blockquote><cite>Matthew 19:14 (KJV)</cite></div>
    <p class="note">If a child’s grief seems stuck, or is affecting school, sleep, or safety for a long time, a child grief counselor can help.</p>`);
}

function prayerRequest() {
  const people = ['Pastor James', 'Church prayer team', 'Small group'];
  let to = people[0];
  render(`<button class="back" onclick="home()">Home</button>
    <span class="eyebrow">Ask my church to pray</span>
    <h2>Share a prayer request</h2>
    <div><p class="muted small" style="margin-bottom:8px">Send to (example contacts)</p>
    <div class="chips">${people.map(p => `<button class="chip" data-p="${p}" aria-pressed="${p === to}">${p}</button>`).join('')}</div></div>
    <div class="field"><label for="pr">Your request</label>
    <textarea id="pr" rows="5" class="ta">Please pray for me as I grieve ${esc(L())}. Some days are very hard right now.</textarea></div>
    <label class="task" style="padding:12px 14px"><input type="checkbox" id="anon"><span>Don’t include my name</span></label>
    <button class="btn" id="go">Review request</button>
    <div id="confirm" hidden class="sheet"></div>`);
  app.querySelectorAll('[data-p]').forEach(c => c.onclick = () => { to = c.dataset.p; app.querySelectorAll('[data-p]').forEach(x => x.setAttribute('aria-pressed', x === c)); });
  $('#go').onclick = () => {
    const cf = $('#confirm'); cf.hidden = false;
    cf.innerHTML = `<p><strong>To:</strong> ${esc(to)}<br><strong>From:</strong> ${$('#anon').checked ? 'Anonymous' : esc(profile.name)}</p><p style="margin-top:8px">“${esc($('#pr').value)}”</p>
      <div class="row" style="margin-top:12px"><button class="tiny-btn" id="send">Send now</button><button class="tiny-btn" id="edit">Edit</button></div>`;
    $('#edit').onclick = () => { cf.hidden = true; };
    $('#send').onclick = () => { cf.innerHTML = '<p><strong>Sample only.</strong> Nothing was sent. In the full app, requests go only to the people you pick, and only when you tap Send.</p>'; };
  };
}

function settingsScreen() {
  render(`<button class="back" onclick="home()">Home</button>
    <span class="eyebrow">Privacy and settings</span>
    <h2>Your space, your rules</h2>
    ${acct() ? (signedIn() ? `<div class="card"><strong>Your account</strong>
      <p class="muted small">Signed in as ${esc(acct().email())}. Your entries are saved to your account and only you can see them.</p>
      <div class="row"><button class="tiny-btn" id="so">Sign out</button><button class="tiny-btn" id="del">Delete my saved data</button></div><p id="delmsg" class="muted small" hidden></p></div>`
      : `<div class="card"><strong>Your account</strong><p class="muted small">Right now your entries are saved only on this device. A free account keeps them safe if you lose your phone.</p>
      <div class="row"><button class="tiny-btn" onclick="accountScreen('signup')">Create account</button><button class="tiny-btn" onclick="accountScreen('signin')">Sign in</button></div></div>`) : ''}
    <div class="card"><strong>App lock</strong>
      <p class="muted small">Ask for a passcode when the app opens. The full app would use Face ID or your phone’s passcode.</p>
      ${settings.pin ? '<button class="tiny-btn" id="off">Turn off app lock</button>' : `<div class="field"><label for="pin" class="small">Choose a 4-digit code</label><input id="pin" inputmode="numeric" maxlength="4"></div><button class="tiny-btn" id="on">Turn on app lock</button>`}
    </div>
    <div class="card"><strong>Backup</strong>
      <label class="task"><input type="checkbox" id="bk" ${settings.backup ? 'checked' : ''}><span>Back up my journal, letters, and memories to my private cloud account</span></label>
      <p class="muted small">So you never lose what you’ve saved about the people you love. The full app also lets you export everything as a file.</p>
      <div class="row"><button class="tiny-btn" id="cp">Copy my saved data</button><span id="cpok" class="muted small" hidden>Copied.</span></div>
    </div>
    <div class="card"><strong>Quiet hours</strong>
      <label class="task"><input type="checkbox" id="qh" ${settings.quiet ? 'checked' : ''}><span>Don’t send any notifications during quiet hours</span></label>
      <div class="row"><div class="field"><label for="qf" class="small">From</label><input id="qf" type="time" value="${settings.quietFrom}"></div><div class="field"><label for="qt" class="small">To</label><input id="qt" type="time" value="${settings.quietTo}"></div></div>
    </div>
    <div class="card"><strong>Important date reminders</strong>
      <label class="task"><input type="checkbox" id="dr" ${settings.dateReminders ? 'checked' : ''}><span>Gently let me know before birthdays and anniversaries</span></label>
      <p class="muted small">Off unless you turn it on.</p>
    </div>`);
  const so = $('#so'), del = $('#del');
  if (so) so.onclick = async () => { await acct().signOut(); settingsScreen(); };
  if (del) del.onclick = () => {
    const m = $('#delmsg'); m.hidden = false;
    m.innerHTML = 'This permanently removes everything saved to your account. This device keeps its copy. <button class="tiny-btn" id="delyes">Yes, delete it</button>';
    $('#delyes').onclick = async () => { const r = await acct().deleteData(); m.textContent = r.error || 'Your saved data was deleted from your account.'; if (!r.error) await acct().signOut(); };
  };
  const on = $('#on'), off = $('#off');
  if (on) on.onclick = () => { const v = $('#pin').value; if (/^\d{4}$/.test(v)) { settings.pin = v; saveSettings(); settingsScreen(); } else $('#pin').focus(); };
  if (off) off.onclick = () => { settings.pin = ''; saveSettings(); settingsScreen(); };
  const bind = (id, key, prop = 'checked') => { $(id).onchange = (e) => { settings[key] = e.target[prop]; saveSettings(); }; };
  bind('#bk', 'backup'); bind('#qh', 'quiet'); bind('#qf', 'quietFrom', 'value'); bind('#qt', 'quietTo', 'value'); bind('#dr', 'dateReminders');
  $('#cp').onclick = async () => {
    const data = JSON.stringify({ profile, settings: { ...settings, pin: undefined } }, null, 2);
    try { await navigator.clipboard.writeText(data); $('#cpok').hidden = false; } catch (e) { $('#cpok').textContent = 'Copy isn’t available here.'; $('#cpok').hidden = false; }
  };
}

function lockScreen() {
  render(`<div class="welcome" style="justify-content:center">
    <h2>Welcome back</h2><p class="muted">Enter your code to open Still With You.</p>
    <div class="field" style="width:12rem"><label for="unlock" class="small">Passcode</label><input id="unlock" inputmode="numeric" maxlength="4" autofocus style="text-align:center;letter-spacing:.5em"></div>
    <p id="bad" class="muted small" hidden>That code didn’t match. Try again.</p>
    <button class="btn link small" id="forgot">Forgot your code? (In this sample, this turns the lock off.)</button></div>`);
  $('#unlock').oninput = (e) => { if (e.target.value.length === 4) { if (e.target.value === settings.pin) home(); else { $('#bad').hidden = false; e.target.value = ''; } } };
  $('#forgot').onclick = () => { settings.pin = ''; saveSettings(); home(); };
}

function accountScreen(mode = 'signup') {
  const up = mode === 'signup';
  const back = profile.people.length ? 'home()' : 'welcome()';
  render(`<button class="back" onclick="${back}">Back</button>
    <span class="eyebrow">${up ? 'Create your free account' : 'Welcome back'}</span>
    <h2>${up ? 'Keep everything safe, on any device' : 'Sign in to Still With You'}</h2>
    <p class="muted">${up ? 'Your entries stay private. Only you can see them.' : 'Everything you saved will be here.'}</p>
    <form id="af" class="sec" novalidate>
      <div class="field"><label for="ae">Email</label><input id="ae" type="email" autocomplete="email" required autofocus></div>
      <div class="field"><label for="ap">Password</label><input id="ap" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" minlength="8" required>${up ? '<p class="muted small" style="margin-top:6px">At least 8 characters.</p>' : ''}</div>
      <p id="amsg" class="muted" role="status" hidden></p>
      <button class="btn" id="ago">${up ? 'Create account' : 'Sign in'}</button>
    </form>
    ${up ? `<button class="btn link" onclick="accountScreen('signin')">I already have an account</button>`
         : `<button class="btn link" onclick="accountScreen('signup')">Create a new account</button><button class="btn link small" id="forgot">Forgot your password?</button>`}`);
  const msg = (t) => { const m = $('#amsg'); m.hidden = false; m.textContent = t; };
  $('#af').onsubmit = async (e) => {
    e.preventDefault();
    const email = $('#ae').value.trim(), pw = $('#ap').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return msg('Please enter a valid email address.');
    if (pw.length < 8) return msg('Please use a password with at least 8 characters.');
    const go = $('#ago'); go.disabled = true; go.textContent = up ? 'Creating your account…' : 'Signing in…';
    const r = up ? await acct().signUp(email, pw) : await acct().signIn(email, pw);
    go.disabled = false; go.textContent = up ? 'Create account' : 'Sign in';
    if (r.error) return msg(r.error);
    if (r.needsConfirm) return msg(`Almost done. We sent a link to ${email}. Open it on this device to confirm your account, and everything here will be saved to it.`);
    await syncAfterSignIn();
    profile.people.length ? home() : stepName();
  };
  const f = $('#forgot');
  if (f) f.onclick = async () => {
    const email = $('#ae').value.trim();
    if (!email) return msg('Enter your email above, then tap “Forgot your password?” again.');
    const r = await acct().resetPassword(email);
    msg(r.error || `If there’s an account for ${email}, we sent a link to reset your password.`);
  };
}

/* Wait briefly for the account bridge so a signed-in person sees their saved entries on a new device. */
let booted = false;
async function boot() {
  if (booted) return; booted = true;
  if (signedIn()) { try { await syncAfterSignIn(); } catch (e) {} }
  if (settings.pin && profile.people.length) lockScreen(); else welcome();
}
if (window.swyAccount) boot(); else { window.addEventListener('swy-account-ready', boot, { once: true }); setTimeout(boot, 1500); }
