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
let speaking = false;
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
/* Plus plan. Checked with the server when signed in; cached so the app opens instantly. Free if billing isn't set up. */
let plan = loadJSON('swy-plan', { available: false, plan: 'free' });
const isPlus = () => plan.plan === 'plus';
const plansOn = () => !!(acct() && plan.available);
async function refreshPlan() {
  if (!acct()) return;
  const p = await acct().plan();
  if (p.error) return;
  plan = signedIn() ? p : { available: p.available, plan: 'free' };
  try { localStorage.setItem('swy-plan', JSON.stringify(plan)); } catch (e) {}
}
const plusOpen = () => !plansOn() || isPlus();
const plusOnly = (open, feature) => plusOpen() ? open() : plansScreen(feature);

const snapshot = () => ({ v: 1, profile, settings: { ...settings, pin: '' }, tasks: loadJSON('swy-tasks', {}), vault: loadJSON('swy-vault', []) });
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
  if (remote.vault) { try { localStorage.setItem('swy-vault', JSON.stringify(remote.vault)); } catch (e) {} }
}
/* After signing in: the account's saved copy wins if it has anyone in it; otherwise this device's entries move into the account. */
async function syncAfterSignIn() {
  const remote = await acct().pull();
  if (remote && remote.profile && remote.profile.people && remote.profile.people.length) {
    // Memories saved on this device before signing in join the account's copy rather than being lost.
    const local = loadJSON('swy-vault', []), ids = new Set((remote.vault || []).map(m => m.id));
    const extra = local.filter(m => !ids.has(m.id));
    adopt(remote);
    if (extra.length) saveJSON('swy-vault', [...extra, ...loadJSON('swy-vault', [])]);
  } else if (profile.people.length) await acct().push(snapshot());
  backupMedia();
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
  moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
  calm: '<path d="M12 21c-4.5-2-7-5.5-7-9.5C5 7 8 4 12 3c4 1 7 4 7 8.5 0 4-2.5 7.5-7 9.5zM12 8v9"/>',
  step: '<path d="M7 19c-1.7 0-3-1.6-3-3.5S5.3 11 7 11s3 2.6 3 4.5S8.7 19 7 19zM17 13c-1.7 0-3-1.6-3-3.5S15.3 5 17 5s3 2.6 3 4.5S18.7 13 17 13z"/>',
  heart: '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14s1.3 2 3.5 2 3.5-2 3.5-2"/>',
};
const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;

const DISCLAIMER = `<p class="note">Still With You is a companion for reflection and faith. It does not replace counseling, pastoral care, medical care, or crisis services. If you are in danger or thinking about ending your life, call or text <strong>988</strong> (US) or your local emergency number.</p>`;

const HILLS = `<svg class="hills" viewBox="0 0 400 110" preserveAspectRatio="none" aria-hidden="true"><path d="M0 62 C70 30 130 44 190 58 S320 34 400 50 V110 H0Z" fill="var(--hill-1)" opacity=".75"/><path d="M0 84 C90 60 170 78 250 72 S350 64 400 76 V110 H0Z" fill="var(--hill-2)" opacity=".85"/></svg>`;
$('#bgsky').insertAdjacentHTML('beforeend', HILLS);
const hr = new Date().getHours();
device.classList.add(hr < 11 ? 't-morning' : hr < 17 ? 't-day' : 't-evening');
$('#clock').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/i, '');

const TABS = [['today', 'Today', 'home()'], ['pray', 'Pray', 'prayer()'], ['journal', 'Journal', 'journal()'], ['remember', 'Remember', 'vault()'], ['support', 'Support', 'support()']];
const tabs = $('#tabs');

/* calm: hard-day night mode. opt.tab marks the active tab; opt.hero for the home sky header; opt.rising for the welcome sunrise. */
function render(html, calm = false, opt = {}) {
  const tab = opt.tab ?? _tab; _tab = '';
  const sky = /class="progress"|class="welcome"/.test(html) || !!draft;
  device.classList.toggle('night', calm === true);
  device.classList.toggle('sky-mode', sky);
  device.classList.toggle('plain', !sky && !calm && !opt.hero);
  device.classList.toggle('rising', !!opt.rising);
  if (!opt.keepDim) device.classList.remove('dim');
  if (speaking) { try { speechSynthesis.cancel(); } catch (e) {} speaking = false; }
  tabs.hidden = sky || calm === true || !!opt.noTabs;
  tabs.innerHTML = TABS.map(([k, label, fn]) => `<button onclick="${fn.replace(/"/g, '&quot;')}" ${tab === k ? 'aria-current="page"' : ''}>${icon(k === 'today' ? 'sun' : k)}${label}</button>`).join('');
  app.innerHTML = `${calm === true ? '<div class="stars"></div>' : ''}<section class="screen ${opt.cls || ''}">${html}</section>`;
  app.scrollTop = 0;
  const f = app.querySelector('[autofocus]'); if (f) f.focus({ preventScroll: true });
  if (typeof stopRec === 'function') stopRec();
  hydrateMedia();
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
        ${acct() && !signedIn() ? `<button class="btn link" onclick="accountScreen('signin')">I already have an account · Sign in</button>` : ''}
        ${signedIn() ? `<button class="btn link small" onclick="settingsScreen()">Signed in as ${esc(acct().email())}</button>` : ''}
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
function listen(btn, text, rate = .86, label = 'Listen') {
  try {
    const synth = window.speechSynthesis;
    if (speaking) { synth.cancel(); speaking = false; btn.innerHTML = `${icon('play')}${label}`; return; }
    const u = new SpeechSynthesisUtterance(text); u.rate = rate; u.pitch = .95;
    u.onend = () => { speaking = false; btn.innerHTML = `${icon('play')}${label}`; };
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

      ${vaultCard()}

      <button class="wave" onclick="wave()">${icon('wave')}<span><strong>A wave of grief just hit me</strong><small>For sudden moments: a song, a smell, their handwriting</small></span></button>

      ${causeCards()}

      <section class="sec">
        <div class="sec-head"><h3>For the hard hours</h3></div>
        <div class="hours">
          <button onclick="sleepCorner()"><span class="well">${icon('moon')}</span><span><strong>Can\u2019t sleep</strong><small>Bedtime prayers and a quiet night screen</small></span></button>
          <button onclick="calmWorry()"><span class="well">${icon('calm')}</span><span><strong>Calm my worry</strong><small>Breathing, grounding, and Scripture</small></span></button>
          <button onclick="heavyDays()"><span class="well">${icon('step')}</span><span><strong>Heavy days</strong><small>One gentle step for today</small></span></button>
        </div>
      </section>

      ${memoryOfTheDay()}

      <p class="encourage">${pick(ENCOURAGE, 2)}</p>

      <section class="sec">
        <div class="sec-head"><h3>What would help?</h3></div>
        <div class="quick">
          <button onclick="prayer()"><span class="well">${icon('pray')}</span>Pray with me</button>
          <button onclick="companion()"><span class="well">${icon('talk')}</span>Talk about my grief</button>
          <button onclick="journal()"><span class="well">${icon('journal')}</span>Write in my journal</button>
          <button onclick='vault()'><span class="well">${icon('remember')}</span>Remember ${esc(L())}</button>
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
      ${f === 'Anxious' || f === 'Overwhelmed' ? '<button onclick="calmWorry()">Help calming my worry</button>' : ''}
      ${['Sad', 'Numb', 'Lonely', 'Overwhelmed'].includes(f) ? '<button onclick="heavyDays()">One gentle step for today</button>' : ''}
      ${hr >= 21 || hr < 5 ? '<button onclick="sleepCorner()">Help for a sleepless night</button>' : ''}
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
      <button onclick="sleepCorner(true)">I can\u2019t sleep</button>
      <button onclick="calmWorry(true)">Calm my worry</button>
      <button onclick="heavyDays(true)">One gentle step</button>
      <button onclick="plusOpen() ? companion(true) : letMeWrite()">Let me talk</button>
      <button onclick="rememberOne()">Help me remember ${esc(L())}</button>
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
    <p id="ok" class="muted small" hidden style="text-align:center">Saved to your Memory Vault.</p>
    <button class="btn link" onclick="hardDay()">I need more support right now</button>`);
  let t = 0; const el = $('#bt');
  const tick = setInterval(() => { if (!document.body.contains(el)) return clearInterval(tick); t = (t + 1) % 10; el.textContent = t < 4 ? 'Breathe in' : t < 5 ? 'Hold' : 'Breathe out'; }, 1000);
  $('#sv').onclick = () => {
    const t = $('#wv').value.trim();
    if (!t) return $('#wv').focus();
    addMemory({ kind: 'moment', who: profile.people[profile.focus] ? L() : '', title: 'A wave of grief', text: t });
    $('#sv').disabled = true; $('#ok').hidden = false;
  };
}

/* ---------- Can't sleep, Calm my worry, Heavy days ---------- */
/* All three are free. calm=true means they were opened from hard-day mode, so Back returns there. */
const backFrom = (calm, parent) => `<button class="back" onclick="${parent ? `${parent}(${calm})` : calm ? 'hardDay()' : 'home()'}">${parent || calm ? 'Back' : 'Home'}</button>`;

/* A breathing circle that follows timed phases: [label, seconds, size]. Counts down each phase; stops when the screen changes. */
function paced(phases, rounds, done) {
  const c = $('#pc'), t = $('#bt'), n = $('#bn'); let i = 0, r = 0;
  const step = () => {
    if (!document.body.contains(c)) return;
    const [label, secs, scale] = phases[i]; let left = secs;
    t.textContent = label; n.textContent = left;
    c.style.transitionDuration = secs + 's'; c.style.transform = `scale(${scale})`;
    const tick = setInterval(() => {
      if (!document.body.contains(c)) return clearInterval(tick);
      if (--left > 0) return n.textContent = left;
      clearInterval(tick); i = (i + 1) % phases.length;
      if (i === 0 && rounds && ++r >= rounds) return done && done();
      step();
    }, 1000);
  };
  step();
}
const breathCircle = (first) => `<div class="breath"><div class="breath-circle paced" id="pc"><span><span id="bt">${first}</span><b id="bn"></b></span></div></div>`;

/* Scripture shown one phrase at a time, so it is read slowly. */
const slowVerse = (v) => v.match(/[^,;:.]+[,;:.]?/g).map(p => p.trim()).map((p, i) => `<span style="animation-delay:${.4 + i * 1.6}s">${esc(p)} </span>`).join('');

const nightPrayers = () => [
  'Lord, the house is quiet and my mind is not. I give You the thoughts I cannot put down on my own. Watch over me tonight, and over the ones I love. Amen.',
  `Father, nights are when I miss ${L()} the most. You do not sleep, and You do not leave. Let me rest in that, even if sleep is slow to come. Amen.`,
  'Jesus, You know what it is to keep watch in the dark. Sit with me now. I do not need to sleep to be held by You. Amen.',
];
const NIGHT_VERSES = [
  ['I will both lay me down in peace, and sleep: for thou, LORD, only makest me dwell in safety.', 'Psalm 4:8 (KJV)'],
  ['When thou liest down, thou shalt not be afraid: yea, thou shalt lie down, and thy sleep shall be sweet.', 'Proverbs 3:24 (KJV)'],
  ['Behold, he that keepeth Israel shall neither slumber nor sleep.', 'Psalm 121:4 (KJV)'],
  ['Come unto me, all ye that labour and are heavy laden, and I will give you rest.', 'Matthew 11:28 (KJV)'],
];
function sleepCorner(calm = false) {
  const NIGHT_PRAYERS = nightPrayers();
  let p = Math.floor(Math.random() * NIGHT_PRAYERS.length), v = day % NIGHT_VERSES.length;
  render(`${backFrom(calm)}
    <div class="moon" aria-hidden="true"></div>
    <h2>Can’t sleep?</h2>
    <p class="muted">Nights can be the hardest part. You don’t have to fall asleep right now. You can simply rest here for a while.</p>
    <div class="card prayer"><span class="eyebrow">A prayer for tonight</span><p class="text" id="np">${esc(NIGHT_PRAYERS[p])}</p>
      <div class="row"><button class="play" id="lp">${icon('play')}Listen</button><button class="tiny-btn" id="ap">Another prayer</button></div></div>
    <div class="card verse slow"><span class="eyebrow">Scripture, slowly</span><blockquote id="nv"></blockquote><cite id="nr"></cite>
      <div class="row"><button class="play" id="lv">${icon('play')}Read it to me</button><button class="tiny-btn" id="av">Another verse</button></div></div>
    <div class="options">
      <button onclick="windDown(${calm})"><span class="t">Wind down with my breath<span class="muted small">Slow breathing with a longer breath out</span></span></button>
      <button onclick="calmWorry(${calm})"><span class="t">My mind won’t stop racing<span class="muted small">Gentle ways to settle worry</span></span></button>
    </div>
    <button class="btn ghost" id="dim">${device.classList.contains('dim') ? 'Brighten the screen' : 'Dim the screen'}</button>
    <p class="note">If sleepless nights keep coming for weeks, it’s worth mentioning to your doctor. Poor sleep is very common in grief, and there is help for it.</p>`, true, { keepDim: true });
  const verse = () => { const [t, r] = NIGHT_VERSES[v]; $('#nv').innerHTML = slowVerse(t); $('#nr').textContent = r; };
  verse();
  $('#lp').onclick = function () { listen(this, NIGHT_PRAYERS[p], .78); };
  $('#lv').onclick = function () { listen(this, NIGHT_VERSES[v][0], .7, 'Read it to me'); };
  $('#ap').onclick = () => { p = (p + 1) % NIGHT_PRAYERS.length; $('#np').textContent = NIGHT_PRAYERS[p]; };
  $('#av').onclick = () => { v = (v + 1) % NIGHT_VERSES.length; verse(); };
  $('#dim').onclick = function () { const on = device.classList.toggle('dim'); this.textContent = on ? 'Brighten the screen' : 'Dim the screen'; };
}
function windDown(calm = false) {
  render(`${backFrom(calm, 'sleepCorner')}
    <h2>Wind down</h2>
    <p class="muted">Breathe in for four, then out slowly for six. A longer breath out tells your body it is safe to rest.</p>
    ${breathCircle('Breathe in')}
    <p class="response" style="text-align:center;font-size:1.1rem" id="cue">Let your shoulders drop.</p>
    <button class="btn ghost" id="dim">${device.classList.contains('dim') ? 'Brighten the screen' : 'Dim the screen'}</button>`, true, { keepDim: true });
  const cues = ['Let your shoulders drop.', 'Unclench your jaw.', 'Let the bed hold your weight.', 'You don’t have to solve anything tonight.', 'God is keeping watch. You can rest.'];
  let k = 0; const el = $('#cue');
  const cueTick = setInterval(() => { if (!document.body.contains(el)) return clearInterval(cueTick); k = (k + 1) % cues.length; el.textContent = cues[k]; }, 20000);
  paced([['Breathe in', 4, 1], ['Breathe out', 6, .62]]);
  $('#dim').onclick = function () { const on = device.classList.toggle('dim'); this.textContent = on ? 'Brighten the screen' : 'Dim the screen'; };
}

const WORRY_VERSES = [
  ['Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.', 'Philippians 4:6–7 (KJV)'],
  ['Casting all your care upon him; for he careth for you.', '1 Peter 5:7 (KJV)'],
  ['Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.', 'John 14:27 (KJV)'],
  ['Thou wilt keep him in perfect peace, whose mind is stayed on thee.', 'Isaiah 26:3 (KJV)'],
  ['In the multitude of my thoughts within me thy comforts delight my soul.', 'Psalm 94:19 (KJV)'],
];
function calmWorry(calm = false) {
  let v = day % WORRY_VERSES.length;
  const night = calm === true || hr >= 21 || hr < 5;
  render(`${backFrom(calm)}
    <span class="eyebrow">Calm my worry</span>
    <h2>Let’s slow things down together.</h2>
    <p class="muted">Worry often rides along with grief. You don’t have to make it go away. Let’s just make this moment a little quieter.</p>
    <div class="options">
      <button onclick="breathe478(${calm})"><span class="t">4-7-8 breathing<span class="muted small">In for 4, hold for 7, out for 8</span></span></button>
      <button onclick="grounding(${calm})"><span class="t">5-4-3-2-1 grounding<span class="muted small">Notice what is around you, one sense at a time</span></span></button>
    </div>
    <div class="card verse"><span class="eyebrow">A word for a worried heart</span><blockquote id="wv"></blockquote><cite id="wr"></cite>
      <div class="row"><button class="tiny-btn" id="av">Another verse</button></div></div>
    <div class="card prayer"><p class="text">Lord, my thoughts are running ahead of me. I hand You what I cannot carry right now. Give me peace for this moment, and then the next. Amen.</p></div>`, night);
  const verse = () => { const [t, r] = WORRY_VERSES[v]; $('#wv').textContent = `“${t}”`; $('#wr').textContent = r; };
  verse();
  $('#av').onclick = () => { v = (v + 1) % WORRY_VERSES.length; verse(); };
}
function breathe478(calm = false) {
  const night = calm === true || hr >= 21 || hr < 5;
  render(`${backFrom(calm, 'calmWorry')}
    <h2>4-7-8 breathing</h2>
    <p class="muted">Breathe in through your nose for 4, hold for 7, and breathe out slowly through your mouth for 8. We’ll do four rounds together.</p>
    ${breathCircle('Breathe in')}
    <p class="muted small" id="after" style="text-align:center">If holding your breath feels uncomfortable, just breathe out slowly instead. There is no wrong way to do this.</p>`, night);
  paced([['Breathe in', 4, 1], ['Hold', 7, 1], ['Breathe out', 8, .62]], 4, () => {
    $('#bt').textContent = 'Well done'; $('#bn').textContent = '';
    $('#after').outerHTML = `<p class="response" style="text-align:center;font-size:1.15rem">Let your breathing return to its own pace.</p><button class="btn ghost" onclick="breathe478(${calm})">Do it again</button>`;
  });
}
function grounding(calm = false) {
  const night = calm === true || hr >= 21 || hr < 5;
  const steps = [
    ['5', 'things you can see', 'Look around slowly. A lamp, a window, the color of a wall. Name each one, out loud or in your head.'],
    ['4', 'things you can feel', 'Your feet on the floor, the chair under you, the air on your skin, your hands resting.'],
    ['3', 'things you can hear', 'A clock, a car outside, your own breath. Let each sound simply be there.'],
    ['2', 'things you can smell', 'Coffee, soap, fresh air. If nothing comes, think of two smells you love.'],
    ['1', 'thing you can taste', 'Or take a slow sip of water and notice it.'],
  ];
  let i = 0;
  const draw = () => {
    if (i >= steps.length) {
      render(`${backFrom(calm, 'calmWorry')}
        <h2>You’re here, right now.</h2>
        <p class="response">The worry may still be there, but you are standing on solid ground in this moment. You can come back to this any time.</p>
        <div class="card prayer"><p class="text">Thank You, Lord, that You are here in this room with me. Keep my heart and mind in Your peace. Amen.</p></div>
        <button class="btn ghost" onclick="grounding(${calm})">Go through it again</button>`, night);
      return;
    }
    const [n, what, help] = steps[i];
    render(`${backFrom(calm, 'calmWorry')}
      <span class="eyebrow">5-4-3-2-1 grounding · ${i + 1} of 5</span>
      <div class="ground-num" aria-hidden="true">${n}</div>
      <h2 style="text-align:center">Notice ${n} ${what}.</h2>
      <p class="muted" style="text-align:center">${help}</p>
      <button class="btn" id="nx">${i === steps.length - 1 ? 'Finish' : 'Next'}</button>`, night);
    $('#nx').onclick = () => { i++; draw(); };
  };
  draw();
}

const GENTLE_STEPS = [
  ['Drink a glass of water', 'Grief is tiring. Your body needs care too.'],
  ['Step outside for five minutes', 'Fresh air, a little daylight, a short walk if you can.'],
  ['Eat something small', 'Toast, fruit, soup. It doesn’t need to be a meal.'],
  ['Text one person', 'Even “thinking of you” or “hard day today” is enough.'],
  ['Open a window or a curtain', 'Let some light into the room.'],
  ['Take a shower or wash your face', 'Small acts of care count.'],
  ['Write one sentence', 'How you feel, or one thing about them.'],
  ['Rest without guilt', 'Lying down is allowed. So is doing nothing today.'],
];
const HEAVY_ANSWERS = {
  ok: 'Thank you for checking in with yourself. Heavy days may still come and go, and you can return here whenever they do.',
  some: 'Heavy days mixed with lighter ones are a very common part of grief. Be gentle with yourself on the heavy ones, and notice the lighter ones without guilt.',
  most: 'Thank you for being honest. Grief is heavy, and it is not something you have to fix. But when most days have felt this heavy for a couple of weeks or more, especially if sleeping, eating, or getting through the day has become very hard, it is worth talking with your doctor or a counselor. That is not a sign of weak faith. It is one more way of caring for yourself, and many people find it really helps.',
};
function heavyDays(calm = false) {
  const today = new Date().toDateString();
  const saved = loadJSON('swy-steps', {});
  const done = saved.day === today ? saved.done || [] : [];
  render(`${backFrom(calm)}
    <span class="eyebrow">Heavy days</span>
    <h2>One gentle step today</h2>
    <p class="muted">When everything feels heavy, big plans can wait. Choose one small thing, only if you feel able. Doing none of them is okay too.</p>
    <div class="options">${GENTLE_STEPS.map(([t, d], i) => `<label class="task"><input type="checkbox" data-i="${i}" ${done.includes(i) ? 'checked' : ''}><span><strong>${t}</strong><br><span class="muted small">${d}</span></span></label>`).join('')}</div>
    <p id="well" class="saved-note" style="text-align:center" ${done.length ? '' : 'hidden'}>That counts. Well done.</p>
    <div class="card"><span class="eyebrow">A gentle check-in</span>
      <p>Over the last two weeks, how have most days felt?</p>
      <div class="chips" id="hq">
        <button class="chip" data-a="ok">Mostly okay</button>
        <button class="chip" data-a="some">Some heavy, some lighter</button>
        <button class="chip" data-a="most">Most days have felt heavy</button>
      </div>
      <div id="ha"></div></div>
    <p class="note">This check-in is just for you. It isn’t a test or a diagnosis, and nothing is shared.</p>`, calm);
  app.querySelectorAll('.task input').forEach(c => c.onchange = () => {
    const now = [...app.querySelectorAll('.task input')].filter(x => x.checked).map(x => +x.dataset.i);
    saveJSON('swy-steps', { day: today, done: now }); $('#well').hidden = !now.length;
  });
  app.querySelectorAll('#hq .chip').forEach(b => b.onclick = () => {
    app.querySelectorAll('#hq .chip').forEach(x => x.setAttribute('aria-pressed', x === b));
    const a = b.dataset.a;
    $('#ha').innerHTML = `<p class="response" style="font-size:1.05rem;margin-top:14px">${HEAVY_ANSWERS[a]}</p>${a === 'most' ? `<div class="options" style="margin-top:12px">
      <button onclick="support(${calm})">Reach out to someone I trust</button>
      <button onclick="crisis(${calm})">Find a counselor or more support</button></div>` : ''}`;
  });
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
  render(`<button class="back" onclick="${profile.people.length ? 'home()' : 'welcome()'}">Back</button>
    <span class="eyebrow">Privacy and settings</span>
    <h2>Your space, your rules</h2>
    ${acct() ? (signedIn() ? `<div class="card"><strong>Your account</strong>
      <p class="muted small">Signed in as ${esc(acct().email())}. Your entries are saved to your account and only you can see them.</p>
      <div class="row"><button class="tiny-btn" onclick="newPasswordScreen()">Change my password</button><button class="tiny-btn" id="so">Sign out</button><button class="tiny-btn" id="del">Delete my saved data</button></div><p id="delmsg" class="muted small" hidden></p></div>`
      : `<div class="card"><strong>Your account</strong><p class="muted small">Right now your entries are saved only on this device. A free account keeps them safe if you lose your phone.</p>
      <div class="row"><button class="tiny-btn" onclick="accountScreen('signup')">Create account</button><button class="tiny-btn" onclick="accountScreen('signin')">Sign in</button></div></div>`) : ''}
    ${planCard()}
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
    </div>
    <p class="muted small"><a href="/privacy" target="_blank">Privacy Policy</a> · <a href="/terms" target="_blank">Terms of Service</a></p>`);
  const pman = $('#pman'), pchk = $('#pchk');
  if (pman) pman.onclick = async function () { this.disabled = true; const r = await acct().managePlan(); if (r.error) { this.disabled = false; const m = $('#pmsg'); m.hidden = false; m.textContent = r.error; } };
  if (pchk) pchk.onclick = async function () { this.textContent = 'Checking…'; await refreshPlan(); settingsScreen(); };
  const so = $('#so'), del = $('#del');
  if (so) so.onclick = async () => { await acct().signOut(); await refreshPlan(); settingsScreen(); };
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

/* ---------- Memory Vault ---------- */
/* Memories are kept in localStorage (synced to the account with everything else). Photos, videos and recordings
   are kept on this device in IndexedDB and, when signed in, backed up to a private storage folder only this person can open. */
const mediaDB = (() => {
  let db = null;
  const open = () => db ??= new Promise((res, rej) => {
    const r = indexedDB.open('swy-media', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('m');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const run = async (mode, fn) => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction('m', mode); const q = fn(t.objectStore('m')); t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error); }); };
  return {
    put: (id, blob) => run('readwrite', s => s.put(blob, id)),
    get: (id) => run('readonly', s => s.get(id)).catch(() => null),
    del: (id) => run('readwrite', s => s.delete(id)).catch(() => {}),
  };
})();
const vaultItems = () => loadJSON('swy-vault', []);
const saveVault = (v) => saveJSON('swy-vault', v);
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
function addMemory(m) { const item = { id: newId(), created: Date.now(), fav: false, media: null, ...m }; saveVault([item, ...vaultItems()]); return item; }
const MAX_VIDEO = 50 * 1024 * 1024;

const objectUrls = {}, signed = {};
async function mediaSrc(m) {
  if (objectUrls[m.id]) return objectUrls[m.id];
  const b = await mediaDB.get(m.id);
  if (b) return objectUrls[m.id] = URL.createObjectURL(b);
  if (signedIn() && m.uploaded) {
    const s = signed[m.id];
    if (s && Date.now() - s.t < 45 * 60e3) return s.u;
    const u = await acct().mediaUrl(m.id);
    if (u) { signed[m.id] = { u, t: Date.now() }; return u; }
  }
  return null;
}
/* Fills every [data-media] placeholder on the current screen. data-thumb shows a still preview instead of a player. */
function hydrateMedia() {
  const items = vaultItems();
  app.querySelectorAll('[data-media]').forEach(async (el) => {
    const m = items.find(x => x.id === el.dataset.media);
    if (!m || !m.media) return;
    const src = await mediaSrc(m);
    if (!src) { el.classList.add('missing'); el.innerHTML = `<span class="muted small">${signedIn() ? 'Still uploading from your other device' : 'Saved on another device. Sign in to see it here.'}</span>`; return; }
    const thumb = 'thumb' in el.dataset, t = m.media.type;
    el.innerHTML = t === 'image' ? `<img src="${src}" alt="${esc(m.title || 'A saved photo')}">`
      : t === 'video' ? (thumb ? `<video src="${src}#t=0.1" muted playsinline preload="metadata"></video><span class="play-badge">${icon('play')}</span>` : `<video src="${src}" controls playsinline preload="metadata"></video>`)
      : `<audio src="${src}" controls preload="metadata"></audio>`;
  });
}
let backingUp = false;
async function backupMedia() {
  if (!signedIn() || backingUp) return;
  backingUp = true;
  try {
    for (const m of vaultItems().filter(x => x.media && !x.uploaded)) {
      const b = await mediaDB.get(m.id);
      if (!b) continue;
      const r = await acct().uploadMedia(m.id, b);
      if (!r.error) saveVault(vaultItems().map(x => x.id === m.id ? { ...x, uploaded: true } : x));
    }
  } finally { backingUp = false; }
}
async function compressImage(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(b => r(b || file), 'image/jpeg', 0.86));
  } catch (e) { return file; }
}

const KINDS = {
  photo: { label: 'Photo', hint: 'A picture you never want to lose', media: 'image', title: 'What is this moment?', ph: 'Our trip to the lake' },
  story: { label: 'A story', hint: 'Something that happened, told your way', title: 'Give it a name', ph: 'The time we…' },
  funny: { label: 'Funny memory', hint: 'The things that still make you smile', title: 'Give it a name', ph: 'They laughed so hard when…' },
  saying: { label: 'Something they always said', hint: 'Their words, in their voice', title: '', ph: '“Don’t forget your coat.”' },
  voice: { label: 'Voice recording', hint: 'Record a memory, or save a voicemail', media: 'audio', title: 'What is this recording?', ph: '' },
  video: { label: 'Video', hint: 'A clip of them, or a day together', media: 'video', title: 'What is this moment?', ph: '' },
  letter: { label: 'A letter to them', hint: 'Write what you wish you could tell them', title: '', ph: '' },
  lesson: { label: 'A life lesson', hint: 'Something they taught you', title: '', ph: 'They taught me to…' },
  recipe: { label: 'A recipe', hint: 'The dish that tastes like home', title: 'Name of the dish', ph: 'Ingredients and steps, or just how it tasted' },
  song: { label: 'A song', hint: 'Music that brings them close', title: 'Song and artist', ph: 'What it reminds you of' },
  scripture: { label: 'Favorite Scripture', hint: 'A verse they loved, or one that holds you now', title: 'Reference, like Psalm 23', ph: 'The words of the verse' },
  date: { label: 'A special date', hint: 'Anniversaries, traditions, days that matter', title: 'What is this day?', ph: 'How you’d like to remember it', date: true },
  moment: { label: 'A wave of grief', hidden: true, title: '', ph: '' },
};
const FILTERS = [['all', 'All'], ['media', 'Photos and recordings'], ['words', 'Words'], ['letter', 'Letters'], ['fav', 'Favorites']];
const inFilter = (f, m) => f === 'all' || (f === 'fav' ? m.fav : f === 'media' ? !!m.media : f === 'letter' ? m.kind === 'letter' : !m.media && m.kind !== 'letter');
let vaultFilter = 'all';

const focusName = () => profile.people[profile.focus] ? profile.people[profile.focus].name : '';
const forFocus = (items) => { const w = focusName(); return items.filter(m => !w || !m.who || m.who === w); };
const fmtDay = (d) => new Date(d.length === 10 ? d + 'T12:00' : d).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

const MEM_PROMPTS = [
  (n) => `Today, remember something that always made ${n} laugh.`,
  (n) => `What is a place that will always feel like ${n}?`,
  (n) => `How did ${n} say your name?`,
  (n) => `What is something ${n} taught you without meaning to?`,
  (n) => `What would ${n} have ordered at their favorite restaurant?`,
  (n) => `Remember a time ${n} made you feel safe, proud, or loved.`,
  (n) => `What song will always make you think of ${n}?`,
];
const BABY_PROMPTS = [
  (n) => `What do you always want to remember about ${n}?`,
  (n) => `What did you dream for ${n}?`,
  (n) => `What is something you would want ${n} to know about you?`,
  (n) => `Where do you feel close to ${n}?`,
];
const memPrompt = (p) => { const list = p.relation === 'Baby' ? BABY_PROMPTS : MEM_PROMPTS; return pick(list.map(f => f(p.name)), 3); };
const promptPerson = () => profile.people[profile.focus] || profile.people[day % Math.max(1, profile.people.length)];

function memoryOfTheDay() {
  const p = promptPerson();
  if (!p) return '';
  const items = plusOpen() ? forFocus(vaultItems()) : [];
  if (items.length) {
    const m = items[day % items.length];
    return `<button class="card motd" onclick="memoryView('${m.id}')"><span class="eyebrow">Memory of the day</span>
      ${m.media && m.media.type !== 'audio' ? `<span class="mem-media" data-media="${m.id}" data-thumb></span>` : ''}
      ${m.title ? `<strong class="motd-title">${esc(m.title)}</strong>` : ''}${m.text ? `<span class="mem-text">${esc(m.text)}</span>` : ''}
      ${m.media && m.media.type === 'audio' ? `<span class="muted small">A voice recording, saved ${fmtDate(m.created)}</span>` : ''}</button>`;
  }
  return `<div class="note-card motd"><span class="eyebrow">Memory of the day</span><p class="motd-prompt">${esc(memPrompt(p))}</p>
    <div class="row"><button class="tiny-btn" onclick="vaultAdd()">Save it in my Memory Vault</button></div></div>`;
}

/* Home screen doorway into the vault, so it is easy to find. */
function vaultCard() {
  if (!profile.people.length) return '';
  const n = forFocus(vaultItems()).length;
  const sub = n ? `${n} ${n === 1 ? 'memory' : 'memories'} of ${esc(L())}, kept safe` : `Photos, stories, voices, and recipes of ${esc(L())}, kept safe in one place`;
  return `<button class="vault-card" onclick="vault()"><span class="well">${icon('remember')}</span>
    <span class="vc-t"><span class="eyebrow">Memory Vault${plusOpen() ? '' : ' <span class="vc-plus">Plus</span>'}</span><strong>${n ? 'Open my Memory Vault' : 'Start my Memory Vault'}</strong><small>${sub}</small></span>
    <span class="vc-go" aria-hidden="true">\u203a</span></button>`;
}

/* Everyone can always open what they saved. Adding new memories is part of Plus. */
function vault() { _tab = 'remember'; if (plusOpen() || vaultItems().length) vaultScreen(); else plansScreen('vault'); }
function vaultAdd(kind) { plusOnly(() => kind ? memoryForm(kind) : addPicker(), 'vault'); }
function vaultScreen() {
  const all = forFocus(vaultItems());
  const shown = all.filter(m => inFilter(vaultFilter, m));
  const p = promptPerson();
  render(`<button class="back" onclick="home()">Home</button>
    <div class="plus-head"><span class="eyebrow">Memory Vault</span><h2>Remembering <span class="name">${esc(L())}</span></h2>
    <p class="muted">Photos, stories, and the little things you never want to forget. Private to you.</p></div>
    ${plusOpen() ? `<button class="btn" onclick="addPicker()">Add a memory</button>`
      : `<div class="note-card"><p>Your memories are always yours to keep and look back on. Adding new ones is part of Still With You Plus.</p><div class="row"><button class="tiny-btn" onclick="plansScreen('vault')">See Plus</button></div></div>`}
    ${all.length ? `<div class="chips" role="group" aria-label="Show">${FILTERS.map(([k, l]) => `<button class="chip" aria-pressed="${vaultFilter === k}" onclick="vaultFilter='${k}';vaultScreen()">${l}</button>`).join('')}</div>` : ''}
    ${shown.length ? `<div class="vault-grid">${shown.map(memTile).join('')}</div>`
      : all.length ? `<p class="muted" style="text-align:center">Nothing here yet.</p>`
      : `<div class="card empty-vault"><span class="eyebrow">A place to begin</span><p class="motd-prompt">${esc(p ? memPrompt(p) : '')}</p>
         <div class="chips">${['story', 'photo', 'saying', 'letter'].map(k => `<button class="chip" onclick="vaultAdd('${k}')">${KINDS[k].label}</button>`).join('')}</div></div>`}
    <p class="note">${signedIn() ? 'Backed up privately to your account. Only you can see your memories.' : acct() ? 'Saved on this device only. A free account keeps your memories safe if you lose your phone.' : 'Saved on this device only.'}</p>`, false, { tab: 'remember' });
}
function memTile(m) {
  const k = KINDS[m.kind] || KINDS.story, visual = m.media && m.media.type !== 'audio';
  return `<button class="mem ${m.kind}" onclick="memoryView('${m.id}')">
    ${visual ? `<span class="mem-media" data-media="${m.id}" data-thumb></span>` : ''}
    <span class="eyebrow">${esc(k.label)}${m.fav ? ' <span aria-label="Favorite">♥</span>' : ''}</span>
    ${m.title ? `<strong>${esc(m.title)}</strong>` : ''}
    ${m.date ? `<span class="muted small">${fmtDay(m.date)}</span>` : ''}
    ${m.text ? `<span class="mem-text">${esc(m.text)}</span>` : ''}
    ${m.media && m.media.type === 'audio' ? `<span class="muted small">${icon('play')} Voice recording</span>` : ''}
  </button>`;
}
function addPicker() {
  render(`<button class="back" onclick="vaultScreen()">Memory Vault</button>
    <span class="eyebrow">Add a memory</span><h2>What would you like to keep?</h2>
    <div class="kinds">${Object.entries(KINDS).filter(([, k]) => !k.hidden).map(([key, k]) => `<button onclick="memoryForm('${key}')"><strong>${k.label}</strong><span class="muted small">${k.hint}</span></button>`).join('')}</div>`, false, { tab: 'remember' });
}

const LETTER_STARTS = ['I wish you were here.', 'Something happened today that I wanted to tell you.', 'I’m struggling today.', 'I remembered when we…'];
let recorder = null;
function memoryForm(kind, id = '') {
  const old = id ? vaultItems().find(m => m.id === id) : null;
  const k = KINDS[kind] || KINDS.story;
  const people = profile.people;
  let who = old ? old.who : (focusName() || (people.length === 1 ? people[0].name : ''));
  let pending = null;
  const letter = kind === 'letter';
  const dear = who || L();
  render(`<button class="back" id="bk">${old ? 'Back' : 'Add a memory'}</button>
    <span class="eyebrow">${esc(k.label)}</span>
    <h2>${letter ? `Dear ${esc(dear)},` : old ? 'Edit this memory' : `Remembering ${esc(who || L())}`}</h2>
    ${people.length > 1 ? `<div><p class="muted small" style="margin-bottom:8px">Who is this about?</p><div class="chips" id="who">${people.map(p => `<button class="chip" data-w="${esc(p.name)}" aria-pressed="${who === p.name}">${esc(p.name)}</button>`).join('')}<button class="chip" data-w="" aria-pressed="${!who}">More than one</button></div></div>` : ''}
    ${k.media === 'image' || k.media === 'video' ? `<label class="drop" id="drop">${old && old.media ? `<div class="mem-media" data-media="${old.id}"></div>` : `<span>${k.media === 'image' ? 'Choose a photo' : 'Choose a video'}</span><span class="muted small">${k.media === 'video' ? 'Up to 50 MB' : 'From your phone or computer'}</span>`}<input type="file" id="file" accept="${k.media}/*" hidden></label>` : ''}
    ${k.media === 'audio' ? `<div class="card rec"><div class="row"><button class="play" id="rec" type="button">${icon('play')}Start recording</button><span id="rt" class="muted small"></span></div>
      <div id="rprev">${old && old.media ? `<div class="mem-media" data-media="${old.id}"></div>` : ''}</div>
      <label class="tiny-btn" style="align-self:flex-start">Or choose a recording<input type="file" id="file" accept="audio/*" hidden></label></div>` : ''}
    ${k.date ? `<div class="field"><label for="md">Date</label><input id="md" type="date" value="${esc(old ? old.date || '' : '')}"></div>` : ''}
    ${k.title ? `<div class="field"><label for="mt">${k.title}</label><input id="mt" value="${esc(old ? old.title || '' : '')}" placeholder="${esc(k.ph && k.media ? k.ph : '')}"></div>` : ''}
    ${letter ? `<div class="chips starters">${LETTER_STARTS.map((t, i) => `<button class="chip" data-s="${i}">${t}</button>`).join('')}</div>` : ''}
    <div class="field">${k.media || k.title ? `<label for="mx">${k.media ? 'Anything you want to remember about it' : 'Tell it your way'} <span class="muted small" style="font-weight:600">(optional)</span></label>` : `<label for="mx" class="sr">${esc(k.label)}</label>`}
      <textarea id="mx" rows="${letter ? 10 : 6}" class="ta" placeholder="${esc(k.media ? '' : k.ph)}">${esc(old ? old.text || '' : '')}</textarea></div>
    ${letter ? '<p class="muted small">Letters are a private way to put your love and your missing into words. They stay here, just for you.</p>' : ''}
    <p id="mmsg" class="muted" role="status" hidden></p>
    <button class="btn" id="msave">${old ? 'Save changes' : 'Keep this memory'}</button>`, false, { tab: 'remember' });
  $('#bk').onclick = () => { stopRec(); old ? memoryView(old.id) : addPicker(); };
  const msg = (t) => { const m = $('#mmsg'); m.hidden = false; m.textContent = t; };
  app.querySelectorAll('#who .chip').forEach(c => c.onclick = () => {
    who = c.dataset.w; app.querySelectorAll('#who .chip').forEach(x => x.setAttribute('aria-pressed', x === c));
    if (letter || !old) $('h2').textContent = letter ? `Dear ${who || L()},` : `Remembering ${who || L()}`;
  });
  app.querySelectorAll('[data-s]').forEach(c => c.onclick = () => { const ta = $('#mx'); ta.value = (ta.value.trim() ? ta.value.trimEnd() + '\n\n' : '') + LETTER_STARTS[+c.dataset.s] + ' '; ta.focus(); });
  const showPreview = (url) => {
    const box = k.media === 'audio' ? $('#rprev') : $('#drop');
    const el = k.media === 'image' ? `<img src="${url}" alt="">` : k.media === 'video' ? `<video src="${url}" controls playsinline></video>` : `<audio src="${url}" controls></audio>`;
    box.innerHTML = `<div class="mem-media">${el}</div>` + (k.media === 'audio' ? '' : `<span class="muted small">Tap to choose a different one</span><input type="file" id="file" accept="${k.media}/*" hidden>`);
    bindFile();
  };
  const bindFile = () => {
    const f = $('#file'); if (!f) return;
    f.onchange = async () => {
      const file = f.files[0]; if (!file) return;
      if (k.media === 'video' && file.size > MAX_VIDEO) return msg('That video is larger than 50 MB. Try a shorter clip.');
      if (file.size > MAX_VIDEO) return msg('That file is larger than 50 MB. Please choose a smaller one.');
      pending = k.media === 'image' ? await compressImage(file) : file;
      showPreview(URL.createObjectURL(pending));
    };
  };
  bindFile();
  const rb = $('#rec');
  if (rb) rb.onclick = async () => {
    if (recorder) return stopRec();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [], r = new MediaRecorder(stream), t0 = Date.now();
      recorder = { r, stream, tick: setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); const el = $('#rt'); if (el) el.textContent = `Recording ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }, 500) };
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => { pending = new Blob(chunks, { type: r.mimeType || 'audio/mp4' }); if ($('#rprev')) showPreview(URL.createObjectURL(pending)); };
      r.start();
      rb.innerHTML = `${icon('pause')}Stop recording`;
    } catch (e) { msg('We couldn’t use your microphone. You can allow it in your browser settings, or choose a recording instead.'); }
  };
  $('#msave').onclick = async function () {
    stopRec();
    const title = $('#mt') ? $('#mt').value.trim() : '', text = $('#mx').value.trim(), date = $('#md') ? $('#md').value : '';
    if (k.media && !pending && !(old && old.media)) return msg(k.media === 'audio' ? 'Record something or choose a recording first.' : `Choose a ${k.media === 'image' ? 'photo' : 'video'} first.`);
    if (!k.media && !text && !title) return msg('Write a few words first. Even one line is enough.');
    if (k.date && !date) return msg('Choose the date first.');
    this.disabled = true; this.textContent = 'Saving…';
    const fields = { kind, who, title, text, date };
    let item;
    if (old) { item = { ...old, ...fields }; saveVault(vaultItems().map(m => m.id === old.id ? item : m)); }
    else item = addMemory(fields);
    if (pending) {
      try { await mediaDB.put(item.id, pending); } catch (e) {
        this.disabled = false; this.textContent = 'Keep this memory';
        if (!old) saveVault(vaultItems().filter(m => m.id !== item.id));
        return msg('This browser couldn’t save the file. If you’re in a private window, try a regular one.');
      }
      delete objectUrls[item.id];
      saveVault(vaultItems().map(m => m.id === item.id ? { ...m, media: { type: k.media, mime: pending.type }, uploaded: false } : m));
      backupMedia();
    }
    vaultFilter = 'all';
    memoryView(item.id, true);
  };
}
function stopRec() {
  if (!recorder) return;
  clearInterval(recorder.tick);
  try { recorder.r.state !== 'inactive' && recorder.r.stop(); } catch (e) {}
  recorder.stream.getTracks().forEach(t => t.stop());
  recorder = null;
  const rb = $('#rec'); if (rb) rb.innerHTML = `${icon('play')}Record again`;
  const el = $('#rt'); if (el) el.textContent = '';
}
function memoryView(id, justSaved = false) {
  const m = vaultItems().find(x => x.id === id);
  if (!m) return vaultScreen();
  const k = KINDS[m.kind] || KINDS.story;
  const words = [m.title, m.text].filter(Boolean).join('. ');
  render(`<button class="back" onclick="vaultScreen()">Memory Vault</button>
    ${justSaved ? '<p class="saved-note">Kept safe in your Memory Vault.</p>' : ''}
    <span class="eyebrow">${esc(k.label)}${m.who ? ` · ${esc(m.who)}` : ''}</span>
    ${m.kind === 'letter' ? `<h2>Dear ${esc(m.who || L())},</h2>` : m.title ? `<h2>${esc(m.title)}</h2>` : ''}
    ${m.media ? `<div class="mem-media full" data-media="${m.id}"></div>` : ''}
    ${m.date ? `<p class="muted">${fmtDay(m.date)}</p>` : ''}
    ${m.text ? `<div class="${m.kind === 'letter' ? 'card letter' : 'mem-body'}"><p>${esc(m.text)}</p></div>` : ''}
    <p class="muted small">Saved ${fmtDate(m.created)}</p>
    <div class="row">
      ${words ? `<button class="play" id="lis">${icon('play')}Listen</button>` : ''}
      <button class="tiny-btn" id="fav" aria-pressed="${!!m.fav}">${m.fav ? 'Favorite' : 'Add to favorites'}</button>
      ${plusOpen() && m.kind !== 'moment' ? `<button class="tiny-btn" onclick="memoryForm('${m.kind}','${m.id}')">Edit</button>` : ''}
      <button class="tiny-btn" id="del">Delete</button>
    </div>
    <div id="delask" class="sheet" hidden><p>Delete this memory? This can’t be undone.</p><div class="row" style="margin-top:12px"><button class="tiny-btn" id="delyes">Yes, delete it</button><button class="tiny-btn" id="delno">Keep it</button></div></div>`, false, { tab: 'remember' });
  if ($('#lis')) $('#lis').onclick = function () { listen(this, words); };
  $('#fav').onclick = () => { saveVault(vaultItems().map(x => x.id === id ? { ...x, fav: !x.fav } : x)); memoryView(id); };
  $('#del').onclick = () => { $('#delask').hidden = false; };
  $('#delno').onclick = () => { $('#delask').hidden = true; };
  $('#delyes').onclick = async () => {
    saveVault(vaultItems().filter(x => x.id !== id));
    if (m.media) { mediaDB.del(id); if (signedIn()) acct().removeMedia(id); }
    vaultScreen();
  };
}

/* Hard-day mode: one memory, shown gently. Free for everyone, with no prompts to upgrade. */
function rememberOne() {
  const items = forFocus(vaultItems());
  let i = Math.floor(Math.random() * Math.max(1, items.length));
  const p = promptPerson();
  const draw = () => {
    const m = items[i];
    render(`${backTo(true)}<span class="eyebrow">Remembering ${esc(L())}</span>
      ${m ? `${m.media ? `<div class="mem-media full" data-media="${m.id}"></div>` : ''}
        ${m.title ? `<h2>${esc(m.title)}</h2>` : ''}${m.text ? `<p class="response" style="font-size:1.3rem;white-space:pre-line">${esc(m.text)}</p>` : ''}
        ${items.length > 1 ? '<button class="btn ghost" id="next">Show another memory</button>' : ''}`
      : `<p class="response">${esc(p ? memPrompt(p) : 'Take a moment to remember them.')}</p>
        <p class="muted">Close your eyes if you like. Let the memory come slowly. There is no rush, and no wrong way to remember.</p>`}
      <div class="card prayer"><p class="text">Lord, thank You for every moment I had with ${esc(L())}. Hold these memories safe for me, and hold me too. Amen.</p></div>`, true);
    if ($('#next')) $('#next').onclick = () => { i = (i + 1) % items.length; draw(); };
  };
  draw();
}

/* ---------- Grief companion ---------- */
const CRISIS = /suicid|kill (myself|me)|end (my|it all)|end my life|take my (own )?life|want(ed)? to die|wish i (was|were) dead|don'?t want to (live|be here|wake up)|no reason to live|hurt(ing)? myself|better off without me|be with (him|her|them) again|join (him|her|them)\b/i;
const CARE_CARD = `<div class="card care"><strong>You matter, and you don’t have to carry this alone.</strong><p>If you are thinking about ending your life or might hurt yourself, please call or text <strong>988</strong> (Suicide &amp; Crisis Lifeline, US) or your local emergency number now. You can also reach out to someone you trust.</p><div class="row"><a class="tiny-btn" href="tel:988">Call 988</a><a class="tiny-btn" href="sms:988">Text 988</a></div></div>`;
let chat = loadJSON('swy-chat', []);
let chatBusy = false;
const saveChat = () => { chat = chat.slice(-60); try { localStorage.setItem('swy-chat', JSON.stringify(chat)); } catch (e) {} };
const paras = (t) => t.split(/\n{2,}/).map(x => `<p>${esc(x).replace(/\n/g, '<br>')}</p>`).join('');
const bubble = (m) => m.role === 'care' ? CARE_CARD
  : m.role === 'note' ? `<p class="muted small chat-note">${esc(m.content)}</p>`
  : `<div class="bubble ${m.role === 'user' ? 'me' : 'them'}">${m.content ? paras(m.content) : '<span class="typing" aria-label="Writing"><i></i><i></i><i></i></span>'}</div>`;

function companion(calm = false) { if (calm === true) return companionScreen(true); plusOnly(() => companionScreen(false), 'companion'); }
function companionScreen(calm) {
  if (calm !== true) _tab = 'today';
  const n = L();
  const starters = [`I miss ${profile.people[profile.focus] ? n : (profile.people[0] || {}).name || 'them'}.`, 'I’m angry with God.', 'Today would have been a special day.', 'I don’t know how to move forward.', 'I feel guilty because I laughed today.'];
  render(`${backTo(calm)}
    <div class="chat-head"><span class="eyebrow">Talk about my grief</span>${chat.length ? '<button class="tiny-btn" id="newc">Start over</button>' : ''}</div>
    <div class="bubble them"><p>I’m here, ${esc(profile.name)}. You can tell me anything about ${esc(n)}, or about today. There’s no right thing to say.</p></div>
    <div class="chat" id="chat" aria-live="polite">${chat.map(bubble).join('')}</div>
    <div class="chips starters" id="starters" ${chat.length ? 'hidden' : ''}>${starters.map(s => `<button class="chip">${esc(s)}</button>`).join('')}</div>
    <form class="composer" id="cf"><label for="cm" class="sr">Your message</label><textarea id="cm" rows="2" class="ta" placeholder="Say what’s on your heart…"></textarea><button class="play" id="send" aria-label="Send">Send</button></form>
    <p class="note">This companion is an AI. It listens and can pray with you, but it isn’t a counselor or pastor. Each message is sent securely to write a reply; your conversation is kept only on this device. If you are in danger, call or text <strong>988</strong>.</p>`, calm, { noTabs: true, cls: 'chat-screen' });
  app.scrollTop = app.scrollHeight;
  const ta = $('#cm');
  $('#cf').onsubmit = (e) => { e.preventDefault(); const t = ta.value.trim(); if (t && !chatBusy) { ta.value = ''; sendChat(t); } };
  ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#cf').requestSubmit(); } };
  app.querySelectorAll('#starters .chip').forEach(c => c.onclick = () => { if (!chatBusy) sendChat(c.textContent); });
  const nc = $('#newc');
  if (nc) nc.onclick = () => { if (chatBusy) return; chat = []; saveChat(); companionScreen(calm); };
}
async function sendChat(text) {
  chatBusy = true;
  const box = $('#chat'), st = $('#starters');
  if (st) st.hidden = true;
  chat.push({ role: 'user', content: text });
  if (CRISIS.test(text)) chat.push({ role: 'care' });
  const reply = { role: 'assistant', content: '' };
  const history = chat.filter(m => m.role === 'user' || m.role === 'assistant').map(({ role, content }) => ({ role, content }));
  chat.push(reply);
  const draw = () => {
    if (!document.body.contains(box)) return;
    const near = app.scrollHeight - app.scrollTop - app.clientHeight < 160;
    box.innerHTML = chat.map(bubble).join('');
    if (near || !reply.content) app.scrollTop = app.scrollHeight;
  };
  draw();
  const bridge = window.swyAccount;
  const r = bridge ? await bridge.companion({ messages: history, name: profile.name, people: profile.people.map(({ name, relation, cause, passed }) => ({ name, relation, cause, passed })) }, (t) => { reply.content += t; draw(); })
    : { error: 'The companion isn’t available just now. Please try again in a moment.' };
  if (r.error) { chat.splice(chat.indexOf(reply), 1); chat.push({ role: 'note', content: r.error }); }
  saveChat(); draw();
  chatBusy = false;
}

/* Hard-day "Let me talk" for people without Plus: a quiet place to write, never an upgrade prompt. */
function letMeWrite() {
  render(`${backTo(true)}<h2>Let it out</h2>
    <p class="muted">Write whatever you feel, however it comes. Nothing here is saved or sent.</p>
    <textarea id="lw" rows="8" class="ta" autofocus></textarea>
    <button class="btn" id="done">I’ve said what I needed to</button>
    <div id="after" hidden></div>`, true);
  $('#done').onclick = () => {
    const t = $('#lw').value;
    const a = $('#after'); a.hidden = false;
    a.innerHTML = `${CRISIS.test(t) ? CARE_CARD : ''}<p class="response" style="font-size:1.3rem">Thank you for putting that into words. What you feel makes sense, and you don’t have to carry it alone.</p>
      <div class="options" style="margin-top:16px"><button onclick="prayer(true)">Pray with me</button><button onclick="breathe(true)">Help me breathe</button><button onclick="support(true)">Call someone I trust</button></div>`;
    $('#lw').value = ''; $('#done').hidden = true;
  };
}

/* ---------- Still With You Plus ---------- */
let chosenPlan = 'year';
const fmtDate = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
function plansScreen(feature = '') {
  const lead = feature === 'companion' ? 'Talk about your grief any time, day or night.'
    : feature === 'vault' ? `Keep every memory of ${esc(L())} in one safe place.`
    : 'More room to remember, and more ways to be held.';
  const trial = !plan.everSubscribed;
  const back = profile.people.length ? 'home()' : 'welcome()';
  render(`<button class="back" onclick="${back}">Back</button>
    <div class="plus-head"><span class="eyebrow">Still With You Plus</span><h2>${lead}</h2>
    <p class="muted">${trial ? 'Try everything free for 7 days. You won’t be charged until the trial ends, and you can cancel any time before then.' : 'Cancel any time.'}</p></div>
    <ul class="plus-list sec">
      <li><span><strong>A grief companion to talk with</strong><br><span class="muted small">Say what’s on your heart and receive a caring, faith-centered response.</span></span></li>
      <li><span><strong>Your Memory Vault</strong><br><span class="muted small">Photos, stories, recipes, songs, and letters, kept private and safe.</span></span></li>
      <li><span><strong>Audio prayers and scripture</strong><br><span class="muted small">Listen when reading feels like too much.</span></span></li>
      <li><span><strong>Backup across your devices</strong><br><span class="muted small">Nothing you’ve saved is lost if you lose your phone.</span></span></li>
    </ul>
    <div class="plans" role="radiogroup" aria-label="Choose a plan">
      <button class="plan" role="radio" data-plan="year"><span class="tag">Best value</span><span class="radio"></span><span class="t"><strong>Yearly</strong><span class="muted small">About $4.08 a month</span></span><span class="price">$49<span class="muted small"> / year</span></span></button>
      <button class="plan" role="radio" data-plan="month"><span class="radio"></span><span class="t"><strong>Monthly</strong><span class="muted small">Billed each month</span></span><span class="price">$6.99<span class="muted small"> / mo</span></span></button>
    </div>
    <p id="pmsg" class="muted" role="status" hidden></p>
    <button class="btn" id="pgo">${!signedIn() ? 'Create a free account first' : trial ? 'Start my free week' : 'Continue'}</button>
    ${!signedIn() ? `<button class="btn link small" onclick="accountScreen('signin')">I already have an account</button>` : ''}
    <div class="free-forever"><span class="eyebrow">Always free</span>
      <p class="muted small" style="margin-top:6px">Hard-day mode, the daily prayer, journaling, and crisis help are free for everyone, forever. No one should have to pay for comfort on their hardest day.</p></div>
    <p class="muted small">Payments are handled securely by Stripe. Still With You never sees your card number. Plus renews automatically until you cancel. See our <a href="/terms" target="_blank">Terms</a> and <a href="/privacy" target="_blank">Privacy Policy</a>.</p>`);
  const pick = (k) => { chosenPlan = k; document.querySelectorAll('.plan').forEach(b => { const on = b.dataset.plan === k; b.setAttribute('aria-pressed', on); b.setAttribute('aria-checked', on); }); };
  document.querySelectorAll('.plan').forEach(b => b.onclick = () => pick(b.dataset.plan));
  pick(chosenPlan);
  $('#pgo').onclick = async function () {
    if (!signedIn()) { afterAccount = () => plansScreen(feature); return accountScreen('signup'); }
    this.disabled = true; this.textContent = 'Opening secure checkout…';
    const r = await acct().checkout(chosenPlan);
    if (r.error) { this.disabled = false; this.textContent = trial ? 'Start my free week' : 'Continue'; const m = $('#pmsg'); m.hidden = false; m.textContent = r.error; }
  };
}
async function plusWelcome() {
  render(`<div class="welcome" style="justify-content:center"><p class="muted">Getting everything ready…</p></div>`);
  for (let i = 0; i < 4 && !isPlus(); i++) { await refreshPlan(); if (!isPlus()) await new Promise(r => setTimeout(r, 1500)); }
  if (!isPlus()) return render(`<button class="back" onclick="home()">Home</button><h2>Thank you</h2>
    <p class="muted">Your payment went through. It can take a moment to show here. If Plus isn’t turned on in a few minutes, open Privacy and settings and tap “Check my plan”.</p>`);
  render(`<div class="welcome" style="justify-content:center;gap:18px">${MARK}
    <span class="eyebrow">Welcome to Plus</span><h2>We’re glad you’re here</h2>
    <p class="muted">${plan.trialEnds ? `Your free week runs until ${fmtDate(plan.trialEnds)}. We’ll email you before it ends.` : 'Everything in Plus is ready for you.'}</p>
    <button class="btn" onclick="home()">Continue</button></div>`);
}
function planCard() {
  if (!plansOn() || !signedIn()) return '';
  if (!isPlus()) return `<div class="card"><strong>Your plan</strong><p class="muted small">You’re on the free plan. Everything you need on a hard day stays free.</p>
    <div class="row"><button class="tiny-btn" onclick="plansScreen()">See Still With You Plus</button><button class="tiny-btn" id="pchk">Check my plan</button></div></div>`;
  const when = plan.status === 'trialing' && plan.trialEnds ? `Free trial until ${fmtDate(plan.trialEnds)}`
    : plan.cancelsAtEnd && plan.renews ? `Ends ${fmtDate(plan.renews)}` : plan.renews ? `Renews ${fmtDate(plan.renews)}` : '';
  return `<div class="card"><strong>Still With You Plus</strong><p class="muted small">${plan.interval === 'year' ? 'Yearly' : 'Monthly'}${when ? ' · ' + when : ''}${plan.status === 'past_due' ? ' · Your last payment didn’t go through' : ''}</p>
    <div class="row"><button class="tiny-btn" id="pman">Manage my plan</button></div><p id="pmsg" class="muted small" hidden></p></div>`;
}

let afterAccount = null;
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
      ${up ? '<p class="muted small" style="margin-top:10px">By creating an account you agree to our <a href="/terms" target="_blank">Terms</a> and <a href="/privacy" target="_blank">Privacy Policy</a>.</p>' : ''}
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
    await refreshPlan();
    const next = afterAccount; afterAccount = null;
    if (next && profile.people.length) return next();
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

/* Email links: a password reset opens a screen to choose a new one; a used or old link explains what to do. */
function handleAuthLink() {
  const l = acct() && acct().authLink ? acct().authLink() : null;
  if (l === 'recovery') { newPasswordScreen(); return true; }
  if (l === 'expired') {
    accountScreen('signin');
    const m = $('#amsg'); m.hidden = false;
    m.textContent = 'That email link has already been used or is too old. Enter your email and tap “Forgot your password?” for a fresh one, and open only the newest email.';
    return true;
  }
  return false;
}
window.addEventListener('swy-auth-link', handleAuthLink);

function newPasswordScreen() {
  render(`<button class="back" onclick="${profile.people.length ? 'home()' : 'welcome()'}">Back</button>
    <span class="eyebrow">Your password</span>
    <h2>Choose a new password</h2>
    <form id="nf" class="sec" novalidate>
      <div class="field"><label for="np">New password</label><input id="np" type="password" autocomplete="new-password" minlength="8" required autofocus><p class="muted small" style="margin-top:6px">At least 8 characters.</p></div>
      <p id="nmsg" class="muted" role="status" hidden></p>
      <button class="btn" id="ngo">Save my new password</button>
    </form>`);
  $('#nf').onsubmit = async (e) => {
    e.preventDefault();
    const m = $('#nmsg'), p = $('#np').value;
    if (p.length < 8) { m.hidden = false; m.textContent = 'Please use at least 8 characters.'; return; }
    const go = $('#ngo'); go.disabled = true; go.textContent = 'Saving…';
    const r = await acct().updatePassword(p);
    if (r.error) { go.disabled = false; go.textContent = 'Save my new password'; m.hidden = false; m.textContent = r.error; return; }
    await syncAfterSignIn();
    await refreshPlan();
    render(`<span class="eyebrow">All set</span><h2>Your new password is saved</h2>
      <p class="muted">You’re signed in. Use your new password next time.</p>
      <button class="btn" id="ndone">Continue</button>`);
    $('#ndone').onclick = () => (profile.people.length ? home() : welcome());
  };
}

/* Wait briefly for the account bridge so a signed-in person sees their saved entries on a new device. */
let booted = false;
async function boot() {
  if (booted) return; booted = true;
  if (signedIn()) { try { await syncAfterSignIn(); } catch (e) {} }
  if (handleAuthLink()) return;
  const ret = new URLSearchParams(location.search).get('plan');
  if (ret) history.replaceState(null, '', location.pathname);
  const has = profile.people.length > 0;
  if (settings.pin && has) { refreshPlan(); return lockScreen(); }
  if (ret === 'welcome' && has) return plusWelcome();
  if (ret === 'manage' && has) { await refreshPlan(); return settingsScreen(); }
  refreshPlan();
  if (ret === 'cancel' && has) return plansScreen();
  welcome();
}
if (window.swyAccount) boot(); else { window.addEventListener('swy-account-ready', boot, { once: true }); setTimeout(boot, 1500); }
