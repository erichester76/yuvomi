import { api } from '/api.js';
import { t } from '/i18n.js';

const APPEARANCE_PATH = '/settings/personal/appearance';

function renderPage(container) {
  const currentMode = container.dataset.budgetMode || 'shared';
  container.replaceChildren();
  container.insertAdjacentHTML('beforeend', `
    <section class="settings-section">
      <h2 class="settings-section__title">${t('settings.sectionBudget')}</h2>
      <div class="settings-card">
        <h3 class="settings-card__title">${t('settings.budgetModeTitle')}</h3>
        <p class="form-hint">${t('settings.budgetModeDescription')}</p>
        <label class="settings-row">
          <span>${t('settings.budgetModeLabel')}</span>
          <select class="form-input" id="budget-mode-select">
            <option value="shared" ${currentMode === 'shared' ? 'selected' : ''}>${t('settings.budgetModeShared')}</option>
            <option value="personal" ${currentMode === 'personal' ? 'selected' : ''}>${t('settings.budgetModePersonal')}</option>
          </select>
        </label>
      </div>
      <div class="settings-card">
        <h3 class="settings-card__title">${t('settings.currencyLabel')}</h3>
        <p class="form-hint">${t('settings.currencyMovedHint')}</p>
        <div class="settings-form-actions">
          <a class="btn btn--secondary" href="${APPEARANCE_PATH}" id="budget-region-link">${t('settings.regionTitle')}</a>
        </div>
      </div>
    </section>
  `);
}

function bindEvents(container) {
  const link = container.querySelector('#budget-region-link');
  link?.addEventListener('click', (event) => {
    if (!window.yuvomi?.navigate) return;
    event.preventDefault();
    window.yuvomi.navigate(APPEARANCE_PATH);
  });
  container.querySelector('#budget-mode-select')?.addEventListener('change', async (event) => {
    const value = event.currentTarget.value;
    try {
      await api.put('/preferences', { budget_mode: value });
      container.dataset.budgetMode = value;
      window.yuvomi?.showToast(t('settings.budgetModeSaved'), 'success');
    } catch (err) {
      event.currentTarget.value = container.dataset.budgetMode || 'shared';
      window.yuvomi?.showToast(err?.data?.error ?? t('common.errorGeneric'), 'danger');
    }
  });
}

export async function render(container, { user }) {
  void user;
  try {
    const prefs = await api.get('/preferences');
    container.dataset.budgetMode = prefs.data?.budget_mode || 'shared';
  } catch {
    container.dataset.budgetMode = 'shared';
  }
  renderPage(container);
  bindEvents(container);
}
