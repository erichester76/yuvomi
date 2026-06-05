/**
 * Modul: Google Calendar Multi-Kalender – Unit-Tests
 * Zweck: Auswahltabelle, pro-Kalender-Sync-Token, Single→Multi-Migration,
 *        Outbound-Ziel-Validierung.
 * Ausführen: node test/test-google-multi.js
 */
process.env.DB_PATH = ':memory:';

const db = (await import('../server/db.js')).get();

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}: ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion fehlgeschlagen'); }
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

console.log('\n[Google Multi] Schema + Migration\n');

test('google_calendar_selection table exists with expected columns', () => {
  const cols = db.prepare(`PRAGMA table_info(google_calendar_selection)`).all().map(c => c.name);
  for (const c of ['calendar_id', 'name', 'color', 'enabled', 'sync_token', 'last_sync']) {
    assert(cols.includes(c), `Spalte ${c} fehlt`);
  }
});

test('calendar_events has target_google_calendar_id column', () => {
  const cols = db.prepare(`PRAGMA table_info(calendar_events)`).all().map(c => c.name);
  assert(cols.includes('target_google_calendar_id'), 'target_google_calendar_id fehlt');
});

console.log(`\n[Google Multi] ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
