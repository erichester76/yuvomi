/**
 * Modul: MCP-Tools
 * Zweck: Kuratiertes Tool-Set für den MCP-Endpoint (Lesen/Anlegen der häufigsten
 *        Entitäten). Reine Funktionen `(database, actorId, args)` — testbar ohne
 *        laufenden Server, wiederverwendbar zur Laufzeit über `db.get()`.
 * Abhängigkeiten: server/middleware/validate.js
 *
 * Architektur: Jedes Tool ist EIN Eintrag in TOOLS (Definition + Handler zusammen)
 *   — daraus werden `tools/list` und der Dispatch abgeleitet, damit Name, Schema
 *   und Implementierung nicht auseinanderlaufen können.
 *
 * Quelle der Validierungs-/Enum-Regeln: server/routes/tasks.js, shopping.js,
 * calendar.js. Bei Änderungen dort diese Datei mitziehen.
 */

import * as v from '../middleware/validate.js';

// Spiegelt server/routes/tasks.js (bewusst dupliziert, um die Tool-Schicht von
// express/db in tasks.js zu entkoppeln — siehe Modul-Header).
const VALID_PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent'];
const VALID_CATEGORIES = ['household', 'school', 'shopping', 'repair',
                          'health', 'finance', 'leisure', 'misc'];

/** Fehler mit für den aufrufenden Client (LLM) sichtbarer Nachricht. */
class ToolError extends Error {}

// --------------------------------------------------------
// Tool-Implementierungen (reine Funktionen)
// --------------------------------------------------------

function listTasks(db, args) {
  let sql = `
    SELECT id, title, status, priority, category, due_date, due_time
    FROM tasks
    WHERE parent_task_id IS NULL
  `;
  const params = [];
  if (args.status) {
    const s = v.oneOf(args.status, ['open', 'in_progress', 'done', 'archived'], 'status');
    if (s.error) throw new ToolError(s.error);
    sql += ' AND status = ?';
    params.push(args.status);
  } else {
    sql += " AND status != 'archived'";
  }
  sql += `
    ORDER BY CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC, created_at DESC
    LIMIT 100
  `;
  return db.prepare(sql).all(...params);
}

function createTask(db, actorId, args) {
  const title = v.str(args.title, 'title', { required: true });
  const description = v.str(args.description, 'description', { required: false, max: v.MAX_TEXT });
  const priority = v.oneOf(args.priority, VALID_PRIORITIES, 'priority');
  const category = v.oneOf(args.category, VALID_CATEGORIES, 'category');
  const dueDate = v.date(args.due_date, 'due_date');
  const dueTime = v.time(args.due_time, 'due_time');

  const errors = v.collectErrors([title, description, priority, category, dueDate, dueTime]);
  if (errors.length) throw new ToolError(errors.join(' '));

  const result = db.prepare(`
    INSERT INTO tasks (title, description, category, priority, due_date, due_time, created_by, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'open')
  `).run(
    title.value,
    description.value,
    category.value || 'Sonstiges',
    priority.value || 'none',
    dueDate.value,
    dueTime.value,
    actorId,
  );

  return db.prepare(
    'SELECT id, title, status, priority, category, due_date, due_time FROM tasks WHERE id = ?'
  ).get(result.lastInsertRowid);
}

function listShoppingItems(db, args) {
  let sql = `
    SELECT si.id, si.name, si.quantity, si.category, si.is_checked, sl.name AS list
    FROM shopping_items si
    JOIN shopping_lists sl ON sl.id = si.list_id
  `;
  if (args.include_checked !== true) sql += ' WHERE si.is_checked = 0';
  sql += ' ORDER BY si.created_at DESC LIMIT 200';
  return db.prepare(sql).all();
}

function addShoppingItem(db, actorId, args) {
  const name = v.str(args.name, 'name', { required: true });
  const quantity = v.str(args.quantity, 'quantity', { required: false, max: v.MAX_SHORT });
  const category = v.str(args.category, 'category', { required: false, max: v.MAX_SHORT });

  const errors = v.collectErrors([name, quantity, category]);
  if (errors.length) throw new ToolError(errors.join(' '));

  const list = args.list
    ? db.prepare('SELECT id FROM shopping_lists WHERE name = ? ORDER BY id LIMIT 1').get(String(args.list).trim())
    : db.prepare('SELECT id FROM shopping_lists ORDER BY id LIMIT 1').get();

  if (!list) {
    throw new ToolError(args.list
      ? `No shopping list named "${args.list}" found.`
      : 'No shopping list exists yet. Create one in the app first.');
  }

  const result = db.prepare(`
    INSERT INTO shopping_items (list_id, name, quantity, category)
    VALUES (?, ?, ?, ?)
  `).run(list.id, name.value, quantity.value, category.value || 'Sonstiges');

  return db.prepare(`
    SELECT si.id, si.name, si.quantity, si.category, si.is_checked, sl.name AS list
    FROM shopping_items si JOIN shopping_lists sl ON sl.id = si.list_id
    WHERE si.id = ?
  `).get(result.lastInsertRowid);
}

function listUpcomingEvents(db, args) {
  let limit = parseInt(args.limit, 10);
  if (!Number.isFinite(limit)) limit = 20;
  limit = Math.min(Math.max(limit, 1), 100);
  return db.prepare(`
    SELECT id, title, start_datetime, end_datetime, all_day, location
    FROM calendar_events
    WHERE date(start_datetime) >= date('now')
    ORDER BY start_datetime ASC
    LIMIT ?
  `).all(limit);
}

function createEvent(db, actorId, args) {
  const title = v.str(args.title, 'title', { required: true });
  const start = v.datetime(args.start_datetime, 'start_datetime', true);
  const end = v.datetime(args.end_datetime, 'end_datetime', false);
  const location = v.str(args.location, 'location', { required: false, max: v.MAX_SHORT });
  const description = v.str(args.description, 'description', { required: false, max: v.MAX_TEXT });

  const errors = v.collectErrors([title, start, end, location, description]);
  if (errors.length) throw new ToolError(errors.join(' '));

  const result = db.prepare(`
    INSERT INTO calendar_events
      (title, description, start_datetime, end_datetime, all_day, location, created_by, external_source)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'local')
  `).run(
    title.value,
    description.value,
    start.value,
    end.value,
    args.all_day === true ? 1 : 0,
    location.value,
    actorId,
  );

  return db.prepare(`
    SELECT id, title, start_datetime, end_datetime, all_day, location
    FROM calendar_events WHERE id = ?
  `).get(result.lastInsertRowid);
}

// --------------------------------------------------------
// Registry: Definition + Handler je Tool an EINER Stelle.
// `handler(ctx, args)` mit ctx = { db, actor: { id, role } }.
// --------------------------------------------------------

const TOOLS = [
  {
    name: 'list_tasks',
    description: 'List the family\'s current top-level tasks (open by default). Optionally filter by status.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'in_progress', 'done', 'archived'], description: 'Filter by task status.' },
      },
    },
    handler: (ctx, args) => listTasks(ctx.db, args),
  },
  {
    name: 'create_task',
    description: 'Create a new task on the family planner.',
    inputSchema: {
      type: 'object',
      properties: {
        title:       { type: 'string', description: 'Short task title (required).' },
        description: { type: 'string', description: 'Optional longer description.' },
        category:    { type: 'string', enum: VALID_CATEGORIES, description: 'Optional category.' },
        priority:    { type: 'string', enum: VALID_PRIORITIES, description: 'Optional priority (default none).' },
        due_date:    { type: 'string', description: 'Optional due date, format YYYY-MM-DD.' },
        due_time:    { type: 'string', description: 'Optional due time, format HH:MM.' },
      },
      required: ['title'],
    },
    handler: (ctx, args) => createTask(ctx.db, ctx.actor.id, args),
  },
  {
    name: 'list_shopping_items',
    description: 'List shopping items across all lists (unchecked by default).',
    inputSchema: {
      type: 'object',
      properties: {
        include_checked: { type: 'boolean', description: 'Also include already-checked items.' },
      },
    },
    handler: (ctx, args) => listShoppingItems(ctx.db, args),
  },
  {
    name: 'add_shopping_item',
    description: 'Add an item to a shopping list. Uses the first list if none is named.',
    inputSchema: {
      type: 'object',
      properties: {
        name:     { type: 'string', description: 'Item name (required).' },
        quantity: { type: 'string', description: 'Optional quantity, e.g. "2" or "500 g".' },
        category: { type: 'string', description: 'Optional category.' },
        list:     { type: 'string', description: 'Optional target list name.' },
      },
      required: ['name'],
    },
    handler: (ctx, args) => addShoppingItem(ctx.db, ctx.actor.id, args),
  },
  {
    name: 'list_upcoming_events',
    description: 'List upcoming calendar events from today onward.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Max number of events (1-100, default 20).' },
      },
    },
    handler: (ctx, args) => listUpcomingEvents(ctx.db, args),
  },
  {
    name: 'create_event',
    description: 'Create a calendar event.',
    inputSchema: {
      type: 'object',
      properties: {
        title:          { type: 'string', description: 'Event title (required).' },
        start_datetime: { type: 'string', description: 'Start, format YYYY-MM-DD or YYYY-MM-DDTHH:MM (required).' },
        end_datetime:   { type: 'string', description: 'Optional end, same format as start.' },
        all_day:        { type: 'boolean', description: 'Whether the event lasts all day.' },
        location:       { type: 'string', description: 'Optional location.' },
        description:    { type: 'string', description: 'Optional description.' },
      },
      required: ['title', 'start_datetime'],
    },
    handler: (ctx, args) => createEvent(ctx.db, ctx.actor.id, args),
  },
];

// Abgeleitet aus TOOLS — keine getrennt zu pflegende Struktur.
const TOOL_DEFINITIONS = TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));

/**
 * Führt ein Tool aus.
 * @param {{ db: object, actor: { id: number, role?: string } }} ctx
 * @param {string} name  - Tool-Name
 * @param {object} args  - Tool-Argumente
 * @returns {any} rohes Ergebnis (wird vom Protokoll-Layer serialisiert)
 * @throws {ToolError} bei unbekanntem Tool oder Validierungsfehler
 */
function callTool(ctx, name, args = {}) {
  const tool = TOOL_MAP.get(name);
  if (!tool) throw new ToolError(`Unknown tool: ${name}`);
  return tool.handler(ctx, args || {});
}

export { TOOL_DEFINITIONS, callTool, ToolError };
