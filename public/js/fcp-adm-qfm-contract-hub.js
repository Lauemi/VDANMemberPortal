"use strict";

;(() => {
  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function getByPath(source, dottedPath) {
    const path = String(dottedPath || "").trim();
    if (!path) return undefined;
    return path.split(".").reduce((acc, key) => {
      if (acc == null) return undefined;
      return acc[key];
    }, source);
  }

  function mergeRecordSources(...sources) {
    return sources.reduce((acc, source) => {
      if (source && typeof source === "object" && !Array.isArray(source)) {
        return { ...acc, ...source };
      }
      return acc;
    }, {});
  }

  function uniqueStrings(values) {
    return [...new Set(toArray(values).map((value) => String(value || "").trim()).filter(Boolean))];
  }

  function collectFieldDefs(panel) {
    return toArray(
      panel?.content?.fields?.length
        ? panel.content.fields
        : panel?.meta?.resolver?.fieldDefs?.length
          ? panel.meta.resolver.fieldDefs
          : panel?.meta?.form?.fieldDefs
    );
  }

  function normalizeBindingResult(binding, result) {
    if (Array.isArray(result)) {
      return {
        raw: result,
        rows: result,
        record: result[0] || null,
      };
    }

    if (result && typeof result === "object") {
      return {
        raw: result,
        rows: Array.isArray(result.rows) ? result.rows : [],
        record: result.record && typeof result.record === "object" ? result.record : result,
      };
    }

    return {
      raw: result,
      rows: [],
      record: null,
    };
  }

  function normalizeErrorMessage(error, fallback) {
    if (!error) return fallback;
    if (typeof error === "string") return error;
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  }

  function normalizeFieldType(rawType, fallback = "text") {
    const value = String(rawType || "").trim().toLowerCase();
    if (!value) return fallback;
    if (["toggle-nullable", "boolean-nullable"].includes(value)) return "boolean-nullable";
    if (["toggle", "checkbox", "boolean"].includes(value)) return "boolean";
    if (["text", "email", "password", "tel", "url", "search"].includes(value)) return "text";
    if (["number", "numeric"].includes(value)) return "number";
    if (value === "select") return "select";
    if (value === "date") return "date";
    if (["datetime", "datetime-local", "timestamptz", "timestamp"].includes(value)) return "datetime";
    if (value === "textarea") return "textarea";
    if (["json", "jsonb", "json-display"].includes(value)) return "json-display";
    if (["masked-text", "masked"].includes(value)) return "masked-text";
    if (value === "readonly") return "readonly";
    if (value === "select-multi") return "special";
    return fallback;
  }

  function normalizeFieldOptions(options) {
    return toArray(options)
      .map((option) => {
        if (option && typeof option === "object") {
          const value = option.value ?? option.id ?? option.key ?? "";
          return {
            value,
            label: option.label ?? value,
          };
        }
        return {
          value: option,
          label: option,
        };
      })
      .filter((option) => String(option.value ?? "").trim() !== "");
  }

  function fieldHelpText(field) {
    return String(field?.help || field?.helpText || field?.description || "").trim();
  }

  function fieldBindingKey(field) {
    return String(field?.name || field?.payloadKey || field?.key || "").trim();
  }

  function normalizeFieldDefinition(field, options = {}) {
    const source = field && typeof field === "object" ? field : {};
    const surface = String(options.surface || "form").trim() || "form";
    const explicitSpecial = String(source.specialComponent || "").trim();
    const rawType = source.editorType || source.inputType || source.type || source.componentType || "";
    const normalizedType = explicitSpecial
      ? "special"
      : normalizeFieldType(rawType, surface === "readonly" ? "readonly" : "text");
    const name = fieldBindingKey(source);
    const readonly = source.readonly === true || source.editable === false || normalizedType === "readonly";
    const normalized = {
      ...source,
      surface,
      name,
      payloadKey: String(source.payloadKey || name).trim() || null,
      label: String(source.label || source.name || source.key || "").trim() || "-",
      componentType: normalizedType,
      editorType: normalizedType,
      inputType: normalizedType === "boolean"
        ? "checkbox"
        : normalizedType === "readonly"
          ? "text"
          : normalizedType,
      options: normalizeFieldOptions(source.options),
      help: fieldHelpText(source),
      readonly,
      disabled: source.disabled === true || readonly,
      required: source.required === true,
      span: source.span || source.displaySpan || null,
      rows: Number(source.rows) > 0 ? Number(source.rows) : 4,
      value: source.value ?? source.defaultValue ?? (normalizedType === "boolean" ? false : ""),
      specialComponent: explicitSpecial || (rawType === "select-multi" ? "select-multi" : ""),
    };
    if (normalized.componentType === "special") {
      normalized.editorType = normalized.specialComponent || "special";
    }
    return normalized;
  }

  function normalizeFieldCollection(fields, options = {}) {
    return toArray(fields).map((field) => normalizeFieldDefinition(field, options));
  }

  function valueToText(value) {
    if (value == null || value === "") return "-";
    if (Array.isArray(value)) {
      return value.length ? value.map((entry) => valueToText(entry)).join(", ") : "-";
    }
    if (value && typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return "[object]";
      }
    }
    if (typeof value === "boolean") return value ? "Ja" : "Nein";
    return String(value);
  }

  function formatDateValue(value, mode = "date") {
    const text = String(value || "").trim();
    if (!text) return "-";
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return text;
    if (mode === "datetime") {
      return parsed.toLocaleString("de-DE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return parsed.toLocaleDateString("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  function maskDisplayValue(value, options = {}) {
    const text = String(value || "").trim();
    if (!text) return "-";
    const keep = Number(options.keepLast ?? 4);
    if (text.length <= keep) return text;
    return `${"•".repeat(Math.max(0, text.length - keep))}${text.slice(-keep)}`;
  }

  function formatFieldDisplayValue(field, value) {
    const normalized = normalizeFieldDefinition({
      ...(field && typeof field === "object" ? field : {}),
      value,
    }, { surface: "readonly" });
    if (normalized.componentType === "boolean" || normalized.componentType === "boolean-nullable") {
      if (value == null && normalized.componentType === "boolean-nullable") return "-";
      return valueToText(Boolean(value));
    }
    if (normalized.componentType === "date") {
      return formatDateValue(value, "date");
    }
    if (normalized.componentType === "datetime") {
      return formatDateValue(value, "datetime");
    }
    if (normalized.componentType === "masked-text") {
      return maskDisplayValue(value, normalized.maskOptions || {});
    }
    if (normalized.componentType === "json-display") {
      if (value == null || value === "") return "-";
      try {
        return typeof value === "string" ? value : JSON.stringify(value);
      } catch {
        return valueToText(value);
      }
    }
    return valueToText(value);
  }

  function renderReadonlyFieldNode(field, runtime = {}) {
    const createElement = runtime.createElement;
    if (typeof createElement !== "function") {
      throw new Error("renderReadonlyFieldNode braucht createElement.");
    }
    const normalized = normalizeFieldDefinition(field, { surface: "readonly" });
    const item = createElement("div", {
      className: `qfp-readonly-item${normalized.span === "full" ? " is-full" : ""}`,
    });
    item.append(
      createElement("div", { className: "qfp-field-label", text: normalized.label }),
      createElement("div", { className: "qfp-field-value", text: formatFieldDisplayValue(normalized, normalized.value) })
    );
    return item;
  }

  function renderFieldNode(field, runtime = {}) {
    const createElement = runtime.createElement;
    const fieldClassName = String(runtime.fieldClassName || "qfp-form-field").trim() || "qfp-form-field";
    const nameAttr = String(runtime.nameAttr || "name").trim() || "name";
    const dataAttr = String(runtime.dataFieldAttr || "").trim();
    const controlClassName = String(runtime.controlClassName || "").trim();
    if (typeof createElement !== "function") {
      throw new Error("renderFieldNode braucht createElement.");
    }

    const normalized = normalizeFieldDefinition(field, { surface: runtime.surface || "form" });
    if (normalized.specialComponent) return null;
    const label = createElement("label", {
      className: `${fieldClassName}${normalized.span === "full" ? " is-full" : ""}${normalized.readonly ? " is-readonly" : ""}`,
    });
    label.append(createElement("span", {
      className: "qfp-field-label",
      text: normalized.label,
    }));

    const controlAttrs = {
      [nameAttr]: normalized.name || undefined,
      disabled: normalized.disabled ? "disabled" : undefined,
      required: normalized.required ? "required" : undefined,
    };
    if (dataAttr) controlAttrs[dataAttr] = normalized.payloadKey || normalized.name || undefined;
    if (normalized.placeholder) controlAttrs.placeholder = normalized.placeholder;
    if (normalized.autocomplete) controlAttrs.autocomplete = normalized.autocomplete;
    if (normalized.inputMode) controlAttrs.inputmode = normalized.inputMode;

    if (normalized.componentType === "textarea") {
      label.append(
        createElement("textarea", {
          className: controlClassName || undefined,
          attrs: {
            ...controlAttrs,
            rows: normalized.rows || 4,
          },
          text: String(normalized.value ?? ""),
        })
      );
    } else if (normalized.componentType === "select") {
      const select = createElement("select", {
        className: controlClassName || undefined,
        attrs: controlAttrs,
      });
      normalized.options.forEach((option) => {
        select.append(
          createElement("option", {
            text: option.label || option.value,
            attrs: {
              value: option.value,
              selected: String(option.value ?? "") === String(normalized.value ?? "") ? "selected" : undefined,
            },
          })
        );
      });
      label.append(select);
    } else if (normalized.componentType === "boolean" || normalized.componentType === "boolean-nullable") {
      const toggleRow = createElement("div", { className: "qfp-toggle-row" });
      toggleRow.append(
        createElement("input", {
          className: controlClassName || undefined,
          attrs: {
            ...controlAttrs,
            type: "checkbox",
            checked: normalized.value ? "checked" : undefined,
          },
        }),
        createElement("span", {
          className: "qfp-toggle-label",
          text: normalized.help || normalized.label,
        })
      );
      label.append(toggleRow);
    } else if (normalized.componentType === "json-display") {
      label.append(
        createElement("textarea", {
          className: controlClassName || undefined,
          attrs: {
            ...controlAttrs,
            rows: normalized.rows || 4,
            readonly: "readonly",
          },
          text: formatFieldDisplayValue(normalized, normalized.value),
        })
      );
    } else {
      const inputType = normalized.componentType === "number"
        ? "number"
        : normalized.componentType === "date"
          ? "date"
          : normalized.componentType === "datetime"
            ? "datetime-local"
          : "text";
      label.append(
        createElement("input", {
          className: controlClassName || undefined,
          attrs: {
            ...controlAttrs,
            type: inputType,
            value: normalized.componentType === "masked-text"
              ? formatFieldDisplayValue(normalized, normalized.value)
              : (normalized.value ?? ""),
          },
        })
      );
    }

    if (normalized.help && normalized.componentType !== "boolean") {
      label.append(createElement("span", { className: "qfp-field-help", text: normalized.help }));
    }
    return label;
  }

  function readFieldValue(root, field, options = {}) {
    if (!(root instanceof HTMLElement)) return undefined;
    const normalized = normalizeFieldDefinition(field, { surface: options.surface || "form" });
    if (normalized.specialComponent || !normalized.payloadKey) return undefined;
    const selectorAttr = String(options.selectorAttr || "name").trim() || "name";
    const selectorValue = selectorAttr === "name" ? normalized.name : normalized.payloadKey;
    if (!selectorValue) return undefined;
    const node = root.querySelector(`[${selectorAttr}="${CSS.escape(selectorValue)}"]`);
    if (!node) return undefined;
    if (node instanceof HTMLInputElement && node.type === "checkbox") {
      return Boolean(node.checked);
    }
    const rawValue = "value" in node ? node.value : "";
    if (options.emptyAsNull && rawValue === "") return null;
    return rawValue;
  }

  function collectFieldPayload(root, fields, options = {}) {
    return normalizeFieldCollection(fields, { surface: options.surface || "form" }).reduce((acc, field) => {
      if (!field.payloadKey || (field.readonly && options.includeReadonly !== true) || field.specialComponent) {
        return acc;
      }
      const value = readFieldValue(root, field, options);
      if (value === undefined) return acc;
      acc[field.payloadKey] = value;
      return acc;
    }, {});
  }

  function normalizeColumnField(column, row, options = {}) {
    const source = column && typeof column === "object" ? column : {};
    const value = source?.key ? row?.[source.key] : null;
    return normalizeFieldDefinition({
      key: source.key,
      name: source.key,
      label: source.label || source.key,
      value: source.type === "boolean" ? Boolean(value) : (value ?? ""),
      editable: source.editable !== false,
      readonly: source.editable === false || source.editorType === "readonly",
      payloadKey: String(source.payloadKey || source.key || "").trim(),
      options: Array.isArray(source.options) ? source.options : [],
      editorType: source.editorType || (source.type === "boolean" ? "checkbox" : "text"),
      type: source.editorType || source.type || "text",
      placeholder: source.placeholder || "",
      specialComponent: source.editorType === "select-multi" ? "select-multi" : "",
    }, { surface: options.surface || "dialog" });
  }

  function renderFieldControlHtml(field, runtime = {}) {
    const esc = typeof runtime.esc === "function" ? runtime.esc : (value) => String(value ?? "");
    const mode = String(runtime.mode || "edit").trim() || "edit";
    const normalized = normalizeFieldDefinition(field, { surface: runtime.surface || "inline" });

    if (normalized.specialComponent === "select-multi") {
      const currentValues = Array.isArray(normalized.value)
        ? normalized.value
            .map((entry) => {
              if (entry && typeof entry === "object") {
                return String(entry.id || entry.value || entry.key || "").trim();
              }
              return String(entry || "").trim();
            })
            .filter(Boolean)
        : [];
      const selected = new Set(currentValues);
      return `
        <div class="data-table__multi-select" data-editor-mode="${esc(mode)}" data-editor-key="${esc(normalized.payloadKey || normalized.name)}">
          ${normalized.options.map((option) => `
            <label class="inline-check">
              <input type="checkbox" value="${esc(option.value)}" ${selected.has(String(option.value)) ? "checked" : ""} />
              <span>${esc(option.label)}</span>
            </label>
          `).join("")}
        </div>
      `;
    }

    if (normalized.readonly || normalized.componentType === "readonly" || normalized.componentType === "json-display") {
      return `<div class="data-table__editor-readonly">${esc(formatFieldDisplayValue(normalized, normalized.value))}</div>`;
    }

    if (normalized.componentType === "select") {
      return `
        <select class="data-table__editor-control" data-editor-mode="${esc(mode)}" data-editor-key="${esc(normalized.payloadKey || normalized.name)}" ${normalized.disabled ? "disabled" : ""}>
          ${normalized.options.map((option) => `
            <option value="${esc(option.value)}" ${String(option.value) === String(normalized.value ?? "") ? "selected" : ""}>${esc(option.label)}</option>
          `).join("")}
        </select>
      `;
    }

    if (normalized.componentType === "boolean" || normalized.componentType === "boolean-nullable") {
      return `
        <label class="inline-check inline-check--single">
          <input type="checkbox" data-editor-mode="${esc(mode)}" data-editor-key="${esc(normalized.payloadKey || normalized.name)}" ${normalized.value ? "checked" : ""} ${normalized.disabled ? "disabled" : ""} />
          <span>${esc(normalized.label)}</span>
        </label>
      `;
    }

    if (normalized.componentType === "textarea") {
      return `
        <textarea
          class="data-table__editor-control"
          data-editor-mode="${esc(mode)}"
          data-editor-key="${esc(normalized.payloadKey || normalized.name)}"
          rows="${esc(normalized.rows || 4)}"
          placeholder="${esc(normalized.placeholder || "")}"
          ${normalized.disabled ? "disabled" : ""}
        >${esc(normalized.value ?? "")}</textarea>
      `;
    }

    const inputType = normalized.componentType === "number"
      ? "number"
      : normalized.componentType === "date"
        ? "date"
        : normalized.componentType === "datetime"
          ? "datetime-local"
        : "text";
    return `
      <input
        class="data-table__editor-control"
        data-editor-mode="${esc(mode)}"
        data-editor-key="${esc(normalized.payloadKey || normalized.name)}"
        type="${esc(inputType)}"
        value="${esc(normalized.componentType === "masked-text" ? formatFieldDisplayValue(normalized, normalized.value) : (normalized.value ?? ""))}"
        placeholder="${esc(normalized.placeholder || "")}"
        ${normalized.disabled ? "disabled" : ""}
      />
    `;
  }

  function authSession() {
    try {
      if (window.VDAN_AUTH?.loadSession) return window.VDAN_AUTH.loadSession();
    } catch {
      // noop
    }
    return null;
  }

  async function authToken() {
    let current = String(authSession()?.access_token || "").trim();
    if (current) return current;
    try {
      if (window.VDAN_AUTH?.refreshSession) {
        const refreshed = await window.VDAN_AUTH.refreshSession();
        current = String(refreshed?.access_token || authSession()?.access_token || "").trim();
      }
    } catch {
      // noop
    }
    return current;
  }

  async function rpcPost(path, payload, withAuth = false) {
    const baseUrl = String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, "");
    const apiKey = String(window.__APP_SUPABASE_KEY || "").trim();
    if (!baseUrl) throw new Error("Supabase-URL fehlt.");
    if (!apiKey) throw new Error("Supabase-API-Key fehlt.");
    const headers = new Headers({
      "Content-Type": "application/json",
      Accept: "application/json",
    });
    headers.set("apikey", apiKey);
    if (withAuth) {
      const token = await authToken();
      if (!token) throw new Error("Keine aktive Sitzung gefunden.");
      headers.set("Authorization", `Bearer ${token}`);
    }
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload || {}),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || `RPC fehlgeschlagen (${response.status})`);
    }
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async function edgePost(functionName, payload) {
    const baseUrl = String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, "");
    const apiKey = String(window.__APP_SUPABASE_KEY || "").trim();
    if (!baseUrl) throw new Error("Supabase-URL fehlt.");
    if (!apiKey) throw new Error("Supabase-API-Key fehlt.");

    const requestBody = JSON.stringify(payload || {});

    async function runRequest({ forceRefresh = false, useCustomTokenHeader = false } = {}) {
      const token = await authToken(forceRefresh);
      if (!token) throw new Error("Keine aktive Sitzung gefunden.");
      const headers = new Headers({
        apikey: apiKey,
        "Content-Type": "application/json",
        Authorization: useCustomTokenHeader ? `Bearer ${apiKey}` : `Bearer ${token}`,
      });
      if (useCustomTokenHeader) headers.set("x-vdan-access-token", token);

      const response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
        method: "POST",
        headers,
        body: requestBody,
      });
      const data = await response.json().catch(() => ({}));
      return { response, data };
    }

    let { response, data } = await runRequest({ forceRefresh: false, useCustomTokenHeader: false });
    if (response.status === 401) {
      ({ response, data } = await runRequest({ forceRefresh: true, useCustomTokenHeader: false }));
    }
    if (response.status === 401) {
      ({ response, data } = await runRequest({ forceRefresh: true, useCustomTokenHeader: true }));
    }

    if (!response.ok || data?.ok === false) {
      throw new Error(String(data?.error || data?.message || `Edge Function fehlgeschlagen (${response.status})`));
    }
    return data;
  }

  async function authJson(path, { method = "GET", body = null } = {}) {
    const baseUrl = String(window.__APP_SUPABASE_URL || "").trim().replace(/\/+$/, "");
    const apiKey = String(window.__APP_SUPABASE_KEY || "").trim();
    if (!baseUrl) throw new Error("Supabase-URL fehlt.");
    if (!apiKey) throw new Error("Supabase-API-Key fehlt.");

    async function runRequest({ forceRefresh = false } = {}) {
      const token = await authToken(forceRefresh);
      if (!token) throw new Error("Keine aktive Sitzung gefunden.");
      const headers = new Headers({
        apikey: apiKey,
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      });
      if (body != null) headers.set("Content-Type", "application/json");
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : undefined,
      });
      const data = await response.json().catch(() => ([]));
      return { response, data };
    }

    let { response, data } = await runRequest({ forceRefresh: false });
    if (response.status === 401) {
      ({ response, data } = await runRequest({ forceRefresh: true }));
    }
    if (!response.ok) {
      throw new Error(String(data?.message || `Request fehlgeschlagen (${response.status})`));
    }
    return data;
  }

  function buildFieldValue(field, model) {
    const valueFromPath = getByPath(model, field.valuePath);
    if (valueFromPath !== undefined && valueFromPath !== null) return valueFromPath;
    return field.defaultValue ?? "";
  }

  function hydrateFormContent(fieldDefs, model) {
    return {
      fields: normalizeFieldCollection(toArray(fieldDefs).map((field) => ({
        ...field,
        value: buildFieldValue(field, model),
      })), { surface: "form" }),
      rows: [],
      actions: [],
      blocks: [],
    };
  }

  function hydrateReadonlyContent(fieldDefs, model) {
    return {
      fields: [],
      rows: toArray(fieldDefs).map((field) => ({
        label: field.label,
        value: buildFieldValue(field, model) || "-",
        span: field.displaySpan || null,
      })),
      actions: [],
      blocks: [],
    };
  }

  function hydrateMixedContent(blockDefs, model) {
    const blocks = toArray(blockDefs).map((block) => {
      if (block.renderMode === "table") {
        const rows = toArray(getByPath(model, block.rowsPath || "rows"));
        return {
          title: block.label || block.id,
          componentType: block.componentType || null,
          renderMode: "table",
          columns: toArray(block.columns),
          tableConfig: block.tableConfig || null,
          rows,
        };
      }

      return {
        title: block.label || block.id,
        componentType: block.componentType || null,
        renderMode: block.renderMode || "readonly",
        content: {
          rows: [
            {
              label: block.label || block.id,
              value: getByPath(model, block.valuePath) || block.emptyStateText || "-",
              span: block.displaySpan || "full",
            },
          ],
        },
      };
    });

    return {
      fields: [],
      rows: [],
      actions: [],
      blocks,
    };
  }

  function buildSavePayload(fields) {
    return toArray(fields).reduce((acc, field) => {
      if (field.readonly) return acc;
      const payloadKey = String(field.payloadKey || field.name || "").trim();
      if (!payloadKey) return acc;
      acc[payloadKey] = field.value === "" ? null : field.value;
      return acc;
    }, {});
  }

  function applySaveDefaults(payload, defaults) {
    if (!defaults || typeof defaults !== "object") return payload;
    return {
      ...defaults,
      ...payload,
    };
  }

  function applyPayloadTemplate(value, context = {}) {
    if (Array.isArray(value)) {
      return value.map((entry) => applyPayloadTemplate(entry, context));
    }
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
    const basePayload = payload && typeof payload === "object" ? { ...payload } : {};
    const normalizedRpcName = String(rpcName || "").trim().replace(/^public\./, "");

    if (normalizedRpcName === "get_onboarding_process_state") {
      const hasOwn = (key) => Object.prototype.hasOwnProperty.call(basePayload, key);
      const clubId = hasOwn("p_club_id")
        ? basePayload.p_club_id
        : hasOwn("club_id")
          ? basePayload.club_id
          : null;
      const inviteToken = hasOwn("p_invite_token")
        ? basePayload.p_invite_token
        : hasOwn("invite_token")
          ? basePayload.invite_token
          : null;
      const includeDebug = hasOwn("p_include_debug")
        ? basePayload.p_include_debug
        : hasOwn("include_debug")
          ? basePayload.include_debug
          : false;

      return {
        ...basePayload,
        p_club_id: clubId || null,
        p_invite_token: inviteToken || null,
        p_include_debug: Boolean(includeDebug),
      };
    }

    return basePayload;
  }

  function resolvePanelSurfaceState(panel) {
    const explicitKey = panel?.meta?.panelState || null;
    const explicitHint = panel?.meta?.panelStateHint || "";
    if (explicitKey) {
      return {
        key: explicitKey,
        label: panel?.meta?.panelStateLabel || panelStateLabel(explicitKey),
        hint: explicitHint,
      };
    }

    const loadKind = panel?.loadBinding?.kind || "none";
    const saveKind = panel?.saveBinding?.kind || "none";
    const sourceTruth = panel?.meta?.sourceOfTruth || "";

    if (loadKind === "rpc" || loadKind === "edge_function" || loadKind === "auth_action") {
      return { key: "live", label: panelStateLabel("live"), hint: "" };
    }

    if (loadKind === "local_only" && saveKind !== "none") {
      return { key: "partial", label: panelStateLabel("partial"), hint: "" };
    }

    if (loadKind === "local_only" && (sourceTruth === "edge" || sourceTruth === "sql")) {
      return { key: "preview", label: panelStateLabel("preview"), hint: "" };
    }

    if (loadKind === "local_only") {
      return { key: "gap", label: panelStateLabel("gap"), hint: "" };
    }

    return null;
  }

  function resolvePanelClass(panel) {
    const explicit = String(panel?.meta?.panelClass || "").trim();
    if (explicit) return explicit;
    const state = resolvePanelSurfaceState(panel)?.key || "live";
    if (state === "gap") return "gap";
    if (state === "preview") return "preview-only";
    const loadKind = String(panel?.loadBinding?.kind || "none").trim();
    const saveKind = String(panel?.saveBinding?.kind || "none").trim();
    if (loadKind === "none" && saveKind !== "none") return "write-first";
    if (loadKind === "local_only" && saveKind === "none") return "static";
    return "read-first";
  }

  function panelStateLabel(key) {
    switch (key) {
      case "live":
        return "Live";
      case "partial":
        return "Teilweise live";
      case "preview":
        return "Vorschau";
      case "gap":
        return "Vertrag offen";
      default:
        return String(key || "");
    }
  }

  function normalizeBinding(binding, fallbackPanelId = "") {
    if (!binding || typeof binding !== "object") return null;
    return {
      kind: String(binding.kind || "").trim(),
      target: binding.target ?? null,
      path: binding.path ?? null,
      panelId: String(binding.panelId || fallbackPanelId || "").trim() || null,
    };
  }

  function collectExpectedColumns(panel) {
    const sqlExpected = toArray(panel?.meta?.sqlContract?.expectedColumns);
    if (sqlExpected.length) return uniqueStrings(sqlExpected);
    if (String(panel?.renderMode || "").trim() === "table") {
      return uniqueStrings(
        toArray(panel?.columns)
          .filter((column) => column?.type !== "actions")
          .map((column) => column?.key)
      );
    }
    return uniqueStrings(collectFieldDefs(panel).map((field) => field?.name));
  }

  function collectValuePaths(panel, fields = null) {
    const fieldList = fields ? toArray(fields) : collectFieldDefs(panel);
    return uniqueStrings(fieldList.map((field) => field?.valuePath));
  }

  function collectPayloadKeys(fields = null, panel = null) {
    const fieldList = fields ? toArray(fields) : collectFieldDefs(panel);
    return uniqueStrings(
      fieldList
        .filter((field) => field?.readonly !== true)
        .map((field) => field?.payloadKey || field?.name)
    );
  }

  function buildBaseContract(panel, context = {}) {
    const surfaceState = resolvePanelSurfaceState(panel);
    const panelId = String(context?.panelId || panel?.id || "").trim();
    return {
      maskId: String(context?.maskId || panel?.__fcpMaskId || "").trim(),
      sectionId: String(context?.sectionId || panel?.__fcpSectionId || "").trim(),
      panelId,
      sourceTable: String(panel?.meta?.sourceTable || "").trim() || null,
      sourceKind: String(panel?.meta?.sourceKind || "").trim() || null,
      sourceOfTruth: String(panel?.meta?.sourceOfTruth || "").trim() || null,
      sqlFile: String(panel?.meta?.sqlContract?.sqlFile || "").trim() || null,
      expectedColumns: collectExpectedColumns(panel),
      loadBinding: normalizeBinding(panel?.loadBinding, panelId),
      saveBinding: normalizeBinding(panel?.saveBinding, panelId),
      securityContext: panel?.securityContext || null,
      panelState: String(surfaceState?.key || panel?.meta?.panelState || "live").trim() || "live",
      panelClass: resolvePanelClass(panel),
      tableConfig: panel?.tableConfig || null,
      componentType: normalizeTableComponentType(panel?.componentType) || String(panel?.componentType || "").trim() || null,
      renderMode: String(panel?.renderMode || "").trim() || null,
    };
  }

  function buildReadContract(panel, context = {}) {
    const resolverMeta = panel?.meta?.resolver || {};
    return {
      ...buildBaseContract(panel, context),
      contractType: "read",
      binding: normalizeBinding(panel?.loadBinding, panel?.id),
      rowsPath: String(resolverMeta?.rowsPath || panel?.rowsPath || "").trim() || null,
      valuePaths: collectValuePaths(panel),
      loadPayloadDefaults: resolverMeta?.loadPayloadDefaults && typeof resolverMeta.loadPayloadDefaults === "object"
        ? resolverMeta.loadPayloadDefaults
        : null,
    };
  }

  function buildWriteContract(panel, fields, context = {}) {
    const resolverMeta = panel?.meta?.resolver || {};
    const fieldMappings = toArray(fields).map((field) => ({
      fieldName: String(field?.name || "").trim(),
      valuePath: String(field?.valuePath || "").trim() || null,
      payloadKey: String(field?.payloadKey || field?.name || "").trim() || null,
      readonly: field?.readonly === true,
      resolvedValue: field?.value,
    }));
    return {
      ...buildBaseContract(panel, context),
      contractType: "write",
      binding: normalizeBinding(panel?.saveBinding, panel?.id),
      valuePaths: collectValuePaths(panel, fields),
      payloadKeys: collectPayloadKeys(fields, panel),
      fieldMappings,
      savePayloadDefaults: resolverMeta?.savePayloadDefaults && typeof resolverMeta.savePayloadDefaults === "object"
        ? resolverMeta.savePayloadDefaults
        : null,
    };
  }

  function buildActionContract(panel, row, action, context = {}) {
    const actionType = String(action || "").trim();
    return {
      ...buildBaseContract(panel, context),
      contractType: "action",
      actionType,
      binding: normalizeBinding(panel?.saveBinding, panel?.id),
      rowKeyField: String(panel?.tableConfig?.rowKeyField || "").trim() || null,
      rowKey: panel?.tableConfig?.rowKeyField ? row?.[panel.tableConfig.rowKeyField] ?? null : null,
      rowInteractionMode: resolveTableInteractionMode(panel),
      actionDefaults: resolveTableActionContract(panel, actionType),
      row: row && typeof row === "object" ? { ...row } : null,
    };
  }

  function normalizeTableComponentType(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    if (raw === "data-table" || raw === "DataTablePanel") return "data-table";
    if (raw === "inline-data-table" || raw === "InlineDataTablePanel") return "inline-data-table";
    return null;
  }

  function hasWriteContract(panel) {
    const saveKind = String(panel?.saveBinding?.kind || "none").trim();
    const canWrite = panel?.permissions?.write === true || panel?.permissions?.update === true;
    return saveKind !== "none" && canWrite;
  }

  function dispatchTableContractEvent(type, detail = {}) {
    if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
    window.dispatchEvent(new CustomEvent(type, { detail }));
  }

  function buildTableRowSavePayload(row, draft) {
    return {
      ...(row && typeof row === "object" ? row : {}),
      ...(draft && typeof draft === "object" ? draft : {}),
    };
  }

  function resolveTableActionContract(panel, action) {
    const tableConfig = panel?.tableConfig || {};
    const suffix = String(action || "").trim();
    if (!suffix) return null;
    const payloadDefaults = tableConfig?.[`${suffix}PayloadDefaults`];
    const confirmMessage = String(tableConfig?.[`${suffix}ConfirmMessage`] || "").trim();
    const confirmLabel = String(tableConfig?.[`${suffix}ConfirmLabel`] || "").trim();
    return {
      payloadDefaults: payloadDefaults && typeof payloadDefaults === "object" ? payloadDefaults : null,
      confirmMessage,
      confirmLabel,
    };
  }

  function resolveTableInteractionMode(panel) {
    const componentType = String(panel?.componentType || "").trim();
    const configured = String(panel?.tableConfig?.rowInteractionMode || "").trim();

    if (componentType === "inline-data-table") {
      if (configured === "custom" || configured === "none") return configured;
      return "inline";
    }

    if (componentType === "data-table") {
      if (configured) return configured;
      return "dialog";
    }

    return configured || "dialog";
  }

  function normalizeDialogFieldValue(column, row) {
    if (!column?.key) return null;
    const value = row?.[column.key];
    if (column.type === "boolean") return Boolean(value);
    return value ?? "";
  }

  function buildTableDialogFields(panel, row) {
    return toArray(panel?.columns)
      .filter((column) => column?.key && column.type !== "actions")
      .map((column) => normalizeColumnField({
        ...column,
        value: normalizeDialogFieldValue(column, row),
      }, row, { surface: "dialog" }));
  }

  function buildTableRuntimeOptions(panel, columns, rows, runtimeContext = {}) {
    const tableConfig = panel?.tableConfig || {};
    const writable = hasWriteContract(panel);
    const interactionMode = resolveTableInteractionMode(panel);
    const message = typeof runtimeContext.onMessage === "function" ? runtimeContext.onMessage : () => {};
    const pattern = runtimeContext.pattern || null;
    const section = runtimeContext.section || null;
    const openTableDialog = typeof runtimeContext.openTableDialog === "function"
      ? runtimeContext.openTableDialog
      : null;
    const confirmAction = typeof runtimeContext.confirmAction === "function"
      ? runtimeContext.confirmAction
      : null;
    const panelId = String(panel?.id || "").trim();
    const utilityActions = Array.isArray(tableConfig?.utilityActions) ? tableConfig.utilityActions : [];
    const utilityHandler = String(tableConfig?.utilityHandler || "").trim();
    let clubContextPromise = null;

    function normalizedRows() {
      return Array.isArray(rows) ? rows : [];
    }

    function currentClubId(row, draft) {
      return String(
        draft?.club_id
        || row?.club_id
        || normalizedRows().find((entry) => String(entry?.club_id || "").trim())?.club_id
        || new URLSearchParams(window.location.search || "").get("club_id")
        || ""
      ).trim();
    }

    function currentClubCode(row, draft) {
      return String(
        draft?.club_code
        || row?.club_code
        || normalizedRows().find((entry) => String(entry?.club_code || "").trim())?.club_code
        || ""
      ).trim();
    }

    async function resolveRuntimeClubContext() {
      if (clubContextPromise) return clubContextPromise;

      clubContextPromise = (async () => {
        let requestedClubId = "";
        try {
          const params = new URLSearchParams(window.location.search || "");
          requestedClubId = String(params.get("club_id") || "").trim();
        } catch {
          requestedClubId = "";
        }

        const session = authSession();
        const userId = String(session?.user?.id || "").trim();
        const baseContext = {
          club_id: "",
          club_code: "",
        };
        if (!userId) return baseContext;

        const [profileRows, aclRows, legacyRows, identityRows] = await Promise.all([
          authJson(`/rest/v1/profiles?select=club_id&id=eq.${encodeURIComponent(userId)}&limit=1`, { method: "GET" }).catch(() => []),
          authJson(`/rest/v1/club_user_roles?select=club_id,role_key&user_id=eq.${encodeURIComponent(userId)}`, { method: "GET" }).catch(() => []),
          authJson(`/rest/v1/user_roles?select=club_id,role&user_id=eq.${encodeURIComponent(userId)}`, { method: "GET" }).catch(() => []),
          authJson("/rest/v1/rpc/get_club_identity_map", { method: "POST", body: {} }).catch(() => []),
        ]);

        const managedClubIds = new Set();
        toArray(aclRows).forEach((entry) => {
          const clubId = String(entry?.club_id || "").trim();
          const roleKey = String(entry?.role_key || "").trim().toLowerCase();
          if (clubId && ["admin", "vorstand", "superadmin"].includes(roleKey)) managedClubIds.add(clubId);
        });
        toArray(legacyRows).forEach((entry) => {
          const clubId = String(entry?.club_id || "").trim();
          const roleKey = String(entry?.role || "").trim().toLowerCase();
          if (clubId && ["admin", "vorstand", "superadmin"].includes(roleKey)) managedClubIds.add(clubId);
        });

        const profile = Array.isArray(profileRows) && profileRows.length ? profileRows[0] : {};
        let clubId = requestedClubId || String(profile?.club_id || "").trim();
        if (!clubId && managedClubIds.size === 1) clubId = [...managedClubIds][0] || "";
        if (!clubId && managedClubIds.size > 1) clubId = [...managedClubIds].sort((a, b) => a.localeCompare(b, "de"))[0] || "";

        const identity = toArray(identityRows).find((entry) => String(entry?.club_id || "").trim() === clubId) || {};
        return {
          club_id: clubId,
          club_code: String(identity?.club_code || "").trim(),
        };
      })();

      return clubContextPromise;
    }

    async function currentClubIdAsync(row, draft) {
      const direct = currentClubId(row, draft);
      if (direct) return direct;
      const context = await resolveRuntimeClubContext().catch(() => ({ club_id: "" }));
      return String(context?.club_id || "").trim();
    }

    function normalizedCardAssignments(value, fallbackLabel = "") {
      if (Array.isArray(value)) {
        const next = value
          .map((entry) => {
            if (entry && typeof entry === "object") {
              return String(entry.id || entry.value || entry.key || "").trim().toLowerCase();
            }
            return String(entry || "").trim().toLowerCase();
          })
          .filter(Boolean);
        return [...new Set(next)].filter((entry) => entry === "innenwasser" || entry === "rheinlos39");
      }

      const legacy = String(value || fallbackLabel || "").toLowerCase();
      const next = [];
      if (legacy.includes("innenwasser") || legacy.includes("innewasser")) next.push("innenwasser");
      if (legacy.includes("rheinlos") || legacy.includes("rhein")) next.push("rheinlos39");
      return [...new Set(next)];
    }

    function canonicalFishingCardType(cardAssignments) {
      const ids = normalizedCardAssignments(cardAssignments);
      const hasInnen = ids.includes("innenwasser");
      const hasRhein = ids.includes("rheinlos39");
      if (hasInnen && hasRhein) return "Innenwasser + Rheinlos";
      if (hasInnen) return "Innenwasser";
      if (hasRhein) return "Rheinlos";
      return "-";
    }

    async function assignMemberCards(clubId, memberNo, draft, row = null) {
      const cardIds = normalizedCardAssignments(
        draft?.card_assignments,
        draft?.fishing_card_type || row?.fishing_card_type || ""
      );
      if (!clubId) throw new Error("club_id fehlt fuer die Kartenzuordnung.");
      if (!memberNo) throw new Error("member_no fehlt fuer die Kartenzuordnung.");
      await rpcPost("/rest/v1/rpc/admin_member_assign_cards", {
        p_club_id: clubId,
        p_member_no: memberNo,
        p_card_ids: cardIds,
      }, true);
      return canonicalFishingCardType(cardIds);
    }

    async function createMemberRegistryRow(draft) {
      const clubId = currentClubId(null, draft);
      const clubCode = currentClubCode(null, draft);
      if (!clubId) throw new Error("club_id fehlt fuer das Anlegen.");
      if (!clubCode) throw new Error("club_code fehlt fuer das Anlegen.");
      const legacyFishingCardType = canonicalFishingCardType(draft?.card_assignments || draft?.fishing_card_type);
      const createdRows = await rpcPost("/rest/v1/rpc/admin_member_registry_create", {
        p_club_id: clubId,
        p_club_code: clubCode,
        p_club_member_no: String(draft?.club_member_no || "").trim().toUpperCase() || null,
        p_first_name: String(draft?.first_name || "").trim() || null,
        p_last_name: String(draft?.last_name || "").trim() || null,
        p_role: String(draft?.role || "member").trim().toLowerCase() || "member",
        p_status: String(draft?.status || "Aktiv").trim() || null,
        p_fishing_card_type: legacyFishingCardType === "-" ? null : legacyFishingCardType,
        p_street: String(draft?.street || "").trim() || null,
        p_email: String(draft?.email || "").trim().toLowerCase() || null,
        p_zip: String(draft?.zip || "").trim() || null,
        p_city: String(draft?.city || "").trim() || null,
        p_phone: String(draft?.phone || "").trim() || null,
        p_mobile: String(draft?.mobile || "").trim() || null,
        p_birthdate: String(draft?.birthdate || "").trim() || null,
        p_guardian_member_no: String(draft?.guardian_member_no || "").trim() || null,
        p_sepa_approved: String(draft?.sepa_approved || "false") === "true" || draft?.sepa_approved === true,
      }, true);
      const createdMemberNo = String(
        (Array.isArray(createdRows) && createdRows[0]?.member_no)
        || draft?.member_no
        || ""
      ).trim();
      if (createdMemberNo) {
        await assignMemberCards(clubId, createdMemberNo, draft, null);
      }
      if (typeof pattern?.loadPanel === "function") {
        await pattern.loadPanel(section.id, panelId).catch(() => null);
      }
      message("Mitglied gespeichert.");
      return true;
    }

    async function updateMemberRegistryRow(row, draft) {
      const memberNo = String(row?.member_no || draft?.member_no || "").trim();
      const clubId = currentClubId(row, draft);
      if (!memberNo) throw new Error("member_no fehlt fuer das Speichern.");
      if (!clubId) throw new Error("club_id fehlt fuer das Speichern.");
      const legacyFishingCardType = canonicalFishingCardType(
        draft?.card_assignments || draft?.fishing_card_type || row?.fishing_card_type
      );
      await rpcPost("/rest/v1/rpc/admin_member_registry_update", {
        p_member_no: memberNo,
        p_club_member_no: String(draft?.club_member_no || "").trim().toUpperCase() || null,
        p_first_name: String(draft?.first_name || "").trim() || null,
        p_last_name: String(draft?.last_name || "").trim() || null,
        p_role: String(draft?.role || "member").trim().toLowerCase() || "member",
        p_status: String(draft?.status || "").trim() || null,
        p_fishing_card_type: legacyFishingCardType === "-" ? null : legacyFishingCardType,
        p_street: String(draft?.street || "").trim() || null,
        p_email: String(draft?.email || "").trim().toLowerCase() || null,
        p_zip: String(draft?.zip || "").trim() || null,
        p_city: String(draft?.city || "").trim() || null,
        p_phone: String(draft?.phone || "").trim() || null,
        p_mobile: String(draft?.mobile || "").trim() || null,
        p_birthdate: String(draft?.birthdate || "").trim() || null,
        p_guardian_member_no: String(draft?.guardian_member_no || "").trim() || null,
        p_sepa_approved: String(draft?.sepa_approved || "false") === "true" || draft?.sepa_approved === true,
      }, true);
      await assignMemberCards(clubId, memberNo, draft, row);
      if (typeof pattern?.loadPanel === "function") {
        await pattern.loadPanel(section.id, panelId).catch(() => null);
      }
      message("Änderungen gespeichert.");
      return true;
    }

    async function deleteMemberRegistryRow(row) {
      const clubId = currentClubId(row, null);
      const memberNo = String(row?.member_no || "").trim();
      if (!clubId) throw new Error("club_id fehlt fuer das Loeschen.");
      if (!memberNo) throw new Error("member_no fehlt fuer das Loeschen.");
      await rpcPost("/rest/v1/rpc/admin_member_registry_delete", {
        p_club_id: clubId,
        p_member_no: memberNo,
      }, true);
      if (typeof pattern?.loadPanel === "function") {
        await pattern.loadPanel(section.id, panelId).catch(() => null);
      }
      return true;
    }

    async function saveWaterRow(row, draft) {
      const clubId = await currentClubIdAsync(row, draft);
      const waterId = String(draft?.water_id || row?.water_id || row?.id || "").trim();
      const name = String(draft?.name ?? row?.name ?? "").trim();
      if (!clubId) throw new Error("club_id fehlt fuer das Gewaesser.");
      if (!waterId) throw new Error("water_id fehlt fuer das Gewaesser.");
      if (!name) throw new Error("Name fehlt fuer das Gewaesser.");

      await edgePost("club-onboarding-workspace", {
        action: "update_water",
        club_id: clubId,
        water_id: waterId,
        name,
        water_type: String(draft?.water_type ?? row?.water_type ?? "").trim(),
        water_status: String(draft?.water_status ?? row?.water_status ?? "active").trim() || "active",
        is_youth_allowed: Boolean(draft?.is_youth_allowed ?? row?.is_youth_allowed),
        requires_board_approval: Boolean(draft?.requires_board_approval ?? row?.requires_board_approval),
        water_cards: normalizedCardAssignments(draft?.water_cards ?? row?.water_cards),
      });

      if (typeof pattern?.loadPanel === "function") {
        await pattern.loadPanel(section.id, panelId).catch(() => null);
      }
      message("Gewaesser gespeichert.");
      return true;
    }

    async function deleteWaterRow(row) {
      const clubId = await currentClubIdAsync(row, null);
      const waterId = String(row?.water_id || row?.id || "").trim();
      if (!clubId) throw new Error("club_id fehlt fuer das Loeschen.");
      if (!waterId) throw new Error("water_id fehlt fuer das Loeschen.");

      await edgePost("club-onboarding-workspace", {
        action: "delete_water",
        club_id: clubId,
        water_id: waterId,
      });

      if (typeof pattern?.loadPanel === "function") {
        await pattern.loadPanel(section.id, panelId).catch(() => null);
      }
      message("Gewaesser geloescht.");
      return true;
    }

    async function saveThroughPanel(payload) {
      if (!pattern || !section?.id || !panelId || typeof pattern.savePanel !== "function") {
        message("Table-Vertrag ist noch nicht vollstaendig angeschlossen.");
        return false;
      }
      const normalizedPayload = payload && typeof payload === "object" ? { ...payload } : {};
      if (panelId === "club_settings_waters_table") {
        const waterId = String(normalizedPayload.water_id || normalizedPayload.id || "").trim();
        if (waterId) normalizedPayload.water_id = waterId;
      }
      const result = await pattern.savePanel(section.id, panelId, normalizedPayload);
      if (result?.ok === true && typeof pattern.loadPanel === "function") {
        await pattern.loadPanel(section.id, panelId).catch(() => null);
      }
      return result?.ok === true;
    }

    async function handleUtilityAction(detail = {}) {
      if (!utilityHandler) return;
      if (utilityHandler === "vereinsverwaltung_members") {
        const tools = window.VereinsverwaltungAdmTools || null;
        if (!tools || typeof tools.handleMembersUtilityAction !== "function") {
          message("Import/Export-Werkzeuge wurden nicht geladen.");
          return;
        }
        await tools.handleMembersUtilityAction({
          ...detail,
          panel,
          section,
          rows,
          onMessage: message,
          reload: async () => {
            if (typeof pattern?.loadPanel === "function") {
              await pattern.loadPanel(section.id, panelId).catch(() => null);
            }
          },
        });
      }
    }

    return {
      panel,
      columns,
      rows,
      tableConfig,
      runtime: {
        tableId: tableConfig?.tableId || panel?.id,
        rowKeyField: tableConfig?.rowKeyField || undefined,
        gridTemplateColumns: tableConfig?.gridTemplateColumns || undefined,
        rowInteractionMode: interactionMode,
        selectionMode: tableConfig?.selectionMode || undefined,
        viewMode: tableConfig?.viewMode || undefined,
        sortKey: tableConfig?.sortKey || undefined,
        sortDir: tableConfig?.sortDir || undefined,
        filterFields: Array.isArray(tableConfig?.filterFields) ? tableConfig.filterFields : [],
        showCreateButton: tableConfig?.showCreateButton !== false,
        createLabel: tableConfig?.createLabel || undefined,
        showToolbar: tableConfig?.showToolbar === true || utilityActions.length > 0,
        showResetButton: tableConfig?.showResetButton === true,
        rowActions: Array.isArray(tableConfig?.rowActions) ? tableConfig.rowActions : [],
        utilityActions,
        onUtilityAction: utilityHandler ? handleUtilityAction : undefined,
        dialogMode: interactionMode === "dialog",
        onRowClick: (row, event) => {
          if (interactionMode === "dialog" && openTableDialog) {
            openTableDialog({
              section,
              panel,
              row,
              mode: writable ? "edit" : "detail",
              fields: buildTableDialogFields(panel, row),
              writable,
            });
          }
          dispatchTableContractEvent("fcp-mask:table-row-click", {
            panelId,
            sectionId: section?.id || "",
            row,
            eventType: event?.type || "click",
          });
        },
        onRowAction: async ({ action, row, event }) => {
          if (!row || !action) return;
          if (action === "edit") {
            if (interactionMode === "dialog" && openTableDialog) {
              openTableDialog({
                section,
                panel,
                row,
                mode: writable ? "edit" : "detail",
                fields: buildTableDialogFields(panel, row),
                writable,
              });
            } else {
              dispatchTableContractEvent("fcp-mask:table-row-edit-request", {
                panelId,
                sectionId: section?.id || "",
                row,
                eventType: event?.type || "action",
              });
            }
            return;
          }
          if (action === "duplicate") {
            dispatchTableContractEvent("fcp-mask:table-row-duplicate", {
              panelId,
              sectionId: section?.id || "",
              row,
              eventType: event?.type || "action",
            });
            message("Duplizieren ist fuer diesen Tabellenvertrag noch nicht standardisiert.");
            return;
          }
          if (action === "delete") {
            dispatchTableContractEvent("fcp-mask:table-row-delete-request", {
              panelId,
              sectionId: section?.id || "",
              row,
              eventType: event?.type || "action",
            });
            message("Loeschen ist fuer diesen Tabellenvertrag noch nicht standardisiert.");
            return;
          }
          dispatchTableContractEvent("fcp-mask:table-row-action", {
            panelId,
            sectionId: section?.id || "",
            row,
            action,
            eventType: event?.type || "action",
          });
        },
        onCreateSubmit: writable
          ? async (draft) => {
              if (utilityHandler === "vereinsverwaltung_members") {
                const ok = await createMemberRegistryRow(draft);
                if (ok) {
                  dispatchTableContractEvent("fcp-mask:table-row-create", {
                    panelId,
                    sectionId: section?.id || "",
                    payload: draft,
                  });
                }
                return ok;
              }
              const ok = await saveThroughPanel(draft);
              if (ok) {
                dispatchTableContractEvent("fcp-mask:table-row-create", {
                  panelId,
                  sectionId: section?.id || "",
                  payload: draft,
                });
              }
              return ok;
            }
          : undefined,
        onEditSubmit: writable
          ? async (row, draft) => {
              if (utilityHandler === "vereinsverwaltung_members") {
                const ok = await updateMemberRegistryRow(row, draft);
                if (ok) {
                  dispatchTableContractEvent("fcp-mask:table-row-save", {
                    panelId,
                    sectionId: section?.id || "",
                    row,
                    payload: buildTableRowSavePayload(row, draft),
                  });
                }
                return ok;
              }
              if (panelId === "club_settings_waters_table") {
                const ok = await saveWaterRow(row, draft);
                if (ok) {
                  dispatchTableContractEvent("fcp-mask:table-row-save", {
                    panelId,
                    sectionId: section?.id || "",
                    row,
                    payload: buildTableRowSavePayload(row, draft),
                  });
                }
                return ok;
              }
              const payload = buildTableRowSavePayload(row, draft);
              const ok = await saveThroughPanel(payload);
              if (ok) {
                dispatchTableContractEvent("fcp-mask:table-row-save", {
                  panelId,
                  sectionId: section?.id || "",
                  row,
                  payload,
                });
              }
              return ok;
            }
          : undefined,
        onDuplicate: async (row) => {
          const actionContract = buildActionContract(panel, row, "duplicate", {
            sectionId: section?.id || "",
          });
          dispatchTableContractEvent("fcp-mask:table-row-duplicate", {
            panelId,
            sectionId: section?.id || "",
            row,
          });
          if (actionContract?.actionDefaults?.payloadDefaults && writable) {
            const payload = {
              ...(row && typeof row === "object" ? row : {}),
              ...actionContract.actionDefaults.payloadDefaults,
            };
            const ok = await saveThroughPanel(payload);
            if (ok) return;
          }
          message("Duplizieren ist fuer diesen Tabellenvertrag noch nicht standardisiert.");
        },
        onDelete: async (row) => {
          const actionContract = buildActionContract(panel, row, "delete", {
            sectionId: section?.id || "",
          });
          if (confirmAction) {
            const confirmed = await confirmAction({
              title: panel?.title || "Eintrag loeschen",
              message: actionContract?.actionDefaults?.confirmMessage || "Diesen Eintrag wirklich loeschen?",
              confirmLabel: actionContract?.actionDefaults?.confirmLabel || "Loeschen",
              confirmVariant: "danger",
            });
            if (!confirmed) return;
          }
          dispatchTableContractEvent("fcp-mask:table-row-delete-request", {
            panelId,
            sectionId: section?.id || "",
            row,
          });
          if (utilityHandler === "vereinsverwaltung_members") {
            await deleteMemberRegistryRow(row);
            return;
          }
          if (panelId === "club_settings_waters_table") {
            await deleteWaterRow(row);
            return;
          }
          if (actionContract?.actionDefaults?.payloadDefaults && writable) {
            const payload = {
              ...(row && typeof row === "object" ? row : {}),
              ...actionContract.actionDefaults.payloadDefaults,
            };
            const ok = await saveThroughPanel(payload);
            if (ok) return;
          }
          message("Loeschen ist fuer diesen Tabellenvertrag noch nicht standardisiert.");
        },
      },
    };
  }

  function requiresClubContext(panel) {
    return panel?.meta?.resolver?.requiresClubContext === true;
  }

  function hasClubContext(clubContext) {
    return Boolean(String(clubContext?.club_id || "").trim());
  }

  function resolveMissingClubContextMessage(panel) {
    return String(
      panel?.meta?.resolver?.missingClubContextMessage || "Kein Vereinskontext verfuegbar."
    );
  }

  window.FcpAdmQfmContractHub = Object.freeze({
    shared: Object.freeze({
      toArray,
      getByPath,
      mergeRecordSources,
      normalizeBindingResult,
      normalizeErrorMessage,
      valueToText,
    }),
    field: Object.freeze({
      normalizeFieldType,
      normalizeFieldDefinition,
      normalizeFieldCollection,
      normalizeColumnField,
      fieldHelpText,
      renderFieldNode,
      renderReadonlyFieldNode,
      renderFieldControlHtml,
      readFieldValue,
      collectFieldPayload,
      valueToText,
      formatFieldDisplayValue,
      maskDisplayValue,
    }),
    read: Object.freeze({
      buildFieldValue,
      hydrateFormContent,
      hydrateReadonlyContent,
      hydrateMixedContent,
      applyPayloadTemplate,
      normalizeRpcPayload,
    }),
    write: Object.freeze({
      buildSavePayload,
      applySaveDefaults,
    }),
    table: Object.freeze({
      hasWriteContract,
      buildTableRowSavePayload,
      resolveTableActionContract,
      resolveTableInteractionMode,
      buildTableDialogFields,
      normalizeTableComponentType,
      buildTableRuntimeOptions,
    }),
    contract: Object.freeze({
      normalizeBinding,
      collectExpectedColumns,
      collectValuePaths,
      collectPayloadKeys,
      buildReadContract,
      buildWriteContract,
      buildActionContract,
    }),
    dialog: Object.freeze({
      panelStateLabel,
      resolvePanelSurfaceState,
      resolvePanelClass,
    }),
    security: Object.freeze({
      requiresClubContext,
      hasClubContext,
      resolveMissingClubContextMessage,
    }),
  });
})();
