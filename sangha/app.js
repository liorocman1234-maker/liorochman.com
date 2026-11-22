/* Sangha PWA · vanilla JS + Supabase */
(function () {
'use strict';
const C = window.SANGHA_CONFIG;
const sb = window.supabase.createClient(C.url, C.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sangha-auth' } });
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const view = $('#view'), nav = $('#nav'), sheet = $('#sheet'), playerEl = $('#player');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TZ = 'Asia/Jerusalem';

// ---------- state ----------
const S = { session: null, profile: null, settings: null, goal: null, personal: null, groups: [], season: null, seasons: [], mine: [], recordings: [], listens: {}, pulse: null, quotes: [], playing: null };

// ---------- time helpers (Israel) ----------
function ilParts(d = new Date()) {
  const p = {}; new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' })
    .formatToParts(d).forEach(x => p[x.type] = x.value);
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { date: `${p.year}-${p.month}-${p.day}`, h: +p.hour % 24, m: +p.minute, wd };
}
const today = () => ilParts().date;
function addDays(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function daysBetween(a, b) { return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5); }
const DAYNAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
function heDate(iso) { const d = new Date(iso + 'T12:00:00Z'); return `${DAYNAMES[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}`; }
function greeting() { const h = ilParts().h; return h < 5 ? 'לילה שקט' : h < 12 ? 'בוקר אור' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב'; }
function ago(ts) {
  const m = Math.round((Date.now() - new Date(ts)) / 6e4);
  if (m < 1) return 'עכשיו'; if (m < 60) return `לפני ${m} דק׳`; const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'לפני שעה' : `לפני ${h} שעות`; const d = Math.round(h / 24); return d === 1 ? 'אתמול' : `לפני ${d} ימים`;
}
function liveInfo() {
  const st = S.settings || {}; const [lh, lm] = String(st.live_time || '05:30').split(':').map(Number);
  const liveMin = lh * 60 + lm, dur = st.live_minutes || 60, days = st.live_days || [0, 1, 2, 3, 4];
  const n = ilParts(), nowMin = n.h * 60 + n.m;
  if (days.includes(n.wd) && nowMin >= liveMin - 10 && nowMin < liveMin + dur) return { now: true, minutes: 0 };
  for (let d = 0; d < 8; d++) {
    const wd = (n.wd + d) % 7; if (!days.includes(wd)) continue;
    const diff = d * 1440 + liveMin - nowMin; if (diff > 0) return { now: false, minutes: diff, wd, d };
  }
  return null;
}
function fmtUntil(min) { if (min < 60) return `בעוד ${min} דק׳`; const h = Math.floor(min / 60), m = min % 60; return h < 24 ? `בעוד ${h}:${String(m).padStart(2, '0')} שעות` : ''; }

// ---------- seed stages ----------
const STAGES = [
  { n: 'זרע', at: 0 }, { n: 'נבט', at: 7 }, { n: 'שתיל', at: 21 }, { n: 'עץ', at: 50 }, { n: 'עץ פורח', at: 100 }];
function stageOf(total) { let i = 0; STAGES.forEach((s, k) => { if (total >= s.at) i = k; }); return i; }
function stageSvg(i) {
  const g = 'var(--gold)', l = 'var(--leaf)';
  const seed = `<path d="M17 9c4 4 5 9 3 13-1 2-2 3-3 4-1-1-2-2-3-4-2-4-1-9 3-13z" fill="#B9763A"/>`;
  const parts = [
    seed,
    `<path d="M17 26v-9" stroke="${l}" stroke-width="2"/><path d="M17 18c-3-1-5-4-5-6 3 0 5 2 5 6zM17 17c3-1 5-4 5-6-3 0-5 2-5 6z" fill="${l}"/>`,
    `<path d="M17 30V12" stroke="${l}" stroke-width="2"/><path d="M17 20c-4-1-7-4-7-7 4 0 7 3 7 7zM17 16c4-1 7-4 7-7-4 0-7 3-7 7zM17 25c-3 0-5-2-6-4 3 0 5 1 6 4z" fill="${l}"/>`,
    `<path d="M17 31V18" stroke="#8B6A3E" stroke-width="2.4"/><circle cx="17" cy="13" r="9" fill="${l}"/>`,
    `<path d="M17 31V18" stroke="#8B6A3E" stroke-width="2.4"/><circle cx="17" cy="13" r="9" fill="${l}"/><circle cx="12" cy="11" r="1.8" fill="${g}"/><circle cx="20" cy="9" r="1.8" fill="${g}"/><circle cx="21" cy="16" r="1.8" fill="${g}"/><circle cx="14" cy="17" r="1.6" fill="${g}"/>`];
  return `<svg viewBox="0 0 34 34" aria-hidden="true">${parts[i]}</svg>`;
}

// ---------- ui helpers ----------
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2600); }
function openSheet(html, onMount) {
  sheet.innerHTML = `<div class="panel" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  sheet.hidden = false; document.body.style.overflow = 'hidden';
  sheet.onclick = e => { if (e.target === sheet) closeSheet(); };
  onMount && onMount(sheet.firstElementChild);
}
function closeSheet() { sheet.hidden = true; sheet.innerHTML = ''; document.body.style.overflow = ''; }
function chipGroup(el, cb) {
  el.addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c || !el.contains(c)) return; $$('.chip', el).forEach(x => x.setAttribute('aria-pressed', x === c)); cb && cb(c.dataset.v, c); });
}
function initials(name) { return (name || '?').trim().slice(0, 1); }
async function guard(promise, msg) {
  const { data, error } = await promise; if (error) { console.error(error); toast(msg || 'משהו השתבש. נסו שוב'); throw error; } return data;
}

// ---------- data ----------
async function loadProfile() {
  const { data } = await sb.from('profiles').select('*').eq('id', S.session.user.id).maybeSingle();
  S.profile = data;
}
async function loadCore() {
  const uid = S.session.user.id;
  const [st, goals, mine, seasons, quotes] = await Promise.all([
    sb.from('settings').select('*').eq('id', 1).maybeSingle(),
    sb.from('goals').select('*').eq('user_id', uid).eq('status', 'active').order('created_at', { ascending: false }),
    sb.from('practices').select('day,mode,minutes,word,created_at').eq('user_id', uid).order('day', { ascending: false }).limit(1000),
    sb.from('seasons').select('*').order('start_date', { ascending: false }),
    sb.from('quotes').select('*').order('id')]);
  if (goals.error) throw goals.error;
  S.settings = st.data || {}; S.mine = mine.data || [];
  S.seasons = seasons.data || []; S.quotes = quotes.data || [];
  setJourneys(goals.data || []);
}
// ---------- current group challenge (Sunday to Thursday) ----------
const isChDay = iso => new Date(iso + 'T12:00:00Z').getUTCDay() < 5;
function challengeDates() {
  const st = S.settings || {}, n = st.challenge_days, out = [];
  if (!st.challenge_start || !(n > 0)) return out;
  for (let d = st.challenge_start; out.length < n; d = addDays(d, 1)) if (isChDay(d)) out.push(d);
  return out;
}
function challengeNow() {
  const dates = challengeDates(), t = today(), end = dates[dates.length - 1];
  if (!dates.length || t < dates[0] || t > end) return null;
  return { challenge: true, title: S.settings.challenge_title || 'האתגר של הסנגהה', dates, end, start_date: dates[0],
    day: dates.filter(d => d <= t).length, rest: !isChDay(t), last: t === end, days_target: dates.length, per_week: 5, min_minutes: 10 };
}
function challengeJustEnded() {
  const end = challengeDates().pop();
  return !!end && end < today() && daysBetween(end, today()) <= 21;
}
// During the challenge it is everybody's journey. When it ends, the personal / group flow takes over by itself.
function syncChallenge() {
  S.challenge = challengeNow();
  S.goal = S.challenge || S.personal || S.groups[0] || null;
  S.season = seasonOf(S.goal);
}
const canPickJourney = () => !S.challenge || S.challenge.last;
const otherJourneys = () => [S.personal, ...S.groups].filter(x => x && x !== S.goal);
const journeyName = g => g.season_id ? seasonOf(g).title : 'המסע האישי שלי';
const shortDate = iso => `${+iso.slice(8, 10)}.${+iso.slice(5, 7)}`;
function phaseOf(ch) {
  if (ch.days_target !== 66) return '';
  return ch.day <= 22 ? 'שלב 1 · הרס' : ch.day <= 44 ? 'שלב 2 · התקנה' : 'שלב 3 · אינטגרציה';
}
function challengeLine(ch) {
  if (ch.rest) return `סופ״ש · ביום ראשון ממשיכים ליום ${ch.day + 1}`;
  if (ch.last) return 'היום האחרון באתגר';
  return [phaseOf(ch), `מסיימים ב־${shortDate(ch.end)}`].filter(Boolean).join(' · ');
}
const seasonOf = g => g && g.season_id ? S.seasons.find(x => x.id === g.season_id) || null : null;
const seasonEnd = x => addDays(x.start_date, x.days); // exclusive
const openSeasons = () => S.seasons.filter(x => x.active && seasonEnd(x) > today());
function setJourneys(goals) {
  S.personal = goals.find(g => !g.season_id) || null;
  S.groups = goals.filter(g => { const x = seasonOf(g); return x && seasonEnd(x) > today(); });
  syncChallenge();
}
async function loadPulse() { const { data } = await sb.rpc('sangha_pulse'); S.pulse = data || { today: 0, members: 0, sitting: 0, words: [] }; }
async function loadRecordings() {
  const [r, l] = await Promise.all([
    sb.from('recordings').select('*').order('recorded_on', { ascending: false }).order('created_at', { ascending: false }),
    sb.from('listens').select('*').eq('user_id', S.session.user.id)]);
  S.recordings = r.data || []; S.listens = {}; (l.data || []).forEach(x => S.listens[x.recording_id] = x);
}
const practicedToday = () => S.mine.find(p => p.day === today());
function goalDone(g = S.goal) {
  if (!g) return 0; const x = seasonOf(g), end = g.challenge ? addDays(g.end, 1) : x ? seasonEnd(x) : '9999-12-31';
  return S.mine.filter(p => p.day >= g.start_date && p.day < end).length;
}
function weeksStreak() {
  // consecutive weeks (Sun-Sat) where practice count >= per_week; current week counts if already met or still possible
  if (!S.goal) return 0; const per = S.goal.per_week; const set = new Set(S.mine.map(p => p.day));
  const t = today(); const wd = new Date(t + 'T12:00:00Z').getUTCDay(); let weekStart = addDays(t, -wd); let streak = 0;
  const cnt = ws => { let c = 0; for (let i = 0; i < 7; i++) if (set.has(addDays(ws, i))) c++; return c; };
  const cur = cnt(weekStart); if (cur >= per) streak++;
  for (let k = 1; k < 200; k++) { weekStart = addDays(weekStart, -7); if (weekStart < addDays(S.goal.start_date, -6)) break; if (cnt(weekStart) >= per) streak++; else break; }
  return streak;
}
function thisWeekCount() { const t = today(); const wd = new Date(t + 'T12:00:00Z').getUTCDay(); const ws = addDays(t, -wd); return S.mine.filter(p => p.day >= ws && p.day <= t).length; }
function welcomeBack() {
  if (practicedToday() || !S.mine.length) return false;
  const last = S.mine[0].day; if (S.challenge) return S.challenge.dates.filter(d => d > last && d < today()).length >= 2; return daysBetween(last, today()) >= 3;
}
function quoteOfDay() { if (!S.quotes.length) return null; const n = daysBetween('2026-01-01', today()); return S.quotes[((n % S.quotes.length) + S.quotes.length) % S.quotes.length]; }

const PENDING_KEY = 'sangha-pending-practice';
async function flushPending() {
  let rows = []; try { rows = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch (_) {}
  if (!rows.length || !navigator.onLine || !S.session) return;
  const { error } = await sb.from('practices').upsert(rows, { onConflict: 'user_id,day' });
  if (!error) { try { localStorage.removeItem(PENDING_KEY); } catch (_) {} toast('התרגול שסימנת בלי רשת נשמר 🌱'); }
}
async function logPractice(mode, minutes, word) {
  const row = { user_id: S.session.user.id, day: today(), mode, minutes: +minutes || 15, word: (word || '').trim().slice(0, 24) || null };
  if (!navigator.onLine) {
    try { const rows = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]').filter(r => r.day !== row.day); rows.push(row); localStorage.setItem(PENDING_KEY, JSON.stringify(rows)); } catch (_) {}
    S.mine = [row, ...S.mine.filter(p => p.day !== row.day)]; return;
  }
  await guard(sb.from('practices').upsert(row, { onConflict: 'user_id,day' }));
  S.mine = [row, ...S.mine.filter(p => p.day !== row.day)];
  sb.from('sitting').delete().eq('user_id', S.session.user.id).then(() => {});
  checkGoalComplete();
}
async function markSitting(minutes) {
  await sb.from('sitting').upsert({ user_id: S.session.user.id, until: new Date(Date.now() + minutes * 6e4).toISOString() });
}
function checkGoalComplete() {
  const g = [S.personal, ...S.groups].find(x => x && !x.completed && goalDone(x) >= x.days_target);
  if (!g) return;
  g.completed = true;
  sb.from('goals').update({ status: 'done' }).eq('id', g.id).then(() => {});
  setTimeout(() => openSheet(`<div class="center stack"><div style="margin:0 auto;width:80px">${stageSvg(4)}</div><h2>השלמת את המסע</h2>
    <p class="small">${g.days_target} ימי תרגול. כל אחד מהם נשאר איתך.</p>
    <button class="btn block" id="ng">לבחור מסע חדש</button></div>`, p => $('#ng', p).onclick = () => {
      closeSheet(); setJourneys([S.personal, ...S.groups].filter(x => x && !x.completed)); go('goal'); }), 600);
}

// ---------- router ----------
const TABS = [
  { id: 'home', t: 'היום שלי', i: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>' },
  { id: 'journey', t: 'המסע', i: '<path d="M12 21c-4-3-6-6-6-10a6 6 0 0 1 12 0c0 4-2 7-6 10z"/><path d="M12 8v13"/>' },
  { id: 'library', t: 'ספרייה', i: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>' },
  { id: 'sangha', t: 'הסנגהה', i: '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M2 20c1-3 3.5-5 6-5s5 2 6 5M10 20c1-3 3.5-5 6-5s5 2 6 5"/>' }];
function renderNav(cur) {
  nav.hidden = false;
  nav.innerHTML = `<div class="in">${TABS.map(t => `<button class="tab" data-go="${t.id}" ${t.id === cur ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${t.i}</svg>${t.t}</button>`).join('')}</div>`;
  $$('.tab', nav).forEach(b => b.onclick = () => go(b.dataset.go));
}
const VIEWS = {};
let current = null;
function go(id) { if (location.hash !== '#' + id) location.hash = id; else route(); }
async function route() {
  if (!S.session) return renderAuth();
  if (!S.profile || S.profile.role === 'pending') return renderPending();
  syncChallenge();
  let id = (location.hash || '#home').slice(1) || 'home';
  if (id === 'goal' && !canPickJourney()) id = 'home';
  if (!S.goal && !['goal', 'me', 'admin'].includes(id)) id = 'goal';
  if (id === 'admin' && !isStaff()) id = 'home';
  if (!VIEWS[id]) id = 'home';
  current = id; window.scrollTo(0, 0);
  if (['home', 'journey', 'library', 'sangha'].includes(id)) renderNav(id); else nav.hidden = true;
  refreshUnread().catch(() => {});
  try { await VIEWS[id](); } catch (e) { console.error(e); view.innerHTML = `<div class="card"><p>לא הצלחנו לטעון. בדקו את החיבור ונסו שוב.</p><button class="btn" onclick="location.reload()">רענון</button></div>`; }
}
const isStaff = () => S.profile && ['facilitator', 'admin'].includes(S.profile.role);
window.addEventListener('hashchange', route);

function header(title, eyebrow) {
  const p = S.profile || {};
  return `<div class="row"><div class="grow">${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ''}<h1>${esc(title)}</h1></div>
  ${isStaff() ? `<button class="icon-btn" data-go="admin" aria-label="ניהול">ניהול</button>` : ''}
  <button class="bell" data-bell aria-label="התראות"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>${S.unread ? `<span class="badge num">${S.unread > 9 ? '9+' : S.unread}</span>` : ''}</button>
  <button class="avatar" style="width:38px;height:38px;border:0;cursor:pointer;background:${esc(p.color || '#E6C068')}" data-go="me" aria-label="הפרופיל שלי">${esc(initials(p.display_name))}</button></div>`;
}
function bindGo(root = view) { $$('[data-go]', root).forEach(b => b.onclick = () => go(b.dataset.go)); $$('[data-bell]', root).forEach(b => b.onclick = notificationsSheet); }
async function refreshUnread() {
  const { data } = await sb.rpc('unread_count'); const n = data || 0; if (n === S.unread) return; S.unread = n;
  $$('[data-bell]').forEach(b => { const old = $('.badge', b); if (old) old.remove(); if (n) b.insertAdjacentHTML('beforeend', `<span class="badge num">${n > 9 ? '9+' : n}</span>`); });
}
const NICON = { comment: '💬', heart: '🤍', announcement: '📌', answer: '🪷', event: '📅', welcome: '🌱' };
async function notificationsSheet() {
  openSheet(`<div class="row"><h2 class="grow">התראות</h2><button class="btn link" id="n-all">סימון הכל כנקרא</button></div><div id="n-list"><p class="small">טוען…</p></div>`, async () => {
    const { data } = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(40);
    const list = data || [];
    $('#n-list').innerHTML = list.length ? list.map(n => `<button class="notif ${n.read ? '' : 'unread'}" data-n="${n.id}" data-link="${esc(n.link)}">
      <span class="ic">${NICON[n.kind] || '·'}</span><span class="grow"><b>${esc(n.title)}</b>${n.body ? `<div class="small" style="color:var(--ink-2)">${esc(n.body)}</div>` : ''}<div class="small">${ago(n.created_at)}</div></span></button>`).join('')
      : '<p class="small">אין התראות עדיין. כשמישהו יגיב לך או כשעדי תפרסם משהו, זה יופיע כאן.</p>';
    $('#n-all').onclick = async () => { await sb.from('notifications').update({ read: true }).eq('read', false); S.unread = 0; closeSheet(); refreshUnread(); toast('הכל נקרא'); };
    $$('[data-n]').forEach(b => b.onclick = async () => {
      sb.from('notifications').update({ read: true }).eq('id', b.dataset.n).then(refreshUnread);
      const link = b.dataset.link; closeSheet();
      if (link.startsWith('post:')) threadSheet(link.slice(5));
      else if (link === 'question') { libTab = 'rec'; go('library'); setTimeout(askSheet, 400); }
      else if (link === 'event') go('sangha');
    });
  });
}

// ---------- AUTH ----------
function renderAuth(mode = 'join') {
  nav.hidden = true;
  view.innerHTML = `<div class="auth-hero"><img src="icons/icon-192.png" alt=""><h1>סנגהה</h1></div>
  <div class="chips" style="justify-content:center" id="am"><button class="chip" data-v="join" aria-pressed="${mode === 'join'}">הצטרפות</button><button class="chip" data-v="login" aria-pressed="${mode === 'login'}">כבר יש לי חשבון</button></div>
  <form class="card" id="af" novalidate>
    ${mode === 'join' ? `<label class="field">השם שיופיע בסנגהה<input type="text" id="a-name" autocomplete="given-name" required></label>` : ''}
    <label class="field">אימייל<input type="email" id="a-email" autocomplete="email" inputmode="email" dir="ltr" required></label>
    <label class="field">סיסמה${mode === 'join' ? ' (לפחות 6 תווים)' : ''}<input type="password" id="a-pass" autocomplete="${mode === 'join' ? 'new-password' : 'current-password'}" dir="ltr" required></label>
    ${mode === 'join' ? `<label class="field">קוד הזמנה<input type="text" id="a-code" autocomplete="off" dir="ltr" required></label>` : ''}
    <p class="err" id="a-err" hidden></p>
    <button class="btn block" id="a-btn">${mode === 'join' ? 'הצטרפות לסנגהה' : 'כניסה'}</button>
    ${mode === 'login' ? `<button type="button" class="btn link" id="a-forgot">שכחתי סיסמה</button>` : ''}
  </form>
  <p class="small center">את קוד ההזמנה מקבלים מעדי או מליאור</p>`;
  chipGroup($('#am'), v => renderAuth(v));
  const err = m => { const e = $('#a-err'); e.textContent = m; e.hidden = !m; };
  $('#af').onsubmit = async e => {
    e.preventDefault(); err('');
    const email = $('#a-email').value.trim(), pass = $('#a-pass').value;
    if (!email || pass.length < 6) return err('צריך אימייל וסיסמה של 6 תווים לפחות');
    const btn = $('#a-btn'); btn.disabled = true;
    try {
      if (mode === 'join') {
        const name = $('#a-name').value.trim(), code = $('#a-code').value.trim();
        if (!name || !code) { btn.disabled = false; return err('צריך שם וקוד הזמנה'); }
        const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { display_name: name } } });
        if (error) { btn.disabled = false; return err(error.message.includes('registered') ? 'האימייל כבר רשום. עברו ל"כבר יש לי חשבון"' : 'ההרשמה לא הצליחה: ' + error.message); }
        if (!data.session) { btn.disabled = false; return err('נשלח מייל אימות. אחרי האישור חזרו לכאן והיכנסו'); }
        S.session = data.session;
        const { data: r } = await sb.rpc('redeem_invite', { p_code: code, p_name: name });
        await loadProfile();
        if (r !== 'ok') { toast('קוד ההזמנה לא תקין'); return renderPending(); }
        await loadCore(); go(S.goal ? 'home' : 'goal');
        if (S.challenge) setTimeout(welcomeSheet, 900);
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (error) { btn.disabled = false; return err('האימייל או הסיסמה לא נכונים'); }
        S.session = data.session; await boot();
      }
    } catch (x) { btn.disabled = false; err('בעיית חיבור. נסו שוב'); }
  };
  const f = $('#a-forgot');
  if (f) f.onclick = async () => {
    const email = $('#a-email').value.trim(); if (!email) return err('כתבו קודם את האימייל');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + '#reset' });
    err(error ? 'לא הצלחנו לשלוח מייל איפוס. כתבו לליאור בוואטסאפ ונסדר' : 'שלחנו קישור לאיפוס סיסמה למייל');
  };
}
function renderPending() {
  nav.hidden = true;
  view.innerHTML = `<div class="auth-hero"><img src="icons/icon-192.png" alt=""><h1>כמעט בפנים</h1><p class="small">כדי להיכנס לסנגהה צריך קוד הזמנה</p></div>
  <form class="card" id="pf"><label class="field">קוד הזמנה<input type="text" id="p-code" dir="ltr" autocomplete="off"></label>
  <p class="err" id="p-err" hidden></p><button class="btn block">כניסה</button></form>
  <button class="btn link" id="p-out">התנתקות</button>`;
  $('#pf').onsubmit = async e => {
    e.preventDefault(); const { data } = await sb.rpc('redeem_invite', { p_code: $('#p-code').value, p_name: (S.profile && S.profile.display_name) || '' });
    if (data !== 'ok') { const er = $('#p-err'); er.textContent = 'הקוד לא תקין'; er.hidden = false; return; }
    await boot();
  };
  $('#p-out').onclick = signOut;
}
async function signOut() { await sb.auth.signOut(); S.session = null; S.profile = null; S.convo = null; location.hash = ''; renderAuth('login'); }

// ---------- GOAL ----------
let goalTab = 'personal';
function welcomeSheet() {
  openSheet(`<div class="center stack"><div style="margin:0 auto;width:70px">${stageSvg(0)}</div><h2>ברוך/ה הבא/ה לסנגהה</h2>
    <p class="small" style="color:var(--ink-2)">רוצה להציג את עצמך? כמה מילים מספיקות. כולם יקבלו התראה ויוכלו לקבל אותך בברכה.</p>
    <button class="btn block" id="in-yes">כתיבת היכרות</button><button class="btn link" id="in-no">אחר כך</button></div>`, p => {
      $('#in-no', p).onclick = closeSheet; $('#in-yes', p).onclick = () => { closeSheet(); composeSheet('intro'); }; });
}
function groupTarget(x) {
  const start = x.start_date > today() ? x.start_date : today(), left = daysBetween(start, seasonEnd(x));
  return { start, target: Math.max(1, Math.min(left, Math.round(left * x.per_week / 7))) };
}
function groupsHtml() {
  const list = openSeasons();
  if (!list.length) return `<div class="card soft"><h3>אין כרגע מסע קבוצתי פתוח</h3><p class="small">כשייפתח מסע לסנגהה, אפשר יהיה להצטרף אליו כאן. בינתיים אפשר לבחור מסע אישי.</p></div>`;
  return list.map(x => { const joined = S.groups.find(g => g.season_id === x.id);
    return `<div class="card gold"><h3>${esc(x.title)}</h3>
      <span class="small">${x.start_date > today() ? 'מתחיל' : 'התחיל'} ב${heDate(x.start_date)} · ${x.days} ימים · ${x.per_week} פעמים בשבוע</span>
      ${x.description ? `<p class="small" style="color:var(--ink-2)">${esc(x.description)}</p>` : ''}
      <p class="small">${joined ? `${goalDone(joined)} מתוך ${joined.days_target} ימי תרגול` : `${groupTarget(x).target} ימי תרגול מרגע ההצטרפות`}</p>
      ${joined ? `<div class="row"><span class="grow heard">✓ הצטרפת</span><button class="btn link" data-leave="${joined.id}">יציאה מהמסע</button></div>`
               : `<button class="btn block" data-join="${x.id}">הצטרפות למסע</button>`}</div>`; }).join('');
}
VIEWS.goal = async function () {
  const cur = S.personal, preset = [21, 40, 66, 100];
  const pick = { days: cur ? cur.days_target : 40, per: cur ? cur.per_week : 5, min: cur ? cur.min_minutes : 15 };
  const custom = !preset.includes(pick.days);
  view.innerHTML = `${header('בוחרים מסע', S.goal ? 'המסעות שלי' : 'צעד ראשון')}
  ${challengeJustEnded() && !S.goal ? `<div class="banner" id="ch-ended"><h3>סיימנו את האתגר 🌳</h3><p class="small" style="color:var(--ink-2)">מזל טוב. ימי התרגול והזרע נשארים איתך, ומכאן בוחרים איך ממשיכים.</p></div>`
    : S.challenge ? `<p class="small">המסע החדש יתחיל מחר, אחרי היום האחרון של האתגר.</p>` : ''}
  <p style="color:var(--ink-2)">אפשר לבחור מסע אישי, להצטרף למסע של הסנגהה, או גם וגם.</p>
  <div class="chips" id="g-kind"><button class="chip" data-v="personal" aria-pressed="${goalTab === 'personal'}">המסע האישי שלי</button><button class="chip" data-v="group" aria-pressed="${goalTab === 'group'}">מסע קבוצתי</button></div>
  <div class="stack" id="g-personal" ${goalTab === 'personal' ? '' : 'hidden'}>
    <div class="card"><h3>כמה ימי תרגול?</h3><div class="chips" id="g-days">${preset.map(d => `<button class="chip" data-v="${d}" aria-pressed="${d === pick.days}">${d}</button>`).join('')}<button class="chip" data-v="x" aria-pressed="${custom}">מספר אישי</button></div>
      <input type="number" id="g-days-x" min="3" max="1000" placeholder="כמה ימים מתאים לך?" value="${custom ? pick.days : ''}" ${custom ? '' : 'hidden'}></div>
    <div class="card"><h3>באיזה קצב?</h3><div class="chips" id="g-per">${[3, 4, 5, 6, 7].map(d => `<button class="chip" data-v="${d}" aria-pressed="${d === pick.per}">${d === 7 ? 'כל יום' : d + ' בשבוע'}</button>`).join('')}</div>
      <p class="small" id="g-grace"></p></div>
    <div class="card"><h3>מינימום דקות</h3><div class="chips" id="g-min">${[3, 10, 15, 30, 60].map(d => `<button class="chip" data-v="${d}" aria-pressed="${d === pick.min}">${d}</button>`).join('')}</div>
      <p class="small">גם 3 דקות של נשימה אחת נחשבות.</p></div>
    <button class="btn block" id="g-save">${cur ? 'התחלת מסע אישי חדש' : 'זה המסע שלי'}</button>
  </div>
  <div class="stack" id="g-group" ${goalTab === 'group' ? '' : 'hidden'}>${groupsHtml()}</div>
  ${S.goal ? `<button class="btn link" data-go="journey">חזרה</button>` : ''}`;
  bindGo();
  chipGroup($('#g-kind'), v => { goalTab = v; $('#g-personal').hidden = v !== 'personal'; $('#g-group').hidden = v !== 'group'; });
  const grace = () => $('#g-grace').textContent = pick.per === 7 ? 'בלי ימי מנוחה מתוכננים. גם יום שמפספסים לא מוחק כלום.' : `${7 - pick.per} ימי מנוחה בשבוע לא שוברים את הרצף.`;
  grace();
  chipGroup($('#g-days'), v => { $('#g-days-x').hidden = v !== 'x'; if (v !== 'x') pick.days = +v; else { pick.days = +$('#g-days-x').value || 0; $('#g-days-x').focus(); } });
  $('#g-days-x').oninput = e => pick.days = Math.min(1000, +e.target.value || 0);
  chipGroup($('#g-per'), v => { pick.per = +v; grace(); });
  chipGroup($('#g-min'), v => pick.min = +v);
  const add = async (row, replace) => {
    const first = !S.goal && !S.mine.length;
    if (replace) await guard(sb.from('goals').update({ status: 'stopped' }).eq('id', replace.id));
    const g = await guard(sb.from('goals').insert({ user_id: S.session.user.id, ...row }).select().single());
    setJourneys([g, S.personal, ...S.groups].filter(x => x && x !== replace && !x.completed));
    toast(g.season_id ? 'הצטרפת למסע של הסנגהה 🌱' : 'המסע האישי נשמר 🌱'); go(g.season_id && !first ? 'journey' : 'home');
    if (first) setTimeout(welcomeSheet, 900);
  };
  $('#g-save').onclick = () => {
    if (!Number.isInteger(pick.days) || pick.days < 3) return toast('בחרו מספר ימים, לפחות 3');
    const start = () => add({ days_target: pick.days, per_week: pick.per, min_minutes: pick.min, start_date: S.challenge ? addDays(S.challenge.end, 1) : today() }, cur);
    cur ? confirmSheet('להתחיל מסע אישי חדש? הספירה שלו תתחיל מהיום, והזרע לא מתאפס.', start) : start();
  };
  $$('[data-join]').forEach(b => b.onclick = async () => {
    b.disabled = true; const x = S.seasons.find(y => y.id === b.dataset.join), t = groupTarget(x);
    try { await add({ days_target: t.target, per_week: x.per_week, min_minutes: S.personal ? S.personal.min_minutes : 15, season_id: x.id, start_date: t.start }); } catch (_) { b.disabled = false; }
  });
  $$('[data-leave]').forEach(b => b.onclick = () => confirmSheet('לצאת מהמסע הקבוצתי? ימי התרגול נשמרים.', async () => {
    await guard(sb.from('goals').update({ status: 'stopped' }).eq('id', b.dataset.leave));
    setJourneys([S.personal, ...S.groups].filter(g => g && g.id !== b.dataset.leave)); VIEWS.goal();
  }));
};

// ---------- HOME ----------
VIEWS.home = async function () {
  loadPulse().then(() => current === 'home' && paintPulse()).catch(() => {});
  syncChallenge();
  const p = S.profile, g = S.goal, ch = S.challenge, done = ch ? ch.day : goalDone(), pct = Math.min(1, done / g.days_target), C2 = 2 * Math.PI * 80;
  const live = liveInfo(), pt = practicedToday(), q = quoteOfDay(), lastRec = S.recordings[0];
  const st = S.settings || {};
  view.innerHTML = `${header(`${greeting()}, ${(p.display_name || '').split(' ')[0]}`, heDate(today()))}
  ${welcomeBack() ? `<div class="banner"><h3>ברוך/ה השב/ה 🤍</h3><p class="small" style="color:var(--ink-2)">כל יום שתרגלת נשאר כאן. מתחילים מהיום, בלי חשבונות.</p></div>` : ''}
  <div class="hero home-hero"><div class="bgimg"></div>
    <span class="eyebrow">${ch ? esc(ch.title) : S.season ? esc(S.season.title) : 'המסע האישי שלי'}</span>
    <svg class="ring" viewBox="0 0 200 200" role="img" aria-label="${done} מתוך ${g.days_target}">
      <defs><clipPath id="seedclip"><circle cx="100" cy="100" r="74"/></clipPath></defs>
      <g class="seed-anim"><image href="icons/icon-512.png" x="26" y="26" width="148" height="148" clip-path="url(#seedclip)" preserveAspectRatio="xMidYMid slice"/></g>
      <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(242,234,214,.18)" stroke-width="5"/>
      <circle cx="100" cy="100" r="80" fill="none" stroke="var(--gold)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${C2}" stroke-dashoffset="${C2 * (1 - pct)}" transform="rotate(-90 100 100)"/>
    </svg>
    <div class="bignum num">${ch ? '<small>יום </small>' : ''}${done}<small> / ${g.days_target}</small></div>
    <span class="small" id="hero-sub" style="color:var(--ink-2)">${ch ? esc(challengeLine(ch)) : done >= g.days_target ? 'השלמת את היעד' : done >= g.days_target / 2 && done < g.days_target / 2 + 3 ? 'עברת את האמצע. כאן בדיוק זה הכי חשוב' : `השבוע ${thisWeekCount()} מתוך ${g.per_week}`}</span>
  </div>

  ${ch && ch.last ? `<div class="banner" id="ch-last"><h3>הגענו ליום ${ch.days_target} 🌳</h3><p class="small" style="color:var(--ink-2)">מזל טוב. אפשר כבר לבחור את המסע שיתחיל מחר.</p><button class="btn block" data-go="goal">לבחור את המסע הבא</button></div>` : ''}
  <div class="card" id="practice"></div>
  <section class="convo" id="convo" aria-label="מהשיחה בסנגהה"></section>
  ${backfillCardHtml()}
  ${otherJourneys().map(x => `<button class="card gold row" data-go="journey" style="flex-direction:row;cursor:pointer;text-align:right"><span class="grow"><span class="eyebrow">${x.season_id ? 'מסע קבוצתי' : 'מסע אישי'}</span><br>${esc(journeyName(x))}</span><b class="num">${goalDone(x)} / ${x.days_target}</b></button>`).join('')}

  <div class="card"><div class="row"><div class="grow">
    <span class="eyebrow">${live && live.now ? 'עכשיו בזום' : 'התרגול המשותף הבא'}</span>
    <h3>${live ? (live.now ? 'יושבים יחד עכשיו' : `${live.d === 0 ? 'היום' : live.d === 1 ? 'מחר' : 'יום ' + DAYNAMES[live.wd]} · ${esc(String(st.live_time || '05:30').slice(0, 5))}`) : 'אין תרגול מתוכנן'}</h3>
    <span class="small" id="live-sub">${live && !live.now ? fmtUntil(live.minutes) : ''}</span></div>
    ${st.zoom_url ? `<a class="btn ${live && live.now ? '' : 'ghost'}" id="zoom" href="${esc(st.zoom_url)}" target="_blank" rel="noopener">הצטרפות</a>` : ''}</div></div>

  ${lastRec ? `<div class="card"><span class="eyebrow">ההקלטה האחרונה</span><div class="row">
    <button class="play" data-rec="${lastRec.id}" aria-label="נגן">▶</button>
    <div class="grow"><b>${esc(lastRec.title)}</b><div class="small">${lastRec.duration_min ? lastRec.duration_min + ' דק׳ · ' : ''}${esc(lastRec.guide)}</div></div></div></div>` : ''}

  <div class="card" id="pulse"><span class="eyebrow">היום בסנגהה</span><p class="small">טוען…</p></div>

  ${q ? `<div class="card"><span class="eyebrow">משפט ליום${q.source ? ' · ' + esc(q.source) : ''}</span><p class="quote">${esc(q.text)}</p></div>` : ''}
  ${danaHtml()}`;
  bindGo(); bindBackfill(); paintPractice(); paintConvo(); loadConvo();
  if (live && live.now) { const zc = $('#zoom') && $('#zoom').closest('.card'), hero = $('.hero'); if (zc && hero) hero.after(zc); }
  const z = $('#zoom'); if (z) z.onclick = () => { markSitting(+(st.live_minutes || 60)); };
  $$('[data-rec]').forEach(b => b.onclick = () => playRecording(b.dataset.rec));
  paintPulse();
};
function paintPractice() {
  const box = $('#practice'); if (!box) return; const pt = practicedToday();
  if (pt) {
    box.innerHTML = `<div class="row"><div class="glow">✓</div><div class="grow"><h3>תרגלת היום</h3><span class="small">${{ live: 'בזום', recording: 'מהקלטה', solo: 'לבד', breath: 'נשימה אחת' }[pt.mode]} · ${pt.minutes} דק׳${pt.word ? ' · "' + esc(pt.word) + '"' : ''}</span></div>
      <button class="btn link" id="pr-edit">עריכה</button></div>`;
    $('#pr-edit').onclick = () => practiceSheet(pt);
    return;
  }
  box.innerHTML = `<h3>תרגלת היום?</h3><p class="small">${S.challenge ? 'בזום, מהקלטה או לבד. גם מעט נחשב.' : `גם מעט נחשב. המינימום שבחרת: ${S.goal.min_minutes} דק׳`}</p>
    <div class="row wrap"><button class="btn grow" id="pr-yes">כן, תרגלתי</button><button class="btn ghost" id="pr-breath">🌬 נשימה אחת · 3 דק׳</button></div>`;
  $('#pr-yes').onclick = () => practiceSheet();
  $('#pr-breath').onclick = breathing;
}
function practiceSheet(existing) {
  const v = { mode: (existing && existing.mode) || (liveInfo() && liveInfo().now ? 'live' : 'solo'), min: (existing && existing.minutes) || Math.max(S.goal.min_minutes, 15) };
  openSheet(`<h2>איך תרגלת?</h2>
    <div class="chips" id="ps-mode">${[['live', 'בזום'], ['recording', 'מהקלטה'], ['solo', 'לבד'], ['breath', 'נשימה אחת']].map(([k, t]) => `<button class="chip" data-v="${k}" aria-pressed="${k === v.mode}">${t}</button>`).join('')}</div>
    <label class="field">כמה דקות<input type="number" id="ps-min" min="1" max="300" value="${v.min}"></label>
    <label class="field">מילה אחת על התרגול (רשות, אנונימי)<input type="text" id="ps-word" maxlength="24" value="${esc((existing && existing.word) || '')}" placeholder="שקט, עייפות, הודיה…"></label>
    <p class="small">המילה מצטרפת לענן בלי שם. הענן מוצג רק כשיש לפחות 3 מילים.</p>
    <button class="btn block" id="ps-save">${existing ? 'עדכון' : 'נרשם 🌱'}</button>`, () => {
    chipGroup($('#ps-mode'), m => v.mode = m);
    $('#ps-save').onclick = async () => {
      await logPractice(v.mode, $('#ps-min').value, $('#ps-word').value); closeSheet();
      const t = S.mine.length, grew = !existing && t > 1 && stageOf(t) > stageOf(t - 1);
      if (current === 'home') VIEWS.home();
      if (grew) milestoneSheet(stageOf(t));
      else if (!existing) toast('נרשם. יום טוב 🤍');
    };
  });
}
function milestoneSheet(si) {
  const st = STAGES[si];
  openSheet(`<div class="center stack"><div style="margin:0 auto;width:90px">${stageSvg(si)}</div><h2>הזרע שלך הפך ל${st.n}</h2>
    <p class="small" style="color:var(--ink-2)">${st.at} ימי תרגול. רוצה לשתף את הסנגהה ברגע הזה?</p>
    <button class="btn block" id="ms-share">שיתוף בסנגהה</button><button class="btn link" id="ms-no">רק לעצמי</button></div>`, p => {
    $('#ms-no', p).onclick = closeSheet;
    $('#ms-share', p).onclick = async () => {
      await guard(sb.from('posts').insert({ user_id: S.session.user.id, kind: 'milestone', body: `${st.at} ימי תרגול. הזרע שלי הפך ל${st.n} 🌱` }));
      closeSheet(); toast('שותף. הסנגהה תשמח איתך 🤍'); };
  });
}
function breathing() {
  const el = document.createElement('div'); el.className = 'breath';
  el.innerHTML = `<p class="eyebrow">נשימה אחת</p><div class="orb"></div><p id="bt-say" style="font-family:var(--display);font-size:22px">שאיפה</p><div class="time num" id="bt">3:00</div><button class="btn ghost" id="bt-stop">סיום</button>`;
  document.body.appendChild(el);
  let left = 180, phase = 0; const orb = $('.orb', el), say = $('#bt-say', el);
  let wake; try { navigator.wakeLock && navigator.wakeLock.request('screen').then(w => wake = w).catch(() => {}); } catch (_) {}
  bell();
  const cycle = () => { phase = 1 - phase; orb.classList.toggle('in', !!phase); say.textContent = phase ? 'שאיפה' : 'נשיפה'; };
  cycle(); const ci = setInterval(cycle, 4000);
  const ti = setInterval(() => { left--; $('#bt', el).textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; if (left <= 0) finish(true); }, 1000);
  async function finish(full) {
    clearInterval(ci); clearInterval(ti); try { wake && wake.release(); } catch (_) {}
    if (full) { bell(); if (!practicedToday()) { await logPractice('breath', 3, null); toast('נשימה אחת נרשמה כיום תרגול 🌱'); } }
    el.remove(); if (current === 'home') VIEWS.home();
  }
  $('#bt-stop', el).onclick = () => { finish(false); toast('נשימה אחת נרשמת בסוף 3 הדקות. אפשר לנסות שוב'); };
}
let actx;
function bell() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const t = actx.currentTime;
    [528, 792, 1056].forEach((f, i) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25 / (i + 1), t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 5);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 5.2); });
  } catch (_) {}
}
function paintPulse() {
  const box = $('#pulse'); if (!box || !S.pulse) return; const P = S.pulse;
  const words = {}; (P.words || []).forEach(w => words[w] = (words[w] || 0) + 1);
  const ws = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 18);
  box.innerHTML = `<span class="eyebrow">היום בסנגהה</span>
    <div class="together"><div class="glow num">${P.today}</div><div><h3>${P.today === 0 ? 'עוד אף אחד לא סימן היום' : P.today === 1 ? 'אחד/ת תרגל/ה היום' : `${P.today} תרגלו היום`}</h3><span class="small">${P.sitting >= 3 ? `🔥 ${P.sitting} יושבים עכשיו` : `מתוך ${P.members} בסנגהה`}</span></div></div>
    ${ws.length ? `<div class="cloud">${ws.map(([w, n]) => `<span style="font-size:${15 + Math.min(n, 5) * 4}px;opacity:${.6 + Math.min(n, 4) * .1}">${esc(w)}</span>`).join('')}</div>` : ''}`;
}

// ---------- marking past challenge days ----------
// A day marked in retrospect is stored with 0 minutes. A normal log always has at least 1,
// so the two never mix, and only retrospective marks can be removed here.
const isBackfill = p => Number(p.minutes) === 0;
const pastChallengeDays = () => S.challenge ? S.challenge.dates.filter(d => d < today()) : [];
const backfillSeenKey = () => `sangha-backfill-seen-${S.session.user.id}-${S.challenge.start_date}`;
function backfillCardHtml() {
  if (!S.challenge || S.mine.some(isBackfill)) return '';
  const have = new Set(S.mine.map(p => p.day));
  if (pastChallengeDays().every(d => have.has(d))) return '';
  try { if (localStorage.getItem(backfillSeenKey())) return ''; } catch (_) {}
  return `<div class="card gold" id="bf-card"><h3>תרגלת לפני האפליקציה?</h3>
    <p class="small">אפשר לסמן את ימי האתגר שכבר תרגלת, והזרע יגדל בהתאם.</p>
    <div class="row wrap"><button class="btn grow" data-backfill>סימון ימים קודמים</button><button class="btn link" id="bf-later">לא עכשיו</button></div></div>`;
}
function bindBackfill() {
  $$('[data-backfill]', view).forEach(b => b.onclick = backfillSheet);
  const later = $('#bf-later', view);
  if (later) later.onclick = () => {
    try { localStorage.setItem(backfillSeenKey(), '1'); } catch (_) {}
    $('#bf-card').remove(); toast('אפשר לסמן בכל זמן במסך "המסע"');
  };
}
function backfillSheet() {
  syncChallenge();
  if (!S.challenge) return;
  const dates = pastChallengeDays();
  const logged = new Set(S.mine.filter(p => !isBackfill(p)).map(p => p.day));
  const before = new Set(S.mine.filter(isBackfill).map(p => p.day).filter(d => dates.includes(d)));
  const picked = new Set(before), open = dates.filter(d => !logged.has(d));
  const changed = () => picked.size !== before.size || [...picked].some(d => !before.has(d));
  openSheet(`<h2>באילו ימים תרגלת?</h2>
    <p class="small">לוחצים על כל יום שתרגלת, בזום, מהקלטה או לבד. אפשר גם לסמן הכל ולהוריד את מה שפספסת.</p>
    <div class="row wrap"><button class="btn ghost small grow" id="bf-all">סימון הכל</button><button class="btn ghost small grow" id="bf-none">ניקוי הסימון</button></div>
    <div class="bf-grid" id="bf-grid">${['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳'].map(d => `<span class="bf-head">${d}</span>`).join('')}${dates.map((d, i) =>
      `<button class="bf-day" data-day="${d}" ${i ? '' : `style="grid-column-start:${new Date(d + 'T12:00:00Z').getUTCDay() + 1}"`} ${logged.has(d) ? 'disabled' : ''} aria-pressed="false" aria-label="יום ${i + 1}, ${heDate(d)}"><b class="num">${i + 1}</b><span>${shortDate(d)}</span></button>`).join('')}</div>
    ${logged.size && dates.some(d => logged.has(d)) ? '<p class="small">ימים עם ✓ כבר נרשמו באפליקציה.</p>' : ''}
    <div class="bf-foot"><span class="small" id="bf-count"></span>
      <div class="row"><button class="btn grow" id="bf-save">שמירה</button><button class="btn ghost" id="bf-cancel">ביטול</button></div></div>`, panel => {
    const paint = () => {
      $$('.bf-day', panel).forEach(b => b.setAttribute('aria-pressed', logged.has(b.dataset.day) || picked.has(b.dataset.day)));
      const n = dates.filter(d => logged.has(d) || picked.has(d)).length;
      $('#bf-count', panel).textContent = `סומנו ${n} מתוך ${dates.length} הימים שעברו`;
      $('#bf-save', panel).disabled = !changed();
    };
    $('#bf-grid', panel).onclick = e => {
      const b = e.target.closest('.bf-day'); if (!b || b.disabled) return;
      const d = b.dataset.day; if (picked.has(d)) picked.delete(d); else picked.add(d);
      paint();
    };
    $('#bf-all', panel).onclick = () => { open.forEach(d => picked.add(d)); paint(); };
    $('#bf-none', panel).onclick = () => { picked.clear(); paint(); };
    $('#bf-cancel', panel).onclick = closeSheet;
    // a stray tap on the backdrop must not lose forty taps
    sheet.onclick = e => { if (e.target !== sheet) return; if (changed()) toast('יש ללחוץ על שמירה או ביטול'); else closeSheet(); };
    $('#bf-save', panel).onclick = async () => {
      if (!navigator.onLine) return toast('צריך חיבור לרשת כדי לשמור ימים קודמים');
      const btn = $('#bf-save', panel), uid = S.session.user.id;
      const add = [...picked].filter(d => !before.has(d)).sort(), del = [...before].filter(d => !picked.has(d)).sort();
      btn.disabled = true; btn.textContent = 'שומר…';
      try {
        if (add.length) await guard(sb.from('practices').upsert(add.map(day => ({ user_id: uid, day, mode: 'solo', minutes: 0, word: null })), { onConflict: 'user_id,day', ignoreDuplicates: true }));
        if (del.length) await guard(sb.from('practices').delete().eq('user_id', uid).eq('minutes', 0).in('day', del));
        S.mine = [...S.mine.filter(p => !del.includes(p.day)),
          ...add.filter(d => !S.mine.some(p => p.day === d)).map(day => ({ day, mode: 'solo', minutes: 0, word: null }))].sort((x, y) => y.day.localeCompare(x.day));
        closeSheet();
        toast(S.mine.length ? `נשמר. הזרע שלך: ${STAGES[stageOf(S.mine.length)].n} 🌱` : 'הסימון עודכן');
        if (current === 'home' || current === 'journey') VIEWS[current]();
      } catch (_) { btn.disabled = false; btn.textContent = 'שמירה'; }
    };
    paint();
  });
}

// ---------- the sangha conversation, on home ----------
// Two quiet lines at most: a fresh pinned message from the facilitator, then the latest activity.
function convoPick(posts) {
  const at = p => new Date(p.last_activity || p.created_at).getTime();
  const pins = posts.filter(p => p.pinned).sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
  const rest = posts.filter(p => !p.pinned).sort((x, y) => at(y) - at(x));
  const pinFirst = pins.length && (Date.now() - new Date(pins[0].created_at) < 7 * 864e5 || !rest.length);
  return (pinFirst ? [pins[0], ...rest] : rest).slice(0, 2);
}
function convoRow(p) {
  const who = p.anonymous ? 'חבר/ת סנגהה' : p.author, n = Number(p.comments) || 0;
  return `<button class="cv-row" data-convo="${p.id}">
    <span class="avatar" style="background:${p.anonymous ? 'var(--line)' : esc(p.color || '#E6C068')}">${p.anonymous ? '·' : esc(initials(p.author))}</span>
    <span class="grow cv-text"><span class="cv-meta"><b class="${p.is_staff ? 'cv-staff' : ''}">${esc(who)}</b><span>${n === 1 ? 'תגובה אחת' : n ? `${n} תגובות` : ago(p.created_at)}</span></span>
      <span class="cv-body" dir="auto">${esc(String(p.body || '').replace(/\s+/g, ' ').slice(0, 160))}</span></span></button>`;
}
function paintConvo() {
  const box = $('#convo'); if (!box) return;
  const list = S.convo, rows = list ? convoPick(list) : null;
  box.innerHTML = `<div class="cv-head"><span class="eyebrow">מהשיחה בסנגהה</span><button class="btn link" id="cv-all">לכל השיחה</button></div>
    ${!rows ? `<p class="small cv-wait">${S.convoFailed ? 'השיחה לא נטענה. אפשר לפתוח אותה דרך "הסנגהה".' : 'טוען…'}</p>`
      : rows.length ? rows.map(convoRow).join('') : '<button class="cv-row cv-empty" id="cv-first">עוד שקט כאן. אפשר לפתוח את השיחה</button>'}`;
  $('#cv-all', box).onclick = () => go('sangha');
  const first = $('#cv-first', box); if (first) first.onclick = () => composeSheet();
  $$('[data-convo]', box).forEach(b => b.onclick = () => threadSheet(b.dataset.convo));
}
async function loadConvo() {
  if (!S.session) return;
  try {
    const { data, error } = await sb.rpc('feed', { p_limit: 12, p_mode: 'active' });
    if (error) throw error;
    S.convo = data || []; S.convoFailed = false;
  } catch (e) { console.error(e); S.convoFailed = true; }
  if (current === 'home') paintConvo();
}
setInterval(() => { if (current === 'home' && S.session && sheet.hidden && document.visibilityState === 'visible') loadConvo(); }, 60000);

// ---------- JOURNEY ----------
VIEWS.journey = async function () {
  syncChallenge(); if (!S.goal) return go('goal');
  if (S.challenge) return challengeJourney();
  const g = S.goal, done = goalDone(), total = S.mine.length, si = stageOf(total), next = STAGES[si + 1];
  const dots = Array.from({ length: g.days_target }, (_, i) => `<span class="dot ${i < done ? 'on' : ''}" title="${i + 1}"></span>`).join('');
  const half = Math.ceil(g.days_target / 2);
  view.innerHTML = `${header('המסע שלי', S.season ? S.season.title : 'המסע האישי שלי')}
  <div class="stats"><div class="stat"><b class="num">${done}</b><span class="small">מתוך ${g.days_target}</span></div>
    <div class="stat"><b class="num">${weeksStreak()}</b><span class="small">שבועות בקצב</span></div>
    <div class="stat"><b class="num">${total}</b><span class="small">ימי תרגול בסך הכל</span></div></div>
  <div class="card"><div class="row"><h3 class="grow">${g.days_target} ימים · ${g.per_week === 7 ? 'כל יום' : g.per_week + ' בשבוע'} · ${g.min_minutes} דק׳</h3><button class="btn link" data-journey="${S.personal ? 'personal' : 'group'}">שינוי</button></div>
    <div class="dots">${dots}</div>
    <span class="small">${done < half ? `האמצע ביום ${half}. שם המוטיבציה נוטה לרדת, וזה טבעי.` : done < g.days_target ? 'עברת את האמצע. מכאן זה נהיה שלך.' : 'השלמת את היעד 🌳'}</span></div>
  ${journeyCards()}
  <div class="row wrap">${S.personal ? '' : '<button class="btn ghost grow" data-journey="personal">הוספת מסע אישי</button>'}<button class="btn ghost grow" data-journey="group">מסע קבוצתי</button></div>
  ${seedCard()}
  <div class="card soft"><h3>יום שפספסת לא מוחק כלום</h3><p class="small" style="line-height:1.7">כל יום שישבת נשאר כאן. ${g.per_week < 7 ? `${7 - g.per_week} ימי מנוחה בשבוע הם חלק מהתוכנית.` : ''} חמלה היא חלק מהתרגול.</p></div>
  ${recentCard()}`;
  bindGo(); bindJourney();
};

function journeyCards() {
  return otherJourneys().map(x => `<div class="card gold"><span class="eyebrow">${x.season_id ? 'מסע קבוצתי' : 'מסע אישי'}</span><div class="row"><h3 class="grow">${esc(journeyName(x))}</h3><b class="num">${goalDone(x)} / ${x.days_target}</b></div><div class="progress"><i style="width:${Math.min(100, goalDone(x) / x.days_target * 100)}%"></i></div></div>`).join('');
}
function seedCard() {
  const total = S.mine.length, si = stageOf(total), next = STAGES[si + 1];
  return `<div class="card"><span class="eyebrow">הזרע שלך</span>
    <div class="stages">${STAGES.map((s, i) => `<div class="${i <= si ? 'reached' : ''} ${i === si ? 'cur' : ''}">${stageSvg(i)}<span>${s.n}</span></div>`).join('')}</div>
    <p class="small">${next ? `עוד ${next.at - total} ימי תרגול עד ${next.n}. הצמיחה לא מתאפסת בין יעדים.` : 'עץ פורח. כל יום ממשיך להוסיף.'}</p></div>`;
}
function recentCard() {
  return `${S.mine.length ? `<div class="card"><span class="eyebrow">ימים אחרונים</span>${S.mine.slice(0, 7).map(p => `<div class="row"><span class="grow">${heDate(p.day)}</span><span class="small">${isBackfill(p) ? 'סומן בדיעבד' : `${{ live: 'זום', recording: 'הקלטה', solo: 'לבד', breath: 'נשימה' }[p.mode]} · ${p.minutes} דק׳`}${p.word ? ' · ' + esc(p.word) : ''}</span></div>`).join('')}</div>` : ''}`;
}
function challengeJourney() {
  const ch = S.challenge, mine = new Set(S.mine.map(p => p.day)), t = today();
  view.innerHTML = `${header('המסע', ch.title)}
  <div class="stats"><div class="stat"><b class="num">${ch.day}</b><span class="small">מתוך ${ch.days_target}</span></div>
    <div class="stat"><b class="num">${ch.days_target - ch.day}</b><span class="small">ימים לסיום</span></div>
    <div class="stat"><b class="num" id="ch-marked">${ch.dates.filter(d => mine.has(d)).length}</b><span class="small">ימים שסימנתי</span></div></div>
  <div class="card"><h3>${esc(challengeLine(ch))}</h3>
    <div class="dots">${ch.dates.map((d, i) => `<span class="dot ${mine.has(d) ? 'on' : d < t ? 'passed' : ''} ${d === t ? 'now' : ''}" title="יום ${i + 1} · ${shortDate(d)}"></span>`).join('')}</div>
    <span class="small">זהב מלא הוא יום שסימנת. זהב עדין הוא יום שעבר ולא סומן.</span>
    ${ch.day > 1 ? '<button class="btn block" data-backfill>סימון ימים שכבר תרגלתי</button>' : ''}</div>
  ${ch.last ? '<button class="btn block" data-journey="personal">לבחור את המסע הבא</button>' : ''}
  ${journeyCards()}
  ${seedCard()}
  <div class="card soft"><h3>יום שפספסת לא מוחק כלום</h3><p class="small" style="line-height:1.7">כל יום שישבת נשאר איתך. שישי ושבת לא נספרים באתגר. חמלה היא חלק מהתרגול.</p></div>
  ${recentCard()}`;
  bindGo(); bindJourney(); bindBackfill();
  if (ch.day > 1) { const dots = $('.dots', view); dots.style.cursor = 'pointer'; dots.onclick = backfillSheet; }
}
function bindJourney(root = view) { $$('[data-journey]', root).forEach(b => b.onclick = () => { goalTab = b.dataset.journey; go('goal'); }); }

// ---------- LIBRARY ----------
let libFilter = { topic: 'הכל', q: '' }, libTab = 'rec', readKind = 'all';
const RKIND = { sutta: 'דרשות הבודהה', text: 'קטעים', link: 'קישורים', book: 'ספרים' };
const libTabs = () => `<div class="chips" id="lib-tab">${[['rec', 'הקלטות ותרגול'], ['read', 'מומלץ לקריאה']].map(([k, t]) => `<button class="chip" data-v="${k}" aria-pressed="${libTab === k}">${t}</button>`).join('')}</div>`;
function bindLibTabs() { chipGroup($('#lib-tab'), v => { libTab = v; VIEWS.library(); }); }
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';
function readingHtml(x) {
  const u = safeUrl(x.url), long = (x.body || '').length > 280;
  const body = `<p class="reading-body" dir="auto">${esc(x.body)}</p>`;
  return `<article class="card" data-reading="${x.id}"><span class="eyebrow">${RKIND[x.kind] || ''}</span>
    <h3 dir="auto">${esc(x.title)}</h3>${x.author ? `<span class="small" dir="auto">${esc(x.author)}</span>` : ''}
    ${x.body ? (long ? `<p class="reading-body" dir="auto">${esc(x.body.slice(0, 180))}…</p><details class="reading-more"><summary>לקריאת הקטע המלא</summary>${body}</details>` : body) : ''}
    ${u || isStaff() ? `<div class="row wrap">${u ? `<a class="icon-btn" style="text-decoration:none" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${x.kind === 'book' ? 'לפרטים על הספר' : 'לפתיחת הקישור'}</a>` : ''}<span class="grow"></span>
      ${isStaff() ? '<button class="btn link" data-redit>עריכה</button><button class="btn link" data-rdel>מחיקה</button>' : ''}</div>` : ''}</article>`;
}
async function readingView() {
  view.innerHTML = `${header('ספרייה')}${libTabs()}<div class="card"><p class="small">טוען…</p></div>`; bindGo(); bindLibTabs();
  const all = (await guard(sb.from('readings').select('*').order('created_at', { ascending: false }))) || [];
  if (current !== 'library' || libTab !== 'read') return;
  view.innerHTML = `${header('ספרייה')}${libTabs()}
  ${isStaff() ? '<button class="btn block" id="rd-add">הוספת קטע, קישור או ספר</button>' : ''}
  <div class="chips scroll" id="rd-kind">${[['all', 'הכל'], ...Object.entries(RKIND)].map(([k, t]) => `<button class="chip" data-v="${k}" aria-pressed="${readKind === k}">${t}</button>`).join('')}</div>
  <div class="stack" id="rd-list"></div>`;
  bindGo(); bindLibTabs();
  const paint = () => {
    const list = all.filter(x => readKind === 'all' || x.kind === readKind);
    $('#rd-list').innerHTML = list.length ? list.map(readingHtml).join('')
      : `<div class="card soft"><p class="small">${all.length ? 'עוד אין המלצות בנושא הזה.' : 'כאן יצטברו הקטעים, הקישורים והספרים שעדי מביאה לסנגהה.'}</p></div>`;
    $$('[data-reading]').forEach(el => {
      const x = all.find(y => y.id === el.dataset.reading), e = $('[data-redit]', el), d = $('[data-rdel]', el), more = $('.reading-more', el);
      if (more) more.ontoggle = () => { more.previousElementSibling.hidden = more.open; };
      if (e) e.onclick = () => readingSheet(x);
      if (d) d.onclick = () => confirmSheet('למחוק את ההמלצה?', async () => { await guard(sb.from('readings').delete().eq('id', x.id)); readingView(); });
    });
  };
  paint();
  chipGroup($('#rd-kind'), v => { readKind = v; paint(); });
  if ($('#rd-add')) $('#rd-add').onclick = () => readingSheet();
}
function readingSheet(x) {
  let kind = x ? x.kind : readKind === 'all' ? 'sutta' : readKind;
  openSheet(`<h2>${x ? 'עריכת המלצה' : 'המלצה חדשה לקריאה'}</h2>
    <div class="chips" id="rs-kind">${Object.entries(RKIND).map(([k, t]) => `<button class="chip" data-v="${k}" aria-pressed="${k === kind}">${t}</button>`).join('')}</div>
    <label class="field">כותרת<input type="text" id="rs-title" maxlength="160" value="${esc(x ? x.title : '')}"></label>
    <label class="field">מקור / מחבר (רשות)<input type="text" id="rs-author" maxlength="160" value="${esc(x ? x.author : '')}"></label>
    <label class="field">הטקסט, או כמה מילים על ההמלצה<textarea id="rs-body" maxlength="30000" rows="7">${esc(x ? x.body : '')}</textarea></label>
    <label class="field">קישור (רשות)<input type="url" id="rs-url" dir="ltr" value="${esc(x && x.url || '')}"></label>
    <button class="btn block" id="rs-save">${x ? 'שמירה' : 'פרסום לספרייה'}</button>`, () => {
    chipGroup($('#rs-kind'), v => kind = v);
    $('#rs-save').onclick = async () => {
      const title = $('#rs-title').value.trim(), body = $('#rs-body').value.trim(); let url = $('#rs-url').value.trim();
      if (!title) return toast('צריך כותרת');
      if (url && !safeUrl(url)) url = 'https://' + url;
      if (url && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(url)) return toast('הקישור לא תקין');
      if (!body && !url && kind !== 'book') return toast('הוסיפו טקסט או קישור');
      const row = { kind, title, body, url: url || null, author: $('#rs-author').value.trim() }, btn = $('#rs-save'); btn.disabled = true;
      try {
        await guard(x ? sb.from('readings').update(row).eq('id', x.id) : sb.from('readings').insert(row));
        closeSheet(); toast('נשמר בספרייה'); readKind = 'all'; libTab = 'read';
        if (current === 'library') readingView(); else go('library');
      } catch (_) { btn.disabled = false; }
    };
  });
}
VIEWS.library = async function () {
  if (libTab === 'read') return readingView();
  view.innerHTML = `${header('ספרייה')}${libTabs()}<div class="card"><p class="small">טוען הקלטות…</p></div>`; bindGo(); bindLibTabs();
  await loadRecordings();
  const { data: faq } = await sb.rpc('faq');
  if (current !== 'library' || libTab !== 'rec') return;
  const topics = ['הכל', ...new Set(S.recordings.map(r => r.topic))];
  const heard = S.recordings.filter(r => S.listens[r.id] && S.listens[r.id].completed).length;
  view.innerHTML = `${header('ספרייה')}${libTabs()}
  ${S.recordings.length ? `<div class="card"><div class="row"><span class="grow">הקשבת ל־<b class="num">${heard}</b> מתוך <b class="num">${S.recordings.length}</b> הקלטות</span></div><div class="progress"><i style="width:${S.recordings.length ? heard / S.recordings.length * 100 : 0}%"></i></div></div>` : ''}
  <input type="text" id="lib-q" placeholder="חיפוש לפי נושא, מנחה או מילה" value="${esc(libFilter.q)}" aria-label="חיפוש">
  <div class="chips scroll" id="lib-t">${topics.map(t => `<button class="chip" data-v="${esc(t)}" aria-pressed="${t === libFilter.topic}">${esc(t)}</button>`).join('')}</div>
  <div class="card" style="gap:0" id="lib-list"></div>
  <div class="card"><h3>טיימר שקט</h3><span class="small">פעמון בהתחלה ובסוף, בלי קולות באמצע</span>
    <div class="chips" id="tm">${[5, 15, 30, 45, 60].map(m => `<button class="chip" data-v="${m}" aria-pressed="${m === 15}">${m}</button>`).join('')}</div>
    <button class="btn block" id="tm-go">התחלה · 15 דק׳</button></div>
  <div class="card"><div class="row"><h3 class="grow">שאלות ותשובות</h3><button class="btn small" id="ask">שאלה למנחה</button></div>
    ${(faq || []).length ? (faq || []).map(f => `<details class="faq"><summary>${esc(f.q)} <span class="tag">${esc(f.topic)}</span></summary><p>${esc(f.a)}</p></details>`).join('') : '<p class="small">התשובות של עדי יצטברו כאן לפי נושא.</p>'}</div>`;
  bindGo(); bindLibTabs();
  const paint = () => {
    const q = libFilter.q.trim(); const list = S.recordings.filter(r => (libFilter.topic === 'הכל' || r.topic === libFilter.topic) && (!q || (r.title + r.topic + r.guide + (r.summary || '')).includes(q)));
    $('#lib-list').innerHTML = list.length ? list.map(r => { const L = S.listens[r.id];
      return `<div class="track"><button class="play ${S.playing && S.playing.id === r.id ? 'on' : ''}" data-rec="${r.id}" aria-label="נגן">${S.playing && S.playing.id === r.id ? '❚❚' : '▶'}</button>
      <div class="grow"><b>${esc(r.title)}</b><div class="small">${r.duration_min ? r.duration_min + ' דק׳ · ' : ''}${esc(r.guide)} · <span class="tag">${esc(r.topic)}</span> ${L && L.completed ? '<span class="heard">✓ הקשבתי</span>' : L && L.position_sec > 30 ? `<span class="small">הגעת ל־${Math.round(L.position_sec / 60)} דק׳</span>` : ''}</div>
      ${r.summary ? `<details><summary class="small" style="cursor:pointer">מה תרגלנו</summary><p class="small" style="color:var(--ink-2);white-space:pre-wrap">${esc(r.summary)}</p></details>` : ''}</div></div>`; }).join('')
      : `<p class="small" style="padding:12px 0">${S.recordings.length ? 'לא נמצאו הקלטות' : 'ההקלטות יעלו לכאן בקרוב.'}</p>`;
    $$('[data-rec]', $('#lib-list')).forEach(b => b.onclick = () => playRecording(b.dataset.rec));
  };
  paint();
  $('#lib-q').oninput = e => { libFilter.q = e.target.value; paint(); };
  chipGroup($('#lib-t'), t => { libFilter.topic = t; paint(); });
  let tmMin = 15; chipGroup($('#tm'), m => { tmMin = +m; $('#tm-go').textContent = `התחלה · ${m} דק׳`; });
  $('#tm-go').onclick = () => silentTimer(tmMin);
  $('#ask').onclick = askSheet;
};
function silentTimer(min) {
  const el = document.createElement('div'); el.className = 'breath';
  el.innerHTML = `<p class="eyebrow">טיימר שקט · ${min} דק׳</p><div class="orb" style="transform:scale(.8);opacity:.85"></div><div class="time num" id="st">${min}:00</div><button class="btn ghost" id="st-stop">סיום</button>`;
  document.body.appendChild(el); bell();
  let wake; try { navigator.wakeLock && navigator.wakeLock.request('screen').then(w => wake = w).catch(() => {}); } catch (_) {}
  const end = Date.now() + min * 6e4;
  const ti = setInterval(() => { const l = Math.max(0, Math.round((end - Date.now()) / 1000)); $('#st', el).textContent = `${Math.floor(l / 60)}:${String(l % 60).padStart(2, '0')}`; if (!l) done(true); }, 1000);
  async function done(full) {
    clearInterval(ti); try { wake && wake.release(); } catch (_) {} el.remove();
    const sat = Math.round((min * 6e4 - Math.max(0, end - Date.now())) / 6e4);
    if (full) bell();
    if (sat >= 1 && !practicedToday()) { await logPractice('solo', sat, null); toast(`${sat} דק׳ נרשמו כתרגול 🌱`); }
  }
  $('#st-stop', el).onclick = () => done(false);
}
function askSheet() {
  openSheet(`<h2>שאלה למנחה</h2><p class="small">התשובה תגיע אליך כאן, ואם עדי תבחר, היא תצטרף לשאלות ותשובות של כולם.</p>
    <textarea id="aq" placeholder="על נשימה, ישיבה, מנטרה, מה שעולה…"></textarea>
    <label class="check"><input type="checkbox" id="aq-anon" checked> לשאול בעילום שם</label>
    <button class="btn block" id="aq-send">שליחה</button>
    <div id="my-q"></div>`, async () => {
    const { data } = await sb.from('questions').select('*').eq('user_id', S.session.user.id).order('created_at', { ascending: false }).limit(10);
    $('#my-q').innerHTML = (data || []).length ? `<span class="eyebrow">השאלות שלי</span>` + data.map(q => `<div class="card soft"><p>${esc(q.body)}</p>${q.answer ? `<p style="color:var(--gold-soft);white-space:pre-wrap">${esc(q.answer)}</p>` : '<span class="small">ממתינה לתשובה</span>'}</div>`).join('') : '';
    $('#aq-send').onclick = async () => { const body = $('#aq').value.trim(); if (body.length < 3) return;
      await guard(sb.from('questions').insert({ user_id: S.session.user.id, body, anonymous: $('#aq-anon').checked })); closeSheet(); toast('השאלה נשלחה לעדי'); };
  });
}

// ---------- PLAYER ----------
const audio = new Audio(); audio.preload = 'metadata';
let saveT = 0;
async function playRecording(id) {
  if (!S.recordings.length) await loadRecordings();
  const r = S.recordings.find(x => x.id === id); if (!r) return;
  if (S.playing && S.playing.id === id) { audio.paused ? audio.play() : audio.pause(); return paintPlayer(); }
  if (!r.audio_path) return toast('הקובץ של ההקלטה עוד לא עלה');
  let src = r.audio_path;
  if (!/^https?:/.test(src)) { const { data, error } = await sb.storage.from('audio').createSignedUrl(src, 6 * 3600); if (error) return toast('לא הצלחנו לטעון את ההקלטה'); src = data.signedUrl; }
  S.playing = r; audio.src = src;
  const L = S.listens[id]; if (L && L.position_sec > 30 && !L.completed) audio.currentTime = L.position_sec;
  audio.play().catch(() => {}); paintPlayer();
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: r.title, artist: r.guide, album: 'סנגהה', artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
    navigator.mediaSession.setActionHandler('seekbackward', () => audio.currentTime -= 15);
    navigator.mediaSession.setActionHandler('seekforward', () => audio.currentTime += 15);
  }
}
function paintPlayer() {
  const r = S.playing; if (!r) { playerEl.hidden = true; return; }
  playerEl.hidden = false;
  playerEl.innerHTML = `<div class="card"><button class="play on" id="pl-pp" aria-label="${audio.paused ? 'נגן' : 'השהה'}">${audio.paused ? '▶' : '❚❚'}</button>
    <div class="grow"><b style="font-size:14px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.title)}</b>
    <input type="range" id="pl-seek" min="0" max="1000" value="0" aria-label="מיקום"></div>
    <span class="small num" id="pl-t">0:00</span><button class="icon-btn" id="pl-x" aria-label="סגירה">✕</button></div>`;
  $('#pl-pp').onclick = () => { audio.paused ? audio.play() : audio.pause(); };
  $('#pl-seek').oninput = e => { if (audio.duration) audio.currentTime = e.target.value / 1000 * audio.duration; };
  $('#pl-x').onclick = () => { audio.pause(); saveListen(); S.playing = null; paintPlayer(); refreshPlayButtons(); };
  refreshPlayButtons();
}
function refreshPlayButtons() { $$('[data-rec]').forEach(b => { const on = S.playing && S.playing.id === b.dataset.rec && !audio.paused; b.classList.toggle('on', !!on); b.textContent = on ? '❚❚' : '▶'; }); }
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
audio.addEventListener('play', () => { const b = $('#pl-pp'); if (b) b.textContent = '❚❚'; refreshPlayButtons(); });
audio.addEventListener('pause', () => { const b = $('#pl-pp'); if (b) b.textContent = '▶'; refreshPlayButtons(); saveListen(); });
audio.addEventListener('timeupdate', () => {
  const s = $('#pl-seek'), t = $('#pl-t'); if (s && audio.duration) s.value = audio.currentTime / audio.duration * 1000; if (t) t.textContent = fmt(audio.currentTime);
  if (Date.now() - saveT > 15000) saveListen();
});
audio.addEventListener('ended', () => saveListen(true));
async function saveListen(end) {
  if (!S.playing || !S.session) return; saveT = Date.now();
  const completed = end || (audio.duration && audio.currentTime / audio.duration > 0.9);
  const row = { user_id: S.session.user.id, recording_id: S.playing.id, position_sec: Math.floor(audio.currentTime || 0), completed: !!(completed || (S.listens[S.playing.id] || {}).completed), updated_at: new Date().toISOString() };
  S.listens[S.playing.id] = row; sb.from('listens').upsert(row).then(() => {});
}

// ---------- SANGHA ----------
let feedMode = 'active', sanghaTimer = null;
VIEWS.sangha = async function (quiet) {
  if (!quiet) { view.innerHTML = `${header('הסנגהה')}<div class="card" id="pulse"><p class="small">טוען…</p></div><div id="sg-rest"></div>`; bindGo(); }
  const nowIso = new Date(Date.now() - 3 * 3600e3).toISOString();
  const [_, feed, ev, rs, mem] = await Promise.all([loadPulse(), sb.rpc('feed', { p_limit: 60, p_mode: feedMode }),
    sb.from('events').select('*').gte('starts_at', nowIso).order('starts_at').limit(5),
    sb.from('rsvps').select('event_id').eq('user_id', S.session.user.id), sb.rpc('members')]);
  if (current !== 'sangha') return;
  paintPulse();
  S.members = mem.data || [];
  const posts = feed.data || [], pinned = posts.filter(p => p.pinned), rest = posts.filter(p => !p.pinned);
  const mine = new Set((rs.data || []).map(r => r.event_id));
  const wa = S.settings && S.settings.whatsapp_url;
  const faces = S.members.slice(-7).map(m => `<span class="avatar" style="background:${esc(m.color)}">${esc(initials(m.name))}</span>`).join('');
  $('#sg-rest').innerHTML = `<div class="stack">
  <div class="row wrap">${wa ? `<a class="wa grow" href="${esc(wa)}" target="_blank" rel="noopener">💬 לקבוצת הוואטסאפ</a>` : ''}
    <button class="card soft row" id="mem-open" style="flex:1;flex-direction:row;padding:8px 12px;cursor:pointer;min-width:160px"><div class="faces">${faces}</div><span class="small grow">${S.members.length} בסנגהה · מי פה?</span></button></div>
  <button class="composer" id="compose"><span class="avatar" style="background:${esc(S.profile.color)}">${esc(initials(S.profile.display_name))}</span><span class="grow">שתפו תובנה, שאלה או רגע של הודיה…</span></button>
  <div class="composer-types">${[['insight', '✨'], ['question', '❓'], ['gratitude', '🙏'], ['temple', '🕯']].map(([k, i]) => `<button data-ck="${k}"><span>${i}</span>${KIND[k]}</button>`).join('')}</div>
  ${danaHtml()}
  ${(canPickJourney() ? openSeasons() : []).filter(x => !S.groups.some(g => g.season_id === x.id)).map(x => `<div class="card gold"><span class="eyebrow">מסע קבוצתי לסנגהה</span><div class="row"><div class="grow"><h3>${esc(x.title)}</h3><span class="small">${x.days} ימים · ${x.per_week} פעמים בשבוע</span></div><button class="btn small" data-journey="group">לפרטים והצטרפות</button></div></div>`).join('')}
  ${pinned.map(p => postHtml(p, true)).join('')}
  ${(ev.data || []).map(e => { const d = new Date(e.starts_at);
    return `<div class="card"><span class="eyebrow">אירוע קרוב</span><div class="row"><div class="grow"><h3>${esc(e.title)}</h3>
      <span class="small">${d.toLocaleDateString('he-IL', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'numeric' })} · ${d.toLocaleTimeString('he-IL', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })}</span>
      ${e.description ? `<p class="small" style="color:var(--ink-2)">${esc(e.description)}</p>` : ''}</div></div>
      <div class="row wrap"><button class="icon-btn" data-rsvp="${e.id}" aria-pressed="${mine.has(e.id)}">${mine.has(e.id) ? '✓ אני מגיע/ה' : 'אני מגיע/ה'}</button>
      <a class="icon-btn" style="text-decoration:none" target="_blank" rel="noopener" href="${gcal(e)}">הוספה ליומן</a>
      ${e.url ? `<a class="icon-btn" style="text-decoration:none" target="_blank" rel="noopener" href="${esc(e.url)}">קישור</a>` : ''}</div></div>`; }).join('')}
  <div class="chips" id="fm">${[['active', 'פעילות אחרונה'], ['new', 'חדשים'], ['saved', 'שמורים'], ['mine', 'שלי']].map(([k, t]) => `<button class="chip" data-v="${k}" aria-pressed="${feedMode === k}">${t}</button>`).join('')}</div>
  ${rest.length ? rest.map(p => postHtml(p)).join('') : `<div class="card soft"><p class="small">${feedMode === 'saved' ? 'עוד לא שמרת שיתופים.' : feedMode === 'mine' ? 'עוד לא שיתפת.' : 'עוד אין שיתופים. אפשר להיות הראשון/ה.'}</p></div>`}
  <p class="support">זה מרחב של תמיכה הדדית ולא תחליף לליווי מקצועי.</p></div>`;
  chipGroup($('#fm'), v => { feedMode = v; VIEWS.sangha(true); });
  $('#compose').onclick = () => composeSheet();
  $$('[data-ck]').forEach(b => b.onclick = () => composeSheet(b.dataset.ck));
  $('#mem-open').onclick = membersSheet; bindJourney();
  clearInterval(sanghaTimer); sanghaTimer = setInterval(() => { if (current === 'sangha' && sheet.hidden && document.visibilityState === 'visible') VIEWS.sangha(true); else if (current !== 'sangha') clearInterval(sanghaTimer); }, 60000);
  $$('[data-rsvp]').forEach(b => b.onclick = async () => { const on = b.getAttribute('aria-pressed') !== 'true';
    if (on) await sb.from('rsvps').insert({ event_id: b.dataset.rsvp, user_id: S.session.user.id }); else await sb.from('rsvps').delete().eq('event_id', b.dataset.rsvp).eq('user_id', S.session.user.id);
    b.setAttribute('aria-pressed', on); b.textContent = on ? '✓ אני מגיע/ה' : 'אני מגיע/ה'; });
  bindPosts();
  loadPostImages();
};
function danaHtml() {
  const u = safeUrl(S.settings && S.settings.dana_url);
  return u ? `<div class="card soft dana"><div class="row"><div class="grow"><h3>דאנה · נדיבות</h3><span class="small">נתינה לסנגהה דרך פייבוקס. לא חובה.</span></div>
    <a class="btn ghost" href="${esc(u)}" target="_blank" rel="noopener noreferrer">לנתינה</a></div></div>` : '';
}
const KIND = { insight: 'תובנה', question: 'שאלה', gratitude: 'הודיה', temple: 'מקדש', announcement: 'מהמנחה', intro: 'היכרות', milestone: 'צמיחה' };
function membersSheet() {
  const list = S.members || [];
  openSheet(`<h2>מי בסנגהה</h2><p class="small">${list.length} חברים. נתוני התרגול של כל אחד פרטיים.</p>
    ${list.map(m => `<div class="comment"><span class="avatar" style="width:36px;height:36px;background:${esc(m.color)}">${esc(initials(m.name))}</span>
      <div class="grow"><b>${esc(m.name)}</b> ${m.role === 'facilitator' ? '<span class="kind">מנחה</span>' : ''}${m.me ? ' <span class="small">(את/ה)</span>' : ''}
      ${m.bio ? `<p class="small" style="color:var(--ink-2)">${esc(m.bio)}</p>` : ''}<div class="small">בסנגהה מ־${new Date(m.since).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}</div></div></div>`).join('')}
    <button class="btn ghost block" data-go="me" id="ms-me">עריכת "קצת עליי"</button>`, p => { $('#ms-me', p).onclick = () => { closeSheet(); go('me'); }; });
}
async function threadSheet(postId) {
  openSheet(`<div id="th"><p class="small">טוען…</p></div>`, async () => {
    const [{ data: post }, { data: comments }] = await Promise.all([sb.rpc('get_post', { p_id: postId }), sb.rpc('post_comments', { p_post: postId })]);
    if (!post) { $('#th').innerHTML = '<p class="small">השיתוף הוסר.</p>'; return; }
    const cs = comments || [];
    $('#th').innerHTML = `${postHtml(post, false, true)}
      <span class="eyebrow">${cs.length ? `${cs.length} תגובות` : 'עוד אין תגובות'}</span>
      <div id="th-c">${cs.map(c => `<div class="comment"><span class="avatar" style="background:${c.anonymous ? 'var(--line)' : esc(c.color)}">${c.anonymous ? '·' : esc(initials(c.author))}</span>
        <div class="grow"><div class="meta small"><b style="color:var(--ink)">${esc(c.anonymous ? 'חבר/ת סנגהה' : c.author)}</b>${c.is_staff ? ' <span class="kind">מנחה</span>' : ''} · ${ago(c.created_at)}${c.mine || isStaff() ? ` · <button class="btn link" style="font-size:12px" data-cdel="${c.id}" data-own="${c.mine}">מחיקה</button>` : ''}</div><p>${esc(c.body)}</p></div></div>`).join('')}</div>
      <div class="reply-bar"><textarea id="th-r" placeholder="תגובה חמה…" aria-label="תגובה"></textarea><button class="btn" id="th-s">שליחה</button></div>
      <label class="check"><input type="checkbox" id="th-a"> בעילום שם</label>`;
    bindPosts($('#th')); loadPostImages($('#th'));
    $$('[data-cdel]').forEach(b => b.onclick = async () => { await guard(b.dataset.own === 'true' ? sb.from('comments').delete().eq('id', b.dataset.cdel) : sb.rpc('staff_delete_comment', { p_id: b.dataset.cdel })); threadSheet(postId); if (current === 'home') loadConvo(); });
    $('#th-s').onclick = async () => { const body = $('#th-r').value.trim(); if (!body) return; const btn = $('#th-s'); btn.disabled = true;
      try { await guard(sb.from('comments').insert({ post_id: postId, user_id: S.session.user.id, body, anonymous: $('#th-a').checked })); threadSheet(postId); if (current === 'sangha') VIEWS.sangha(true); else if (current === 'home') loadConvo(); }
      catch (_) { btn.disabled = false; } };
  });
}
function postHtml(p, pinned, inThread) {
  const who = p.anonymous ? 'חבר/ת סנגהה' : p.author;
  return `<article class="card post ${pinned ? 'gold' : ''}" data-post="${p.id}">
    <div class="meta">${pinned ? '📌 ' : ''}<span class="avatar" style="background:${p.anonymous ? 'var(--line)' : esc(p.color || '#E6C068')}">${p.anonymous ? '·' : esc(initials(p.author))}</span>
      <b style="color:var(--ink)">${esc(who)}</b>${p.is_staff ? '<span class="kind">מנחה</span>' : ''}<span class="kind">${KIND[p.kind] || ''}</span><span class="grow"></span><span>${ago(p.created_at)}</span></div>
    <p>${esc(p.body)}</p>
    ${p.image_path ? `<img data-img="${esc(p.image_path)}" alt="תמונה מהשיתוף" loading="lazy">` : ''}
    <div class="row wrap"><button class="icon-btn" data-heart aria-pressed="${p.hearted}">${p.hearted ? '♥' : '♡'}${p.mine && p.my_hearts ? ' ' + p.my_hearts : ''}</button>
      ${inThread ? '' : `<button class="icon-btn" data-thread>💬 ${p.comments ? p.comments : 'תגובה'}</button>`}
      <button class="icon-btn" data-save aria-pressed="${p.saved}">${p.saved ? 'נשמר' : 'שמירה'}</button><span class="grow"></span>
      ${p.mine || isStaff() ? `<button class="btn link" data-del>${p.mine ? 'מחיקה' : 'הסתרה'}</button>` : `<button class="btn link" data-report style="color:var(--muted)">דיווח</button>`}</div>
  </article>`;
}
function bindPosts(root = view) {
  $$('[data-post]', root).forEach(a => { const id = a.dataset.post;
    const th = $('[data-thread]', a); if (th) { th.onclick = () => threadSheet(id); const body = $('p', a); if (body) { body.style.cursor = 'pointer'; body.onclick = () => threadSheet(id); } }
    const h = $('[data-heart]', a); if (h) h.onclick = async () => { if (h.disabled) return; h.disabled = true; const on = h.getAttribute('aria-pressed') !== 'true'; h.setAttribute('aria-pressed', on); h.textContent = on ? '♥' : '♡';
      if (navigator.vibrate) navigator.vibrate(10);
      const { error } = on ? await sb.from('hearts').insert({ post_id: id, user_id: S.session.user.id }) : await sb.from('hearts').delete().eq('post_id', id).eq('user_id', S.session.user.id);
      if (error && !/duplicate/.test(error.message)) { h.setAttribute('aria-pressed', !on); h.textContent = !on ? '♥' : '♡'; toast('לא נשמר. נסו שוב'); }
      h.disabled = false; };
    const s = $('[data-save]', a); if (s) s.onclick = async () => { const on = s.getAttribute('aria-pressed') !== 'true'; s.setAttribute('aria-pressed', on); s.textContent = on ? 'נשמר' : 'שמירה';
      if (on) await sb.from('saves').insert({ post_id: id, user_id: S.session.user.id }); else await sb.from('saves').delete().eq('post_id', id).eq('user_id', S.session.user.id); };
    const d = $('[data-del]', a); if (d) d.onclick = () => confirmSheet(d.textContent === 'מחיקה' ? 'למחוק את השיתוף?' : 'להסתיר את השיתוף מכולם?', async () => {
      if (d.textContent === 'מחיקה') await guard(sb.from('posts').delete().eq('id', id)); else await guard(sb.rpc('moderate_post', { p_id: id, p_hidden: true })); a.remove(); if (current === 'home') loadConvo(); });
    const r = $('[data-report]', a); if (r) r.onclick = () => confirmSheet('לדווח על השיתוף למנחה?', async () => { await guard(sb.from('reports').insert({ post_id: id, user_id: S.session.user.id })); toast('תודה. המנחה תבדוק'); });
  });
}
async function loadPostImages(root = view) {
  for (const img of $$('img[data-img]', root)) { const { data } = await sb.storage.from('images').createSignedUrl(img.dataset.img, 3600); if (data) img.src = data.signedUrl; }
}
function confirmSheet(q, yes) {
  openSheet(`<h2>${esc(q)}</h2><div class="row"><button class="btn grow" id="cy">כן</button><button class="btn ghost grow" id="cn">ביטול</button></div>`, () => {
    $('#cn').onclick = closeSheet; $('#cy').onclick = async () => { closeSheet(); await yes(); }; });
}
const PLACE = { insight: 'מה עלה בתרגול?', question: 'מה תרצה/י לשאול את הסנגהה?', gratitude: 'על מה את/ה מודה היום?', temple: 'ספרו על פינת התרגול שלכם', announcement: 'הודעה לכל הסנגהה', intro: 'ספרו קצת על עצמכם ומה הביא אתכם לתרגול' };
function composeSheet(kind, preset) {
  const v = { kind: kind || 'insight', file: null };
  openSheet(`<h2>${v.kind === 'intro' ? 'היכרות עם הסנגהה' : 'שיתוף עם הסנגהה'}</h2>
    ${v.kind === 'intro' ? '<p class="small">כמה מילים עליך. כולם יקבלו התראה ויוכלו לקבל אותך בברכה.</p>' : `<div class="chips" id="ck">${['insight', 'question', 'gratitude', 'temple'].map(k => `<button class="chip" data-v="${k}" aria-pressed="${k === v.kind}">${KIND[k]}</button>`).join('')}${isStaff() ? `<button class="chip" data-v="announcement" aria-pressed="${v.kind === 'announcement'}">${KIND.announcement}</button>` : ''}</div>`}
    <textarea id="cb" placeholder="${esc(PLACE[v.kind] || '')}">${esc(preset || '')}</textarea>
    <label class="field" id="cf-wrap" ${v.kind === 'temple' ? '' : 'hidden'}>תמונה (רשות)<input type="file" id="cf" accept="image/*"></label>
    <label class="check"><input type="checkbox" id="ca"> לשתף בעילום שם</label>
    ${isStaff() ? `<label class="check"><input type="checkbox" id="cp"> להצמיד למעלה</label>` : ''}
    <button class="btn block" id="cs">פרסום</button>`, () => {
    if ($('#ck')) chipGroup($('#ck'), k => { v.kind = k; $('#cf-wrap').hidden = k !== 'temple'; $('#cb').placeholder = PLACE[k] || ''; if (k === 'announcement' && $('#cp')) $('#cp').checked = true; });
    if (v.kind === 'intro' && $('#ca')) $('#ca').closest('label').hidden = true;
    $('#cf').onchange = e => v.file = e.target.files[0] || null;
    $('#cs').onclick = async () => {
      const body = $('#cb').value.trim(); if (!body) return toast('כתבו כמה מילים');
      const btn = $('#cs'); btn.disabled = true;
      let image_path = null;
      try {
        if (v.file) { const blob = await shrink(v.file); image_path = `${crypto.randomUUID()}.jpg`;
          const { error } = await sb.storage.from('images').upload(image_path, blob, { contentType: 'image/jpeg' }); if (error) throw error; }
        await guard(sb.from('posts').insert({ user_id: S.session.user.id, kind: v.kind, body, anonymous: $('#ca').checked, image_path, pinned: !!($('#cp') && $('#cp').checked) }));
        closeSheet(); toast(v.kind === 'intro' ? 'ברוך/ה הבא/ה לסנגהה 🌱' : 'שותף 🤍'); feedMode = 'new'; if (current === 'sangha') VIEWS.sangha(true); else go('sangha');
      } catch (e) { btn.disabled = false; toast('הפרסום לא הצליח'); }
    };
  });
}
function shrink(file) {
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => { const max = 1280, k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    c.toBlob(b => b ? res(b) : rej(), 'image/jpeg', 0.82); URL.revokeObjectURL(img.src); }; img.onerror = rej; img.src = URL.createObjectURL(file); });
}
function gcal(e) {
  const f = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); const s = new Date(e.starts_at), en = new Date(s.getTime() + (e.duration_min || 60) * 6e4);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.title)}&dates=${f(s)}/${f(en)}&details=${encodeURIComponent((e.description || '') + (e.url ? '\n' + e.url : ''))}`;
}

// ---------- ME ----------
VIEWS.me = async function () {
  const p = S.profile; const colors = ['#E6C068', '#7FA06A', '#D98C6A', '#9BB7D4', '#C8A2C8', '#F2EAD6'];
  view.innerHTML = `<div class="row"><button class="btn link" id="back">→ חזרה</button></div><h1>הפרופיל שלי</h1>
  <div class="card"><label class="field">השם בסנגהה<input type="text" id="me-name" value="${esc(p.display_name)}"></label>
    <label class="field">קצת עליי (מופיע ב"מי בסנגהה")<textarea id="me-bio" maxlength="280" placeholder="מאיפה אני, ממתי מתרגל/ת, מה מביא אותי">${esc(p.bio || '')}</textarea></label>
    <span class="small">צבע</span><div class="chips" id="me-c">${colors.map(c => `<button class="chip" data-v="${c}" aria-pressed="${c === p.color}" style="width:38px;height:38px;padding:0;background:${c};border-color:${c === p.color ? 'var(--ink)' : 'transparent'}" aria-label="צבע"></button>`).join('')}</div>
    <button class="btn" id="me-save">שמירה</button></div>
  <div class="card"><h3>תזכורת יומית</h3><p class="small">התזכורות עדיין לא פעילות. אפשר לשמור כבר עכשיו את השעה הרצויה.</p>
    <label class="field">שעה<input type="time" id="me-rem" value="${p.reminder_time ? String(p.reminder_time).slice(0, 5) : ''}"></label>
    <button class="btn ghost" id="me-rem-save">שמירת שעה</button></div>
  <div class="card"><h3>התקנה על מסך הבית</h3><p class="small" style="line-height:1.7">באייפון: בספארי לוחצים על כפתור השיתוף <b>⎋</b>, גוללים ובוחרים <b>"הוסף למסך הבית"</b>, ואז <b>"הוסף"</b>. האפליקציה תיפתח במסך מלא כמו כל אפליקציה.</p></div>
  <div class="card"><div class="row"><span class="grow small">${esc(S.session.user.email)}</span><button class="btn ghost small" id="me-out">התנתקות</button></div></div>`;
  $('#back').onclick = () => history.length > 1 ? history.back() : go('home');
  let color = p.color; chipGroup($('#me-c'), c => { color = c; $$('#me-c .chip').forEach(x => x.style.borderColor = x.dataset.v === c ? 'var(--ink)' : 'transparent'); });
  $('#me-save').onclick = async () => { const display_name = $('#me-name').value.trim() || p.display_name, bio = $('#me-bio').value.trim().slice(0, 280);
    await guard(sb.from('profiles').update({ display_name, color, bio }).eq('id', p.id)); S.profile = { ...p, display_name, color, bio }; toast('נשמר'); };
  $('#me-rem-save').onclick = async () => { const v = $('#me-rem').value || null;
    await guard(sb.from('profiles').update({ reminder_time: v }).eq('id', p.id)); S.profile.reminder_time = v; toast(v ? `תזכורת ב־${v}` : 'בלי תזכורת'); };
  $('#me-out').onclick = signOut;
};

// ---------- staff: edit and delete recordings and events ----------
const MAX_AUDIO = 50 * 1024 * 1024;
function audioProblem(f, required) {
  if (!f) return required ? 'לא נבחר קובץ. בחרו קובץ אודיו ואז העלאה' : '';
  if (!f.size) return 'הקובץ ריק. בחרו קובץ אחר';
  return f.size > MAX_AUDIO ? 'הקובץ מעל 50MB. צריך לכווץ אותו לפני ההעלאה' : '';
}
const isStored = p => !!p && !/^https?:/.test(p);
async function uploadAudio(f, date) {
  const ext = ((f.name.match(/\.([a-z0-9]{1,5})$/i) || [])[1] || 'mp3').toLowerCase(), path = `${date}-${Date.now()}.${ext}`;
  const { error } = await sb.storage.from('audio').upload(path, f, { contentType: f.type || 'audio/mpeg' });
  if (error) throw error;
  return path;
}
// A failed response can still mean a saved row, so remove the upload only when no row points to it.
async function dropUnusedAudio(path) {
  try {
    const { data, error } = await sb.from('recordings').select('id').eq('audio_path', path);
    if (!error && !data.length) await sb.storage.from('audio').remove([path]);
  } catch (e) { console.error(e); }
}
// RLS answers "0 rows" without an error, so success requires a returned row.
async function changeOne(query) {
  const rows = await guard(query.select('id'));
  if (!rows || !rows.length) { toast('לא נשמר. רעננו את המסך ונסו שוב'); throw new Error('no row changed'); }
}
function stopIfPlaying(id) {
  if (!S.playing || S.playing.id !== id) return;
  S.playing = null; audio.pause(); audio.removeAttribute('src'); paintPlayer();
}
const manageRow = (id, title, sub) => `<div class="card soft" data-item="${esc(id)}"><b dir="auto">${esc(title)}</b><span class="small">${sub}</span>
  <div class="row"><button class="btn link" data-edit>עריכה</button><span class="grow"></span><button class="btn link" data-delete>מחיקה</button></div></div>`;
function bindManage(el, rows, edit, del) {
  $$('[data-item]', el).forEach(c => { const x = rows.find(r => String(r.id) === c.dataset.item);
    $('[data-edit]', c).onclick = () => edit(x); $('[data-delete]', c).onclick = () => del(x); });
}
async function recordingList() {
  const el = $('#r-list'); if (!el) return;
  const { data, error } = await sb.from('recordings').select('*').order('recorded_on', { ascending: false }).order('created_at', { ascending: false });
  if (!el.isConnected) return;
  if (error) { el.innerHTML = '<p class="small">לא הצלחנו לטעון את ההקלטות.</p>'; return; }
  el.innerHTML = data.length ? '<h3>הקלטות קיימות</h3>' + data.map(r => manageRow(r.id, r.title,
    `${r.recorded_on ? heDate(r.recorded_on) : ''}${r.audio_path ? '' : ' · <b>חסר קובץ</b>'}`)).join('') : '';
  bindManage(el, data, recordingSheet, deleteRecording);
}
function recordingSheet(r) {
  openSheet(`<h2>עריכת הקלטה</h2>
    <label class="field">כותרת<input type="text" id="er-title" value="${esc(r.title)}"></label>
    <div class="row"><label class="field grow">נושא<input type="text" id="er-topic" value="${esc(r.topic)}"></label><label class="field" style="width:110px">דקות<input type="number" id="er-dur" value="${esc(r.duration_min)}"></label></div>
    <label class="field">מנחה<input type="text" id="er-guide" value="${esc(r.guide)}"></label>
    <label class="field">תאריך<input type="date" id="er-date" value="${esc(r.recorded_on)}"></label>
    <label class="field">מה תרגלנו (2-3 שורות)<textarea id="er-sum">${esc(r.summary)}</textarea></label>
    <label class="field">${r.audio_path ? 'החלפת הקובץ (רשות)' : 'קובץ אודיו (חסר)'}<input type="file" id="er-file" accept="audio/*"></label>
    <button class="btn block" id="er-save">שמירה</button>`, () => {
    $('#er-save').onclick = async () => {
      const title = $('#er-title').value.trim(), f = $('#er-file').files[0], date = $('#er-date').value;
      if (!title) return toast('צריך כותרת');
      if (!date) return toast('צריך תאריך');
      const bad = audioProblem(f, !r.audio_path); if (bad) return toast(bad);
      const row = { title, topic: $('#er-topic').value.trim() || 'כללי', guide: $('#er-guide').value.trim() || 'עדי', duration_min: +$('#er-dur').value || null, recorded_on: date, summary: $('#er-sum').value.trim() };
      const btn = $('#er-save'); btn.disabled = true; btn.textContent = 'שומר…';
      let path = null;
      try {
        if (f) { path = await uploadAudio(f, date); row.audio_path = path; }
        await changeOne(sb.from('recordings').update(row).eq('id', r.id));
      } catch (e) {
        console.error(e); btn.disabled = false; btn.textContent = 'שמירה'; toast('השמירה לא הצליחה. נסו שוב');
        if (path) await dropUnusedAudio(path);
        return;
      }
      closeSheet(); toast('ההקלטה עודכנה'); S.recordings = [];
      if (path) { stopIfPlaying(r.id); if (isStored(r.audio_path)) await dropUnusedAudio(r.audio_path); }
      recordingList();
    };
  });
}
function deleteRecording(r) {
  confirmSheet(`למחוק את "${r.title}"? אי אפשר לשחזר`, async () => {
    try {
      // file first: if this fails the row stays and the delete can simply be repeated
      if (isStored(r.audio_path)) await guard(sb.storage.from('audio').remove([r.audio_path]), 'המחיקה לא הצליחה. נסו שוב');
      await changeOne(sb.from('recordings').delete().eq('id', r.id));
      stopIfPlaying(r.id); S.recordings = []; toast('ההקלטה נמחקה'); recordingList();
    } catch (e) { console.error(e); }
  });
}
const eventUrl = v => { const u = v.trim(); return !u ? null : /^https?:\/\//i.test(u) ? u : 'https://' + u; };
const isoToIlLocal = iso => { const p = ilParts(new Date(iso)); return `${p.date}T${String(p.h).padStart(2, '0')}:${String(p.m).padStart(2, '0')}`; };
async function eventList() {
  const el = $('#e-list'); if (!el) return;
  const { data, error } = await sb.from('events').select('*').order('starts_at', { ascending: false });
  if (!el.isConnected) return;
  if (error) { el.innerHTML = '<p class="small">לא הצלחנו לטעון את האירועים.</p>'; return; }
  el.innerHTML = data.length ? '<h3>אירועים קיימים</h3>' + data.map(e => { const [d, t] = isoToIlLocal(e.starts_at).split('T');
    return manageRow(e.id, e.title, `${heDate(d)} · ${t}`); }).join('') : '';
  bindManage(el, data, eventSheet, deleteEvent);
}
function eventSheet(e) {
  openSheet(`<h2>עריכת אירוע</h2>
    <label class="field">שם<input type="text" id="ee-t" value="${esc(e.title)}"></label>
    <label class="field">מתי<input type="datetime-local" id="ee-d" value="${isoToIlLocal(e.starts_at)}"></label>
    <label class="field">משך בדקות<input type="number" id="ee-m" value="${esc(e.duration_min)}"></label>
    <label class="field">קישור (זום / הרשמה)<input type="url" id="ee-u" dir="ltr" value="${esc(e.url)}"></label>
    <label class="field">תיאור<textarea id="ee-x">${esc(e.description)}</textarea></label>
    <p class="small">שינוי לא שולח התראה. אם המועד השתנה, כדאי לפרסם הודעה.</p>
    <button class="btn block" id="ee-save">שמירה</button>`, () => {
    $('#ee-save').onclick = async () => {
      const title = $('#ee-t').value.trim(), d = $('#ee-d').value; if (!title || !d) return toast('צריך שם ותאריך');
      const btn = $('#ee-save'); btn.disabled = true;
      try {
        await changeOne(sb.from('events').update({ title, starts_at: ilLocalToIso(d), duration_min: +$('#ee-m').value || 60, url: eventUrl($('#ee-u').value), description: $('#ee-x').value.trim() }).eq('id', e.id));
        closeSheet(); toast('האירוע עודכן'); eventList();
      } catch (err) { console.error(err); btn.disabled = false; }
    };
  });
}
function deleteEvent(e) {
  confirmSheet(`למחוק את "${e.title}"? גם אישורי ההגעה יימחקו`, async () => {
    try { await changeOne(sb.from('events').delete().eq('id', e.id)); toast('האירוע נמחק. כדאי לעדכן בהודעה'); eventList(); }
    catch (err) { console.error(err); }
  });
}

// ---------- ADMIN (facilitator) ----------
VIEWS.admin = async function () {
  view.innerHTML = `<div class="row"><button class="btn link" data-go="home">→ חזרה</button></div><h1>ניהול</h1>
  <div class="chips scroll" id="ad-t">${[['rec', 'הקלטה'], ['post', 'הודעה'], ['ev', 'אירוע'], ['read', 'קריאה'], ['q', 'שאלות'], ['season', 'מסע קבוצתי'], ['quote', 'משפט'], ['rep', 'דיווחים'], ['set', 'הגדרות'], ['mem', 'חברים']].map(([k, t], i) => `<button class="chip" data-v="${k}" aria-pressed="${i === 0}">${t}</button>`).join('')}</div>
  <div id="ad-body" class="stack"></div>`;
  bindGo(); chipGroup($('#ad-t'), adminTab); adminTab('rec');
};
async function adminTab(t) {
  const b = $('#ad-body'); const uid = S.session.user.id;
  if (t === 'rec') {
    b.innerHTML = `<div class="card"><h3>הקלטה חדשה</h3>
      <label class="field">כותרת<input type="text" id="r-title" placeholder="התבוננות בצ׳אקרות"></label>
      <div class="row"><label class="field grow">נושא<input type="text" id="r-topic" list="topics" placeholder="נשימה"></label><label class="field" style="width:110px">דקות<input type="number" id="r-dur"></label></div>
      <datalist id="topics"><option>נשימה</option><option>סריקת גוף</option><option>צ׳אקרות</option><option>מנטרה</option><option>קונדליני</option><option>מנחה אורח</option></datalist>
      <label class="field">מנחה<input type="text" id="r-guide" value="${esc((S.settings && S.settings.facilitator_name) || 'עדי')}"></label>
      <label class="field">תאריך<input type="date" id="r-date" value="${today()}"></label>
      <label class="field">מה תרגלנו (2-3 שורות)<textarea id="r-sum"></textarea></label>
      <label class="field">קובץ אודיו (mp3 / m4a, עד 50MB)<input type="file" id="r-file" accept="audio/*"></label>
      <div class="progress" id="r-prog" hidden><i></i></div>
      <button class="btn block" id="r-save">העלאה</button></div><div class="stack" id="r-list"></div>`;
    $('#r-save').onclick = async () => {
      const title = $('#r-title').value.trim(); if (!title) return toast('צריך כותרת');
      const f = $('#r-file').files[0], bad = audioProblem(f, true); if (bad) return toast(bad);
      const date = $('#r-date').value; if (!date) return toast('צריך תאריך');
      const btn = $('#r-save'); btn.disabled = true; let audio_path = null;
      try {
        $('#r-prog').hidden = false; $('#r-prog i').style.width = '30%';
        const row = { title, topic: $('#r-topic').value.trim() || 'כללי', guide: $('#r-guide').value.trim() || 'עדי', duration_min: +$('#r-dur').value || null, recorded_on: date, summary: $('#r-sum').value.trim() };
        audio_path = await uploadAudio(f, date);
        await guard(sb.from('recordings').insert({ ...row, audio_path }));
        toast('ההקלטה עלתה'); S.recordings = [];
        if (btn.isConnected) adminTab('rec');
      } catch (e) {
        console.error(e); btn.disabled = false; toast('ההעלאה לא הצליחה. נסו שוב');
        const bar = $('#r-prog'); if (bar) bar.hidden = true;
        if (audio_path) await dropUnusedAudio(audio_path);
      }
    };
    recordingList();
  } else if (t === 'post') {
    b.innerHTML = `<div class="card"><h3>הודעה מוצמדת לסנגהה</h3><textarea id="an"></textarea><button class="btn block" id="an-s">פרסום והצמדה</button></div><div id="pins"></div>`;
    $('#an-s').onclick = async () => { const body = $('#an').value.trim(); if (!body) return;
      await guard(sb.from('posts').insert({ user_id: uid, kind: 'announcement', body, pinned: true })); toast('פורסם'); adminTab('post'); };
    const data = ((await guard(sb.rpc('staff_posts'))) || []).filter(p => p.pinned && !p.hidden);
    $('#pins').innerHTML = (data || []).map(p => `<div class="card soft"><p class="small">${esc(p.body.slice(0, 140))}</p><button class="btn link" data-unpin="${p.id}">הסרת הצמדה</button></div>`).join('');
    $$('[data-unpin]').forEach(x => x.onclick = async () => { await guard(sb.rpc('moderate_post', { p_id: x.dataset.unpin, p_pinned: false })); adminTab('post'); });
  } else if (t === 'read') {
    b.innerHTML = `<div class="card"><h3>מומלץ לקריאה</h3><p class="small">דרשות, קטעים, קישורים וספרים. עריכה ומחיקה נעשות מהספרייה.</p><button class="btn block" id="ad-read">הוספת המלצה</button></div>`;
    $('#ad-read').onclick = () => readingSheet();
  } else if (t === 'ev') {
    b.innerHTML = `<div class="card"><h3>אירוע חדש</h3><label class="field">שם<input type="text" id="e-t"></label>
      <label class="field">מתי<input type="datetime-local" id="e-d"></label><label class="field">משך בדקות<input type="number" id="e-m" value="90"></label>
      <label class="field">קישור (זום / הרשמה)<input type="url" id="e-u" dir="ltr"></label><label class="field">תיאור<textarea id="e-x"></textarea></label>
      <button class="btn block" id="e-s">שמירה</button></div><div class="stack" id="e-list"></div>`;
    $('#e-s').onclick = async () => { const d = $('#e-d').value, title = $('#e-t').value.trim(); if (!title || !d) return toast('צריך שם ותאריך');
      const btn = $('#e-s'); btn.disabled = true;
      try {
        await guard(sb.from('events').insert({ title, starts_at: ilLocalToIso(d), duration_min: +$('#e-m').value || 60, url: eventUrl($('#e-u').value), description: $('#e-x').value.trim() }));
        toast('האירוע נוסף'); if (btn.isConnected) adminTab('ev');
      } catch (e) { console.error(e); btn.disabled = false; }
    };
    eventList();
  } else if (t === 'q') {
    const data = await guard(sb.rpc('staff_questions'));
    b.innerHTML = (data || []).length ? data.map(q => `<div class="card" data-q="${q.id}"><p>${esc(q.body)}</p><span class="small">${q.anonymous ? 'בעילום שם' : esc(q.author)} · ${ago(q.created_at)}</span>
      <textarea placeholder="תשובה">${esc(q.answer || '')}</textarea><div class="row"><input type="text" value="${esc(q.topic || 'כללי')}" aria-label="נושא" style="width:130px">
      <label class="check grow"><input type="checkbox" ${q.published ? 'checked' : ''}> לפרסם לכולם</label><button class="btn small">שמירה</button></div></div>`).join('') : '<div class="card soft"><p class="small">אין שאלות כרגע.</p></div>';
    $$('[data-q]').forEach(c => $('button', c).onclick = async () => {
      await guard(sb.rpc('answer_question', { p_id: c.dataset.q, p_answer: $('textarea', c).value, p_topic: $('input[type=text]', c).value, p_published: $('input[type=checkbox]', c).checked })); toast('נשמר'); });
  } else if (t === 'season') {
    const { data } = await sb.from('seasons').select('*').order('start_date', { ascending: false });
    b.innerHTML = `<div class="card"><h3>מסע קבוצתי חדש</h3><p class="small">מסע משותף לסנגהה. כל אחד בוחר אם להצטרף, והמסע האישי שלו נשאר.</p>
      <label class="field">שם<input type="text" id="s-t" placeholder="חורף · קונדליני"></label><label class="field">תיאור<textarea id="s-x"></textarea></label>
      <div class="row"><label class="field grow">התחלה<input type="date" id="s-d" value="${today()}"></label><label class="field" style="width:70px">ימים<input type="number" id="s-n" value="42"></label><label class="field" style="width:70px">בשבוע<input type="number" id="s-w" value="5" min="1" max="7"></label></div>
      <button class="btn block" id="s-s">יצירה</button></div>
      ${(data || []).map(s => `<div class="card soft"><div class="row"><div class="grow"><b>${esc(s.title)}</b><div class="small">${heDate(s.start_date)} · ${s.days} ימים · ${s.active ? 'פעילה' : 'סגורה'}</div></div><button class="btn link" data-sx="${s.id}" data-a="${s.active}">${s.active ? 'סגירה' : 'פתיחה'}</button></div></div>`).join('')}`;
    $('#s-s').onclick = async () => { if (!$('#s-t').value.trim()) return toast('צריך שם');
      await guard(sb.from('seasons').insert({ title: $('#s-t').value.trim(), description: $('#s-x').value.trim(), start_date: $('#s-d').value, days: +$('#s-n').value || 42, per_week: Math.min(7, Math.max(1, +$('#s-w').value || 5)) })); toast('המסע הקבוצתי נפתח'); adminTab('season'); };
    $$('[data-sx]').forEach(x => x.onclick = async () => { await sb.from('seasons').update({ active: x.dataset.a !== 'true' }).eq('id', x.dataset.sx); adminTab('season'); });
  } else if (t === 'quote') {
    b.innerHTML = `<div class="card"><h3>משפט עוגן חדש</h3><textarea id="qt"></textarea><label class="field">מקור<input type="text" id="qs"></label><button class="btn block" id="qq">הוספה</button>
      <p class="small">יש ${S.quotes.length} משפטים במאגר. כל יום מוצג אחד, לפי הסדר.</p></div>`;
    $('#qq').onclick = async () => { if (!$('#qt').value.trim()) return; const d = await guard(sb.from('quotes').insert({ text: $('#qt').value.trim(), source: $('#qs').value.trim() }).select().single()); S.quotes.push(d); toast('נוסף'); adminTab('quote'); };
  } else if (t === 'rep') {
    const posts = ((await guard(sb.rpc('staff_posts'))) || []).filter(p => p.reported);
    b.innerHTML = (posts || []).length ? posts.map(p => `<div class="card"><p class="small">${esc(p.body.slice(0, 220))}</p><div class="row"><span class="grow small">${p.hidden ? 'מוסתר' : 'גלוי'}</span><button class="btn small" data-hide="${p.id}" data-h="${p.hidden}">${p.hidden ? 'החזרה' : 'הסתרה'}</button></div></div>`).join('') : '<div class="card soft"><p class="small">אין דיווחים.</p></div>';
    $$('[data-hide]').forEach(x => x.onclick = async () => { await guard(sb.rpc('moderate_post', { p_id: x.dataset.hide, p_hidden: x.dataset.h !== 'true' })); adminTab('rep'); });
  } else if (t === 'set') {
    const st = S.settings || {};
    b.innerHTML = `<div class="card"><h3>התרגול המשותף</h3><label class="field">קישור זום קבוע<input type="url" id="z-u" dir="ltr" value="${esc(st.zoom_url || '')}"></label>
      <div class="row"><label class="field grow">שעה<input type="time" id="z-t" value="${esc(String(st.live_time || '05:30').slice(0, 5))}"></label><label class="field" style="width:110px">דקות<input type="number" id="z-m" value="${st.live_minutes || 60}"></label></div>
      <span class="small">ימים</span><div class="chips" id="z-d">${DAYNAMES.map((d, i) => `<button class="chip" data-v="${i}" aria-pressed="${(st.live_days || []).includes(i)}">${d}</button>`).join('')}</div>
      <label class="field">שם המנחה<input type="text" id="z-n" value="${esc(st.facilitator_name || '')}"></label>
      <label class="field">קישור לקבוצת הוואטסאפ (יופיע בסנגהה)<input type="url" id="z-w" dir="ltr" value="${esc(st.whatsapp_url || '')}"></label><label class="field">קישור לדאנה בפייבוקס<input type="url" id="z-dn" dir="ltr" value="${esc(st.dana_url || '')}"></label><button class="btn block" id="z-s">שמירה</button></div>`;
    $('#z-d').onclick = e => { const c = e.target.closest('.chip'); if (c) c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') !== 'true'); };
    $('#z-s').onclick = async () => { const row = { zoom_url: $('#z-u').value.trim(), whatsapp_url: $('#z-w').value.trim() || null, dana_url: $('#z-dn').value.trim() || null, live_time: $('#z-t').value, live_minutes: +$('#z-m').value || 60, facilitator_name: $('#z-n').value.trim(),
      live_days: $$('#z-d .chip').filter(c => c.getAttribute('aria-pressed') === 'true').map(c => +c.dataset.v) };
      await guard(sb.from('settings').update(row).eq('id', 1)); S.settings = { ...st, ...row }; toast('נשמר'); };
  } else if (t === 'mem') {
    const data = await guard(sb.rpc('admin_profiles'));
    const admin = S.profile.role === 'admin';
    b.innerHTML = `<div class="card"><span class="small">${(data || []).filter(x => x.role !== 'pending').length} חברים</span><div class="tablewrap"><table class="admin">${(data || []).map(m => `<tr><td>${esc(m.display_name || '·')}</td><td>${admin && m.id !== uid ? `<select data-role="${m.id}">${['pending', 'member', 'facilitator', 'admin'].map(r => `<option value="${r}" ${r === m.role ? 'selected' : ''}>${{ pending: 'ממתין', member: 'חבר', facilitator: 'מנחה', admin: 'מנהל' }[r]}</option>`).join('')}</select>` : { pending: 'ממתין', member: 'חבר', facilitator: 'מנחה', admin: 'מנהל' }[m.role]}</td></tr>`).join('')}</table></div></div>`;
    $$('[data-role]').forEach(s => s.onchange = async () => { await guard(sb.rpc('set_member_role', { p_id: s.dataset.role, p_role: s.value })); toast('עודכן'); });
  }
}
function ilLocalToIso(local) {
  // interpret "YYYY-MM-DDTHH:MM" as Israel wall time
  const guess = new Date(local + ':00Z'); const p = ilParts(guess);
  const asIl = new Date(`${p.date}T${String(p.h).padStart(2, '0')}:${String(p.m).padStart(2, '0')}:00Z`);
  return new Date(guess.getTime() - (asIl - guess)).toISOString();
}

// ---------- install hint (iOS Safari, not installed) ----------
function maybeInstallHint() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  let seen = false; try { seen = localStorage.getItem('sangha-install-seen') === '1'; } catch (_) {}
  if (!ios || standalone || seen) return;
  setTimeout(() => openSheet(`<h2>שימו את הסנגהה על מסך הבית</h2>
    <ol style="margin:0;padding-inline-start:20px;line-height:2">
      <li>לוחצים על כפתור השיתוף <b>⎋</b> בתחתית ספארי</li><li>גוללים ובוחרים <b>"הוסף למסך הבית"</b></li><li>לוחצים <b>"הוסף"</b></li></ol>
    <p class="small">מעכשיו נפתחים מהאייקון, במסך מלא. בפעם הראשונה צריך להתחבר שוב מתוך האייקון.</p>
    <button class="btn block" id="ih">הבנתי</button>`, () => $('#ih').onclick = () => { try { localStorage.setItem('sangha-install-seen', '1'); } catch (_) {} closeSheet(); }), 1500);
}

// ---------- boot ----------
async function boot() {
  const { data } = await sb.auth.getSession(); S.session = data.session;
  if (S.session) { await loadProfile(); if (S.profile && S.profile.role !== 'pending') { await loadCore(); loadRecordings().catch(() => {}); } }
  const sp = $('#splash'); if (sp) { sp.classList.add('out'); setTimeout(() => sp.remove(), 600); }
  route(); maybeInstallHint(); flushPending();
}
sb.auth.onAuthStateChange((ev, session) => {
  if (ev === 'PASSWORD_RECOVERY') {
    S.session = session;
    openSheet(`<h2>סיסמה חדשה</h2><input type="password" id="np" dir="ltr" autocomplete="new-password"><button class="btn block" id="nps">שמירה</button>`, () => $('#nps').onclick = async () => {
      const { error } = await sb.auth.updateUser({ password: $('#np').value }); toast(error ? 'הסיסמה צריכה 6 תווים לפחות' : 'הסיסמה עודכנה'); if (!error) { closeSheet(); boot(); } });
  }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible' || !S.session || !S.profile || S.profile.role === 'pending' || current !== 'home') return; syncChallenge(); if (S.goal) VIEWS.home(); else route(); });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
const netBanner = () => { const o = $('#offline'); if (o) o.hidden = navigator.onLine; };
window.addEventListener('online', () => { netBanner(); flushPending(); if (S.session && current) route(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
window.addEventListener('offline', netBanner); netBanner();
boot();
})();
