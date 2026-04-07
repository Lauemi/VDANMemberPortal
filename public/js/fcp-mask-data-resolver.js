;(() => {
  const contractHub = window.FcpAdmQfmContractHub || {};
  const sharedContracts = contractHub.shared || {};
  const readContracts = contractHub.read || {};
  const writeContracts = contractHub.write || {};
  const securityContracts = contractHub.security || {};
  const dialogContracts = contractHub.dialog || {};
  const contractContracts = contractHub.contract || {};

  function cfg() {
    return {
      url: String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, ""),
      key: String(window.__APP_SUPABASE_KEY || "").trim(),
    };
  }

  function session() {
    return window.VDAN_AUTH?.loadSession?.() || null;
  }

  async function ensureAccessToken({ forceRefresh = false } = {}) {
    const auth = window.VDAN_AUTH || {};
    if (forceRefresh && auth?.refreshSession) {
      const refreshed = await auth.refreshSession().catch(() => null);
      const refreshToken = String(refreshed?.access_token || "").trim();
      if (refreshToken) return refreshToken;
    }
    const currentToken = String(session()?.access_token || "").trim();
    if (currentToken) return currentToken;
    if (auth?.refreshSession) {
      const refreshed = await auth.refreshSession().catch(() => null);
      return String(refreshed?.access_token || session()?.access_token || "").trim();
    }
    return "";
  }

  function readLocalJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeLocalJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }

  async function waitForAuthReady(timeoutMs = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (window.VDAN_AUTH?.loadSession) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return Boolean(window.VDAN_AUTH?.loadSession);
  }

  async function readErrorPayload(res) {
    const contentType = String(res.headers?.get?.("content-type") || "").toLowerCase();
    if (contentType.includes("application/json")) {
      const json = await res.json().catch(() => ({}));
      return String(json?.error_description || json?.error || json?.message || json?.msg || "").trim();
    }
    return String(await res.text().catch(() => "")).trim();
  }

  async function sb(path, init = {}, withAuth = false) {
    await waitForAuthReady();
    const { url, key } = cfg();
    if (!url || !key) throw new Error("Supabase-Konfiguration fehlt.");

    const headers = new Headers(init.headers || {});
    headers.set("apikey", key);
    headers.set("Content-Type", "application/json");

    const token = withAuth ? await ensureAccessToken() : "";
    if (withAuth && !token) throw new Error("Bitte zuerst einloggen.");
    if (withAuth && token) headers.set("Authorization", `Bearer ${token}`);

    const res = await fetch(`${url}${path}`, { ...init, headers });
    if (!res.ok) {
      throw new Error((await readErrorPayload(res)) || `Request failed (${res.status})`);
    }
    return res.json().catch(() => []);
  }

  function structuredCloneSafe(value) {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map((entry) => structuredCloneSafe(entry));
    if (value && typeof value === "object") {
      const output = {};
      for (const key of Object.keys(value)) {
        output[key] = structuredCloneSafe(value[key]);
      }
      return output;
    }
    return value;
  }

  function toArray(value) {
    if (typeof sharedContracts.toArray === "function") return sharedContracts.toArray(value);
    return Array.isArray(value) ? value : [];
  }

  function getByPath(source, dottedPath) {
    if (typeof sharedContracts.getByPath === "function") {
      return sharedContracts.getByPath(source, dottedPath);
    }
    const path = String(dottedPath || "").trim();
    if (!path) return undefined;
    return path.split(".").reduce((acc, key) => {
      if (acc == null) return undefined;
      return acc[key];
    }, source);
  }

  function mergeRecordSources(...sources) {
    if (typeof sharedContracts.mergeRecordSources === "function") {
      return sharedContracts.mergeRecordSources(...sources);
    }
    return sources.reduce((acc, source) => {
      if (source && typeof source === "object" && !Array.isArray(source)) {
        return { ...acc, ...source };
      }
      return acc;
    }, {});
  }

  function normalizeBindingResult(binding, result) {
    if (typeof sharedContracts.normalizeBindingResult === "function") {
      return sharedContracts.normalizeBindingResult(binding, result);
    }
    if (Array.isArray(result)) {
      return { raw: result, rows: result, record: result[0] || null };
    }
    if (result && typeof result === "object") {
      return {
        raw: result,
        rows: Array.isArray(result.rows) ? result.rows : [],
        record: result.record && typeof result.record === "object" ? result.record : result,
      };
    }
    return { raw: result, rows: [], record: null };
  }

  function buildFieldValue(field, model) {
    if (typeof readContracts.buildFieldValue === "function") {
      return readContracts.buildFieldValue(field, model);
    }
    const valueFromPath = getByPath(model, field.valuePath);
    if (valueFromPath !== undefined && valueFromPath !== null) return valueFromPath;
    return field.defaultValue ?? "";
  }

  function hydrateFormContent(fieldDefs, model) {
    if (typeof readContracts.hydrateFormContent === "function") {
      return readContracts.hydrateFormContent(fieldDefs, model);
    }
    return { fields: toArray(fieldDefs).map((field) => ({ ...field, value: buildFieldValue(field, model) })), rows: [], actions: [], blocks: [] };
  }

  function hydrateReadonlyContent(fieldDefs, model) {
    if (typeof readContracts.hydrateReadonlyContent === "function") {
      return readContracts.hydrateReadonlyContent(fieldDefs, model);
    }
    return { fields: [], rows: toArray(fieldDefs).map((field) => ({ label: field.label, value: buildFieldValue(field, model) || "-", span: field.displaySpan || null })), actions: [], blocks: [] };
  }

  function hydrateMixedContent(blockDefs, model) {
    if (typeof readContracts.hydrateMixedContent === "function") {
      return readContracts.hydrateMixedContent(blockDefs, model);
    }
    const blocks = toArray(blockDefs).map((block) => block);
    return { fields: [], rows: [], actions: [], blocks };
  }

  function normalizeRoleValue(roleId) {
    return String(roleId || "").trim().toLowerCase();
  }

  const MANAGER_ROLES = new Set(["admin", "vorstand", "superadmin"]);

  function clubUserRoleMapKey(clubId, userId) {
    const cid = String(clubId || "").trim();
    const uid = String(userId || "").trim();
    return cid && uid ? `${cid}:${uid}` : "";
  }

  function pickPrimaryRole(roleIds, fallback = "member") {
    const priority = ["admin", "vorstand", "member"];
    const normalized = [...new Set((Array.isArray(roleIds) ? roleIds : []).map(normalizeRoleValue).filter(Boolean))];
    if (!normalized.length) return normalizeRoleValue(fallback) || "member";
    for (const roleId of priority) {
      if (normalized.includes(roleId)) return roleId;
    }
    return normalized.sort((a, b) => a.localeCompare(b, "de"))[0] || normalizeRoleValue(fallback) || "member";
  }

  function buildEffectiveRoleMap(roleRows) {
    const byClubUser = new Map();
    toArray(roleRows).forEach((row) => {
      const key = clubUserRoleMapKey(row?.club_id, row?.user_id);
      const roleId = normalizeRoleValue(row?.role_key);
      if (!key || !roleId) return;
      if (!byClubUser.has(key)) byClubUser.set(key, new Set());
      byClubUser.get(key).add(roleId);
    });

    const result = new Map();
    byClubUser.forEach((roles, key) => {
      result.set(key, pickPrimaryRole([...roles]));
    });
    return result;
  }

  function applyEffectiveRolesToRows(rows, effectiveRoleByClubUser) {
    return toArray(rows).map((row) => {
      const effective = effectiveRoleByClubUser.get(clubUserRoleMapKey(row?.club_id, row?.profile_user_id));
      if (!effective) {
        return {
          ...row,
          role: normalizeRoleValue(row?.role) || "member",
        };
      }
      return {
        ...row,
        role: effective,
      };
    });
  }

  function toRoleOnlyStatusText() {
    return "ohne_mitgliedsnummer";
  }

  function buildSavePayload(fields) {
    if (typeof writeContracts.buildSavePayload === "function") {
      return writeContracts.buildSavePayload(fields);
    }
    return toArray(fields).reduce((acc, field) => {
      if (field.readonly) return acc;
      const payloadKey = String(field.payloadKey || field.name || "").trim();
      if (!payloadKey) return acc;
      acc[payloadKey] = field.value === "" ? null : field.value;
      return acc;
    }, {});
  }

  function applySaveDefaults(payload, defaults) {
    if (typeof writeContracts.applySaveDefaults === "function") {
      return writeContracts.applySaveDefaults(payload, defaults);
    }
    if (!defaults || typeof defaults !== "object") return payload;
    return { ...defaults, ...payload };
  }

  function applyPayloadTemplate(value, context = {}) {
    if (typeof readContracts.applyPayloadTemplate === "function") {
      return readContracts.applyPayloadTemplate(value, context);
    }
    if (Array.isArray(value)) return value.map((entry) => applyPayloadTemplate(entry, context));
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, applyPayloadTemplate(entry, context)])
      );
    }
    if (typeof value !== "string") return value;
    return value.replace(/\{([^}]+)\}/g, (_, rawKey) => {
      const key = String(rawKey || "").trim();
      const resolved = Object.prototype.hasOwnProperty.call(context, key) ? context[key] : "";
      return resolved == null ? "" : String(resolved);
    });
  }

  function normalizeRpcPayload(rpcName, payload = null) {
    if (typeof readContracts.normalizeRpcPayload === "function") {
      return readContracts.normalizeRpcPayload(rpcName, payload);
    }
    return payload && typeof payload === "object" ? { ...payload } : {};
  }

  function getPathTail(path) {
    const raw = String(path || "").trim();
    if (!raw) return "";
    const parts = raw.split(".").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : raw;
  }

  function hasByPath(source, dottedPath) {
    const path = String(dottedPath || "").trim();
    if (!path) return false;
    return getByPath(source, path) !== undefined;
  }

  function uniqueStrings(values) {
    return [...new Set(toArray(values).map((value) => String(value || "").trim()).filter(Boolean))];
  }

  function collectPanelFields(panel, resolverMeta) {
    return uniqueStrings([
      ...toArray(resolverMeta?.fieldDefs).map((field) => field?.name),
      ...toArray(panel?.content?.fields).map((field) => field?.name),
    ]);
  }

  function collectPanelValuePaths(panel, resolverMeta) {
    return uniqueStrings([
      ...toArray(resolverMeta?.fieldDefs).map((field) => field?.valuePath),
      ...toArray(panel?.content?.fields).map((field) => field?.valuePath),
    ]);
  }

  function collectExpectedColumns(panel, resolverMeta) {
    const sqlExpected = toArray(panel?.meta?.sqlContract?.expectedColumns);
    if (sqlExpected.length) return uniqueStrings(sqlExpected);
    if (panel?.renderMode === "table") return uniqueStrings(toArray(panel?.columns).map((column) => column?.key));
    return collectPanelFields(panel, resolverMeta);
  }

  function collectActualKeysForRecord(panel, resolverMeta, model) {
    const valuePaths = collectPanelValuePaths(panel, resolverMeta);
    const resolvedFromPaths = valuePaths
      .filter((path) => hasByPath(model, path))
      .map((path) => getPathTail(path));
    if (resolvedFromPaths.length) return uniqueStrings(resolvedFromPaths);
    return uniqueStrings(Object.keys(model?.record && typeof model.record === "object" ? model.record : {}));
  }

  function collectActualKeysForRows(rows) {
    const keys = [];
    toArray(rows).slice(0, 20).forEach((row) => {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        keys.push(...Object.keys(row));
      }
    });
    return uniqueStrings(keys);
  }

  function normalizeBindingForDebug(binding) {
    if (!binding || typeof binding !== "object") return null;
    return {
      kind: String(binding.kind || "").trim(),
      target: binding.target ?? null,
      path: binding.path ?? null,
    };
  }

  function buildReadContractForPanel(panel, context = {}) {
    if (typeof contractContracts.buildReadContract === "function") {
      return contractContracts.buildReadContract(panel, context);
    }
    return {
      maskId: String(context?.maskId || panel?.__fcpMaskId || "").trim(),
      sectionId: String(context?.sectionId || panel?.__fcpSectionId || "").trim(),
      panelId: String(panel?.id || "").trim(),
      sourceTable: String(panel?.meta?.sourceTable || "").trim() || null,
      sourceKind: String(panel?.meta?.sourceKind || "").trim() || null,
      sourceOfTruth: String(panel?.meta?.sourceOfTruth || "").trim() || null,
      sqlFile: String(panel?.meta?.sqlContract?.sqlFile || "").trim() || null,
      expectedColumns: collectExpectedColumns(panel, panel?.meta?.resolver || {}),
      binding: normalizeBindingForDebug(panel?.loadBinding),
      loadBinding: normalizeBindingForDebug(panel?.loadBinding),
      saveBinding: normalizeBindingForDebug(panel?.saveBinding),
      securityContext: panel?.securityContext || null,
      panelState: resolvePanelStateKey(panel),
      tableConfig: panel?.tableConfig || null,
      componentType: panel?.componentType || null,
      renderMode: panel?.renderMode || null,
      rowsPath: String(panel?.meta?.resolver?.rowsPath || panel?.rowsPath || "").trim() || null,
      valuePaths: panel?.renderMode === "table" ? [] : collectPanelValuePaths(panel, panel?.meta?.resolver || {}),
      loadPayloadDefaults: panel?.meta?.resolver?.loadPayloadDefaults || null,
    };
  }

  function buildWriteContractForPanel(panel, fields, context = {}) {
    if (typeof contractContracts.buildWriteContract === "function") {
      return contractContracts.buildWriteContract(panel, fields, context);
    }
    return {
      maskId: String(context?.maskId || panel?.__fcpMaskId || "").trim(),
      sectionId: String(context?.sectionId || panel?.__fcpSectionId || "").trim(),
      panelId: String(panel?.id || "").trim(),
      binding: normalizeBindingForDebug(panel?.saveBinding),
      saveBinding: normalizeBindingForDebug(panel?.saveBinding),
      savePayloadDefaults: panel?.meta?.resolver?.savePayloadDefaults || null,
      fieldMappings: toArray(fields).map((field) => ({
        fieldName: String(field?.name || "").trim(),
        valuePath: String(field?.valuePath || "").trim() || null,
        payloadKey: String(field?.payloadKey || field?.name || "").trim() || null,
        readonly: field?.readonly === true,
        resolvedValue: field?.value,
      })),
      payloadKeys: uniqueStrings(
        toArray(fields)
          .filter((field) => !field?.readonly)
          .map((field) => String(field?.payloadKey || field?.name || "").trim())
      ),
    };
  }

  function buildActionContractForPanel(panel, row, action, context = {}) {
    if (typeof contractContracts.buildActionContract === "function") {
      return contractContracts.buildActionContract(panel, row, action, context);
    }
    return {
      panelId: String(panel?.id || "").trim(),
      sectionId: String(context?.sectionId || panel?.__fcpSectionId || "").trim(),
      binding: normalizeBindingForDebug(panel?.saveBinding),
      actionType: String(action || "").trim(),
      rowKeyField: String(panel?.tableConfig?.rowKeyField || "").trim() || null,
      rowKey: panel?.tableConfig?.rowKeyField ? row?.[panel.tableConfig.rowKeyField] ?? null : null,
      rowInteractionMode: String(panel?.tableConfig?.rowInteractionMode || "").trim() || null,
      actionDefaults: null,
    };
  }

  function buildDefaultWriteDebug() {
    return {
      triggered: false,
      fieldMappings: [],
      payload: null,
      rpcTarget: null,
      rpcPath: null,
      response: null,
      error: null,
      missingPayloadKeys: [],
      emptyValues: [],
      unexpectedPayloadKeys: [],
    };
  }

  function resolvePanelStateKey(panel) {
    const resolved = typeof dialogContracts.resolvePanelSurfaceState === "function"
      ? dialogContracts.resolvePanelSurfaceState(panel)
      : null;
    return String(resolved?.key || panel?.meta?.panelState || "live").trim() || "live";
  }

  function slugifyContractSegment(value, fallback = "unknown") {
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^public\./, "")
      .replace(/[()]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return normalized || fallback;
  }

  function inferProcessSlug(maskId, sourceOfTruth, sourceTable) {
    const candidates = [maskId, sourceOfTruth, sourceTable].map((value) => String(value || "").trim().toLowerCase());
    if (candidates.some((value) => value.includes("club_settings") || value.includes("club-settings"))) return "club-settings";
    if (candidates.some((value) => value.includes("onboarding"))) return "onboarding";
    if (candidates.some((value) => value.includes("cards"))) return "cards";
    return "shared";
  }

  function inferPanelSqlReferencePath({ maskId, sectionId, panelId, sourceTable, sourceOfTruth }) {
    const processSlug = inferProcessSlug(maskId, sourceOfTruth, sourceTable);
    const sectionSlug = slugifyContractSegment(sectionId || "overview", "overview").replace(/_/g, "-");
    let panelSlug = slugifyContractSegment(panelId || sourceTable || "panel", "panel");
    const processPrefix = processSlug.replace(/-/g, "_");
    if (panelSlug.startsWith(`${processPrefix}_`)) {
      panelSlug = panelSlug.slice(processPrefix.length + 1) || panelSlug;
    }
    return `docs/sql-contracts/processes/${processSlug}/${sectionSlug}/READ_${panelSlug}.sql`;
  }

  function resolveSqlContractMeta(panel, contract = null) {
    const candidates = [
      contract && typeof contract === "object" ? contract.sqlContract || null : null,
      panel?.__fcpSqlContractMeta && typeof panel.__fcpSqlContractMeta === "object" ? panel.__fcpSqlContractMeta : null,
      panel?.meta?.sqlContract && typeof panel.meta.sqlContract === "object" ? panel.meta.sqlContract : null,
      panel?.sqlContract && typeof panel.sqlContract === "object" ? panel.sqlContract : null,
    ].filter(Boolean);
    const explicitFile = candidates
      .map((entry) => String(entry?.sqlFile || "").trim())
      .find(Boolean);
    const expectedColumns = uniqueStrings([
      ...candidates.flatMap((entry) => toArray(entry?.expectedColumns)),
      ...toArray(contract?.expectedColumns),
    ]);
    return {
      sqlFile: explicitFile || String(contract?.sqlFile || "").trim() || null,
      expectedColumns,
    };
  }

  function isWriteExpected(panel, fields = [], actions = null) {
    if (panel?.saveBinding?.kind && panel.saveBinding.kind !== "none") return true;
    if (panel?.permissions?.write === true || panel?.permissions?.update === true) return true;
    if (actions?.save === true) return true;
    return toArray(fields).some((field) => field?.readonly !== true);
  }

  function classifyWritePathState(saveBinding, panelState, writeExpected) {
    const kind = String(saveBinding?.kind || "").trim();
    if (!writeExpected) return "readonly";
    if (kind && kind !== "none") return panelState === "preview" ? "warn" : "ok";
    if (panelState === "preview" || panelState === "partial" || panelState === "gap") return "not_applicable";
    return "gap";
  }

  function buildRequiredSqlContract(debug) {
    const expectedColumns = uniqueStrings(debug?.expectedColumns);
    const needsSql = !debug?.sqlFile || toArray(debug?.missingExpected).length > 0;
    if (!needsSql) return null;
    return {
      expectedColumns,
      expectedSource: debug?.sourceTable || debug?.sourceOfTruth || null,
      expectedSourceKind: debug?.sourceKind || null,
      expectedResultType: debug?.contract?.renderMode === "table" || debug?.rowsPath ? "rows" : "record",
      valuePaths: uniqueStrings(debug?.valuePaths),
      recommendedSqlFile: debug?.sqlFile || inferPanelSqlReferencePath(debug || {}),
    };
  }

  function resolveRuntimeReadSnapshot({
    panel,
    resolverMeta,
    model,
    runtimeModel,
    rows,
    runtimeRows,
    readContract,
  }) {
    const contract = readContract || {};
    const loadBinding = normalizeBindingForDebug(contract.loadBinding || contract.binding || panel?.loadBinding);
    const bindingKind = String(loadBinding?.kind || "").trim() || "none";
    const sourceModel = bindingKind === "local_only"
      ? (runtimeModel || model)
      : (runtimeModel || model);
    const sourceRows = panel?.renderMode === "table"
      ? (Array.isArray(runtimeRows) ? runtimeRows : toArray(getByPath(sourceModel, contract?.rowsPath || resolverMeta?.rowsPath || panel?.rowsPath || "rows")))
      : [];
    const actualKeys = panel?.renderMode === "table"
      ? collectActualKeysForRows(sourceRows)
      : collectActualKeysForRecord(panel, resolverMeta, sourceModel || {});
    const rowCount = panel?.renderMode === "table" ? sourceRows.length : actualKeys.length ? 1 : 0;
    const resolvedRowsPathExists = contract?.rowsPath ? hasByPath(sourceModel, contract.rowsPath) : null;
    return {
      loadBinding,
      bindingKind,
      sourceModel,
      sourceRows,
      actualKeys,
      rowCount,
      resolvedRowsPathExists,
    };
  }

  function detectSuspectedIssue({
    hasLoadBinding,
    loadBindingKind,
    actualKeys,
    rowCount,
    rowsPath,
    rowsPathExists,
    missingExpected,
    panelState,
    writeExpected,
    saveBinding,
  }) {
    if (panelState === "preview") return "PREVIEW_NOT_LIVE";
    if (panelState === "partial") return "PARTIAL_NOT_FULLY_CONNECTED";
    if (panelState === "gap" && !hasLoadBinding) return "NO_LOAD_BINDING";
    if ((loadBindingKind === "rpc" || loadBindingKind === "edge_function" || loadBindingKind === "auth_action")
      && Number(rowCount || 0) === 0
      && !toArray(actualKeys).length) {
      return "READ_EMPTY_RESULT";
    }
    if (rowsPath && rowsPathExists === false) return "INVALID_ROWS_PATH";
    if (panelState === "preview" && toArray(missingExpected).length) return "PREVIEW_STRUCTURE_MISMATCH";
    if (toArray(missingExpected).length) return "COLUMN_MISMATCH";
    if (!hasLoadBinding) return "NO_LOAD_BINDING";
    if (writeExpected && (!saveBinding || saveBinding.kind === "none") && panelState === "live") return "NO_SAVE_BINDING";
    return null;
  }

  function buildPanelFieldContract(panel, resolverMeta = {}) {
    const fieldDefs = toArray(panel?.content?.fields?.length ? panel.content.fields : resolverMeta?.fieldDefs);
    return fieldDefs.map((field) => ({
      fieldName: String(field?.name || field?.id || "").trim() || null,
      valuePath: String(field?.valuePath || "").trim() || null,
      payloadKey: String(field?.payloadKey || field?.name || "").trim() || null,
      readonly: field?.readonly === true,
      inputType: String(field?.type || field?.inputType || "").trim() || null,
    }));
  }

  function buildPanelActionSummary(panel) {
    const tableConfig = panel?.tableConfig || {};
    const rowActions = uniqueStrings(toArray(tableConfig.rowActions));
    const rowInteractionMode = String(tableConfig.rowInteractionMode || "").trim()
      || (panel?.componentType === "data-table" ? "dialog" : panel?.componentType === "inline-data-table" ? "inline" : null);
    return {
      read: Boolean(panel?.loadBinding?.kind && panel.loadBinding.kind !== "none"),
      save: Boolean(panel?.saveBinding?.kind && panel.saveBinding.kind !== "none"),
      delete: rowActions.includes("delete") || Boolean(tableConfig.deletePayloadDefaults),
      duplicate: rowActions.includes("duplicate") || Boolean(tableConfig.duplicatePayloadDefaults),
      rowClick: Boolean(rowInteractionMode),
      dialog: rowInteractionMode === "dialog",
      inline: rowInteractionMode === "inline",
      rowInteractionMode: rowInteractionMode || null,
      rowKeyField: String(tableConfig.rowKeyField || "").trim() || null,
    };
  }

  function isPanelDebugEnabled() {
    try {
      if (window.__FCP_PANEL_DEBUG__ === true) return true;
      const params = new URLSearchParams(window.location.search || "");
      const queryValue = String(params.get("fcpPanelDebug") || params.get("fcpDebug") || "").trim().toLowerCase();
      if (queryValue === "1" || queryValue === "true" || queryValue === "yes") return true;
      const stored = String(localStorage.getItem("fcp_panel_debug") || "").trim().toLowerCase();
      return stored === "1" || stored === "true" || stored === "yes";
    } catch {
      return false;
    }
  }

  function isKescherEnabled() {
    try {
      if (window.__FCP_KESCHER__ === true) return true;
      const params = new URLSearchParams(window.location.search || "");
      const queryValue = String(params.get("fcpKescher") || params.get("fcpTrace") || "").trim().toLowerCase();
      if (queryValue === "1" || queryValue === "true" || queryValue === "yes") return true;
      const stored = String(localStorage.getItem("fcp_kescher") || "").trim().toLowerCase();
      if (stored === "1" || stored === "true" || stored === "yes") return true;
    } catch {
      // ignore
    }
    return isPanelDebugEnabled();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function summarizeValue(value) {
    if (value == null) return "-";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  function joinValues(values) {
    const items = toArray(values).map((value) => String(value || "").trim()).filter(Boolean);
    return items.length ? items.join(", ") : "-";
  }

  function summarizeBinding(binding) {
    if (!binding || !binding.kind || binding.kind === "none") return "nicht vorhanden";
    const target = String(binding.target || binding.path || "").trim();
    return target ? `${binding.kind}: ${target}` : binding.kind;
  }

  function buildKescherChain(debug) {
    const write = debug?.write || buildDefaultWriteDebug();
    const writePayloadKeys = uniqueStrings(Object.keys(write?.payload || {}));
    const readHasBinding = Boolean(debug?.loadBinding?.kind && debug.loadBinding.kind !== "none");
    const readStructureOk = !toArray(debug?.missingExpected).length && (debug?.resolvedRowsPathExists !== false);
    const writeExpected = debug?.writeExpected === true;
    const writeState = classifyWritePathState(debug?.saveBinding, debug?.panelState, writeExpected);
    return [
      {
        id: "sql-contract",
        label: "SQL-Vertrag",
        status: debug?.sqlFile ? "ok" : debug?.panelState === "preview" ? "warn" : "gap",
        expected: "meta.sqlContract.sqlFile",
        actual: debug?.sqlFile || debug?.missingContract || "nicht referenziert",
      },
      {
        id: "read-binding",
        label: "Read-Pfad",
        status: debug?.loadBinding?.kind && debug.loadBinding.kind !== "none"
          ? debug?.panelState === "preview" ? "warn" : "ok"
          : debug?.panelState === "gap" ? "gap" : "warn",
        expected: "loadBinding",
        actual: summarizeBinding(debug?.loadBinding),
      },
      {
        id: "read-result",
        label: "Read-Ergebnis",
        status: debug?.suspectedIssue === "READ_EMPTY_RESULT"
          ? "warn"
          : debug?.resolvedRowsPathExists === false
          ? "warn"
          : toArray(debug?.missingExpected).length
            ? debug?.panelState === "preview" ? "warn" : "warn"
            : readHasBinding && readStructureOk
              ? "ok"
              : "idle",
        expected: joinValues(debug?.expectedColumns),
        actual: debug?.suspectedIssue === "READ_EMPTY_RESULT"
          ? `leer; keys=${joinValues(debug?.actualKeys)}`
          : `rows=${Number(debug?.rowCount || 0)}; keys=${joinValues(debug?.actualKeys)}`,
      },
      {
        id: "write-binding",
        label: "Write-Pfad",
        status: writeState,
        expected: writeExpected ? "saveBinding" : "readonly / not_applicable",
        actual: writeExpected ? summarizeBinding(debug?.saveBinding) : "kein Write erwartet",
      },
      {
        id: "actions",
        label: "Actions",
        status: debug?.actions?.read || debug?.actions?.save || debug?.actions?.delete || debug?.actions?.duplicate
          ? "ok"
          : "idle",
        expected: "row click / save / delete / duplicate",
        actual: [
          debug?.actions?.rowInteractionMode ? `row:${debug.actions.rowInteractionMode}` : null,
          debug?.actions?.save ? "save" : null,
          debug?.actions?.delete ? "delete" : null,
          debug?.actions?.duplicate ? "duplicate" : null,
        ].filter(Boolean).join(", ") || "-",
      },
      {
        id: "write-payload",
        label: "Write-Payload",
        status: write?.triggered !== true
          ? "idle"
          : write?.error
            ? "error"
            : !writePayloadKeys.length
              ? "error"
              : toArray(write?.missingPayloadKeys).length
                ? "warn"
                : "ok",
        expected: joinValues(write?.contract?.payloadKeys),
        actual: joinValues(writePayloadKeys),
      },
      {
        id: "write-result",
        label: "Write-Ergebnis",
        status: write?.triggered !== true
          ? "idle"
          : write?.error
            ? "error"
            : "ok",
        expected: "Response oder Fehler",
        actual: write?.error || summarizeValue(write?.response),
      },
    ];
  }

  function buildKescherTrace(debug) {
    const write = debug?.write || buildDefaultWriteDebug();
    const key = [
      String(debug?.maskId || "").trim() || "mask",
      String(debug?.sectionId || "").trim() || "section",
      String(debug?.panelId || "").trim() || "panel",
    ].join("::");
    return {
      key,
      maskId: String(debug?.maskId || "").trim() || "unknown_mask",
      sectionId: String(debug?.sectionId || "").trim() || "unknown_section",
      panelId: String(debug?.panelId || "").trim() || "unknown_panel",
      sourceTable: String(debug?.sourceTable || "").trim() || null,
      sourceKind: String(debug?.sourceKind || "").trim() || null,
      sourceOfTruth: String(debug?.sourceOfTruth || "").trim() || null,
      sqlFile: String(debug?.sqlFile || "").trim() || null,
      missingContract: debug?.missingContract || null,
      loadBinding: debug?.loadBinding || null,
      saveBinding: debug?.saveBinding || null,
      expectedColumns: toArray(debug?.expectedColumns),
      actualKeys: toArray(debug?.actualKeys),
      usedColumns: toArray(debug?.usedColumns),
      additionalAvailableFields: toArray(debug?.additionalAvailableFields),
      availableButUnusedColumns: toArray(debug?.availableButUnusedColumns),
      missingExpected: toArray(debug?.missingExpected),
      rowsPath: debug?.rowsPath || null,
      valuePaths: toArray(debug?.valuePaths),
      rowCount: Number(debug?.rowCount || 0),
      resolvedRowsPathExists: debug?.resolvedRowsPathExists,
      securityContext: debug?.securityContext || null,
      fields: toArray(debug?.fields),
      actions: debug?.actions || null,
      panelState: debug?.panelState || "live",
      writeExpected: debug?.writeExpected === true,
      suspectedIssue: debug?.suspectedIssue || null,
      requiredSqlContract: sanitizeForExport(debug?.requiredSqlContract),
      write,
      chain: buildKescherChain(debug),
      updatedAt: new Date().toISOString(),
    };
  }

  function sanitizeForExport(value) {
    if (value == null) return null;
    if (Array.isArray(value)) return value.map((entry) => sanitizeForExport(entry));
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
      };
    }
    if (value && typeof value === "object") {
      return Object.entries(value).reduce((acc, [key, entry]) => {
        acc[key] = sanitizeForExport(entry);
        return acc;
      }, {});
    }
    return value;
  }

  function collectKescherIssueCodes(trace) {
    const issues = [];
    if (!trace?.sqlFile) issues.push("NO_SQL_CONTRACT_REFERENCE");
    if (!trace?.loadBinding?.kind || trace.loadBinding.kind === "none") issues.push("NO_LOAD_BINDING");
    if (trace?.writeExpected && (!trace?.saveBinding?.kind || trace.saveBinding.kind === "none") && trace?.panelState === "live") {
      issues.push("NO_SAVE_BINDING");
    }
    if (trace?.resolvedRowsPathExists === false) issues.push("INVALID_ROWS_PATH");
    if (trace?.suspectedIssue === "READ_EMPTY_RESULT") issues.push("READ_EMPTY_RESULT");
    else if (trace?.panelState === "preview" && toArray(trace?.missingExpected).length) issues.push("PREVIEW_STRUCTURE_MISMATCH");
    else if (toArray(trace?.missingExpected).length) issues.push("COLUMN_MISMATCH");
    if (trace?.panelState === "preview") issues.push("PREVIEW_NOT_LIVE");
    if (trace?.panelState === "partial") issues.push("PARTIAL_NOT_FULLY_CONNECTED");
    if (trace?.write?.triggered && !Object.keys(trace?.write?.payload || {}).length) issues.push("EMPTY_PAYLOAD");
    if (toArray(trace?.write?.missingPayloadKeys).length) issues.push("MISSING_PAYLOAD_KEYS");
    if (trace?.write?.error) issues.push("WRITE_ERROR");
    if (trace?.suspectedIssue) issues.push(String(trace.suspectedIssue).trim());
    return uniqueStrings(issues);
  }

  function buildKescherSharedIssues(traces) {
    const aggregate = new Map();
    toArray(traces).forEach((trace) => {
      collectKescherIssueCodes(trace).forEach((code) => {
        if (!aggregate.has(code)) {
          aggregate.set(code, {
            code,
            count: 0,
            panels: [],
          });
        }
        const entry = aggregate.get(code);
        entry.count += 1;
        entry.panels.push({
          key: trace.key,
          maskId: trace.maskId,
          sectionId: trace.sectionId,
          panelId: trace.panelId,
        });
      });
    });
    return Array.from(aggregate.values())
      .map((entry) => ({
        ...entry,
        panels: entry.panels.sort((a, b) => a.key.localeCompare(b.key)),
      }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
  }

  function buildKescherExport(traces, selectedMaskId = "") {
    const filtered = String(selectedMaskId || "").trim()
      ? toArray(traces).filter((trace) => trace.maskId === selectedMaskId)
      : toArray(traces);
    const sharedIssues = buildKescherSharedIssues(filtered);
    return {
      kind: "fcp_kescher_export",
      exportedAt: new Date().toISOString(),
      selectedMaskId: String(selectedMaskId || "").trim() || null,
      summary: {
        panelCount: filtered.length,
        liveCount: filtered.filter((trace) => trace.panelState === "live").length,
        previewCount: filtered.filter((trace) => trace.panelState === "preview").length,
        gapCount: filtered.filter((trace) =>
          toArray(trace.chain).some((step) => step.status === "gap" || step.status === "error")
        ).length,
        issueCount: filtered.filter((trace) => collectKescherIssueCodes(trace).length > 0).length,
      },
      sharedIssues,
      panels: filtered.map((trace) => ({
        key: trace.key,
        maskId: trace.maskId,
        sectionId: trace.sectionId,
        panelId: trace.panelId,
        status: {
          panelState: trace.panelState,
          suspectedIssue: trace.suspectedIssue,
          issueCodes: collectKescherIssueCodes(trace),
        },
        contract: {
          sourceTable: trace.sourceTable,
          sourceKind: trace.sourceKind,
          sourceOfTruth: trace.sourceOfTruth,
          sqlFile: trace.sqlFile,
          missingContract: trace.missingContract,
          requiredSqlContract: sanitizeForExport(trace.requiredSqlContract),
          expectedColumns: trace.expectedColumns,
          rowsPath: trace.rowsPath,
          valuePaths: trace.valuePaths,
        },
        runtime: {
          readBinding: sanitizeForExport(trace.loadBinding),
          saveBinding: sanitizeForExport(trace.saveBinding),
          resolvedRowsPathExists: trace.resolvedRowsPathExists,
          rowCount: trace.rowCount,
          actualKeys: trace.actualKeys,
          missingExpected: trace.missingExpected,
          additionalAvailableFields: trace.additionalAvailableFields,
          availableButUnusedColumns: trace.availableButUnusedColumns,
        },
        actions: sanitizeForExport(trace.actions),
        fields: sanitizeForExport(trace.fields),
        write: {
          triggered: Boolean(trace.write?.triggered),
          contract: sanitizeForExport(trace.write?.contract),
          payload: sanitizeForExport(trace.write?.payload),
          rpcTarget: trace.write?.rpcTarget || null,
          rpcPath: trace.write?.rpcPath || null,
          missingPayloadKeys: toArray(trace.write?.missingPayloadKeys),
          emptyValues: toArray(trace.write?.emptyValues),
          unexpectedPayloadKeys: toArray(trace.write?.unexpectedPayloadKeys),
          error: trace.write?.error || null,
          response: sanitizeForExport(trace.write?.response),
        },
        securityContext: sanitizeForExport(trace.securityContext),
        chain: sanitizeForExport(trace.chain),
      })),
    };
  }

  async function copyKescherJson() {
    const store = getKescherStore();
    const exportObject = buildKescherExport(Array.from(store.traces.values()), store.selectedMaskId);
    const text = JSON.stringify(exportObject, null, 2);
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return exportObject;
    }
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "readonly");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    document.body.removeChild(helper);
    return exportObject;
  }

  function ensureKescherStyles() {
    if (typeof document === "undefined" || document.getElementById("fcp-kescher-style")) return;
    const style = document.createElement("style");
    style.id = "fcp-kescher-style";
    style.textContent = `
      .fcp-kescher-toggle{position:fixed;right:16px;bottom:16px;z-index:10020;border:1px solid rgba(42,52,32,.18);background:#f7f2e5;color:#2a3420;border-radius:999px;padding:10px 14px;font:600 12px/1.1 system-ui,sans-serif;box-shadow:0 12px 32px rgba(0,0,0,.18)}
      .fcp-kescher{position:fixed;right:16px;bottom:64px;z-index:10020;width:min(980px,calc(100vw - 32px));height:min(78vh,760px);background:#fffdf7;color:#2a3420;border:1px solid rgba(42,52,32,.16);border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.22);display:flex;flex-direction:column;overflow:hidden}
      .fcp-kescher[hidden]{display:none}
      .fcp-kescher__header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(42,52,32,.1);background:linear-gradient(135deg,#faf3df,#f4f1e6)}
      .fcp-kescher__title{font:700 16px/1.2 system-ui,sans-serif}
      .fcp-kescher__subtitle{font:500 12px/1.3 system-ui,sans-serif;opacity:.72}
      .fcp-kescher__actions{display:flex;gap:8px;align-items:center}
      .fcp-kescher__btn,.fcp-kescher__select{border:1px solid rgba(42,52,32,.18);background:#fff;color:#2a3420;border-radius:10px;padding:8px 10px;font:500 12px/1.2 system-ui,sans-serif}
      .fcp-kescher__copy-state{font:600 11px/1.2 system-ui,sans-serif;opacity:.72}
      .fcp-kescher__body{display:grid;grid-template-columns:280px 1fr;min-height:0;flex:1}
      .fcp-kescher__sidebar{border-right:1px solid rgba(42,52,32,.1);padding:10px;overflow:auto;background:#f9f6ed}
      .fcp-kescher__summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}
      .fcp-kescher__metric{background:#fff;border:1px solid rgba(42,52,32,.1);border-radius:12px;padding:8px}
      .fcp-kescher__metric strong{display:block;font:700 15px/1.2 system-ui,sans-serif}
      .fcp-kescher__metric span{font:500 11px/1.2 system-ui,sans-serif;opacity:.72}
      .fcp-kescher__trace{width:100%;text-align:left;background:#fff;border:1px solid rgba(42,52,32,.1);border-radius:12px;padding:10px;margin-bottom:8px}
      .fcp-kescher__trace.is-active{border-color:#5d6f46;box-shadow:inset 0 0 0 1px #5d6f46}
      .fcp-kescher__trace-title{font:700 13px/1.25 system-ui,sans-serif}
      .fcp-kescher__section-title{font:700 11px/1.2 system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;opacity:.66;margin:12px 4px 8px}
      .fcp-kescher__trace-meta{font:500 11px/1.25 system-ui,sans-serif;opacity:.72;margin-top:4px}
      .fcp-kescher__content{padding:14px 16px;overflow:auto}
      .fcp-kescher__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .fcp-kescher__card{border:1px solid rgba(42,52,32,.1);border-radius:14px;padding:12px;background:#fff}
      .fcp-kescher__card--full{grid-column:1/-1}
      .fcp-kescher__label{font:700 11px/1.2 system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;opacity:.72;margin-bottom:6px}
      .fcp-kescher__value{font:500 13px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-word}
      .fcp-kescher__list{display:flex;flex-wrap:wrap;gap:6px}
      .fcp-kescher__chip{border-radius:999px;padding:4px 8px;background:#f3efe3;border:1px solid rgba(42,52,32,.08);font:500 11px/1.2 system-ui,sans-serif}
      .fcp-kescher__chip.is-missing{background:#fff2f0;border-color:#f0b3a9;color:#9a3824}
      .fcp-kescher__chip.is-additional{background:#eef6ff;border-color:#b8d7ff;color:#1f4d88}
      .fcp-kescher__chain{display:grid;gap:8px}
      .fcp-kescher__step{border:1px solid rgba(42,52,32,.1);border-radius:12px;padding:10px}
      .fcp-kescher__step-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
      .fcp-kescher__status{display:inline-flex;align-items:center;border-radius:999px;padding:4px 8px;font:700 11px/1 system-ui,sans-serif}
      .fcp-kescher__status.is-ok{background:#e7f5e8;color:#1f6a32}
      .fcp-kescher__status.is-warn{background:#fff5db;color:#8b6113}
      .fcp-kescher__status.is-error{background:#ffe9e6;color:#9a3824}
      .fcp-kescher__status.is-gap{background:#f2edf9;color:#65409d}
      .fcp-kescher__status.is-idle{background:#ececec;color:#555}
      .fcp-kescher__status.is-blocked{background:#fff0d8;color:#9a5e00}
      .fcp-kescher__status.is-readonly,.fcp-kescher__status.is-not_applicable{background:#edf1f5;color:#415466}
      .fcp-kescher__empty{padding:24px;border:1px dashed rgba(42,52,32,.18);border-radius:14px;background:#fff}
      @media (max-width: 860px){.fcp-kescher{width:calc(100vw - 16px);right:8px;bottom:56px;height:82vh}.fcp-kescher__body{grid-template-columns:1fr}.fcp-kescher__sidebar{max-height:34vh;border-right:0;border-bottom:1px solid rgba(42,52,32,.1)}.fcp-kescher__grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function getKescherStore() {
    if (!window.__FCP_KESCHER_STORE__) {
      window.__FCP_KESCHER_STORE__ = {
        traces: new Map(),
        selectedKey: "",
        selectedMaskId: "",
        open: false,
        copyState: "",
      };
    }
    return window.__FCP_KESCHER_STORE__;
  }

  function formatChips(values, className = "") {
    const items = toArray(values);
    if (!items.length) return `<span class="fcp-kescher__chip">-</span>`;
    return items.map((value) => `<span class="fcp-kescher__chip ${className}">${escapeHtml(value)}</span>`).join("");
  }

  function groupTracesBySection(traces) {
    return traces.reduce((acc, trace) => {
      const key = String(trace?.sectionId || "ohne-section").trim() || "ohne-section";
      if (!acc[key]) acc[key] = [];
      acc[key].push(trace);
      return acc;
    }, {});
  }

  function renderKescher() {
    if (typeof document === "undefined") return;
    const store = getKescherStore();
    ensureKescherStyles();

    let toggle = document.getElementById("fcp-kescher-toggle");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.id = "fcp-kescher-toggle";
      toggle.type = "button";
      toggle.className = "fcp-kescher-toggle";
      toggle.textContent = "Kescher";
      toggle.addEventListener("click", () => {
        const current = getKescherStore();
        current.open = !current.open;
        renderKescher();
      });
      document.body.appendChild(toggle);
    }

    let root = document.getElementById("fcp-kescher-root");
    if (!root) {
      root = document.createElement("aside");
      root.id = "fcp-kescher-root";
      root.className = "fcp-kescher";
      document.body.appendChild(root);
    }

    const traces = Array.from(store.traces.values()).sort((a, b) => {
      return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
    const maskIds = uniqueStrings(traces.map((trace) => trace.maskId));
    if (!store.selectedMaskId && maskIds.length) store.selectedMaskId = maskIds[0];
    const filtered = store.selectedMaskId
      ? traces.filter((trace) => trace.maskId === store.selectedMaskId)
      : traces;
    if (!store.selectedKey || !filtered.some((trace) => trace.key === store.selectedKey)) {
      store.selectedKey = filtered[0]?.key || traces[0]?.key || "";
    }
    const selected = traces.find((trace) => trace.key === store.selectedKey) || null;
    const issuesCount = traces.filter((trace) => trace.suspectedIssue).length;
    const gapCount = traces.filter((trace) =>
      trace.chain.some((step) => step.status === "gap" || step.status === "error")
    ).length;
    const grouped = groupTracesBySection(filtered);

    root.hidden = store.open !== true;
    root.innerHTML = `
      <div class="fcp-kescher__header">
        <div>
          <div class="fcp-kescher__title">FCP Kescher</div>
          <div class="fcp-kescher__subtitle">Vertragskette pro ADM/QFM sichtbar machen: Soll, Ist, Fehler, GAP.</div>
        </div>
        <div class="fcp-kescher__actions">
          <select id="fcp-kescher-mask-select" class="fcp-kescher__select">
            <option value="">Alle Masken</option>
            ${maskIds.map((maskId) => `<option value="${escapeHtml(maskId)}"${store.selectedMaskId === maskId ? " selected" : ""}>${escapeHtml(maskId)}</option>`).join("")}
          </select>
          <button id="fcp-kescher-copy" type="button" class="fcp-kescher__btn">JSON kopieren</button>
          <span class="fcp-kescher__copy-state">${escapeHtml(store.copyState || "")}</span>
          <button id="fcp-kescher-close" type="button" class="fcp-kescher__btn">Schließen</button>
        </div>
      </div>
      <div class="fcp-kescher__body">
        <div class="fcp-kescher__sidebar">
          <div class="fcp-kescher__summary">
            <div class="fcp-kescher__metric"><strong>${traces.length}</strong><span>Panels</span></div>
            <div class="fcp-kescher__metric"><strong>${issuesCount}</strong><span>Issues</span></div>
            <div class="fcp-kescher__metric"><strong>${gapCount}</strong><span>Gaps</span></div>
          </div>
          ${Object.entries(grouped).map(([sectionId, sectionTraces]) => `
            <div class="fcp-kescher__section-title">${escapeHtml(sectionId)}</div>
            ${sectionTraces.map((trace) => {
              const issue = trace.suspectedIssue ? ` • ${trace.suspectedIssue}` : "";
              return `<button type="button" class="fcp-kescher__trace ${trace.key === store.selectedKey ? "is-active" : ""}" data-kescher-key="${escapeHtml(trace.key)}">
                <div class="fcp-kescher__trace-title">${escapeHtml(trace.panelId)}</div>
                <div class="fcp-kescher__trace-meta">${escapeHtml(trace.maskId)}</div>
                <div class="fcp-kescher__trace-meta">${escapeHtml(trace.panelState)}${escapeHtml(issue)}</div>
              </button>`;
            }).join("")}
          `).join("") || `<div class="fcp-kescher__empty">Noch keine Panel-Traces vorhanden.</div>`}
        </div>
        <div class="fcp-kescher__content">
          ${selected ? `
            <div class="fcp-kescher__grid">
              <div class="fcp-kescher__card">
                <div class="fcp-kescher__label">Maske / Panel</div>
                <div class="fcp-kescher__value">${escapeHtml(selected.maskId)} / ${escapeHtml(selected.panelId)}</div>
              </div>
              <div class="fcp-kescher__card">
                <div class="fcp-kescher__label">Status</div>
                <div class="fcp-kescher__value">${escapeHtml(selected.panelState || "-")} / ${escapeHtml(selected.suspectedIssue || "ok")}</div>
                <div class="fcp-kescher__value">writeExpected: ${escapeHtml(String(Boolean(selected.writeExpected)))}</div>
              </div>
              <div class="fcp-kescher__card">
                <div class="fcp-kescher__label">Soll-Vertrag</div>
                <div class="fcp-kescher__value">sourceTable: ${escapeHtml(selected.sourceTable || "-")}</div>
                <div class="fcp-kescher__value">sourceKind: ${escapeHtml(selected.sourceKind || "-")}</div>
                <div class="fcp-kescher__value">sourceOfTruth: ${escapeHtml(selected.sourceOfTruth || "-")}</div>
                <div class="fcp-kescher__value">sqlFile: ${escapeHtml(selected.sqlFile || selected.missingContract || "-")}</div>
              </div>
              <div class="fcp-kescher__card">
                <div class="fcp-kescher__label">Ist-Laufweg</div>
                <div class="fcp-kescher__value">read: ${escapeHtml(summarizeBinding(selected.loadBinding))}</div>
                <div class="fcp-kescher__value">write: ${escapeHtml(summarizeBinding(selected.saveBinding))}</div>
                <div class="fcp-kescher__value">rowsPath: ${escapeHtml(selected.rowsPath || "-")}</div>
                <div class="fcp-kescher__value">rowsPathExists: ${escapeHtml(selected.resolvedRowsPathExists == null ? "-" : String(selected.resolvedRowsPathExists))}</div>
              </div>
              <div class="fcp-kescher__card fcp-kescher__card--full">
                <div class="fcp-kescher__label">Benötigter SQL-Vertrag</div>
                ${selected.requiredSqlContract ? `
                  <div class="fcp-kescher__value">expectedColumns: ${escapeHtml(joinValues(selected.requiredSqlContract.expectedColumns))}</div>
                  <div class="fcp-kescher__value">source: ${escapeHtml(selected.requiredSqlContract.expectedSourceKind || "-")} / ${escapeHtml(selected.requiredSqlContract.expectedSource || "-")}</div>
                  <div class="fcp-kescher__value">resultType: ${escapeHtml(selected.requiredSqlContract.expectedResultType || "-")}</div>
                  <div class="fcp-kescher__value">valuePaths: ${escapeHtml(joinValues(selected.requiredSqlContract.valuePaths))}</div>
                  <div class="fcp-kescher__value">recommendedSqlFile: ${escapeHtml(selected.requiredSqlContract.recommendedSqlFile || "-")}</div>
                ` : `<div class="fcp-kescher__value">-</div>`}
              </div>
              <div class="fcp-kescher__card fcp-kescher__card--full">
                <div class="fcp-kescher__label">Prozesskette</div>
                <div class="fcp-kescher__chain">
                  ${selected.chain.map((step) => `
                    <div class="fcp-kescher__step">
                      <div class="fcp-kescher__step-head">
                        <strong>${escapeHtml(step.label)}</strong>
                        <span class="fcp-kescher__status is-${escapeHtml(step.status)}">${escapeHtml(step.status)}</span>
                      </div>
                      <div class="fcp-kescher__trace-meta">Soll: ${escapeHtml(step.expected)}</div>
                      <div class="fcp-kescher__value">Ist: ${escapeHtml(step.actual)}</div>
                    </div>
                  `).join("")}
                </div>
              </div>
              <div class="fcp-kescher__card">
                <div class="fcp-kescher__label">Soll-Spalten</div>
                <div class="fcp-kescher__list">${formatChips(selected.expectedColumns)}</div>
              </div>
              <div class="fcp-kescher__card">
                <div class="fcp-kescher__label">Ist-Spalten</div>
                <div class="fcp-kescher__list">${formatChips(selected.actualKeys)}</div>
              </div>
              <div class="fcp-kescher__card">
                <div class="fcp-kescher__label">Fehlend</div>
                <div class="fcp-kescher__list">${formatChips(selected.missingExpected, "is-missing")}</div>
              </div>
              <div class="fcp-kescher__card">
                <div class="fcp-kescher__label">Zusätzlich vorhanden</div>
                <div class="fcp-kescher__list">${formatChips(selected.additionalAvailableFields, "is-additional")}</div>
              </div>
              <div class="fcp-kescher__card fcp-kescher__card--full">
                <div class="fcp-kescher__label">Actions</div>
                <div class="fcp-kescher__value">rowInteractionMode: ${escapeHtml(selected.actions?.rowInteractionMode || "-")}</div>
                <div class="fcp-kescher__value">read=${escapeHtml(String(Boolean(selected.actions?.read)))} save=${escapeHtml(String(Boolean(selected.actions?.save)))} delete=${escapeHtml(String(Boolean(selected.actions?.delete)))} duplicate=${escapeHtml(String(Boolean(selected.actions?.duplicate)))}</div>
                <div class="fcp-kescher__value">rowKeyField: ${escapeHtml(selected.actions?.rowKeyField || "-")}</div>
              </div>
              <div class="fcp-kescher__card fcp-kescher__card--full">
                <div class="fcp-kescher__label">Field / Mapping</div>
                ${toArray(selected.fields).length ? selected.fields.map((field) => `
                  <div class="fcp-kescher__value">${escapeHtml(field.fieldName || "-")} | valuePath=${escapeHtml(field.valuePath || "-")} | payloadKey=${escapeHtml(field.payloadKey || "-")} | readonly=${escapeHtml(String(Boolean(field.readonly)))} | type=${escapeHtml(field.inputType || "-")}</div>
                `).join("") : `<div class="fcp-kescher__value">-</div>`}
              </div>
              <div class="fcp-kescher__card fcp-kescher__card--full">
                <div class="fcp-kescher__label">Write / Payload</div>
                <div class="fcp-kescher__value">payloadKeys: ${escapeHtml(joinValues(selected.write?.contract?.payloadKeys))}</div>
                <div class="fcp-kescher__value">payload: ${escapeHtml(summarizeValue(selected.write?.payload))}</div>
                <div class="fcp-kescher__value">response: ${escapeHtml(summarizeValue(selected.write?.response))}</div>
                <div class="fcp-kescher__value">error: ${escapeHtml(selected.write?.error || "-")}</div>
              </div>
            </div>
          ` : `<div class="fcp-kescher__empty">Noch kein Trace ausgewählt.</div>`}
        </div>
      </div>
    `;

    const closeButton = root.querySelector("#fcp-kescher-close");
    closeButton?.addEventListener("click", () => {
      const current = getKescherStore();
      current.open = false;
      renderKescher();
    });
    const copyButton = root.querySelector("#fcp-kescher-copy");
    copyButton?.addEventListener("click", async () => {
      const current = getKescherStore();
      try {
        await copyKescherJson();
        current.copyState = "JSON kopiert";
      } catch (error) {
        current.copyState = error?.message ? `Copy fehlgeschlagen: ${error.message}` : "Copy fehlgeschlagen";
      }
      renderKescher();
      window.setTimeout(() => {
        const latest = getKescherStore();
        latest.copyState = "";
        renderKescher();
      }, 2200);
    });
    const maskSelect = root.querySelector("#fcp-kescher-mask-select");
    maskSelect?.addEventListener("change", (event) => {
      const current = getKescherStore();
      current.selectedMaskId = String(event?.target?.value || "").trim();
      current.selectedKey = "";
      renderKescher();
    });
    root.querySelectorAll("[data-kescher-key]").forEach((button) => {
      button.addEventListener("click", () => {
        const current = getKescherStore();
        current.selectedKey = String(button.getAttribute("data-kescher-key") || "").trim();
        renderKescher();
      });
    });
  }

  function ensureKescherApi() {
    if (window.FcpKescher) return window.FcpKescher;
    window.FcpKescher = {
      description: "Zentraler Trace-Kanal fuer ADM/QFM. Zeigt Soll, Ist, Vertragskette, Read-/Write-Pfade und direkte Fehler pro Panel.",
      open() {
        const store = getKescherStore();
        store.open = true;
        renderKescher();
      },
      close() {
        const store = getKescherStore();
        store.open = false;
        renderKescher();
      },
      toggle() {
        const store = getKescherStore();
        store.open = !store.open;
        renderKescher();
      },
      render() {
        renderKescher();
      },
      clear() {
        const store = getKescherStore();
        store.traces.clear();
        store.selectedKey = "";
        renderKescher();
      },
      select(key) {
        const store = getKescherStore();
        store.selectedKey = String(key || "").trim();
        renderKescher();
      },
      getTraces() {
        return Array.from(getKescherStore().traces.values());
      },
      getTrace(key) {
        return getKescherStore().traces.get(String(key || "").trim()) || null;
      },
      export() {
        const store = getKescherStore();
        return buildKescherExport(Array.from(store.traces.values()), store.selectedMaskId);
      },
      async copyJson() {
        return copyKescherJson();
      },
    };
    return window.FcpKescher;
  }

  function upsertKescherTrace(debug) {
    if (!debug || !isKescherEnabled()) return;
    const api = ensureKescherApi();
    const store = getKescherStore();
    const trace = buildKescherTrace(debug);
    store.traces.set(trace.key, trace);
    if (!store.selectedKey) store.selectedKey = trace.key;
    if (!store.selectedMaskId) store.selectedMaskId = trace.maskId;
    if (store.open !== false) store.open = true;
    api.render();
    try {
      window.dispatchEvent(new CustomEvent("fcp-kescher:update", { detail: trace }));
    } catch {
      // ignore
    }
  }

  function buildReadDebugSnapshot({
    panel,
    resolverMeta,
    rows,
    model,
    runtimeModel,
    runtimeRows,
    readContract,
  }) {
    const contract = readContract || buildReadContractForPanel(panel, {
      maskId: panel?.__fcpMaskId || "",
      sectionId: panel?.__fcpSectionId || "",
    });
    const sqlContractMeta = resolveSqlContractMeta(panel, contract);
    const expectedColumns = uniqueStrings([...sqlContractMeta.expectedColumns, ...toArray(contract.expectedColumns)]);
    const rowsPath = String(contract.rowsPath || "").trim() || null;
    const valuePaths = toArray(contract.valuePaths);
    const runtimeSnapshot = resolveRuntimeReadSnapshot({
      panel,
      resolverMeta,
      model,
      runtimeModel,
      rows,
      runtimeRows,
      readContract: contract,
    });
        const actualKeys = runtimeSnapshot.actualKeys;
    const rowCount = runtimeSnapshot.rowCount;
    const resolvedRowsPathExists = runtimeSnapshot.resolvedRowsPathExists;
    const isRemoteEmpty = (runtimeSnapshot.bindingKind === "rpc"
      || runtimeSnapshot.bindingKind === "edge_function"
      || runtimeSnapshot.bindingKind === "auth_action")
      && rowCount === 0
      && !actualKeys.length;
    const missingExpected = isRemoteEmpty ? [] : expectedColumns.filter((key) => !actualKeys.includes(key));
    const usedColumns = expectedColumns.filter((key) => actualKeys.includes(key));
    const additionalAvailableFields = actualKeys.filter((key) => !expectedColumns.includes(key));
    const availableButUnusedColumns = additionalAvailableFields.slice();
    const loadBinding = runtimeSnapshot.loadBinding;
    const saveBinding = normalizeBindingForDebug(contract.saveBinding || panel?.saveBinding);
    const sqlFile = String(sqlContractMeta.sqlFile || "").trim() || null;
    const panelState = String(contract.panelState || resolvePanelStateKey(panel)).trim() || "live";
    const fields = buildPanelFieldContract(panel, resolverMeta);
    const actions = buildPanelActionSummary(panel);
    const writeExpected = isWriteExpected(panel, fields, actions);

    const debugObject = {
      maskId: String(contract.maskId || panel?.__fcpMaskId || "").trim(),
      sectionId: String(contract.sectionId || panel?.__fcpSectionId || "").trim(),
      panelId: String(contract.panelId || panel?.id || "").trim(),
      sourceTable: String(contract.sourceTable || panel?.meta?.sourceTable || "").trim() || null,
      sourceKind: String(contract.sourceKind || panel?.meta?.sourceKind || "").trim() || null,
      sourceOfTruth: String(contract.sourceOfTruth || panel?.meta?.sourceOfTruth || "").trim() || null,
      sqlFile,
      missingContract: sqlFile ? null : "NO_SQL_CONTRACT_REFERENCE",
      loadBinding,
      saveBinding,
      expectedColumns,
      rowsPath,
      valuePaths,
      actualKeys,
      usedColumns,
      additionalAvailableFields,
      availableButUnusedColumns,
      rowCount,
      resolvedRowsPathExists,
      missingExpected,
      securityContext: {
        requiresTenantAccess: contract?.securityContext?.requiresTenantAccess === true || panel?.securityContext?.requiresTenantAccess === true,
        requiresRoleCheck: contract?.securityContext?.requiresRoleCheck === true || panel?.securityContext?.requiresRoleCheck === true,
        allowedRoles: toArray(contract?.securityContext?.allowedRoles || panel?.securityContext?.allowedRoles),
        serverValidated: contract?.securityContext?.serverValidated === true || panel?.securityContext?.serverValidated === true,
      },
      fields,
      actions,
      panelState,
      writeExpected,
      contract: {
        type: contract.contractType || "read",
        componentType: contract.componentType || panel?.componentType || null,
        renderMode: contract.renderMode || panel?.renderMode || null,
        rowsPath,
        valuePaths,
      },
      suspectedIssue: detectSuspectedIssue({
        hasLoadBinding: Boolean(loadBinding?.kind && loadBinding.kind !== "none"),
        loadBindingKind: runtimeSnapshot.bindingKind,
        actualKeys,
        rowCount,
        rowsPath,
        rowsPathExists: resolvedRowsPathExists,
        missingExpected,
        panelState,
        writeExpected,
        saveBinding,
      }),
    };

    debugObject.requiredSqlContract = buildRequiredSqlContract(debugObject);

    return debugObject;
  }

  function emitPanelDebug(readDebug, writeDebug = null) {
    const panelDebug = isPanelDebugEnabled();
    const kescherEnabled = isKescherEnabled();
    if ((!panelDebug && !kescherEnabled) || !readDebug) return;
    const finalDebug = {
      ...readDebug,
      write: writeDebug || buildDefaultWriteDebug(),
    };

    if (finalDebug.write?.triggered === true) {
      if (finalDebug.write.error) {
        finalDebug.suspectedIssue = "RPC_ERROR";
      } else if (!finalDebug.write.payload || !Object.keys(finalDebug.write.payload).length) {
        finalDebug.suspectedIssue = "EMPTY_PAYLOAD";
      } else if (finalDebug.write.missingPayloadKeys?.length) {
        finalDebug.suspectedIssue = "MISSING_PAYLOAD_MAPPING";
      } else if (finalDebug.write.fieldMappings?.some((entry) =>
        entry?.payloadKey && entry?.resolvedValue === undefined
      )) {
        finalDebug.suspectedIssue = "INVALID_VALUE_PATH";
      } else if (!finalDebug.saveBinding || finalDebug.saveBinding.kind === "none") {
        finalDebug.suspectedIssue = "NO_SAVE_BINDING";
      }
    }

    if (kescherEnabled) {
      upsertKescherTrace(finalDebug);
    }

    if (panelDebug && typeof console !== "undefined") {
      console.groupCollapsed(`[FCP PANEL DEBUG] ${finalDebug.panelId}`);
      console.log("FULL DIAG:", finalDebug);
      if (Array.isArray(finalDebug.write?.fieldMappings) && finalDebug.write.fieldMappings.length) {
        console.table(finalDebug.write.fieldMappings);
      }
      console.groupEnd();
    }
  }

  async function executeBinding(binding, payload = null) {
    if (!binding || !binding.kind) return normalizeBindingResult({ kind: "none" }, []);

    if (binding.kind === "rpc") {
      const rpcName = String(binding.target || "").trim();
      const body = normalizeRpcPayload(rpcName, payload);
      const result = await sb(`/rest/v1/rpc/${rpcName.replace(/^public\./, "")}`, {
        method: "POST",
        body: JSON.stringify(body),
      }, true);
      return normalizeBindingResult(binding, result);
    }

    if (binding.kind === "auth_action") {
      const target = String(binding.target || "").trim();
      if (target === "list_sessions") {
        const currentSession = session();
        return normalizeBindingResult(binding, {
          rows: currentSession
            ? [
                {
                  slot: "Aktuelle Sitzung",
                  status: currentSession.user?.email || currentSession.user?.id || "Aktiv",
                },
              ]
            : [],
          record: null,
        });
      }
      if (target.startsWith("public.")) {
        const result = await sb(`/rest/v1/rpc/${target.replace(/^public\./, "")}`, {
          method: "POST",
          body: JSON.stringify(payload && typeof payload === "object" ? payload : {}),
        }, true);
        return normalizeBindingResult(binding, result);
      }
      throw new Error(`Auth-Aktion ${target || "unknown"} ist noch nicht live angebunden.`);
    }

    if (binding.kind === "edge_function") {
      const functionName = String(binding.target || "").trim();
      if (!functionName) {
        throw new Error("Edge Function Ziel fehlt.");
      }
      const { url, key } = cfg();
      if (!url || !key) throw new Error("Supabase-Konfiguration fehlt.");

      const requestBody = JSON.stringify(payload && typeof payload === "object" ? payload : {});
      const attempts = [];
      const runRequest = async ({ forceRefresh = false, useCustomTokenHeader = false } = {}) => {
        const token = await ensureAccessToken({ forceRefresh });
        if (!token) {
          throw new Error("Bitte zuerst einloggen.");
        }
        const authMode = useCustomTokenHeader ? "anon-plus-x-vdan-access-token" : "bearer-access-token";

        const headers = new Headers({
          apikey: key,
          "Content-Type": "application/json",
          Authorization: useCustomTokenHeader ? `Bearer ${key}` : `Bearer ${token}`,
        });
        if (useCustomTokenHeader) {
          headers.set("x-vdan-access-token", token);
        }

        const res = await fetch(`${url}/functions/v1/${functionName}`, {
          method: "POST",
          headers,
          body: requestBody,
        });
        const data = await res.json().catch(() => ({}));
        attempts.push({
          status: res.status,
          authMode,
          tokenPresent: Boolean(token),
          tokenPreview: token ? `${String(token).slice(0, 16)}...` : "",
          tokenSegments: String(token || "").split(".").length,
          response: data,
        });
        return { res, data, token, authMode };
      };

      let { res, data, token, authMode } = await runRequest({ forceRefresh: false, useCustomTokenHeader: false });
      if (res.status === 401) {
        ({ res, data, token, authMode } = await runRequest({ forceRefresh: true, useCustomTokenHeader: false }));
      }
      if (res.status === 401) {
        ({ res, data, token, authMode } = await runRequest({ forceRefresh: true, useCustomTokenHeader: true }));
      }
      if (!res.ok || data?.ok === false) {
        if (typeof console !== "undefined") {
          console.error("[FCP resolver] edge function failed", {
            panelId: String(binding?.panelId || ""),
            functionName,
            status: res.status,
            authMode,
            tokenPresent: Boolean(token),
            tokenPreview: token ? `${String(token).slice(0, 16)}...` : "",
            payload: payload && typeof payload === "object" ? payload : {},
            response: data,
            attempts,
          });
          try {
            console.error("[FCP resolver] edge function failed json", JSON.stringify({
              panelId: String(binding?.panelId || ""),
              functionName,
              status: res.status,
              authMode,
              tokenPresent: Boolean(token),
              tokenPreview: token ? `${String(token).slice(0, 16)}...` : "",
              payload: payload && typeof payload === "object" ? payload : {},
              response: data,
              attempts,
            }, null, 2));
          } catch {
            // ignore logging serialization failures
          }
        }
        throw new Error(String(data?.error || `function_${functionName}_failed_${res.status}`));
      }
      return normalizeBindingResult(binding, data);
    }

    if (binding.kind === "local_only") {
      const target = String(binding.target || "").trim();
      if (target === "app_status") {
        return normalizeBindingResult(binding, {
          record: {
            online: navigator.onLine,
          },
          rows: [],
        });
      }
      if (target === "check_update") {
        return normalizeBindingResult(binding, { record: { action: "check_update", ok: true }, rows: [] });
      }
      if (target === "reload_app") {
        window.location.reload();
        return normalizeBindingResult(binding, { record: { action: "reload_app", ok: true }, rows: [] });
      }
      return normalizeBindingResult(binding, { record: { ok: true }, rows: [] });
    }

    return normalizeBindingResult(binding, []);
  }

  function createResolver(options = {}) {
    const onMessage = typeof options.onMessage === "function" ? options.onMessage : () => {};
    const processState = options.processState && typeof options.processState.resolveLoad === "function"
      ? options.processState
      : null;
    let clubContextPromise = null;
    async function resolveClubContext() {
      if (clubContextPromise) return clubContextPromise;

      clubContextPromise = (async () => {
        await waitForAuthReady();
        const currentSession = session();
        const userId = String(currentSession?.user?.id || "").trim();
        const baseContext = {
          identity_id: userId,
          club_id: "",
          club_code: "",
          club_name: "",
          canonical_membership_id: "",
        };

        if (!userId) return baseContext;

        const [profileRows, aclRows, legacyRows, identityRows] = await Promise.all([
          sb(
            `/rest/v1/profiles?select=club_id,canonical_membership_id&id=eq.${encodeURIComponent(userId)}&limit=1`,
            { method: "GET" },
            true
          ).catch(() => []),
          sb(
            `/rest/v1/club_user_roles?select=club_id,role_key&user_id=eq.${encodeURIComponent(userId)}`,
            { method: "GET" },
            true
          ).catch(() => []),
          sb(
            `/rest/v1/user_roles?select=club_id,role&user_id=eq.${encodeURIComponent(userId)}`,
            { method: "GET" },
            true
          ).catch(() => []),
          sb("/rest/v1/rpc/get_club_identity_map", {
            method: "POST",
            body: "{}",
          }, true).catch(() => []),
        ]);

        const profile = Array.isArray(profileRows) && profileRows.length ? profileRows[0] : {};
        const canonicalMembershipId = String(profile?.canonical_membership_id || "").trim();

        const managedClubIds = new Set();
        toArray(aclRows).forEach((row) => {
          const clubId = String(row?.club_id || "").trim();
          const roleKey = normalizeRoleValue(row?.role_key);
          if (clubId && MANAGER_ROLES.has(roleKey)) managedClubIds.add(clubId);
        });
        toArray(legacyRows).forEach((row) => {
          const clubId = String(row?.club_id || "").trim();
          const roleKey = normalizeRoleValue(row?.role);
          if (clubId && MANAGER_ROLES.has(roleKey)) managedClubIds.add(clubId);
        });

        let clubId = String(profile?.club_id || "").trim();
        if (!clubId && managedClubIds.size === 1) {
          clubId = [...managedClubIds][0] || "";
        }
        if (!clubId && managedClubIds.size > 1) {
          const sortedManagedClubIds = [...managedClubIds].sort((a, b) => a.localeCompare(b, "de"));
          clubId = sortedManagedClubIds[0] || "";
        }

        if (!clubId) {
          return {
            ...baseContext,
            canonical_membership_id: canonicalMembershipId,
          };
        }

        const identity = (Array.isArray(identityRows) ? identityRows : []).find((entry) =>
          String(entry?.club_id || "").trim() === clubId
        ) || {};

        return {
          ...baseContext,
          club_id: clubId,
          club_code: String(identity?.club_code || "").trim(),
          club_name: String(identity?.club_name || "").trim(),
          canonical_membership_id: canonicalMembershipId,
        };
      })();

      return clubContextPromise;
    }

    async function loadRoleOnlyRows(baseRows, clubContext) {
      const currentClubId = String(clubContext?.club_id || "").trim();
      if (!currentClubId) return [];

      const rowKeys = new Set(
        toArray(baseRows).map((row) => clubUserRoleMapKey(row?.club_id, row?.profile_user_id)).filter(Boolean)
      );

      const [roleRows, profileRows, signinRows, identityRows] = await Promise.all([
        sb(`/rest/v1/club_user_roles?select=club_id,user_id,role_key&club_id=eq.${encodeURIComponent(currentClubId)}`, { method: "GET" }, true).catch(() => []),
        sb("/rest/v1/profiles?select=id,first_name,last_name,member_no", { method: "GET" }, true).catch(() => []),
        sb("/rest/v1/rpc/admin_user_last_signins", { method: "POST", body: "{}" }, true).catch(() => []),
        sb("/rest/v1/rpc/get_club_identity_map", { method: "POST", body: "{}" }, true).catch(() => []),
      ]);

      const profileById = new Map();
      toArray(profileRows).forEach((row) => {
        const id = String(row?.id || "").trim();
        if (!id) return;
        profileById.set(id, {
          first_name: String(row?.first_name || "").trim(),
          last_name: String(row?.last_name || "").trim(),
          member_no: String(row?.member_no || "").trim(),
        });
      });

      const lastSigninByUser = new Map();
      toArray(signinRows).forEach((row) => {
        const id = String(row?.user_id || "").trim();
        if (!id) return;
        lastSigninByUser.set(id, row?.last_sign_in_at || null);
      });

      const clubIdentityById = new Map();
      toArray(identityRows).forEach((row) => {
        const clubId = String(row?.club_id || "").trim();
        if (!clubId) return;
        clubIdentityById.set(clubId, {
          code: String(row?.club_code || "").trim(),
          name: String(row?.club_name || "").trim(),
        });
      });

      const coreRoleIds = new Set(["member", "vorstand", "admin"]);
      const seenRoleUsers = new Set();
      const out = [];

      toArray(roleRows).forEach((row) => {
        const clubId = String(row?.club_id || "").trim();
        const userId = String(row?.user_id || "").trim();
        if (!clubId || !userId) return;

        const roleKey = normalizeRoleValue(row?.role_key);
        if (!coreRoleIds.has(roleKey)) return;

        const key = `${clubId}:${userId}`;
        if (seenRoleUsers.has(key) || rowKeys.has(key)) return;
        seenRoleUsers.add(key);

        const profile = profileById.get(userId) || {};
        const identity = clubIdentityById.get(clubId) || {};
        const memberNo = String(profile?.member_no || "").trim();
        const lastSignInAt = lastSigninByUser.get(userId) || null;

        out.push({
          club_id: clubId,
          club_code: String(identity?.code || clubContext?.club_code || "").trim(),
          member_no: memberNo || "",
          club_member_no: "",
          first_name: String(profile?.first_name || "").trim(),
          last_name: String(profile?.last_name || "").trim(),
          role: roleKey || "member",
          status: toRoleOnlyStatusText(),
          fishing_card_type: "-",
          has_login: Boolean(lastSignInAt),
          last_sign_in_at: lastSignInAt,
          profile_user_id: userId,
          street: "",
          email: "",
          zip: "",
          city: "",
          phone: "",
          mobile: "",
          birthdate: null,
          sepa_approved: null,
          iban_last4: "",
          guardian_member_no: "",
          row_kind: "role_only",
        });
      });

      return out;
    }

    async function loadPanelContent(panel, panelContext = {}) {
      const resolverMeta = panel?.meta?.resolver || {};
      const binding = panel?.loadBinding || panel?.saveBinding || null;
      const maskId = String(panelContext?.maskId || "").trim();
      const sectionId = String(panelContext?.sectionId || "").trim();
      const readContract = buildReadContractForPanel(panel, { maskId, sectionId });
      const effectiveBinding = readContract?.binding
        ? { ...readContract.binding, panelId: readContract.panelId || panel?.id || "" }
        : binding
          ? { ...binding, panelId: panel?.id || "" }
          : null;
      const clubContext = await resolveClubContext();
      if ((typeof securityContracts.requiresClubContext === "function"
        ? securityContracts.requiresClubContext(panel)
        : resolverMeta.requiresClubContext === true)
        && !(typeof securityContracts.hasClubContext === "function"
          ? securityContracts.hasClubContext(clubContext)
          : clubContext.club_id)) {
        const missingClubContextMessage = typeof securityContracts.resolveMissingClubContextMessage === "function"
          ? securityContracts.resolveMissingClubContextMessage(panel)
          : String(resolverMeta.missingClubContextMessage || "Kein Vereinskontext verfuegbar.");
        const readDebug = buildReadDebugSnapshot({
          panel,
          resolverMeta,
          rows: [],
          model: { record: clubContext, rows: [] },
          runtimeModel: { record: clubContext, rows: [] },
          runtimeRows: [],
          readContract,
        });
        panel.__fcpReadDebug = readDebug;
        emitPanelDebug(readDebug);
        return {
          content: panel.renderMode === "form"
            ? { fields: hydrateFormContent(resolverMeta.fieldDefs, { record: {} }).fields, rows: [], actions: [], blocks: [] }
            : panel.renderMode === "readonly"
              ? { fields: [], rows: [{ label: "Status", value: missingClubContextMessage, span: "full" }], actions: [], blocks: [] }
              : {},
          rows: panel.renderMode === "table"
            ? []
            : undefined,
          state: {
            error: missingClubContextMessage,
            message: missingClubContextMessage,
          },
        };
      }
      const model = await executeBinding(
        effectiveBinding,
        applyPayloadTemplate(readContract?.loadPayloadDefaults || resolverMeta.loadPayloadDefaults || null, clubContext)
      );
      const processLoad = processState ? processState.resolveLoad(panel, model) || {} : {};
      const sessionUser = session()?.user || null;
      const pendingClubRequest = readLocalJson("vdan_club_request_pending_v1");
      const mergedRecord = mergeRecordSources(
        clubContext,
        pendingClubRequest,
        sessionUser?.email ? { requester_email: String(sessionUser.email || "").trim().toLowerCase() } : null,
        processLoad.model?.record,
        model?.record
      );
      const resolvedModel = processLoad.model
        ? { ...model, ...processLoad.model, record: mergedRecord }
        : { ...model, record: mergedRecord };
      const resolvedState = processLoad.state;

      if (panel.renderMode === "form") {
        const hydratedContent = hydrateFormContent(resolverMeta.fieldDefs, resolvedModel);
        const readDebug = buildReadDebugSnapshot({
          panel,
          resolverMeta,
          rows: [],
          model: resolvedModel,
          runtimeModel: model,
          runtimeRows: [],
          readContract,
        });
        panel.__fcpReadDebug = readDebug;
        emitPanelDebug(readDebug);
        return {
          content: hydratedContent,
          state: resolvedState,
        };
      }
      if (panel.renderMode === "readonly") {
        const readDebug = buildReadDebugSnapshot({
          panel,
          resolverMeta,
          rows: [],
          model: resolvedModel,
          runtimeModel: model,
          runtimeRows: [],
          readContract,
        });
        panel.__fcpReadDebug = readDebug;
        emitPanelDebug(readDebug);
        return {
          content: hydrateReadonlyContent(resolverMeta.fieldDefs, resolvedModel),
          state: resolvedState,
        };
      }
      if (panel.renderMode === "mixed") {
        const readDebug = buildReadDebugSnapshot({
          panel,
          resolverMeta,
          rows: [],
          model: resolvedModel,
          runtimeModel: model,
          runtimeRows: [],
          readContract,
        });
        panel.__fcpReadDebug = readDebug;
        emitPanelDebug(readDebug);
        return {
          content: hydrateMixedContent(resolverMeta.blockDefs, resolvedModel),
          state: resolvedState,
        };
      }
      if (panel.renderMode === "table") {
        let rows = toArray(getByPath(resolvedModel, readContract?.rowsPath || resolverMeta.rowsPath || panel.rowsPath || "rows"));
        if (resolverMeta.enrichMemberRegistry === true) {
          const roleRows = await sb("/rest/v1/club_user_roles?select=club_id,user_id,role_key", { method: "GET" }, true).catch(() => []);
          const effectiveRoleByClubUser = buildEffectiveRoleMap(roleRows);
          rows = applyEffectiveRolesToRows(rows, effectiveRoleByClubUser);
          const roleOnlyRows = await loadRoleOnlyRows(rows, clubContext);
          rows = [...rows, ...roleOnlyRows];
        }
        const readDebug = buildReadDebugSnapshot({
          panel,
          resolverMeta,
          rows,
          model: resolvedModel,
          runtimeModel: model,
          runtimeRows: toArray(getByPath(model, readContract?.rowsPath || resolverMeta.rowsPath || panel.rowsPath || "rows")),
          readContract,
        });
        panel.__fcpReadDebug = readDebug;
        emitPanelDebug(readDebug);
        return {
          rows,
          state: resolvedState,
        };
      }
      if (panel.renderMode === "actions") {
        return {
          state: resolvedState,
        };
      }
      return {};
    }

    function attachActionHandlers(section, panel) {
      panel.actions = toArray(panel.actions).map((action) => ({
        ...action,
        onClick: async () => {
          const binding = action.binding || panel.saveBinding;
          const result = await executeBinding(binding);
          const processAction = processState && typeof processState.resolveAction === "function"
            ? processState.resolveAction(panel, action, result) || {}
            : {};
          const message = processAction.message || `${action.label || action.id || "Aktion"} ausgefuehrt.`;
          onMessage(message);
        },
      }));
    }

    function enhanceConfig(config) {
      const rootMaskId = String(config?.maskId || "").trim();
      const next = {
        ...config,
        sections: toArray(config.sections).map((section) => ({
          ...section,
          panels: toArray(section.panels).map((panel) => {
            const nextPanel = {
              ...panel,
              __fcpMaskId: rootMaskId,
              __fcpSectionId: section.id,
              __fcpSqlContractMeta: structuredCloneSafe(panel?.meta?.sqlContract || null),
              load: async () => loadPanelContent(nextPanel, {
                maskId: rootMaskId,
                sectionId: section.id,
              }),
            };
            attachActionHandlers(section, nextPanel);
            return nextPanel;
          }),
        })),
      };
      return next;
    }

    async function hydrateVisiblePanels(pattern) {
      const state = pattern.getState();
      const activeSection = toArray(state.sections).find((section) => section.id === state.activeSectionId);
      if (!activeSection) return;
      const openPanels = toArray(activeSection.panels).filter((panel) => panel.open);
      for (const panel of openPanels) {
        await pattern.loadPanel(activeSection.id, panel.id);
      }
    }

    async function savePanel(payload, ctx) {
      const panel = ctx?.panel;
      if (!panel) throw new Error("Panelkontext fehlt.");
      const binding = panel.saveBinding;
      if (!binding || binding.kind === "none") {
        onMessage("Dieser Bereich ist schreibgeschuetzt.");
        return {};
      }

      const currentFields = toArray(ctx.panel?.draftContent?.fields || ctx.panel?.loadedContent?.fields);
      const incomingPayload = payload && typeof payload === "object" ? { ...payload } : {};
      let nextFields = currentFields.map((field) => ({
        ...field,
        value: Object.prototype.hasOwnProperty.call(payload || {}, field.name) ? payload[field.name] : field.value,
      }));
      const passthroughPayload = Object.fromEntries(
        Object.entries(incomingPayload).filter(([key]) => !currentFields.some((field) => field?.name === key))
      );

      const resolverMeta = panel?.meta?.resolver || {};
      const clubContext = await resolveClubContext();
      const writeContract = buildWriteContractForPanel(panel, nextFields, {
        maskId: ctx?.pattern?.config?.maskId || panel?.__fcpMaskId || "",
        sectionId: ctx?.section?.id || panel?.__fcpSectionId || "",
      });
      const savePayload = applyPayloadTemplate(
        applySaveDefaults(
          {
            ...passthroughPayload,
            ...buildSavePayload(nextFields),
          },
          writeContract?.savePayloadDefaults || resolverMeta.savePayloadDefaults
        ),
        clubContext
      );
      const expectedPayloadKeys = uniqueStrings(writeContract?.payloadKeys || []);
      const actualPayloadKeys = uniqueStrings(Object.keys(savePayload || {}));
      const fieldMappings = toArray(writeContract?.fieldMappings).map((field) => ({
        ...field,
        includedInPayload: Boolean(field?.payloadKey && Object.prototype.hasOwnProperty.call(savePayload || {}, field.payloadKey)),
      }));
      const effectiveSaveBinding = writeContract?.binding || binding;
      const writeDebugBase = {
        triggered: true,
        fieldMappings,
        contract: {
          type: writeContract?.contractType || "write",
          payloadKeys: expectedPayloadKeys,
          componentType: writeContract?.componentType || panel?.componentType || null,
          renderMode: writeContract?.renderMode || panel?.renderMode || null,
        },
        payload: savePayload,
        rpcTarget: String(effectiveSaveBinding?.target || "").trim() || null,
        rpcPath: String(effectiveSaveBinding?.path || "").trim() || null,
        response: null,
        error: null,
        missingPayloadKeys: expectedPayloadKeys.filter((key) => !actualPayloadKeys.includes(key)),
        emptyValues: actualPayloadKeys.filter((key) => {
          const value = savePayload?.[key];
          return value === "" || value === null || value === undefined;
        }),
        unexpectedPayloadKeys: actualPayloadKeys.filter((key) => !expectedPayloadKeys.includes(key)),
      };

      if (binding.kind === "edge_function" && !session()?.access_token) {
        const draftStorageKey = String(resolverMeta.draftStorageKey || "").trim();
        const draftPayload = applySaveDefaults(
          savePayload,
          resolverMeta.draftPayloadDefaults
        );
        if (draftStorageKey) {
          writeLocalJson(draftStorageKey, draftPayload);
        }
        window.dispatchEvent(new CustomEvent("fcp-mask:auth-required", {
          detail: {
            panelId: panel.id,
            sectionId: ctx?.section?.id || "",
            message: String(resolverMeta.authRequiredMessage || "Bitte zuerst einloggen oder einen Zugang anlegen."),
            draftStorageKey,
            payload: draftPayload,
          },
        }));
        emitPanelDebug(panel.__fcpReadDebug || buildReadDebugSnapshot({
          maskId: ctx?.pattern?.config?.maskId || "",
          sectionId: ctx?.section?.id || "",
          panel,
          resolverMeta,
          rows: toArray(ctx?.panel?.loadedRows),
          model: { record: {} },
          runtimeModel: { record: {} },
          runtimeRows: toArray(ctx?.panel?.loadedRows),
        }), {
          ...writeDebugBase,
          error: String(resolverMeta.authRequiredMessage || "Bitte zuerst einloggen."),
        });
        throw new Error(String(resolverMeta.authRequiredMessage || "Bitte zuerst einloggen."));
      }
      let result;
      let raw = {};
      try {
        result = await executeBinding(effectiveSaveBinding, savePayload);
        raw = result?.raw || {};
      } catch (error) {
        emitPanelDebug(panel.__fcpReadDebug || buildReadDebugSnapshot({
          maskId: ctx?.pattern?.config?.maskId || "",
          sectionId: ctx?.section?.id || "",
          panel,
          resolverMeta,
          rows: toArray(ctx?.panel?.loadedRows),
          model: { record: {} },
          runtimeModel: { record: {} },
          runtimeRows: toArray(ctx?.panel?.loadedRows),
        }), {
          ...writeDebugBase,
          response: raw,
          error: normalizeErrorMessage(error, "save_failed"),
        });
        throw error;
      }
      const resultFieldMap = resolverMeta.resultFieldMap && typeof resolverMeta.resultFieldMap === "object"
        ? resolverMeta.resultFieldMap
        : null;
      if (resultFieldMap) {
        nextFields = nextFields.map((field) => {
          const mappedKey = String(resultFieldMap[field.name] || "").trim();
          if (!mappedKey) return field;
          return {
            ...field,
            value: getByPath(raw, mappedKey) ?? field.value,
          };
        });
      }
      if (binding.kind === "edge_function") {
        try {
          const draftStorageKey = String(resolverMeta.draftStorageKey || "vdan_club_request_pending_v1").trim();
          localStorage.removeItem(draftStorageKey);
        } catch {
          // ignore
        }
      }
      const successMessage = String(resolverMeta.successMessage || "").trim() || (
        raw?.status === "approved"
          ? "Vereinsanfrage freigegeben. Du wirst jetzt im Portal weiterarbeiten koennen."
          : raw?.status === "pending"
            ? "Vereinsanfrage gespeichert und zur Pruefung eingereicht."
            : "Aenderungen gespeichert."
      );
      onMessage(successMessage);
      window.dispatchEvent(new CustomEvent("fcp-mask:save-success", {
        detail: {
          panelId: panel.id,
          sectionId: ctx?.section?.id || "",
          binding,
          message: successMessage,
          result: raw,
          resolverMeta,
        },
      }));
      emitPanelDebug(panel.__fcpReadDebug || buildReadDebugSnapshot({
        maskId: ctx?.pattern?.config?.maskId || "",
        sectionId: ctx?.section?.id || "",
        panel,
        resolverMeta,
        rows: toArray(ctx?.panel?.loadedRows),
        model: { record: raw && typeof raw === "object" ? raw : {} },
        runtimeModel: { record: raw && typeof raw === "object" ? raw : {} },
        runtimeRows: toArray(ctx?.panel?.loadedRows),
      }), {
        ...writeDebugBase,
        response: raw,
        error: null,
      });

      if (ctx?.pattern && ctx?.section?.id) {
        const siblingPanels = toArray(ctx.section.panels).filter((candidate) =>
          candidate && candidate.id && candidate.id !== panel.id && candidate.loadBinding
        );
        for (const sibling of siblingPanels) {
          await ctx.pattern.loadPanel(ctx.section.id, sibling.id).catch(() => null);
        }
      }

      if (panel.renderMode === "form") {
        return {
          content: {
            fields: nextFields,
            rows: [],
            actions: [],
            blocks: [],
          },
        };
      }

      return {};
    }

    return {
      enhanceConfig,
      hydrateVisiblePanels,
      savePanel,
    };
  }

  window.FcpMaskDataResolver = Object.freeze({
    create: createResolver,
  });
})();
