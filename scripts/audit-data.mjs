// TeamFlow datový audit — kontrola konzistence docházky, dovolených a exportů.
//
// Spuštění:  npm run audit            (kontroluje minulý + aktuální měsíc)
//            npm run audit -- 2026-07 (kontroluje konkrétní měsíc)
//
// Jen čte — nikdy nic nezapisuje ani nemaže. Exit kód 1 = nalezeny problémy.
//
// Kontroly vycházejí z reálných chyb, které jsme v systému našli:
//  1. Duplicitní PINy (rozbijí přihlášení oběma zaměstnancům)
//  2. Duplicitní záznamy dovolené na stejný den
//  3. Osiřelé záznamy dovolené (bez schválené žádosti)
//  4. Nepropsaná dovolená (schválený den bez záznamu v docházce)
//  5. Překrývající se docházkové záznamy (hodiny by se počítaly dvakrát)
//  6. Soulad dovolené: hodiny v docházce vs. dny ze žádostí (dublování v exportu)
//  7. Neuzavřené směny ze starších dnů
//  8. Blížící se limity počtu řádků (1000/dotaz)

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ── env ──────────────────────────────────────────────────────────────────────
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const VACATION_NOTE = 'Placená dovolená';

// ── datumové helpery (stejná logika jako src/lib/vacationDays.ts) ───────────
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isWeekend = (iso) => { const dow = new Date(iso + 'T12:00:00').getDay(); return dow === 0 || dow === 6; };
function daysInRange(from, to, countWeekends, clipStart, clipEnd) {
  const end = to && to > from ? to : from;
  const out = [];
  const cur = new Date(from + 'T12:00:00');
  let iso = toISO(cur);
  while (iso <= end && out.length < 1100) {
    if ((countWeekends || !isWeekend(iso)) && iso >= clipStart && iso <= clipEnd) out.push(iso);
    cur.setDate(cur.getDate() + 1);
    iso = toISO(cur);
  }
  return out;
}
function monthWindow(month) {
  const [y, m] = month.split('-').map(Number);
  return { start: `${month}-01`, end: toISO(new Date(y, m, 0)) };
}
const pragueToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// ── měsíce ke kontrole ──────────────────────────────────────────────────────
const argMonth = process.argv[2];
let months;
if (argMonth && /^\d{4}-\d{2}$/.test(argMonth)) {
  months = [argMonth];
} else {
  const today = pragueToday();
  const [y, m] = today.split('-').map(Number);
  const prev = new Date(y, m - 2, 1);
  months = [`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`, today.slice(0, 7)];
}

let problems = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => { problems++; console.log(`  ⚠ ${msg}`); };

// ── audit jedné organizace ──────────────────────────────────────────────────
async function auditOrg(org) {
  console.log(`\n═══ ${org.name} ═══`);

  const [{ data: employees }, { data: settingsRow }] = await Promise.all([
    sb.from('employees').select('id, name, pin_code, active, employment_type').eq('organization_id', org.id),
    sb.from('company_settings').select('extra_settings').eq('organization_id', org.id).maybeSingle(),
  ]);
  const empById = new Map((employees ?? []).map((e) => [e.id, e]));
  const extra = settingsRow?.extra_settings ?? {};
  const countWeekends = extra.vacation_counting_mode === 'all';

  // Nárok na placenou dovolenou dle úvazku — stejná logika jako schvalování
  // žádostí: bez nároku se dovolená do docházky záměrně nepropisuje.
  const configs = extra.employment_type_configs ?? {};
  const DEFAULT_PAID = { HPP: true, DPP: true, 'DPČ': true, 'IČO': false };
  const hasPaidVacation = (empId) => {
    const t = empById.get(empId)?.employment_type ?? '';
    return configs[t]?.paidVacation ?? DEFAULT_PAID[t] ?? true;
  };

  // 1) Duplicitní PINy
  const pinMap = new Map();
  for (const e of employees ?? []) {
    if (!e.pin_code) continue;
    if (!pinMap.has(e.pin_code)) pinMap.set(e.pin_code, []);
    pinMap.get(e.pin_code).push(e);
  }
  let pinIssues = 0;
  for (const [pin, emps] of pinMap) {
    if (emps.length > 1) {
      pinIssues++;
      warn(`PIN ${pin} sdílí ${emps.length} zaměstnanci: ${emps.map((e) => `${e.name}${e.active ? '' : ' (neaktivní)'}`).join(', ')}`);
    }
  }
  if (!pinIssues) ok('PINy jsou unikátní');

  // Schválené dovolené přes kontrolované měsíce (overlap fence)
  const windowStart = monthWindow(months[0]).start;
  const windowEnd = monthWindow(months[months.length - 1]).end;
  const { data: vacReqs } = await sb.from('requests')
    .select('employee_id, date_from, date_to')
    .eq('organization_id', org.id).eq('type', 'vacation').eq('status', 'approved')
    .lte('date_from', windowEnd)
    .or(`date_to.gte.${windowStart},and(date_to.is.null,date_from.gte.${windowStart})`);

  for (const month of months) {
    console.log(`\n── ${month} ──`);
    const { start, end } = monthWindow(month);

    // Docházka měsíce (stránkovaně)
    const logs = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('attendance_logs')
        .select('id, employee_id, date, check_in, check_out, note')
        .eq('organization_id', org.id).gte('date', start).lte('date', end)
        .order('date').range(from, from + 999);
      if (error) throw error;
      logs.push(...(data ?? []));
      if ((data ?? []).length < 1000) break;
    }

    // 2) Duplicitní záznamy dovolené na stejný den
    const vacLogKeys = new Map();
    for (const l of logs) {
      if (l.note !== VACATION_NOTE) continue;
      const k = `${l.employee_id}|${l.date}`;
      vacLogKeys.set(k, (vacLogKeys.get(k) ?? 0) + 1);
    }
    const dupVac = [...vacLogKeys.entries()].filter(([, n]) => n > 1);
    if (dupVac.length) {
      for (const [k, n] of dupVac) {
        const [empId, date] = k.split('|');
        warn(`${empById.get(empId)?.name ?? empId}: ${n}× záznam dovolené na ${date}`);
      }
    } else ok('Žádné duplicitní záznamy dovolené');

    // Množina schválených dnů dovolené v měsíci (podle žádostí)
    const approvedDays = new Map(); // empId -> Set(dates)
    for (const r of vacReqs ?? []) {
      for (const d of daysInRange(r.date_from, r.date_to, countWeekends, start, end)) {
        if (!approvedDays.has(r.employee_id)) approvedDays.set(r.employee_id, new Set());
        approvedDays.get(r.employee_id).add(d);
      }
    }

    // 3) Osiřelé záznamy dovolené (den není v žádné schválené žádosti)
    let orphans = 0;
    for (const l of logs) {
      if (l.note !== VACATION_NOTE) continue;
      if (!approvedDays.get(l.employee_id)?.has(l.date)) {
        orphans++;
        warn(`${empById.get(l.employee_id)?.name ?? l.employee_id}: záznam dovolené ${l.date} bez schválené žádosti`);
      }
    }
    if (!orphans) ok('Všechny záznamy dovolené mají schválenou žádost');

    // 4) Nepropsaná dovolená: schválený den bez JAKÉHOKOLI záznamu ten den
    // (jen u úvazků s nárokem na placenou dovolenou)
    const logDays = new Set(logs.map((l) => `${l.employee_id}|${l.date}`));
    let missing = 0;
    const today = pragueToday();
    for (const [empId, days] of approvedDays) {
      if (!hasPaidVacation(empId)) continue;
      for (const d of days) {
        if (d > today) continue; // budoucí dovolená se propisuje při schválení, ale netrestat plán
        if (!logDays.has(`${empId}|${d}`)) {
          missing++;
          warn(`${empById.get(empId)?.name ?? empId}: schválená dovolená ${d} není v docházce`);
        }
      }
    }
    if (!missing) ok('Schválená dovolená je propsaná v docházce');

    // 5) Překrývající se uzavřené záznamy (tentýž zaměstnanec)
    const byEmp = new Map();
    for (const l of logs) {
      if (!l.check_in || !l.check_out) continue;
      if (!byEmp.has(l.employee_id)) byEmp.set(l.employee_id, []);
      byEmp.get(l.employee_id).push(l);
    }
    let overlaps = 0;
    for (const [empId, list] of byEmp) {
      const sorted = [...list].sort((a, b) => a.check_in.localeCompare(b.check_in));
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        if (new Date(cur.check_in) < new Date(prev.check_out)) {
          overlaps++;
          warn(`${empById.get(empId)?.name ?? empId}: překryv záznamů ${prev.date} (${prev.check_in.slice(11, 16)}–${prev.check_out.slice(11, 16)}) × ${cur.date} (${cur.check_in.slice(11, 16)}–${cur.check_out.slice(11, 16)})`);
        }
      }
    }
    if (!overlaps) ok('Žádné překrývající se docházkové záznamy');

    // 6) Soulad: hodiny dovolené v docházce vs. schválené dny × 8
    let vacMismatch = 0;
    const vacHoursByEmp = new Map();
    for (const l of logs) {
      if (l.note !== VACATION_NOTE || !l.check_in || !l.check_out) continue;
      const h = (new Date(l.check_out) - new Date(l.check_in)) / 3600000;
      vacHoursByEmp.set(l.employee_id, (vacHoursByEmp.get(l.employee_id) ?? 0) + h);
    }
    for (const [empId, days] of approvedDays) {
      // Dovolená se propisuje dopředu při schválení → porovnáváme proti VŠEM
      // schváleným dnům měsíce. Nižší actual je legitimní (den přeskočen kvůli
      // existující docházce); vyšší = dublování.
      const expected = days.size * 8;
      const actual = vacHoursByEmp.get(empId) ?? 0;
      if (actual > expected + 0.01) {
        vacMismatch++;
        warn(`${empById.get(empId)?.name ?? empId}: dovolená v docházce ${actual.toFixed(1)} h > očekáváno max ${expected} h (${days.size} dní) — možné dublování`);
      }
    }
    if (!vacMismatch) ok('Hodiny dovolené odpovídají schváleným dnům (žádné dublování)');
  }

  // 7) Neuzavřené směny ze starších dnů (mimo dnešek)
  const { data: openOld } = await sb.from('attendance_logs')
    .select('employee_id, date')
    .eq('organization_id', org.id)
    .not('check_in', 'is', null).is('check_out', null)
    .lt('date', pragueToday())
    .gte('date', monthWindow(months[0]).start);
  if (openOld?.length) {
    for (const l of openOld) warn(`${empById.get(l.employee_id)?.name ?? l.employee_id}: neuzavřená směna z ${l.date}`);
  } else ok('Žádné neuzavřené směny ze starších dnů');

  // 8) Blížící se řádkové limity
  const yearAgo = toISO(new Date(new Date().setFullYear(new Date().getFullYear() - 1)));
  const { count: reqCount } = await sb.from('requests')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', org.id).gte('date_from', yearAgo);
  if ((reqCount ?? 0) > 900) warn(`Žádosti za poslední rok: ${reqCount} — blíží se limitu 1000/dotaz`);
  else ok(`Počty řádků v normě (žádosti za rok: ${reqCount ?? 0})`);
}

// ── main ─────────────────────────────────────────────────────────────────────
console.log(`TeamFlow datový audit · kontrolované měsíce: ${months.join(', ')}`);
const { data: orgs, error } = await sb.from('organizations').select('id, name');
if (error) { console.error('Nelze načíst organizace:', error.message); process.exit(2); }

for (const org of orgs ?? []) {
  try {
    await auditOrg(org);
  } catch (err) {
    problems++;
    console.error(`  ✗ Audit organizace ${org.name} selhal:`, err.message ?? err);
  }
}

console.log(`\n${'═'.repeat(50)}`);
if (problems === 0) {
  console.log('✅ Vše v pořádku — exporty budou sedět.');
} else {
  console.log(`❌ Nalezeno ${problems} problémů — viz výše.`);
  process.exit(1);
}
