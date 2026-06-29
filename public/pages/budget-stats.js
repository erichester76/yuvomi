/**
 * Modul: Budget-Statistik-View
 * Zweck: Statistik-Tab (Zeitraum-Filter, Summary-Cards, Trendlinie, Donut, CSV-Export).
 */
import { api } from '/api.js';
import { t } from '/i18n.js';
import { toLocalDateKey } from '/utils/date.js';

const view = { range: 'month', anchor: toLocalDateKey(new Date()), data: null, ctx: null };

export async function renderStats(panel, ctx) {
  view.ctx = ctx;
  panel.insertAdjacentHTML('beforeend',
    `<div class="budget-stats" id="budget-stats-root">${t('budget.statsTrendTitle')}</div>`);
}
