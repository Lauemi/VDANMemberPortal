;(() => {
  const FALLBACK_MASK_PATH = '/app/';
  const STANDARD_VIEWPORTS = ['web', 'tablet', 'phone'];
  const PREVIEW_AUDIENCES = ['live', 'guest', 'member', 'manager', 'admin', 'superadmin'];

  const picker = {
    enabled: false,
    frame: null,
    selectedEl: null,
    hoverEl: null,
    onClick: null,
    onMove: null,
    onPointerDown: null,
    onPointerMove: null,
    onWheelBlock: null,
    onTouchMoveBlock: null,
    onTouchStartBlock: null,
    onDocMove: null,
    onDocClick: null,
    onLayerMove: null,
    onLayerClick: null,
    onLayerRefresh: null,
    pickLayerEl: null,
    pickLayerMap: null,
    hostOverlayEl: null,
  };
  let pickLastActionTs = 0;
  const pickDebug = {
    mode: 'off',
    hover: 0,
    click: 0,
    targetHits: 0,
    targetMiss: 0,
    last: 'init',
    lastTarget: '-',
  };

  const editor = {
    schema: null,
    selected: null,
    dragSource: null,
  };
  const pickPanels = { details: true, notes: true };
  let selectedAuditComponentId = '';

  const COMPONENT_TEMPLATES = [
    { type: 'header-brand', title: 'Header Brand', hint: 'Logo / Markenbereich', slot: 'header', variant: 'logo', span: 4, minHeight: 56 },
    { type: 'header-menu', title: 'Header Menu', hint: 'Burger / Action Button', slot: 'header', variant: 'icon', span: 2, minHeight: 56 },
    { type: 'hero-card', title: 'Hero Card', hint: 'Intro / CTA Bereich', slot: 'main', variant: 'hero', span: 12, minHeight: 140 },
    { type: 'table', title: 'Data Table', hint: 'Rows, Filter, Sortierung', slot: 'main', variant: 'standard', span: 12, minHeight: 220 },
    { type: 'card-grid', title: 'Card Grid', hint: 'Alternative Kartenansicht', slot: 'main', variant: 'grid', span: 12, minHeight: 180 },
    { type: 'form-block', title: 'Form Block', hint: 'Eingaben + Aktionen', slot: 'main', variant: 'form', span: 6, minHeight: 180 },
    { type: 'info-panel', title: 'Info Panel', hint: 'Status / Hinweise', slot: 'main', variant: 'info', span: 6, minHeight: 140 },
    { type: 'action-row', title: 'Action Row', hint: 'Buttons / Quick Actions', slot: 'footer', variant: 'actions', span: 12, minHeight: 84 },
  ];
  const STUDIO_COMPONENT_TYPES = ['table', 'card', 'dialog', 'button', 'input', 'list', 'section', 'header', 'footer'];
  const STUDIO_SLOTS = ['header', 'main', 'sidebar', 'footer'];
  const STUDIO_LIBRARY_MAP = {
    table: 'LIB_TABLE_STANDARD_V1',
    card: 'LIB_CARD_STANDARD_V1',
    dialog: 'LIB_DIALOG_STANDARD_V1',
    button: 'LIB_BUTTON_STANDARD_V1',
    input: 'LIB_INPUT_STANDARD_V1',
    list: 'LIB_LIST_STANDARD_V1',
    section: 'LIB_SECTION_STANDARD_V1',
    header: 'LIB_HEADER_STANDARD_V1',
    footer: 'LIB_FOOTER_STANDARD_V1',
  };
  const COMPONENT_LIBRARY_KEYS = new Set([
    'buttons--primary-button',
    'buttons--secondary-button',
    'buttons--ghost-button',
    'buttons--icon-button',
    'buttons--danger-button',
    'inputs--text-input',
    'inputs--select',
    'inputs--search-input',
    'inputs--textarea',
    'inputs--checkbox-switch-radio',
    'chips--status-badge',
    'chips--filter-chip',
    'chips--info-tag',
    'chips--beta-badge',
    'cards--standard-card',
    'cards--feed-card',
    'cards--info-card',
    'cards--action-card',
    'navigation--header-elements',
    'navigation--burger-button',
    'navigation--tab-bar',
    'navigation--bottom-actions',
    'navigation--quick-actions',
    'dialogs--confirm-dialog',
    'dialogs--info-dialog',
    'dialogs--form-dialog',
    'dialogs--bottom-sheet-action-sheet',
    'lists--standard-tabelle',
    'lists--table-row',
    'lists--card-list-item',
    'lists--toolbar',
    'lists--ansichtsumschalter-tabelle-karte',
    'lists--filter-bar',
  ]);
  const COMPONENT_ID_LIBRARY_RULES = [
    { re: /(fangliste|catch|work|members).*(table|grid)|table-/i, key: 'lists--standard-tabelle' },
    { re: /(table-row|row-)/i, key: 'lists--table-row' },
    { re: /(view-toggle|kartenansicht|table.*card|card.*table)/i, key: 'lists--ansichtsumschalter-tabelle-karte' },
    { re: /(toolbar|filter-bar|filterbar)/i, key: 'lists--toolbar' },
    { re: /(dialog|sheet|modal)/i, key: 'dialogs--form-dialog' },
    { re: /(header|brand|logo|nav-top)/i, key: 'navigation--header-elements' },
    { re: /(burger|menu-toggle)/i, key: 'navigation--burger-button' },
    { re: /(portal-quick|quick)/i, key: 'navigation--quick-actions' },
    { re: /(feed-btn|primary|submit|confirm|copy)/i, key: 'buttons--primary-button' },
    { re: /(ghost|secondary|cancel|close)/i, key: 'buttons--ghost-button' },
    { re: /(input|search|select|textarea)/i, key: 'inputs--text-input' },
    { re: /(card|panel|surface)/i, key: 'cards--standard-card' },
    { re: /(beta|badge)/i, key: 'chips--beta-badge' },
  ];
  const SPLIT_WIDTH_KEY = 'templateStudio.controlsWidth';
  const isDomElement = (node) => Boolean(node && node.nodeType === 1);
  const LIBRARY_STORAGE_KEY = 'vdan_component_library_standards_v1';
  const SPECIAL_MASK_CACHE_KEY = 'templateStudio.specialMasks.v1';
  const specialMaskCache = new Set();

  function normalizeMaskPath(value) {
    const raw = String(value || '').trim();
    if (!raw) return FALLBACK_MASK_PATH;
    if (!raw.startsWith('/')) return FALLBACK_MASK_PATH;
    return raw.endsWith('/') ? raw : `${raw}/`;
  }

  function readSpecialMaskCache() {
    specialMaskCache.clear();
    try {
      const raw = localStorage.getItem(SPECIAL_MASK_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      parsed
        .map((entry) => normalizeMaskPath(entry))
        .filter(Boolean)
        .forEach((entry) => specialMaskCache.add(entry));
    } catch {
      // ignore malformed cache
    }
  }

  function writeSpecialMaskCache() {
    try {
      localStorage.setItem(SPECIAL_MASK_CACHE_KEY, JSON.stringify([...specialMaskCache]));
    } catch {
      // ignore storage errors
    }
  }

  function selectedMaskPath() {
    const select = document.getElementById('templateMaskPath');
    if (!(select instanceof HTMLSelectElement)) return FALLBACK_MASK_PATH;
    return normalizeMaskPath(select.value);
  }

  function syncMaskSelects(path) {
    const next = normalizeMaskPath(path);
    const a = document.getElementById('templateMaskPath');
    const b = document.getElementById('templateEditorMaskPath');
    if (a instanceof HTMLSelectElement) a.value = next;
    if (b instanceof HTMLSelectElement) b.value = next;
  }

  function uid(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function renderPickDebug() {
    const el = document.getElementById('templatePickDebug');
    if (!(el instanceof HTMLElement)) return;
    el.textContent = [
      `mode: ${pickDebug.mode}`,
      `hover_hits: ${pickDebug.hover}`,
      `click_hits: ${pickDebug.click}`,
      `target_hits: ${pickDebug.targetHits}`,
      `target_miss: ${pickDebug.targetMiss}`,
      `last: ${pickDebug.last}`,
      `last_target: ${pickDebug.lastTarget}`,
    ].join('\n');
  }

  function setPickDebug(patch) {
    Object.assign(pickDebug, patch);
    renderPickDebug();
  }

  function setSection(next) {
    const section = next === 'mask-editor' ? 'mask-editor' : 'standard-template';
    const sectionSelect = document.getElementById('templateSectionSelect');
    if (sectionSelect instanceof HTMLSelectElement) sectionSelect.value = section;
    const panels = [...document.querySelectorAll('.template-section[data-template-panel]')];
    panels.forEach((panel) => {
      if (!(panel instanceof HTMLElement)) return;
      const on = panel.dataset.templatePanel === section;
      panel.toggleAttribute('hidden', !on);
      panel.classList.toggle('is-active', on);
    });
    if (section !== 'standard-template') stopPicking();
  }

  function setViewport(next) {
    const viewport = STANDARD_VIEWPORTS.includes(next) ? next : 'web';
    const select = document.getElementById('templateViewportSelect');
    if (select instanceof HTMLSelectElement) select.value = viewport;
    const buttons = [...document.querySelectorAll('.template-vp-btn[data-template-viewport]')];
    buttons.forEach((btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      btn.classList.toggle('is-active', btn.dataset.templateViewport === viewport);
    });

    const shell = document.getElementById('templateLiveShell');
    if (!(shell instanceof HTMLElement)) return;
    shell.classList.remove('is-web', 'is-tablet', 'is-phone');
    shell.classList.add(`is-${viewport}`);
  }

  function setEditorViewport(next) {
    const viewport = STANDARD_VIEWPORTS.includes(next) ? next : 'web';
    const buttons = [...document.querySelectorAll('.template-vp-btn[data-editor-viewport]')];
    buttons.forEach((btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      btn.classList.toggle('is-active', btn.dataset.editorViewport === viewport);
    });

    const canvas = document.getElementById('editorCanvas');
    if (canvas instanceof HTMLElement) {
      canvas.classList.remove('is-web', 'is-tablet', 'is-phone');
      canvas.classList.add(`is-${viewport}`);
    }
    if (editor.schema) {
      editor.schema.mask.viewport = viewport;
      touchSchema();
    }
  }

  function activeViewport() {
    const select = document.getElementById('templateViewportSelect');
    if (select instanceof HTMLSelectElement) {
      const val = String(select.value || 'web').trim().toLowerCase();
      if (STANDARD_VIEWPORTS.includes(val)) return val;
    }
    const active = document.querySelector('.template-vp-btn.is-active[data-template-viewport]');
    if (!(active instanceof HTMLButtonElement)) return 'web';
    return String(active.dataset.templateViewport || 'web');
  }

  function activeEditorViewport() {
    const active = document.querySelector('.template-vp-btn.is-active[data-editor-viewport]');
    if (!(active instanceof HTMLButtonElement)) return 'web';
    return String(active.dataset.editorViewport || 'web');
  }

  function activePreviewAudience() {
    const select = document.getElementById('templateAudienceSelect');
    if (select instanceof HTMLSelectElement) {
      const val = String(select.value || 'live').trim().toLowerCase();
      if (PREVIEW_AUDIENCES.includes(val)) return val;
    }
    const active = document.querySelector('.template-vp-btn.is-active[data-template-audience]');
    if (!(active instanceof HTMLButtonElement)) return 'live';
    const val = String(active.dataset.templateAudience || 'live').trim().toLowerCase();
    return PREVIEW_AUDIENCES.includes(val) ? val : 'live';
  }

  function restorePreviewVisibility(doc) {
    const nodes = doc.querySelectorAll('[data-guest-only], [data-member-only], [data-manager-only], [data-admin-only], [data-superadmin-only], [data-admin-or-superadmin-only]');
    nodes.forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const hadHiddenAttr = el.dataset.studioOrigHiddenAttr === '1';
      const hadHiddenClass = el.dataset.studioOrigHiddenClass === '1';
      el.toggleAttribute('hidden', hadHiddenAttr);
      el.classList.toggle('hidden', hadHiddenClass);
    });
  }

  function setForcedVisibility(doc, selector, visible) {
    doc.querySelectorAll(selector).forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      if (!('studioOrigHiddenAttr' in el.dataset)) {
        el.dataset.studioOrigHiddenAttr = el.hasAttribute('hidden') ? '1' : '0';
      }
      if (!('studioOrigHiddenClass' in el.dataset)) {
        el.dataset.studioOrigHiddenClass = el.classList.contains('hidden') ? '1' : '0';
      }
      el.toggleAttribute('hidden', !visible);
      el.classList.toggle('hidden', !visible);
    });
  }

  function applyPreviewAudienceToFrame(audience) {
    const frame = document.getElementById('templateLiveFrame');
    if (!(frame instanceof HTMLIFrameElement)) return;
    try {
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      if (audience === 'live') {
        restorePreviewVisibility(doc);
        return;
      }
      if (audience === 'guest') {
        setForcedVisibility(doc, '[data-guest-only]', true);
        setForcedVisibility(doc, '[data-member-only]', false);
        setForcedVisibility(doc, '[data-manager-only], [data-admin-only], [data-superadmin-only], [data-admin-or-superadmin-only]', false);
        return;
      }
      if (audience === 'member') {
        setForcedVisibility(doc, '[data-guest-only]', false);
        setForcedVisibility(doc, '[data-member-only]', true);
        setForcedVisibility(doc, '[data-manager-only], [data-admin-only], [data-superadmin-only], [data-admin-or-superadmin-only]', false);
        return;
      }
      if (audience === 'manager') {
        setForcedVisibility(doc, '[data-guest-only]', false);
        setForcedVisibility(doc, '[data-member-only], [data-manager-only]', true);
        setForcedVisibility(doc, '[data-admin-only], [data-superadmin-only], [data-admin-or-superadmin-only]', false);
        return;
      }
      if (audience === 'admin') {
        setForcedVisibility(doc, '[data-guest-only]', false);
        setForcedVisibility(doc, '[data-member-only], [data-manager-only], [data-admin-only], [data-admin-or-superadmin-only]', true);
        setForcedVisibility(doc, '[data-superadmin-only]', false);
        return;
      }
      if (audience === 'superadmin') {
        setForcedVisibility(doc, '[data-guest-only]', false);
        setForcedVisibility(doc, '[data-member-only], [data-manager-only], [data-admin-only], [data-superadmin-only], [data-admin-or-superadmin-only]', true);
      }
    } catch {
      // ignore cross-context access errors
    }
  }

  function setPreviewAudience(next) {
    const audience = PREVIEW_AUDIENCES.includes(next) ? next : 'live';
    const select = document.getElementById('templateAudienceSelect');
    if (select instanceof HTMLSelectElement) select.value = audience;
    const buttons = [...document.querySelectorAll('.template-vp-btn[data-template-audience]')];
    buttons.forEach((btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      btn.classList.toggle('is-active', btn.dataset.templateAudience === audience);
    });
    applyPreviewAudienceToFrame(audience);
    updateStudioOverview();
  }

  function inferComponentType(el) {
    if (!isDomElement(el)) return 'section';
    const explicit = String(el.getAttribute('data-studio-component-type') || '').trim().toLowerCase();
    if (explicit) return explicit;
    if (el.hasAttribute('data-table-id') || el.matches('table, .catch-table, .fangliste-table, .work-part-table')) return 'table';
    if (el.matches('button, .feed-btn, [role="button"]')) return 'button';
    if (el.matches('input, select, textarea')) return 'input';
    if (el.matches('dialog, [role="dialog"], .dialog, .catch-dialog')) return 'dialog';
    if (el.matches('header, .header')) return 'header';
    if (el.matches('footer, .site-footer')) return 'footer';
    if (el.matches('ul, ol, .list, .card-list')) return 'list';
    if (el.matches('.card, article')) return 'card';
    return 'section';
  }

  function inferComponentSlot(el) {
    if (!isDomElement(el)) return 'main';
    const explicit = String(el.getAttribute('data-studio-slot') || '').trim().toLowerCase();
    if (explicit) return explicit;
    if (el.closest('header, .header')) return 'header';
    if (el.closest('footer, .site-footer')) return 'footer';
    if (el.closest('aside, .sidebar')) return 'sidebar';
    return 'main';
  }

  function elementLabel(el) {
    if (!isDomElement(el)) return '-';
    const explicit =
      String(el.getAttribute('data-component-name') || '').trim() ||
      String(el.getAttribute('aria-label') || '').trim();
    if (explicit) return explicit;
    const text = String(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 52);
    return text || el.tagName.toLowerCase();
  }

  function mapComponentToLibrary(id, type, label, preferred) {
    const idNorm = String(id || '').trim().toLowerCase();
    const typeNorm = String(type || '').trim().toLowerCase();
    const labelNorm = String(label || '').trim().toLowerCase();
    const preferredNorm = String(preferred || '').trim().toLowerCase();

    if (preferredNorm && COMPONENT_LIBRARY_KEYS.has(preferredNorm)) return preferredNorm;

    if (COMPONENT_LIBRARY_KEYS.has(idNorm)) return idNorm;
    for (const rule of COMPONENT_ID_LIBRARY_RULES) {
      if (rule.re.test(idNorm) || rule.re.test(labelNorm)) {
        return rule.key;
      }
    }

    // Optional fallback on type mapping, still constrained to known library keys.
    const fallbackByType = {
      table: 'lists--standard-tabelle',
      list: 'lists--card-list-item',
      dialog: 'dialogs--form-dialog',
      button: 'buttons--primary-button',
      input: 'inputs--text-input',
      card: 'cards--standard-card',
      header: 'navigation--header-elements',
      footer: 'navigation--bottom-actions',
      section: 'cards--standard-card',
    }[typeNorm];
    if (fallbackByType && COMPONENT_LIBRARY_KEYS.has(fallbackByType)) return fallbackByType;
    return '';
  }

  function readLibraryComponentStandards() {
    try {
      const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      const components = parsed && typeof parsed === 'object' ? parsed.components : null;
      return components && typeof components === 'object' ? components : {};
    } catch {
      return {};
    }
  }

  function pickSpecFields(fields) {
    if (!fields || typeof fields !== 'object') return [];
    const keyOrder = [
      'height',
      'width',
      'padding',
      'radius',
      'font',
      'icon',
      'touch',
      'states',
      'colors',
      'usage',
      'patterns',
    ];
    return keyOrder
      .filter((key) => String(fields[key] || '').trim())
      .map((key) => ({ key, label: key.toUpperCase(), value: String(fields[key]).trim() }));
  }

  function collectAuditableComponents(doc) {
    if (!doc?.body) return [];
    const candidates = [...doc.querySelectorAll('[data-studio-component-id], [data-component-id], [data-table-id], button, .card, section, article')];
    const seen = new Set();
    const rows = [];
    let autoIdx = 0;

    candidates.forEach((el) => {
      if (!isDomElement(el)) return;
      const explicitStudioId = String(el.getAttribute('data-studio-component-id') || '').trim();
      const explicitLegacyId = String(el.getAttribute('data-component-id') || '').trim();
      const tableId = el.hasAttribute('data-table-id') ? String(el.getAttribute('data-table-id') || '').trim() : '';
      const domId = String(el.id || '').trim();
      let id = explicitStudioId || explicitLegacyId || (tableId ? `table-${tableId}` : '') || (domId ? `dom-${domId}` : '');
      if (!id) {
        const tag = el.tagName.toLowerCase();
        if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'textarea') {
          autoIdx += 1;
          id = `auto-${tag}-${autoIdx}`;
        }
      }
      if (!id || seen.has(id)) return;
      seen.add(id);

      const type = inferComponentType(el);
      const slot = inferComponentSlot(el);
      const label = elementLabel(el);
      const preferredLibraryId = String(el.getAttribute('data-studio-library-id') || '').trim();
      const libraryId = mapComponentToLibrary(id, type, label, preferredLibraryId);
      const exportable = Boolean(explicitStudioId && String(el.getAttribute('data-studio-component-type') || '').trim() && String(el.getAttribute('data-studio-slot') || '').trim());
      rows.push({
        id,
        type,
        slot,
        label,
        ok: Boolean(libraryId && COMPONENT_LIBRARY_KEYS.has(libraryId)),
        libraryId: libraryId || 'kein Mapping',
        table: Boolean(tableId),
        exportable,
      });
    });

    return rows;
  }

  function renderComponentAudit(doc, state = 'ready') {
    const list = document.getElementById('templateComponentAuditList');
    if (!(list instanceof HTMLElement)) return;
    if (state === 'loading') {
      list.innerHTML = '<li class="template-audit-list__empty">Preview lädt noch… Komponenten werden gleich erkannt.</li>';
      return;
    }
    if (!doc?.body) {
      list.innerHTML = '<li class="template-audit-list__empty">Noch keine Komponenten erkannt.</li>';
      return;
    }
    const rows = collectAuditableComponents(doc);

    if (!rows.length) {
      list.innerHTML = '<li class="template-audit-list__empty">Keine auswertbaren Komponenten mit ID auf der aktuellen Seite.</li>';
      return;
    }

    const libraryState = readLibraryComponentStandards();
    list.innerHTML = rows
      .map((row) => {
        const lib = row.libraryId && row.libraryId !== 'kein Mapping' ? libraryState[row.libraryId] : null;
        const specs = pickSpecFields(lib);
        const specRows = specs.length
          ? specs.map((entry) => `<div class="template-audit-item__meta"><strong>${esc(entry.label)}:</strong> ${esc(entry.value)}</div>`).join('')
          : '<div class="template-audit-item__meta">Keine Standardwerte geladen (Component Library speichern).</div>';
        const status = row.ok ? '<span class="template-audit-item__ok">Standard zugeordnet</span>' : '<span class="template-audit-item__fail">Kein Standard-Mapping</span>';
        const isSelected = selectedAuditComponentId && selectedAuditComponentId === row.id;
        return [
          `<li class="template-audit-item${isSelected ? ' is-selected' : ''}" data-audit-id="${esc(row.id)}">`,
          `<div class="template-audit-item__head"><span>${esc(row.label)}</span></div>`,
          `<div class="template-audit-item__meta">ID: <code>${esc(row.id)}</code></div>`,
          `<details class="template-audit-item__details">`,
          '<summary>Details</summary>',
          `<div class="template-audit-item__meta">STANDARD_ID: <code>${esc(row.libraryId)}</code></div>`,
          `<div class="template-audit-item__meta">TYPE: <code>${esc(row.type)}</code> · SLOT: <code>${esc(row.slot)}</code></div>`,
          `<div class="template-audit-item__meta">${status}</div>`,
          specRows,
          '</details>',
          '</li>',
        ].join('');
      })
      .join('');
  }

  function focusAuditEntryById(id) {
    const list = document.getElementById('templateComponentAuditList');
    if (!(list instanceof HTMLElement)) return;
    const entry = list.querySelector(`.template-audit-item[data-audit-id="${CSS.escape(String(id || ''))}"]`);
    if (!(entry instanceof HTMLElement)) return;
    entry.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }

  function updateStudioOverview() {
    const frame = document.getElementById('templateLiveFrame');
    const elComponents = document.getElementById('studioCountComponents');
    const elTables = document.getElementById('studioCountTables');
    const elExport = document.getElementById('studioCountExportable');
    const elStandardized = document.getElementById('studioCountStandardized');
    const elSpecial = document.getElementById('studioCountSpecial');
    const elSpecialMasks = document.getElementById('studioCountSpecialMasks');
    if (!(elComponents instanceof HTMLElement) || !(elTables instanceof HTMLElement) || !(elExport instanceof HTMLElement)) return;
    try {
      const doc = frame instanceof HTMLIFrameElement ? frame.contentDocument : null;
      const href = String(doc?.location?.href || '');
      const isAboutBlank = href === 'about:blank' || href.endsWith('/about:blank');
      if (!doc?.body || isAboutBlank) {
        elComponents.textContent = '0';
        elTables.textContent = '0';
        elExport.textContent = '0';
        if (elStandardized instanceof HTMLElement) elStandardized.textContent = '0';
        if (elSpecial instanceof HTMLElement) elSpecial.textContent = '0';
        if (elSpecialMasks instanceof HTMLElement) elSpecialMasks.textContent = String(specialMaskCache.size);
        renderComponentAudit(null, 'loading');
        return;
      }
      const rows = collectAuditableComponents(doc);
      const components = rows.length;
      const tables = rows.filter((row) => row.table).length;
      const exportable = rows.filter((row) => row.exportable).length;
      const standardized = rows.filter((row) => row.ok).length;
      const special = Math.max(0, components - standardized);
      const maskPath = normalizeMaskPath(doc?.location?.pathname || selectedMaskPath());
      if (special > 0) specialMaskCache.add(maskPath);
      else specialMaskCache.delete(maskPath);
      writeSpecialMaskCache();
      elComponents.textContent = String(components);
      elTables.textContent = String(tables);
      elExport.textContent = String(exportable);
      if (elStandardized instanceof HTMLElement) elStandardized.textContent = String(standardized);
      if (elSpecial instanceof HTMLElement) elSpecial.textContent = String(special);
      if (elSpecialMasks instanceof HTMLElement) elSpecialMasks.textContent = String(specialMaskCache.size);
      renderComponentAudit(doc);
    } catch {
      elComponents.textContent = '0';
      elTables.textContent = '0';
      elExport.textContent = '0';
      if (elStandardized instanceof HTMLElement) elStandardized.textContent = '0';
      if (elSpecial instanceof HTMLElement) elSpecial.textContent = '0';
      if (elSpecialMasks instanceof HTMLElement) elSpecialMasks.textContent = String(specialMaskCache.size);
      renderComponentAudit(null, 'loading');
    }
  }

  function buildPlanPayload() {
    const nameEl = document.getElementById('templateMaskName');
    const notesEl = document.getElementById('templateMaskNotes');
    const fnChecks = [...document.querySelectorAll('input[type="checkbox"][data-template-fn]')];

    const features = fnChecks
      .filter((el) => el instanceof HTMLInputElement && el.checked)
      .map((el) => String(el.dataset.templateFn || '').trim())
      .filter(Boolean);

    return {
      version: '1.0',
      created_at: nowIso(),
      source: 'template-studio',
      mask: {
        name: nameEl instanceof HTMLInputElement ? String(nameEl.value || '').trim() : '',
        path: selectedMaskPath(),
        viewport: activeViewport(),
        features,
        notes: notesEl instanceof HTMLTextAreaElement ? String(notesEl.value || '').trim() : '',
      },
    };
  }

  function writePlanJson() {
    const area = document.getElementById('templatePlanJson');
    if (!(area instanceof HTMLTextAreaElement)) return;
    area.value = JSON.stringify(buildPlanPayload(), null, 2);
  }

  function setPickLines(text) {
    const area = document.getElementById('templatePickLines');
    if (!(area instanceof HTMLTextAreaElement)) return;
    area.value = String(text || '');
  }

  function activeNoteKind() {
    const hidden = document.getElementById('templatePickNoteKind');
    if (hidden instanceof HTMLInputElement) {
      const val = String(hidden.value || '').trim().toLowerCase();
      if (val) return val;
    }
    const select = document.getElementById('templateNoteKindSelect');
    if (select instanceof HTMLSelectElement) {
      const val = String(select.value || '').trim().toLowerCase();
      if (val) return val;
    }
    const active = document.querySelector('.template-note-kind__btn.is-active[data-note-kind]');
    if (!(active instanceof HTMLButtonElement)) return 'task';
    return String(active.dataset.noteKind || 'task').trim().toLowerCase();
  }

  function noteKindLabel(kind) {
    const normalized = String(kind || 'task').trim().toLowerCase();
    if (normalized === 'bug') return 'BUG';
    if (normalized === 'behavior') return 'VERHALTEN';
    if (normalized === 'uiux') return 'UI_UX';
    return 'TASK';
  }

  function noteTemplate(kind) {
    const normalized = String(kind || 'task').trim().toLowerCase();
    if (normalized === 'bug') return 'PROBLEM:\nSTEPS:\nACTUAL:\nEXPECTED:';
    if (normalized === 'behavior') return 'PROBLEM:\nEXPECTED:\nSCOPE:';
    if (normalized === 'uiux') return 'PROBLEM:\nUX_ZIEL:\nACCEPTANCE:';
    return 'TASK:\nEXPECTED:\nSCOPE:';
  }

  function setNoteKind(kind, shouldPrefill = false) {
    const normalized = String(kind || 'task').trim().toLowerCase() || 'task';
    const select = document.getElementById('templateNoteKindSelect');
    if (select instanceof HTMLSelectElement) select.value = normalized;
    const buttons = [...document.querySelectorAll('.template-note-kind__btn[data-note-kind]')];
    buttons.forEach((btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      const active = String(btn.dataset.noteKind || '').trim().toLowerCase() === normalized;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const hidden = document.getElementById('templatePickNoteKind');
    if (hidden instanceof HTMLInputElement) hidden.value = normalized;

    const notes = document.getElementById('templatePickNotes');
    if (shouldPrefill && notes instanceof HTMLTextAreaElement && !String(notes.value || '').trim()) {
      notes.value = noteTemplate(normalized);
    }
  }

  function setPickPanelVisibility(nextDetails, nextNotes) {
    pickPanels.details = Boolean(nextDetails);
    pickPanels.notes = Boolean(nextNotes);

    const details = document.getElementById('templatePickDetailsAccordion');
    const notes = document.getElementById('templatePickNotesAccordion');
    if (details instanceof HTMLDetailsElement) details.open = pickPanels.details;
    if (notes instanceof HTMLDetailsElement) notes.open = pickPanels.notes;
  }

  function composePickCopyText(baseText, noteText, noteKind) {
    const base = String(baseText || '').trim();
    if (!base) return '';
    const kindLine = `TYPE: ${noteKindLabel(noteKind)}`;
    const note = String(noteText || '').trim();
    if (!note) {
      if (/NOTES:[\s\S]*$/m.test(base)) {
        return base.replace(/NOTES:[\s\S]*$/m, `NOTES:\n${kindLine}\n-`);
      }
      return `${base}\nNOTES:\n${kindLine}\n-`;
    }
    const noteBlock = note
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter(Boolean)
      .join('\n');
    if (!noteBlock) return base;

    if (/NOTES:[\s\S]*$/m.test(base)) {
      return base.replace(/NOTES:[\s\S]*$/m, `NOTES:\n${kindLine}\n${noteBlock}`);
    }
    return `${base}\nNOTES:\n${kindLine}\n${noteBlock}`;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function pickInfoHtml(title, selector, area, rect) {
    return [
      `<p><strong>Komponente:</strong> ${esc(title)}</p>`,
      `<p><strong>Bereich:</strong> ${esc(area)}</p>`,
      `<p><strong>Selector:</strong> <code>${esc(selector)}</code></p>`,
      `<p><strong>Position:</strong> x=${Math.round(rect.left)} y=${Math.round(rect.top)} · w=${Math.round(rect.width)} h=${Math.round(rect.height)}</p>`,
    ].join('');
  }

  function frameMaskContext() {
    const frame = picker.frame;
    if (!(frame instanceof HTMLIFrameElement)) return { path: FALLBACK_MASK_PATH, pageTitle: '', heading: '', href: '' };
    try {
      const doc = frame.contentDocument;
      const path = String(frame.contentWindow?.location?.pathname || FALLBACK_MASK_PATH);
      const href = String(frame.contentWindow?.location?.href || '');
      const pageTitle = String(doc?.title || '').trim();
      const heading = String(doc?.querySelector('h1')?.textContent || '').trim();
      return { path, href, pageTitle, heading };
    } catch {
      return { path: FALLBACK_MASK_PATH, pageTitle: '', heading: '', href: '' };
    }
  }

  function elementArea(el) {
    if (!(el instanceof Element)) return 'Unbekannt';
    if (el.closest('.header, header')) return 'Header';
    if (el.closest('.main, main')) return 'Main';
    if (el.closest('.site-footer, footer')) return 'Footer';
    if (el.closest('.card, section, article')) return 'Content';
    return 'Root';
  }

  function elementSelector(el) {
    if (!(el instanceof Element)) return 'unknown';
    const id = String(el.id || '').trim();
    if (id) return `#${id}`;
    const cls = [...el.classList].slice(0, 2).join('.');
    if (cls) return `${el.tagName.toLowerCase()}.${cls}`;
    return el.tagName.toLowerCase();
  }

  function elementTitle(el) {
    if (!(el instanceof Element)) return 'Unbekannt';
    const aria = String(el.getAttribute('aria-label') || '').trim();
    if (aria) return aria;
    const dataName = String(el.getAttribute('data-component-name') || '').trim();
    if (dataName) return dataName;
    const text = String(el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    if (text) return text;
    return elementSelector(el);
  }

  function stableNodePath(el) {
    if (!(el instanceof Element)) return '-';
    const parts = [];
    let current = el;
    let guard = 0;
    while (current && current.nodeType === Node.ELEMENT_NODE && guard < 10) {
      const tag = current.tagName.toLowerCase();
      const id = String(current.id || '').trim();
      if (id) {
        parts.unshift(`${tag}#${id}`);
        break;
      }
      const parent = current.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const sameTag = [...parent.children].filter((child) => child.tagName === current.tagName);
      const index = Math.max(1, sameTag.indexOf(current) + 1);
      parts.unshift(`${tag}:nth-of-type(${index})`);
      current = parent;
      guard += 1;
    }
    return parts.join(' > ') || '-';
  }

  function componentIdentifier(el) {
    if (!(el instanceof Element)) return '-';
    const explicit =
      String(el.getAttribute('data-component-id') || '').trim() ||
      String(el.getAttribute('data-component-name') || '').trim() ||
      String(el.getAttribute('data-testid') || '').trim() ||
      String(el.id || '').trim();
    if (explicit) return explicit;
    const cls = [...el.classList].slice(0, 3).join('.');
    if (cls) return `${el.tagName.toLowerCase()}.${cls}`;
    return el.tagName.toLowerCase();
  }

  function componentSlotPath(el) {
    if (!(el instanceof Element)) return '-';
    const chain = el.closest('header, main, footer, nav, section, article, aside, .card');
    const parts = [];
    if (chain instanceof Element) parts.push(elementSelector(chain));
    parts.push(`area:${elementArea(el).toLowerCase()}`);
    return parts.join(' | ');
  }

  function buildPickLines(target, title, selector, area) {
    const ctx = frameMaskContext();
    const id = String(target.id || '').trim() || '-';
    const classes = [...target.classList].join(' ').trim() || '-';
    const tag = target.tagName.toLowerCase();
    const text = String(target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120) || '-';
    const role = String(target.getAttribute('role') || '').trim() || '-';
    const aria = String(target.getAttribute('aria-label') || '').trim() || '-';
    const dataAction = String(target.getAttribute('data-action') || '').trim() || '-';
    const componentId = componentIdentifier(target);
    const slotPath = componentSlotPath(target);
    const nodePath = stableNodePath(target);
    return [
      'TEMPLATE_PICK_V1',
      `TIME: ${nowIso()}`,
      `MASK_PATH: ${ctx.path}`,
      `MASK_URL: ${ctx.href || '-'}`,
      `MASK_TITLE: ${ctx.heading || ctx.pageTitle || '-'}`,
      `VIEWPORT: ${activeViewport()}`,
      `AREA: ${area}`,
      `COMPONENT_NAME: ${title}`,
      `COMPONENT_ID: ${componentId}`,
      `SLOT_PATH: ${slotPath}`,
      `SELECTOR: ${selector}`,
      `NODE_PATH: ${nodePath}`,
      `TAG: ${tag}`,
      `ID: ${id}`,
      `CLASSES: ${classes}`,
      `ROLE: ${role}`,
      `ARIA_LABEL: ${aria}`,
      `DATA_ACTION: ${dataAction}`,
      `TEXT_SNIPPET: ${text}`,
      '---',
      'NOTES:',
    ].join('\n');
  }

  function buildPickLinesFromPayload(payload) {
    const ctxPath = normalizeMaskPath(payload?.mask_path || selectedMaskPath());
    const maskUrl = String(payload?.mask_url || '-');
    const componentName = String(payload?.component_name || '-');
    const componentId = String(payload?.component_id || '-');
    const componentType = String(payload?.component_type || '-');
    const slot = String(payload?.slot || '-');
    const tableId = String(payload?.table_id || '-');
    const area = String(payload?.area || 'Unbekannt');
    const selector = String(payload?.selector || '-');
    const nodePath = String(payload?.node_path || '-');
    const tag = String(payload?.tag || '-');
    const role = String(payload?.role || '-');
    const aria = String(payload?.aria_label || '-');
    const dataAction = String(payload?.data_action || '-');
    const text = String(payload?.text_snippet || '-');
    return [
      'TEMPLATE_PICK_V1',
      `TIME: ${nowIso()}`,
      `MASK_PATH: ${ctxPath}`,
      `MASK_URL: ${maskUrl}`,
      'MASK_TITLE: -',
      `VIEWPORT: ${activeViewport()}`,
      `AREA: ${area}`,
      `COMPONENT_NAME: ${componentName}`,
      `COMPONENT_ID: ${componentId}`,
      `COMPONENT_TYPE: ${componentType}`,
      `SLOT: ${slot}`,
      `TABLE_ID: ${tableId}`,
      `SLOT_PATH: area:${area.toLowerCase()}`,
      `SELECTOR: ${selector}`,
      `NODE_PATH: ${nodePath}`,
      `TAG: ${tag}`,
      'ID: -',
      'CLASSES: -',
      `ROLE: ${role}`,
      `ARIA_LABEL: ${aria}`,
      `DATA_ACTION: ${dataAction}`,
      `TEXT_SNIPPET: ${text}`,
      '---',
      'NOTES:',
    ].join('\n');
  }

  function setPickInfo(html) {
    const box = document.getElementById('templatePickInfo');
    if (!(box instanceof HTMLElement)) return;
    box.innerHTML = html;
  }

  function ensurePickerStyle(doc) {
    if (!doc || doc.getElementById('templateStudioPickerStyle')) return;
    const style = doc.createElement('style');
    style.id = 'templateStudioPickerStyle';
    style.textContent = `
      .template-picker-active, .template-picker-active * { cursor: crosshair !important; }
      .template-picker-hover {
        outline: 2px dashed #7ec8ff !important;
        outline-offset: -1px !important;
        box-shadow: 0 0 0 2px rgba(126, 200, 255, .22) inset !important;
      }
      .template-picker-selected {
        outline: 3px solid #ffc830 !important;
        outline-offset: -1px !important;
        box-shadow: 0 0 0 3px rgba(255, 200, 48, .25) inset !important;
      }
      #templateStudioPickLayer {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483000 !important;
        pointer-events: auto !important;
      }
      #templateStudioPickLayer .template-studio-pick-hit {
        position: fixed !important;
        pointer-events: auto !important;
        background: rgba(126, 200, 255, 0.02) !important;
        border: 1px solid rgba(126, 200, 255, 0.28) !important;
        border-radius: 6px !important;
        cursor: crosshair !important;
      }
      #templateStudioPickLayer .template-studio-pick-hit:hover {
        border-color: rgba(126, 200, 255, 0.9) !important;
        background: rgba(126, 200, 255, 0.1) !important;
      }
    `;
    doc.head?.appendChild(style);
  }

  function annotatePickTargets(doc) {
    if (!doc || !doc.body) return;
    const scope = doc.body;
    const selectors = [
      'header',
      'main',
      'footer',
      '.card',
      '.feed-btn',
      '.catch-table',
      '.catch-table__row',
      '.portal-quick-toggle',
      '.burger-toggle',
      'button',
      'a',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      'section',
      'article',
      'nav',
      'aside',
    ];
    const nodes = scope.querySelectorAll(selectors.join(','));
    let index = 0;
    nodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.hasAttribute('data-component-id')) return;
      const base =
        String(node.id || '').trim() ||
        [...node.classList].slice(0, 2).join('-') ||
        node.tagName.toLowerCase();
      node.setAttribute('data-component-id', `auto-${base || 'node'}-${index}`);
      index += 1;
    });
  }

  function ensurePickLayer(doc) {
    if (!doc || !doc.body) return null;
    let layer = doc.getElementById('templateStudioPickLayer');
    if (!(layer instanceof HTMLElement)) {
      layer = doc.createElement('div');
      layer.id = 'templateStudioPickLayer';
      doc.body.appendChild(layer);
    }
    return layer;
  }

  function rebuildPickLayer(doc) {
    const layer = ensurePickLayer(doc);
    if (!(layer instanceof HTMLElement)) return;
    layer.innerHTML = '';
    const map = new Map();
    const nodes = [...doc.querySelectorAll('[data-component-id]')];
    let markerCount = 0;
    nodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const rect = node.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return;
      if (rect.bottom < 0 || rect.right < 0) return;
      const style = doc.defaultView?.getComputedStyle(node);
      if (style?.display === 'none' || style?.visibility === 'hidden' || style?.opacity === '0') return;
      const key = `${String(node.getAttribute('data-component-id') || 'node')}-${markerCount}`;
      const hit = doc.createElement('div');
      hit.className = 'template-studio-pick-hit';
      hit.dataset.pickKey = key;
      hit.style.left = `${Math.max(0, rect.left)}px`;
      hit.style.top = `${Math.max(0, rect.top)}px`;
      hit.style.width = `${Math.max(8, rect.width)}px`;
      hit.style.height = `${Math.max(8, rect.height)}px`;
      map.set(key, node);
      layer.appendChild(hit);
      markerCount += 1;
    });
    picker.pickLayerEl = layer;
    picker.pickLayerMap = map;
    setPickDebug({ last: `pick_layer_ready:${markerCount}` });
  }

  function resolvePickTarget(raw) {
    if (!(raw instanceof Element)) return null;
    const explicit = raw.closest('[data-component-id]');
    if (explicit instanceof Element) return explicit;
    const candidate = raw.closest([
      'button', 'a', 'input', 'select', 'textarea', '[role="button"]',
      '.catch-table__row', '.catch-table', '.card', '.feed-btn',
      '.header', '.nav', '.site-footer',
      'section', 'article',
    ].join(','));
    const picked = candidate instanceof Element ? candidate : raw;
    const tag = picked.tagName.toLowerCase();
    if (tag === 'html' || tag === 'body') return null;
    return picked;
  }

  function eventElementFromIframeDocEvent(doc, event) {
    if (!doc) return null;
    if (event && typeof event.composedPath === 'function') {
      const fromPath = event.composedPath().find((node) => node instanceof Element);
      if (fromPath instanceof Element) return fromPath;
    }
    if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY) && doc.elementFromPoint) {
      const fromPoint = doc.elementFromPoint(event.clientX, event.clientY);
      if (fromPoint instanceof Element) return fromPoint;
    }
    if (event?.target instanceof Element) return event.target;
    return null;
  }

  function clearHover() {
    if (picker.hoverEl instanceof Element) picker.hoverEl.classList.remove('template-picker-hover');
    picker.hoverEl = null;
  }

  function clearSelection() {
    if (picker.selectedEl instanceof Element) picker.selectedEl.classList.remove('template-picker-selected');
    picker.selectedEl = null;
  }

  function stopPicking() {
    picker.enabled = false;
    const btn = document.getElementById('templatePickBtn');
    if (btn instanceof HTMLButtonElement) btn.classList.remove('is-pick-active');
    setPickInfo('<p class="small">Auswahlmodus aus. Wähle eine Komponente, dann kannst du die Zeilen direkt kopieren und senden.</p>');
    picker.frame?.contentWindow?.postMessage({ type: 'STUDIO_PICK_MODE', active: false }, '*');
    setPickDebug({
      mode: 'off',
      last: 'stopPicking',
      lastTarget: '-',
    });
  }

  function startPicking() {
    const frame = document.getElementById('templateLiveFrame');
    if (!(frame instanceof HTMLIFrameElement)) return;
    const frameWin = frame.contentWindow;
    if (!frameWin) {
      setPickInfo('<p class="small"><strong>Preview lädt noch…</strong> Bitte kurz warten und erneut klicken.</p>');
      setPickDebug({ mode: 'pending', last: 'preview_not_ready' });
      return;
    }

    picker.frame = frame;
    picker.enabled = true;

    const btn = document.getElementById('templatePickBtn');
    if (btn instanceof HTMLButtonElement) btn.classList.add('is-pick-active');
    setPickInfo('<p class="small"><strong>Auswahlmodus aktiv.</strong> Klicke im Preview auf eine Komponente.</p>');
    setPickDebug({
      mode: 'active',
      hover: 0,
      click: 0,
      targetHits: 0,
      targetMiss: 0,
      last: 'startPicking',
      lastTarget: '-',
    });
    frameWin.postMessage({ type: 'STUDIO_PICK_MODE', active: true }, '*');
  }

  function handleBridgeMessage(event) {
    const frame = document.getElementById('templateLiveFrame');
    if (!(frame instanceof HTMLIFrameElement)) return;
    if (event.source !== frame.contentWindow) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    const type = String(data.type || '');
    if (!type.startsWith('STUDIO_')) return;
    const payload = data.payload && typeof data.payload === 'object' ? data.payload : {};

    if (type === 'STUDIO_PICK_READY') {
      setPickDebug({ last: payload.ok ? 'bridge_ready_on' : 'bridge_ready_off' });
      return;
    }

    if (!picker.enabled) return;

    if (type === 'STUDIO_COMPONENT_HOVER') {
      pickDebug.hover += 1;
      pickDebug.targetHits += 1;
      setPickInfo('<p class="small"><strong>Hover erkannt.</strong> Klick im Preview zum Auswählen.</p>');
      setPickDebug({
        last: 'hover_resolved',
        lastTarget: `${String(payload.tag || '-')}`.slice(0, 120),
      });
      return;
    }

    if (type === 'STUDIO_COMPONENT_MISS') {
      pickDebug.click += 1;
      pickDebug.targetMiss += 1;
      setPickDebug({
        last: 'click_no_resolved_target',
        lastTarget: '-',
      });
      return;
    }

    if (type === 'STUDIO_COMPONENT_SELECTED') {
      const now = Date.now();
      if (now - pickLastActionTs < 120) return;
      pickLastActionTs = now;
      pickDebug.click += 1;
      pickDebug.targetHits += 1;

      const rect = payload.rect && typeof payload.rect === 'object'
        ? {
            left: Number(payload.rect.left) || 0,
            top: Number(payload.rect.top) || 0,
            width: Number(payload.rect.width) || 0,
            height: Number(payload.rect.height) || 0,
          }
        : { left: 0, top: 0, width: 0, height: 0 };
      const title = String(payload.component_name || 'Unbekannt');
      const selector = String(payload.selector || '-');
      const area = String(payload.area || 'Unbekannt');
      selectedAuditComponentId = String(payload.component_id || '').trim();
      setPickInfo(pickInfoHtml(title, selector, area, rect));
      setPickLines(buildPickLinesFromPayload(payload));
      updateStudioOverview();
      focusAuditEntryById(selectedAuditComponentId);
      setPickDebug({
        last: 'click_selected',
        lastTarget: `${String(payload.tag || '-')} ${selector}`.slice(0, 120),
      });
    }
  }

  function applyMaskToPreview(path) {
    const next = normalizeMaskPath(path);
    const frame = document.getElementById('templateLiveFrame');
    if (!(frame instanceof HTMLIFrameElement)) return;
    stopPicking();
    frame.setAttribute('src', next);
    syncMaskSelects(next);
    setPickLines('');
    setPickInfo('<p class="small"><strong>Maske gewechselt.</strong> Preview lädt neu.</p>');
    setPickDebug({ last: 'mask_changed_preview_reload', lastTarget: '-' });
    writePlanJson();
  }

  function buildComponentFromTemplate(type) {
    const t = COMPONENT_TEMPLATES.find((item) => item.type === type);
    if (!t) return null;
    return {
      id: uid('cmp'),
      type: t.type,
      title: t.title,
      label: t.title,
      hint: t.hint,
      variant: t.variant,
      span: t.span,
      minHeight: t.minHeight,
      notes: '',
      flags: [],
    };
  }

  function createInitialSchema() {
    return {
      version: '2.0',
      updated_at: nowIso(),
      source: 'template-studio-editor',
      mask: {
        path: normalizeMaskPath(selectedMaskPath()),
        viewport: activeEditorViewport(),
      },
      slots: {
        header: [buildComponentFromTemplate('header-brand'), buildComponentFromTemplate('header-menu')].filter(Boolean),
        main: [buildComponentFromTemplate('hero-card'), buildComponentFromTemplate('table')].filter(Boolean),
        footer: [buildComponentFromTemplate('action-row')].filter(Boolean),
      },
    };
  }

  function toSchemaV1(internalSchema) {
    const source = internalSchema && typeof internalSchema === 'object' ? internalSchema : {};
    const maskPath = normalizeMaskPath(source?.mask?.path || FALLBACK_MASK_PATH);
    const viewport = STANDARD_VIEWPORTS.includes(source?.mask?.viewport) ? source.mask.viewport : 'web';
    const components = [];
    const slots = source?.slots && typeof source.slots === 'object' ? source.slots : {};

    Object.entries(slots).forEach(([slot, list]) => {
      if (!Array.isArray(list)) return;
      list.forEach((item) => {
        const cmp = item && typeof item === 'object' ? item : {};
        components.push({
          id: String(cmp.id || uid('cmp')),
          type: String(cmp.type || 'section'),
          slot: String(slot || 'main'),
          props: {
            label: String(cmp.label || cmp.title || cmp.type || 'Component'),
            variant: String(cmp.variant || 'standard'),
            span: Math.min(12, Math.max(1, Number(cmp.span) || 12)),
            minHeight: Math.min(1200, Math.max(24, Number(cmp.minHeight) || 48)),
            notes: String(cmp.notes || ''),
          },
        });
      });
    });

    return {
      version: '1.0',
      generated_at: nowIso(),
      layout: {
        mask_path: maskPath,
        viewport,
        slots: {
          header: { columns: 12 },
          main: { columns: 12 },
          footer: { columns: 12 },
        },
      },
      components,
    };
  }

  function fromSchemaV1(schemaV1) {
    const payload = schemaV1 && typeof schemaV1 === 'object' ? schemaV1 : {};
    const layout = payload.layout && typeof payload.layout === 'object' ? payload.layout : {};
    const components = Array.isArray(payload.components) ? payload.components : [];
    const slots = { header: [], main: [], footer: [] };

    components.forEach((item) => {
      const cmp = item && typeof item === 'object' ? item : {};
      const slotRaw = String(cmp.slot || 'main');
      const slot = slotRaw === 'sidebar' ? 'main' : (slots[slotRaw] ? slotRaw : 'main');
      const props = cmp.props && typeof cmp.props === 'object' ? cmp.props : {};
      slots[slot].push({
        id: String(cmp.id || uid('cmp')),
        type: String(cmp.type || 'section'),
        title: String(props.label || cmp.type || 'Component'),
        label: String(props.label || cmp.type || 'Component'),
        hint: '',
        variant: String(props.variant || 'standard'),
        span: Math.min(12, Math.max(1, Number(props.span) || 12)),
        minHeight: Math.min(1200, Math.max(24, Number(props.minHeight) || 48)),
        notes: String(props.notes || ''),
        flags: [],
      });
    });

    return {
      version: '2.0',
      updated_at: nowIso(),
      source: 'template-studio-editor',
      mask: {
        path: normalizeMaskPath(String(layout.mask_path || FALLBACK_MASK_PATH)),
        viewport: STANDARD_VIEWPORTS.includes(layout.viewport) ? layout.viewport : 'web',
      },
      slots,
    };
  }

  function validateTemplateSchemaV1(input) {
    const errors = [];
    const payload = input && typeof input === 'object' ? input : null;
    if (!payload) {
      errors.push('Schema ist kein Objekt.');
      return { ok: false, errors };
    }

    if (String(payload.version || '').trim() !== '1.0') {
      errors.push('version muss "1.0" sein.');
    }

    const layout = payload.layout;
    if (!layout || typeof layout !== 'object') {
      errors.push('layout fehlt oder ist ungültig.');
    } else {
      const maskPath = String(layout.mask_path || '').trim();
      if (!maskPath.startsWith('/')) {
        errors.push('layout.mask_path muss mit "/" beginnen.');
      }
      if (!STANDARD_VIEWPORTS.includes(String(layout.viewport || '').trim())) {
        errors.push(`layout.viewport muss einer von ${STANDARD_VIEWPORTS.join(', ')} sein.`);
      }
      const slots = layout.slots;
      if (!slots || typeof slots !== 'object') {
        errors.push('layout.slots fehlt.');
      }
    }

    if (!Array.isArray(payload.components)) {
      errors.push('components muss ein Array sein.');
    } else {
      payload.components.forEach((cmp, index) => {
        if (!cmp || typeof cmp !== 'object') {
          errors.push(`components[${index}] ist kein Objekt.`);
          return;
        }
        const id = String(cmp.id || '').trim();
        const type = String(cmp.type || '').trim();
        const slot = String(cmp.slot || '').trim();
        if (!id) errors.push(`components[${index}].id fehlt.`);
        if (!STUDIO_COMPONENT_TYPES.includes(type)) {
          errors.push(`components[${index}].type "${type}" ist nicht erlaubt.`);
        }
        if (!STUDIO_SLOTS.includes(slot)) {
          errors.push(`components[${index}].slot "${slot}" ist nicht erlaubt.`);
        }
        if (cmp.props && typeof cmp.props !== 'object') {
          errors.push(`components[${index}].props muss Objekt sein.`);
        }
      });
    }

    return { ok: errors.length === 0, errors };
  }

  function touchSchema() {
    if (!editor.schema) return;
    editor.schema.updated_at = nowIso();
    renderEditorJson();
  }

  function selectedComponentRef() {
    if (!editor.selected || !editor.schema) return null;
    const { slot, id } = editor.selected;
    const list = editor.schema.slots?.[slot];
    if (!Array.isArray(list)) return null;
    const index = list.findIndex((item) => item.id === id);
    if (index < 0) return null;
    return { slot, id, list, index, component: list[index] };
  }

  function selectEditorComponent(slot, id) {
    editor.selected = slot && id ? { slot, id } : null;
    renderEditorCanvas();
    renderInspector();
  }

  function renderPalette() {
    const el = document.getElementById('editorPalette');
    if (!(el instanceof HTMLElement)) return;
    el.innerHTML = COMPONENT_TEMPLATES.map((item) => `
      <button
        type="button"
        class="editor-palette-item"
        draggable="true"
        data-editor-palette="${item.type}"
        title="${item.hint}"
      >
        <strong>${item.title}</strong>
        <span>${item.hint}</span>
      </button>
    `).join('');
  }

  function renderEditorCanvas() {
    if (!editor.schema) return;
    const zones = [...document.querySelectorAll('.editor-slot__items[data-slot-drop]')];
    zones.forEach((zone) => {
      if (!(zone instanceof HTMLElement)) return;
      const slot = String(zone.dataset.slotDrop || '');
      const list = Array.isArray(editor.schema.slots?.[slot]) ? editor.schema.slots[slot] : [];
      zone.innerHTML = list.map((component) => {
        const selected = editor.selected?.id === component.id ? 'is-selected' : '';
        const span = Number(component.span) || 12;
        const minHeight = Number(component.minHeight) || 48;
        return `
          <article
            class="editor-component ${selected}"
            data-editor-component-id="${component.id}"
            data-editor-slot="${slot}"
            draggable="true"
            style="grid-column:span ${Math.min(12, Math.max(1, span))}; min-height:${Math.max(24, minHeight)}px;"
          >
            <strong>${component.label || component.title || component.type}</strong>
            <div class="editor-component__meta">
              <span>${component.type}</span>
              <span>var: ${component.variant || '-'}</span>
              <span>span: ${span}/12</span>
              <span>minH: ${minHeight}px</span>
            </div>
          </article>
        `;
      }).join('');
    });
  }

  function renderInspector() {
    const label = document.getElementById('editorSelectionLabel');
    const fieldLabel = document.getElementById('editorFieldLabel');
    const fieldVariant = document.getElementById('editorFieldVariant');
    const fieldSpan = document.getElementById('editorFieldSpan');
    const fieldMinHeight = document.getElementById('editorFieldMinHeight');
    const fieldNotes = document.getElementById('editorFieldNotes');

    if (!(label instanceof HTMLElement) ||
      !(fieldLabel instanceof HTMLInputElement) ||
      !(fieldVariant instanceof HTMLInputElement) ||
      !(fieldSpan instanceof HTMLInputElement) ||
      !(fieldMinHeight instanceof HTMLInputElement) ||
      !(fieldNotes instanceof HTMLTextAreaElement)
    ) return;

    const ref = selectedComponentRef();
    if (!ref) {
      label.textContent = 'Keine Komponente ausgewählt.';
      fieldLabel.value = '';
      fieldVariant.value = '';
      fieldSpan.value = '';
      fieldMinHeight.value = '';
      fieldNotes.value = '';
      return;
    }

    const c = ref.component;
    label.textContent = `${c.label || c.title} · Slot ${ref.slot} · ${c.id}`;
    fieldLabel.value = String(c.label || '');
    fieldVariant.value = String(c.variant || '');
    fieldSpan.value = String(c.span || 12);
    fieldMinHeight.value = String(c.minHeight || 48);
    fieldNotes.value = String(c.notes || '');
  }

  function renderEditorJson() {
    const area = document.getElementById('editorSchemaJson');
    if (!(area instanceof HTMLTextAreaElement)) return;
    area.value = JSON.stringify(toSchemaV1(editor.schema), null, 2);
  }

  function applyInspectorPatch(patch) {
    const ref = selectedComponentRef();
    if (!ref) return;
    Object.assign(ref.component, patch);
    touchSchema();
    renderEditorCanvas();
    renderInspector();
  }

  function editorMove(delta) {
    const ref = selectedComponentRef();
    if (!ref) return;
    const next = ref.index + delta;
    if (next < 0 || next >= ref.list.length) return;
    const [item] = ref.list.splice(ref.index, 1);
    ref.list.splice(next, 0, item);
    touchSchema();
    renderEditorCanvas();
  }

  function editorDuplicate() {
    const ref = selectedComponentRef();
    if (!ref) return;
    const copy = { ...ref.component, id: uid('cmp'), label: `${ref.component.label} Copy` };
    ref.list.splice(ref.index + 1, 0, copy);
    touchSchema();
    renderEditorCanvas();
    selectEditorComponent(ref.slot, copy.id);
  }

  function editorDelete() {
    const ref = selectedComponentRef();
    if (!ref) return;
    ref.list.splice(ref.index, 1);
    touchSchema();
    selectEditorComponent(null, null);
  }

  function addComponentToSlot(type, slot) {
    if (!editor.schema || !editor.schema.slots?.[slot]) return;
    const component = buildComponentFromTemplate(type);
    if (!component) return;
    editor.schema.slots[slot].push(component);
    touchSchema();
    renderEditorCanvas();
    selectEditorComponent(slot, component.id);
  }

  function moveComponent(slotFrom, id, slotTo) {
    if (!editor.schema) return;
    const fromList = editor.schema.slots?.[slotFrom];
    const toList = editor.schema.slots?.[slotTo];
    if (!Array.isArray(fromList) || !Array.isArray(toList)) return;
    const index = fromList.findIndex((item) => item.id === id);
    if (index < 0) return;
    const [item] = fromList.splice(index, 1);
    toList.push(item);
    touchSchema();
    renderEditorCanvas();
    selectEditorComponent(slotTo, item.id);
  }

  function initEditorDnD() {
    const palette = document.getElementById('editorPalette');
    if (palette instanceof HTMLElement) {
      palette.addEventListener('dragstart', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const type = String(target.dataset.editorPalette || '').trim();
        if (!type) return;
        event.dataTransfer?.setData('application/x-template-palette', type);
        event.dataTransfer?.setData('text/plain', type);
      });
    }

    document.addEventListener('dragstart', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const card = target.closest('.editor-component[data-editor-component-id]');
      if (!(card instanceof HTMLElement)) return;
      const slot = String(card.dataset.editorSlot || '').trim();
      const id = String(card.dataset.editorComponentId || '').trim();
      if (!slot || !id) return;
      editor.dragSource = { slot, id };
      event.dataTransfer?.setData('application/x-template-component', JSON.stringify(editor.dragSource));
      event.dataTransfer?.setData('text/plain', id);
    });

    const zones = [...document.querySelectorAll('.editor-slot__items[data-slot-drop]')];
    zones.forEach((zone) => {
      if (!(zone instanceof HTMLElement)) return;

      zone.addEventListener('dragover', (event) => {
        event.preventDefault();
        zone.classList.add('is-drop-target');
      });

      zone.addEventListener('dragleave', () => zone.classList.remove('is-drop-target'));

      zone.addEventListener('drop', (event) => {
        event.preventDefault();
        zone.classList.remove('is-drop-target');
        const slot = String(zone.dataset.slotDrop || '').trim();
        if (!slot) return;

        const paletteType = event.dataTransfer?.getData('application/x-template-palette') || '';
        if (paletteType) {
          addComponentToSlot(paletteType, slot);
          return;
        }

        const sourceRaw = event.dataTransfer?.getData('application/x-template-component') || '';
        if (sourceRaw) {
          try {
            const source = JSON.parse(sourceRaw);
            if (source && source.slot && source.id) {
              moveComponent(String(source.slot), String(source.id), slot);
            }
          } catch {
            // ignore malformed payload
          }
          return;
        }

        if (editor.dragSource?.slot && editor.dragSource?.id) {
          moveComponent(editor.dragSource.slot, editor.dragSource.id, slot);
        }
      });
    });

    document.addEventListener('dragend', () => {
      editor.dragSource = null;
      [...document.querySelectorAll('.editor-slot__items.is-drop-target')].forEach((el) => el.classList.remove('is-drop-target'));
    });
  }

  function initEditor() {
    editor.schema = createInitialSchema();
    syncMaskSelects(editor.schema.mask.path);
    renderPalette();
    renderEditorCanvas();
    renderInspector();
    renderEditorJson();
    initEditorDnD();
  }

  async function copyText(button, text, ok = 'Kopiert', fail = 'Kopieren fehlgeschlagen') {
    if (!(button instanceof HTMLButtonElement)) return;
    try {
      await navigator.clipboard.writeText(text);
      const prev = button.textContent;
      button.textContent = ok;
      window.setTimeout(() => {
        button.textContent = prev || 'Kopieren';
      }, 900);
    } catch {
      const prev = button.textContent;
      button.textContent = fail;
      window.setTimeout(() => {
        button.textContent = prev || 'Kopieren';
      }, 900);
    }
  }

  function initStandardSplitResize() {
    const layout = document.querySelector('.template-standard-layout');
    const handle = document.getElementById('templateSplitHandle');
    if (!(layout instanceof HTMLElement) || !(handle instanceof HTMLElement)) return;

    const saved = Number(localStorage.getItem(SPLIT_WIDTH_KEY) || 0);
    if (Number.isFinite(saved) && saved >= 280 && saved <= 760) {
      layout.style.setProperty('--template-controls-width', `${saved}px`);
    }

    let dragging = false;
    const updateFromClientX = (clientX) => {
      const rect = layout.getBoundingClientRect();
      const min = 280;
      const max = Math.min(760, rect.width - 360);
      const width = Math.max(min, Math.min(max, clientX - rect.left));
      layout.style.setProperty('--template-controls-width', `${Math.round(width)}px`);
      localStorage.setItem(SPLIT_WIDTH_KEY, String(Math.round(width)));
    };

    handle.addEventListener('pointerdown', (event) => {
      if (window.matchMedia('(max-width: 900px)').matches) return;
      dragging = true;
      handle.setPointerCapture(event.pointerId);
      updateFromClientX(event.clientX);
      event.preventDefault();
    });

    handle.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      updateFromClientX(event.clientX);
    });

    const stop = () => {
      dragging = false;
    };
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  }

  async function copyLivePreviewScreenshot(button) {
    if (!(button instanceof HTMLButtonElement)) return;
    const shell = document.getElementById('templateLiveShell');
    const frameEl = document.getElementById('templateLiveFrame');
    if (!(shell instanceof HTMLElement) || !(frameEl instanceof HTMLIFrameElement)) return;

    const canCapture = typeof navigator !== 'undefined'
      && navigator.mediaDevices
      && typeof navigator.mediaDevices.getDisplayMedia === 'function';
    const canClipboardImage = typeof navigator !== 'undefined'
      && navigator.clipboard
      && typeof navigator.clipboard.write === 'function'
      && typeof window.ClipboardItem !== 'undefined';

    if (!canCapture) {
      setPickInfo('<p class="small"><strong>Screenshot nicht verfügbar.</strong> Browser unterstützt Tab-Capture hier nicht.</p>');
      return;
    }

    button.disabled = true;
    let stream = null;
    try {
      setPickInfo('<p class="small"><strong>Screenshot:</strong> Bitte im nächsten Dialog den aktuellen Tab auswählen.</p>');
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 1,
          displaySurface: 'browser',
          preferCurrentTab: true,
          selfBrowserSurface: 'include',
        },
        audio: false,
      });

      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings ? track.getSettings() : null;
      const surface = String(settings?.displaySurface || '').toLowerCase();
      if (surface && surface !== 'browser') {
        setPickInfo('<p class="small"><strong>Falsche Quelle gewählt.</strong> Bitte beim Screenshot die <strong>aktuelle Registerkarte</strong> wählen, nicht Fenster/Bildschirm.</p>');
        return;
      }

      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      await new Promise((resolve) => window.setTimeout(resolve, 80));

      const rect = frameEl.getBoundingClientRect();
      const viewportW = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
      const viewportH = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
      const scaleX = video.videoWidth / viewportW;
      const scaleY = video.videoHeight / viewportH;

      let sx = Math.max(0, Math.floor(rect.left * scaleX));
      let sy = Math.max(0, Math.floor(rect.top * scaleY));
      let sw = Math.max(1, Math.floor(rect.width * scaleX));
      let sh = Math.max(1, Math.floor(rect.height * scaleY));

      if (sx + sw > video.videoWidth) sw = Math.max(1, video.videoWidth - sx);
      if (sy + sh > video.videoHeight) sh = Math.max(1, video.videoHeight - sy);

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas_ctx_failed');
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((next) => {
          if (next) resolve(next);
          else reject(new Error('screenshot_blob_failed'));
        }, 'image/png');
      });

      if (canClipboardImage) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          button.classList.add('is-copy-ok');
          window.setTimeout(() => button.classList.remove('is-copy-ok'), 900);
          setPickInfo('<p class="small"><strong>Screenshot kopiert.</strong> Live-Fenster liegt jetzt als Bild in der Zwischenablage.</p>');
          return;
        } catch {
          // Fallback to file download below.
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `template-live-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPickInfo('<p class="small"><strong>Clipboard nicht verfügbar.</strong> Screenshot wurde als PNG heruntergeladen.</p>');
    } catch {
      setPickInfo('<p class="small"><strong>Screenshot fehlgeschlagen.</strong> Bitte erneut klicken und den aktuellen Browser-Tab freigeben.</p>');
    } finally {
      if (stream) stream.getTracks().forEach((track) => track.stop());
      button.disabled = false;
    }
  }

  document.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const editorVpBtn = target.closest('.template-vp-btn[data-editor-viewport]');
    if (editorVpBtn instanceof HTMLButtonElement) {
      const next = String(editorVpBtn.dataset.editorViewport || '').trim();
      if (next) setEditorViewport(next);
      return;
    }

    const pickBtn = target.closest('#templatePickBtn');
    if (pickBtn instanceof HTMLButtonElement) {
      if (picker.enabled) stopPicking();
      else startPicking();
      return;
    }

    const copyShotBtn = target.closest('#templateCopyShotBtn');
    if (copyShotBtn instanceof HTMLButtonElement) {
      await copyLivePreviewScreenshot(copyShotBtn);
      return;
    }

    const copyPlanBtn = target.closest('#templateCopyPlan');
    if (copyPlanBtn instanceof HTMLButtonElement) {
      writePlanJson();
      await copyText(copyPlanBtn, JSON.stringify(buildPlanPayload(), null, 2), 'JSON kopiert');
      return;
    }

    const copyPickBtn = target.closest('#templateCopyPickLines');
    if (copyPickBtn instanceof HTMLButtonElement) {
      const area = document.getElementById('templatePickLines');
      const notes = document.getElementById('templatePickNotes');
      const text = area instanceof HTMLTextAreaElement ? String(area.value || '').trim() : '';
      const noteText = notes instanceof HTMLTextAreaElement ? String(notes.value || '') : '';
      const output = composePickCopyText(text, noteText, activeNoteKind());
      if (!output) {
        const prev = copyPickBtn.textContent;
        copyPickBtn.textContent = 'Keine Auswahl';
        window.setTimeout(() => {
          copyPickBtn.textContent = prev || 'Zeilen kopieren';
        }, 900);
        setPickInfo('<p class="small"><strong>Nichts zu kopieren.</strong> Bitte zuerst eine Komponente im Live-Preview auswählen.</p>');
        return;
      }
      if (area instanceof HTMLTextAreaElement) {
        area.value = output;
      }
      await copyText(copyPickBtn, output, 'Zeilen kopiert');
      return;
    }

    const card = target.closest('.editor-component[data-editor-component-id]');
    if (card instanceof HTMLElement) {
      const slot = String(card.dataset.editorSlot || '').trim();
      const id = String(card.dataset.editorComponentId || '').trim();
      if (slot && id) selectEditorComponent(slot, id);
      return;
    }

    const upBtn = target.closest('#editorMoveUp');
    if (upBtn instanceof HTMLButtonElement) {
      editorMove(-1);
      return;
    }

    const downBtn = target.closest('#editorMoveDown');
    if (downBtn instanceof HTMLButtonElement) {
      editorMove(1);
      return;
    }

    const dupBtn = target.closest('#editorDuplicate');
    if (dupBtn instanceof HTMLButtonElement) {
      editorDuplicate();
      return;
    }

    const delBtn = target.closest('#editorDelete');
    if (delBtn instanceof HTMLButtonElement) {
      editorDelete();
      return;
    }

    const copyEditorBtn = target.closest('#editorCopyJson');
    if (copyEditorBtn instanceof HTMLButtonElement) {
      renderEditorJson();
      const area = document.getElementById('editorSchemaJson');
      const text = area instanceof HTMLTextAreaElement ? area.value : '';
      if (text) await copyText(copyEditorBtn, text, 'JSON kopiert');
      return;
    }

    const loadEditorBtn = target.closest('#editorLoadJson');
    if (loadEditorBtn instanceof HTMLButtonElement) {
      const incoming = window.prompt('Masken-JSON einfügen');
      if (!incoming) return;
      try {
        const parsed = JSON.parse(incoming);
        if (!parsed || typeof parsed !== 'object') throw new Error('invalid');
        if (parsed.layout && parsed.components) {
          const v1 = validateTemplateSchemaV1(parsed);
          if (!v1.ok) {
            window.alert(`Schema V1 ungültig:\n- ${v1.errors.join('\n- ')}`);
            return;
          }
          editor.schema = fromSchemaV1(parsed);
        } else if (parsed.slots) {
          editor.schema = parsed;
        } else {
          throw new Error('invalid');
        }
        if (!editor.schema.mask) editor.schema.mask = { path: FALLBACK_MASK_PATH, viewport: 'web' };
        editor.schema.mask.path = normalizeMaskPath(editor.schema.mask.path || FALLBACK_MASK_PATH);
        editor.schema.mask.viewport = STANDARD_VIEWPORTS.includes(editor.schema.mask.viewport) ? editor.schema.mask.viewport : 'web';
        if (!editor.schema.slots.header) editor.schema.slots.header = [];
        if (!editor.schema.slots.main) editor.schema.slots.main = [];
        if (!editor.schema.slots.footer) editor.schema.slots.footer = [];
        syncMaskSelects(editor.schema.mask.path);
        setEditorViewport(editor.schema.mask.viewport);
        touchSchema();
        selectEditorComponent(null, null);
        renderEditorCanvas();
      } catch {
        window.alert('JSON konnte nicht geladen werden. Bitte Format prüfen.');
      }
      return;
    }
  });

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.matches('#templateMaskName, #templateMaskNotes, input[data-template-fn]')) {
      writePlanJson();
      return;
    }

    if (target.matches('#editorFieldLabel')) {
      applyInspectorPatch({ label: String(target.value || '') });
      return;
    }

    if (target.matches('#editorFieldVariant')) {
      applyInspectorPatch({ variant: String(target.value || '') });
      return;
    }

    if (target.matches('#editorFieldSpan')) {
      const span = Math.min(12, Math.max(1, Number(target.value) || 12));
      applyInspectorPatch({ span });
      return;
    }

    if (target.matches('#editorFieldMinHeight')) {
      const minHeight = Math.min(1200, Math.max(24, Number(target.value) || 48));
      applyInspectorPatch({ minHeight });
      return;
    }

    if (target.matches('#editorFieldNotes')) {
      applyInspectorPatch({ notes: String(target.value || '') });
    }
  });

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.matches('input[data-template-fn]')) {
      writePlanJson();
      return;
    }

    if (target.matches('#templateMaskPath')) {
      const next = normalizeMaskPath(target.value);
      applyMaskToPreview(next);
      if (editor.schema) {
        editor.schema.mask.path = next;
        syncMaskSelects(next);
        touchSchema();
      }
      return;
    }

    if (target.matches('#templateSectionSelect')) {
      const next = String(target.value || '').trim();
      setSection(next);
      return;
    }

    if (target.matches('#templateViewportSelect')) {
      const next = String(target.value || '').trim();
      stopPicking();
      setViewport(next);
      writePlanJson();
      return;
    }

    if (target.matches('#templateAudienceSelect')) {
      const next = String(target.value || '').trim().toLowerCase();
      setPreviewAudience(next);
      return;
    }

    if (target.matches('#templateNoteKindSelect')) {
      const next = String(target.value || '').trim().toLowerCase();
      setNoteKind(next, true);
      return;
    }

    if (target.matches('#templateEditorMaskPath')) {
      const next = normalizeMaskPath(target.value);
      if (editor.schema) {
        editor.schema.mask.path = next;
        touchSchema();
      }
      syncMaskSelects(next);
      applyMaskToPreview(next);
      return;
    }

  });

  document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('message', handleBridgeMessage);
    setSection('standard-template');
    setViewport('web');
    setEditorViewport('web');
    setPreviewAudience('live');
    writePlanJson();
    setPickLines('');
    renderPickDebug();
    setNoteKind('task', false);
    setPickPanelVisibility(true, true);
    readSpecialMaskCache();

    const frame = document.getElementById('templateLiveFrame');
    if (frame instanceof HTMLIFrameElement) {
      const applyPreviewClass = () => {
        try {
          stopPicking();
          const body = frame.contentDocument?.body;
          if (body) body.classList.add('template-preview-wide');
          applyPreviewAudienceToFrame(activePreviewAudience());
          updateStudioOverview();
        } catch {
          // ignore
        }
      };
      frame.addEventListener('load', applyPreviewClass);
      applyPreviewClass();
      syncMaskSelects(normalizeMaskPath(frame.getAttribute('src') || FALLBACK_MASK_PATH));
    }

    const detailsAcc = document.getElementById('templatePickDetailsAccordion');
    if (detailsAcc instanceof HTMLDetailsElement) {
      detailsAcc.addEventListener('toggle', () => {
        pickPanels.details = detailsAcc.open;
      });
    }
    const notesAcc = document.getElementById('templatePickNotesAccordion');
    if (notesAcc instanceof HTMLDetailsElement) {
      notesAcc.addEventListener('toggle', () => {
        pickPanels.notes = notesAcc.open;
      });
    }

    initStandardSplitResize();
    initEditor();
  });
})();
