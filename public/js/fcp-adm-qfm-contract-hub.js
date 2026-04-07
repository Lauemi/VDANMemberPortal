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

  function buildFieldValue(field, model) {
    const valueFromPath = getByPath(model, field.valuePath);
    if (valueFromPath !== undefined && valueFromPath !== null) return valueFromPath;
    return field.defaultValue ?? "";
  }

  function hydrateFormContent(fieldDefs, model) {
    return {
      fields: toArray(fieldDefs).map((field) => ({
        ...field,
        value: buildFieldValue(field, model),
      })),
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
      return uniqueStrings(toArray(panel?.columns).map((column) => column?.key));
    }
    return uniqueStrings([
      ...toArray(panel?.meta?.resolver?.fieldDefs).map((field) => field?.name),
      ...toArray(panel?.content?.fields).map((field) => field?.name),
    ]);
  }

  function collectValuePaths(panel, fields = null) {
    const fieldList = fields ? toArray(fields) : [
      ...toArray(panel?.meta?.resolver?.fieldDefs),
      ...toArray(panel?.content?.fields),
    ];
    return uniqueStrings(fieldList.map((field) => field?.valuePath));
  }

  function collectPayloadKeys(fields = null, panel = null) {
    const fieldList = fields ? toArray(fields) : [
      ...toArray(panel?.meta?.resolver?.fieldDefs),
      ...toArray(panel?.content?.fields),
    ];
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
      .map((column) => ({
        key: column.key,
        label: column.label || column.key,
        editable: column.editable !== false,
        editorType: column.editorType || (column.type === "boolean" ? "checkbox" : "text"),
        payloadKey: String(column.payloadKey || column.key || "").trim(),
        options: Array.isArray(column.options) ? column.options : [],
        value: normalizeDialogFieldValue(column, row),
      }));
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

    async function saveThroughPanel(payload) {
      if (!pattern || !section?.id || !panelId || typeof pattern.savePanel !== "function") {
        message("Table-Vertrag ist noch nicht vollstaendig angeschlossen.");
        return false;
      }
      const result = await pattern.savePanel(section.id, panelId, payload);
      if (result?.ok === true && typeof pattern.loadPanel === "function") {
        await pattern.loadPanel(section.id, panelId).catch(() => null);
      }
      return result?.ok === true;
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
    }),
    security: Object.freeze({
      requiresClubContext,
      hasClubContext,
      resolveMissingClubContextMessage,
    }),
  });
})();
