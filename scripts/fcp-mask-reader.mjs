import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const MASK_FAMILIES = Object.freeze({
  QFM: "renderQuickflowMask",
  ADM: "renderAdminPanelMask",
});

const BINDING_KINDS = new Set(["rpc", "auth_action", "edge_function", "local_only", "none"]);
const RENDER_MODES = new Set(["readonly", "form", "table", "actions", "mixed"]);
const SOURCE_KINDS = new Set(["record", "table", "process", "snapshot", "append_only"]);
const FIELD_COMPONENT_TYPES = new Set([
  "input",
  "textarea",
  "select",
  "toggle",
  "date",
  "email",
  "phone",
  "number",
  "readonly",
  "custom",
]);
const BLOCK_COMPONENT_TYPES = new Set([
  "readonly-block",
  "stats",
  "data-table",
  "inline-data-table",
  "custom",
]);
const META_DISPLAY_VALUES = new Set(["auto", "hidden", "compact", "full"]);
const APPEND_ONLY_HANDLING_VALUES = new Set(["explicit", "compact_meta", "history_only"]);
const WORKSPACE_MODE_VALUES = new Set(["full_width", "split_board", "board_stack"]);
const NAV_POSITION_VALUES = new Set(["left", "top"]);
const WORKSPACE_SLOT_VALUES = new Set(["main", "side", "detail", "toolbar", "footer"]);
const SECURITY_KEYS = new Set([
  "tenant_id",
  "club_id",
  "identity_id",
  "canonical_membership_id",
  "none",
]);
const MASK_TYPES = Object.freeze({
  QFM: new Set(["sectioned", "process"]),
  ADM: new Set(["workspace", "sectioned"]),
});
const PROCESS_STEP_TYPES = new Set([
  "auth",
  "claim",
  "identity",
  "profile",
  "consent",
  "billing",
  "activation",
  "custom",
]);
const PROCESS_STEP_STATUSES = new Set([
  "locked",
  "available",
  "active",
  "completed",
  "blocked",
  "failed",
  "skipped",
]);
const PROCESS_STATUSES = new Set([
  "not_started",
  "in_progress",
  "paused",
  "completed",
  "blocked",
  "failed",
]);
const OWNERSHIP_VALUES = new Set([
  "global_user",
  "auth_system",
  "club_scoped",
  "club_override",
  "billing_snapshot",
  "consent_append_only",
]);

const REQUIRED_TOP_LEVEL = ["maskId", "maskFamily", "maskType", "sections"];

export async function readMaskJsonFile(filePath) {
  const absolutePath = path.resolve(filePath);
  const fileName = path.basename(absolutePath);
  const fileText = await fs.readFile(absolutePath, "utf8");
  const json = JSON.parse(fileText);
  return resolveMaskConfig(json, { filePath: absolutePath, fileName });
}

export function resolveMaskConfig(rawConfig, context = {}) {
  const fileName = context.fileName || "";
  const filePath = context.filePath || "";
  const prefix = detectPrefix(fileName);
  const diagnostics = createDiagnostics();

  if (!prefix) {
    diagnostics.errors.push({
      code: "mask_file_prefix_invalid",
      path: "$file",
      message: "Dateiname muss mit QFM_ oder ADM_ beginnen.",
    });
  }

  for (const key of REQUIRED_TOP_LEVEL) {
    if (!hasValue(rawConfig?.[key])) {
      diagnostics.errors.push({
        code: "mask_required_missing",
        path: key,
        message: `Pflichtfeld fehlt: ${key}`,
      });
    }
  }

  const maskFamily = String(rawConfig?.maskFamily || "").trim();
  if (maskFamily && prefix && maskFamily !== prefix) {
    diagnostics.errors.push({
      code: "mask_family_prefix_mismatch",
      path: "maskFamily",
      message: `maskFamily ${maskFamily} passt nicht zum Dateiprefix ${prefix}.`,
    });
  }

  if (maskFamily && !MASK_FAMILIES[maskFamily]) {
    diagnostics.errors.push({
      code: "mask_family_unsupported",
      path: "maskFamily",
      message: `Maskenfamilie ${maskFamily} wird nicht unterstuetzt.`,
    });
  }

  const resolved = {
    filePath,
    fileName,
    prefix,
    renderer: prefix ? MASK_FAMILIES[prefix] || null : null,
    maskId: rawConfig?.maskId || null,
    maskFamily: maskFamily || null,
    maskType: rawConfig?.maskType || null,
    workspaceMode: normalizeWorkspaceMode(rawConfig?.workspaceMode, diagnostics),
    workspaceNav: normalizeWorkspaceNav(rawConfig?.workspaceNav, diagnostics),
    securityContext: normalizeSecurityContext(rawConfig?.securityContext, "securityContext", diagnostics, {
      required: true,
      bindingKind: rawConfig?.loadBinding?.kind || null,
    }),
    header: normalizeHeader(rawConfig?.header, diagnostics),
    metaPolicy: normalizeMetaPolicy(rawConfig?.metaPolicy, diagnostics),
    toolbar: normalizeToolbar(rawConfig?.toolbar, diagnostics),
    dataContract: normalizeDataContract(rawConfig?.dataContract, diagnostics),
    loadBinding: normalizeBinding(rawConfig?.loadBinding, "$.loadBinding", diagnostics, { allowNone: false }),
    process: normalizeProcess(rawConfig?.process, diagnostics),
    sections: normalizeSections(rawConfig?.sections, diagnostics),
    specialCases: normalizeSpecialCases(rawConfig?.specialCases, diagnostics),
    renderPlan: null,
    diagnostics,
    valid: false,
  };

  applyFamilyRules(resolved, diagnostics);
  resolved.renderPlan = buildRenderPlan(resolved);
  resolved.valid = diagnostics.errors.length === 0;
  return resolved;
}

function applyFamilyRules(resolved, diagnostics) {
  const allowedMaskTypes = MASK_TYPES[resolved.maskFamily];
  if (allowedMaskTypes && resolved.maskType && !allowedMaskTypes.has(resolved.maskType)) {
    diagnostics.errors.push({
      code: "mask_type_invalid_for_family",
      path: "maskType",
      message: `maskType ${resolved.maskType} ist fuer ${resolved.maskFamily} nicht erlaubt.`,
    });
  }

  if (resolved.maskFamily === "QFM") {
    if (!["sectioned", "process"].includes(resolved.maskType)) {
      diagnostics.errors.push({
        code: "qfm_mask_type_invalid",
        path: "maskType",
        message: "QFM-Masken muessen aktuell maskType = sectioned oder process verwenden.",
      });
    }
    if (resolved.toolbar && resolved.toolbar.enabled) {
      diagnostics.feedback.push({
        code: "qfm_toolbar_present",
        path: "toolbar",
        message: "Toolbar ist fuer QFM ungewoehnlich und sollte bewusst begruendet sein.",
      });
    }
  }

  if (resolved.maskType === "process" && !resolved.process) {
    diagnostics.errors.push({
      code: "process_config_missing",
      path: "process",
      message: "maskType = process braucht eine process-Konfiguration.",
    });
  }

  if (resolved.maskFamily === "ADM") {
    if (!resolved.workspaceMode) {
      diagnostics.warnings.push({
        code: "adm_workspace_mode_missing",
        path: "workspaceMode",
        message: "ADM-Masken sollten einen expliziten workspaceMode setzen.",
      });
    }
    if (!resolved.workspaceNav || resolved.workspaceNav.enabled !== true) {
      diagnostics.warnings.push({
        code: "adm_workspace_nav_missing",
        path: "workspaceNav",
        message: "ADM-Masken sollten eine explizite workspaceNav-Definition haben.",
      });
    }
    if (!resolved.toolbar || resolved.toolbar.enabled !== true) {
      diagnostics.warnings.push({
        code: "adm_toolbar_missing",
        path: "toolbar",
        message: "ADM-Masken sollten in der Regel eine explizite toolbar-Definition haben.",
      });
    }
  }

  if (!resolved.securityContext) {
    diagnostics.warnings.push({
      code: "mask_security_context_missing",
      path: "securityContext",
      message: "Maskenweiter securityContext fehlt.",
    });
  }
}

function normalizeHeader(header, diagnostics) {
  const normalized = {
    kicker: asText(header?.kicker),
    title: asText(header?.title),
    description: asText(header?.description),
  };

  if (!normalized.title) {
    diagnostics.errors.push({
      code: "header_title_missing",
      path: "header.title",
      message: "header.title ist verpflichtend.",
    });
  }

  if (!normalized.description) {
    diagnostics.warnings.push({
      code: "header_description_missing",
      path: "header.description",
      message: "header.description fehlt.",
    });
  }

  return normalized;
}

function normalizeMetaPolicy(policy, diagnostics) {
  const auditFields = Array.isArray(policy?.auditFields) ? policy.auditFields.filter(Boolean) : [];
  const normalized = {
    autoDetect: policy?.autoDetect !== false,
    appendOnlyHandling: asText(policy?.appendOnlyHandling) || "explicit",
    auditFields,
  };

  if (normalized.autoDetect) {
    diagnostics.feedback.push({
      code: "meta_auto_detect_enabled",
      path: "metaPolicy.autoDetect",
      message: "Auto-Meta-Erkennung ist aktiv.",
    });
  }

  if (!APPEND_ONLY_HANDLING_VALUES.has(normalized.appendOnlyHandling)) {
    diagnostics.errors.push({
      code: "meta_append_only_handling_invalid",
      path: "metaPolicy.appendOnlyHandling",
      message: `appendOnlyHandling ${normalized.appendOnlyHandling} ist nicht erlaubt.`,
    });
  }

  return normalized;
}

function normalizeToolbar(toolbar, diagnostics) {
  if (!toolbar) return null;
  return {
    enabled: toolbar.enabled === true,
    actions: Array.isArray(toolbar.actions) ? toolbar.actions : [],
  };
}

function normalizeWorkspaceMode(value, diagnostics) {
  const mode = asText(value) || null;
  if (!mode) return null;
  if (!WORKSPACE_MODE_VALUES.has(mode)) {
    diagnostics.errors.push({
      code: "workspace_mode_invalid",
      path: "workspaceMode",
      message: `workspaceMode ${mode} ist nicht erlaubt.`,
    });
  }
  return mode;
}

function normalizeWorkspaceNav(value, diagnostics) {
  if (!value) return null;
  const position = asText(value?.position) || "left";
  const items = Array.isArray(value?.items)
    ? value.items.map((item, index) => ({
        id: asText(item?.id) || `nav-${index + 1}`,
        label: asText(item?.label),
        targetSectionId: asText(item?.targetSectionId),
        icon: asText(item?.icon),
        badge: asText(item?.badge),
      }))
    : [];

  if (!NAV_POSITION_VALUES.has(position)) {
    diagnostics.errors.push({
      code: "workspace_nav_position_invalid",
      path: "workspaceNav.position",
      message: `workspaceNav.position ${position} ist nicht erlaubt.`,
    });
  }

  items.forEach((item, index) => {
    if (!item.label) {
      diagnostics.errors.push({
        code: "workspace_nav_item_label_missing",
        path: `workspaceNav.items[${index}].label`,
        message: "workspaceNav item label fehlt.",
      });
    }
    if (!item.targetSectionId) {
      diagnostics.errors.push({
        code: "workspace_nav_item_target_missing",
        path: `workspaceNav.items[${index}].targetSectionId`,
        message: "workspaceNav item targetSectionId fehlt.",
      });
    }
  });

  return {
    enabled: value?.enabled !== false,
    position,
    defaultSectionId: asText(value?.defaultSectionId),
    items,
  };
}

function normalizeDataContract(contract) {
  return {
    sourceOfTruth: asText(contract?.sourceOfTruth) || "sql",
    contracts: Array.isArray(contract?.contracts) ? contract.contracts.filter(Boolean) : [],
  };
}

function normalizeProcess(processConfig, diagnostics) {
  if (!processConfig) return null;

  const normalized = {
    processId: asText(processConfig?.processId),
    resumeKey: asText(processConfig?.resumeKey),
    stateBinding: normalizeBinding(processConfig?.stateBinding, "process.stateBinding", diagnostics, { allowNone: false }),
    advanceBinding: normalizeBinding(processConfig?.advanceBinding, "process.advanceBinding", diagnostics, { allowNone: false }),
    allowedStatuses: Array.isArray(processConfig?.allowedStatuses)
      ? processConfig.allowedStatuses.filter((status) => PROCESS_STATUSES.has(status))
      : [],
    steps: Array.isArray(processConfig?.steps)
      ? processConfig.steps.map((step, index) => normalizeProcessStep(step, `process.steps[${index}]`, diagnostics))
      : [],
  };

  for (const key of ["processId"]) {
    if (!normalized[key]) {
      diagnostics.errors.push({
        code: "process_required_missing",
        path: `process.${key}`,
        message: `Process-Pflichtfeld fehlt: ${key}`,
      });
    }
  }

  if (!normalized.steps.length) {
    diagnostics.errors.push({
      code: "process_steps_missing",
      path: "process.steps",
      message: "Process braucht mindestens einen Step.",
    });
  }

  return normalized;
}

function normalizeProcessStep(step, basePath, diagnostics) {
  const normalized = {
    id: asText(step?.id),
    label: asText(step?.label),
    title: asText(step?.title),
    stepType: asText(step?.stepType),
    statusSource: asText(step?.statusSource),
    requiresServerUnlock: step?.requiresServerUnlock !== false,
    unlockRule: asText(step?.unlockRule) || "server_only",
    completionRule: asText(step?.completionRule) || "server_only",
    visibleWhen: asText(step?.visibleWhen) || "server_only",
    editableWhen: asText(step?.editableWhen) || "server_only",
    terminalStates: Array.isArray(step?.terminalStates) ? step.terminalStates.filter(Boolean) : [],
  };

  for (const key of ["id", "label", "title", "stepType", "statusSource"]) {
    if (!normalized[key]) {
      diagnostics.errors.push({
        code: "process_step_required_missing",
        path: `${basePath}.${key}`,
        message: `Process-Step-Pflichtfeld fehlt: ${key}`,
      });
    }
  }

  if (normalized.stepType && !PROCESS_STEP_TYPES.has(normalized.stepType)) {
    diagnostics.errors.push({
      code: "process_step_type_invalid",
      path: `${basePath}.stepType`,
      message: `stepType ${normalized.stepType} ist nicht erlaubt.`,
    });
  }

  normalized.terminalStates.forEach((status, index) => {
    if (!PROCESS_STEP_STATUSES.has(status)) {
      diagnostics.errors.push({
        code: "process_step_terminal_state_invalid",
        path: `${basePath}.terminalStates[${index}]`,
        message: `terminalState ${status} ist nicht erlaubt.`,
      });
    }
  });

  return normalized;
}

function normalizeSections(sections, diagnostics) {
  if (!Array.isArray(sections) || sections.length === 0) {
    diagnostics.errors.push({
      code: "sections_missing",
      path: "sections",
      message: "Es muss mindestens eine Section vorhanden sein.",
    });
    return [];
  }

  return sections.map((section, index) =>
    normalizeSection(section, `sections[${index}]`, diagnostics)
  );
}

function normalizeSection(section, basePath, diagnostics) {
  const normalized = {
    id: asText(section?.id),
    label: asText(section?.label),
    title: asText(section?.title),
    description: asText(section?.description),
    workspaceSlot: normalizeWorkspaceSlot(section?.workspaceSlot, `${basePath}.workspaceSlot`, diagnostics),
    sectionLayout: asText(section?.sectionLayout) || "stack",
    permissions: normalizePermissions(section?.permissions, `${basePath}.permissions`, diagnostics),
    securityContext: normalizeSecurityContext(section?.securityContext, `${basePath}.securityContext`, diagnostics, {
      required: true,
      bindingKind: section?.saveBinding?.kind || null,
    }),
    ownership: normalizeOwnership(section?.ownership, `${basePath}.ownership`, diagnostics),
    scope: normalizeOwnership(section?.scope, `${basePath}.scope`, diagnostics),
    saveBinding: normalizeBinding(section?.saveBinding, `${basePath}.saveBinding`, diagnostics, { allowNone: true }),
    panels: normalizePanels(section?.panels, `${basePath}.panels`, diagnostics),
  };

  for (const key of ["id", "label", "title"]) {
    if (!normalized[key]) {
      diagnostics.errors.push({
        code: "section_required_missing",
        path: `${basePath}.${key}`,
        message: `Section-Pflichtfeld fehlt: ${key}`,
      });
    }
  }

  if (!normalized.description) {
    diagnostics.warnings.push({
      code: "section_description_missing",
      path: `${basePath}.description`,
      message: "Section-Beschreibung fehlt.",
    });
  }

  if (normalized.scope && normalized.ownership && normalized.scope !== normalized.ownership) {
    diagnostics.feedback.push({
      code: "section_scope_ownership_differs",
      path: basePath,
      message: "Section scope und ownership unterscheiden sich bewusst.",
    });
  }

  if (!normalized.securityContext) {
    diagnostics.warnings.push({
      code: "section_security_context_missing",
      path: `${basePath}.securityContext`,
      message: "Section securityContext fehlt.",
    });
  }

  return normalized;
}

function normalizeWorkspaceSlot(value, basePath, diagnostics) {
  const slot = asText(value) || "main";
  if (!WORKSPACE_SLOT_VALUES.has(slot)) {
    diagnostics.errors.push({
      code: "workspace_slot_invalid",
      path: basePath,
      message: `workspaceSlot ${slot} ist nicht erlaubt.`,
    });
  }
  return slot;
}

function normalizePanels(panels, basePath, diagnostics) {
  if (!Array.isArray(panels) || panels.length === 0) {
    diagnostics.errors.push({
      code: "panels_missing",
      path: basePath,
      message: "Jede Section braucht mindestens ein Panel.",
    });
    return [];
  }

  return panels.map((panel, index) =>
    normalizePanel(panel, `${basePath}[${index}]`, diagnostics)
  );
}

function normalizePanel(panel, basePath, diagnostics) {
  const renderMode = asText(panel?.renderMode);
  const componentType = normalizePanelComponentType(panel?.componentType, renderMode, `${basePath}.componentType`, diagnostics);
  const columns = Array.isArray(panel?.columns) ? panel.columns : [];
  const normalized = {
    id: asText(panel?.id),
    title: asText(panel?.title),
    renderMode,
    componentType,
    flowType: asText(panel?.flowType) || "standard",
    permissions: normalizePermissions(panel?.permissions, `${basePath}.permissions`, diagnostics),
    securityContext: normalizeSecurityContext(panel?.securityContext, `${basePath}.securityContext`, diagnostics, {
      required: true,
      bindingKind: panel?.saveBinding?.kind || panel?.loadBinding?.kind || null,
      flowType: panel?.flowType || null,
    }),
    meta: normalizePanelMeta(panel?.meta, `${basePath}.meta`, diagnostics),
    loadBinding: normalizeBinding(panel?.loadBinding, `${basePath}.loadBinding`, diagnostics, { allowNone: false }),
    saveBinding: normalizeBinding(panel?.saveBinding, `${basePath}.saveBinding`, diagnostics, { allowNone: true }),
    content: normalizePanelContent(panel?.content, renderMode, `${basePath}.content`, diagnostics),
    contentArea: normalizeWorkspaceSlot(panel?.contentArea, `${basePath}.contentArea`, diagnostics),
    columns,
    rowsPath: asText(panel?.rowsPath),
    tableConfig: normalizeTableConfig(panel?.tableConfig, `${basePath}.tableConfig`, diagnostics, componentType, columns),
  };

  for (const key of ["id", "title", "renderMode"]) {
    if (!normalized[key]) {
      diagnostics.errors.push({
        code: "panel_required_missing",
        path: `${basePath}.${key}`,
        message: `Panel-Pflichtfeld fehlt: ${key}`,
      });
    }
  }

  if (renderMode && !RENDER_MODES.has(renderMode)) {
    diagnostics.errors.push({
      code: "panel_render_mode_invalid",
      path: `${basePath}.renderMode`,
      message: `renderMode ${renderMode} ist nicht erlaubt.`,
    });
  }

  if (normalized.saveBinding.kind === "none" && renderMode === "form") {
    diagnostics.warnings.push({
      code: "form_without_save",
      path: `${basePath}.saveBinding`,
      message: "Form-Panel ohne Save-Binding ist ungewoehnlich.",
    });
  }

  if (normalized.flowType === "auth_critical" && renderMode === "form") {
    diagnostics.errors.push({
      code: "auth_critical_form_invalid",
      path: `${basePath}.flowType`,
      message: "auth_critical darf nicht als normales form-Panel behandelt werden.",
    });
  }

  if (normalized.meta.scope && normalized.meta.ownership && normalized.meta.scope !== normalized.meta.ownership) {
    diagnostics.feedback.push({
      code: "panel_scope_ownership_differs",
      path: `${basePath}.meta`,
      message: "Panel-Meta nutzt unterschiedliche scope/ownership-Werte.",
    });
  }

  if (normalized.permissions.write && normalized.saveBinding.kind === "none") {
    diagnostics.warnings.push({
      code: "write_permission_without_save_binding",
      path: `${basePath}.saveBinding`,
      message: "Panel ist schreibbar markiert, aber saveBinding steht auf none.",
    });
  }

  if (!normalized.securityContext) {
    diagnostics.warnings.push({
      code: "panel_security_context_missing",
      path: `${basePath}.securityContext`,
      message: "Panel securityContext fehlt.",
    });
  }

  compareInferredSecurity(normalized.meta.inferredSecurity, normalized.securityContext, `${basePath}`, diagnostics);
  applyTenantFieldChecks(normalized.content, normalized.securityContext, `${basePath}`, diagnostics);
  applyRoleProcessChecks(normalized, `${basePath}`, diagnostics);

  if (normalized.componentType === "data-table" || normalized.componentType === "inline-data-table") {
    if (!normalized.columns.length) {
      diagnostics.errors.push({
        code: "panel_table_columns_missing",
        path: `${basePath}.columns`,
        message: "Table-Panel braucht mindestens eine Spalte.",
      });
    }
    if (!normalized.rowsPath && normalized.content.summary.rowCount === 0) {
      diagnostics.warnings.push({
        code: "panel_table_rows_path_missing",
        path: `${basePath}.rowsPath`,
        message: "Table-Panel sollte rowsPath oder statische rows definieren.",
      });
    }
  }

  return normalized;
}

function normalizePanelComponentType(value, renderMode, basePath, diagnostics) {
  const type = asText(value);
  if (!type) {
    if (renderMode === "table") return "data-table";
    return componentTypeForRenderMode(renderMode);
  }

  const aliases = {
    table: "data-table",
    table_inline: "inline-data-table",
  };

  const resolved = aliases[type] || type;
  const allowed = new Set([
    "ReadonlyPanel",
    "FormPanel",
    "DataTablePanel",
    "InlineDataTablePanel",
    "ActionPanel",
    "MixedPanel",
    "data-table",
    "inline-data-table",
    "custom",
  ]);

  if (!allowed.has(resolved)) {
    diagnostics.errors.push({
      code: "panel_component_type_invalid",
      path: basePath,
      message: `Panel componentType ${resolved} ist nicht erlaubt.`,
    });
  }
  return resolved;
}

function normalizePanelMeta(meta, basePath, diagnostics) {
  const normalized = {
    sourceTable: asText(meta?.sourceTable),
    sourceKind: asText(meta?.sourceKind),
    sourceOfTruth: asText(meta?.sourceOfTruth) || "sql",
    scope: normalizeOwnership(meta?.scope, `${basePath}.scope`, diagnostics),
    ownership: normalizeOwnership(meta?.ownership, `${basePath}.ownership`, diagnostics),
    metaDisplay: asText(meta?.metaDisplay) || "auto",
    inferredSecurity: normalizeInferredSecurity(meta?.inferredSecurity, `${basePath}.inferredSecurity`, diagnostics),
    securityHints: Array.isArray(meta?.securityHints) ? meta.securityHints.filter(Boolean) : [],
    riskFlags: Array.isArray(meta?.riskFlags) ? meta.riskFlags.filter(Boolean) : [],
    processAdapter: asText(meta?.processAdapter),
    panelState: asText(meta?.panelState) || null,
    panelStateLabel: asText(meta?.panelStateLabel) || null,
    panelStateHint: asText(meta?.panelStateHint) || null,
    sqlContract: meta?.sqlContract && typeof meta.sqlContract === "object"
      ? {
          sqlFile: asText(meta.sqlContract.sqlFile) || null,
          expectedColumns: Array.isArray(meta.sqlContract.expectedColumns)
            ? meta.sqlContract.expectedColumns.filter(Boolean)
            : [],
        }
      : null,
    resolver: meta?.resolver && typeof meta.resolver === "object"
      ? structuredClone(meta.resolver)
      : null,
  };

  if (!normalized.sourceTable) {
    diagnostics.warnings.push({
      code: "panel_source_table_missing",
      path: `${basePath}.sourceTable`,
      message: "sourceTable fehlt.",
    });
  }

  if (normalized.sourceKind && !SOURCE_KINDS.has(normalized.sourceKind)) {
    diagnostics.errors.push({
      code: "panel_source_kind_invalid",
      path: `${basePath}.sourceKind`,
      message: `sourceKind ${normalized.sourceKind} ist nicht erlaubt.`,
    });
  }

  if (!normalized.sourceKind) {
    diagnostics.warnings.push({
      code: "panel_source_kind_missing",
      path: `${basePath}.sourceKind`,
      message: "sourceKind fehlt.",
    });
  }

  if (!META_DISPLAY_VALUES.has(normalized.metaDisplay)) {
    diagnostics.errors.push({
      code: "panel_meta_display_invalid",
      path: `${basePath}.metaDisplay`,
      message: `metaDisplay ${normalized.metaDisplay} ist nicht erlaubt.`,
    });
  }

  return normalized;
}

function normalizeInferredSecurity(value, basePath, diagnostics) {
  if (!value) return null;

  return {
    rlsKey: normalizeSecurityKey(value?.rlsKey, `${basePath}.rlsKey`, diagnostics, { allowNull: true }),
    membershipKey: normalizeSecurityKey(value?.membershipKey, `${basePath}.membershipKey`, diagnostics, { allowNull: true }),
    requiresTenantAccess: value?.requiresTenantAccess === true,
    requiresRoleCheck: value?.requiresRoleCheck === true,
    allowedRoles: Array.isArray(value?.allowedRoles) ? value.allowedRoles.filter(Boolean) : [],
    serverValidatedRecommended: value?.serverValidatedRecommended !== false,
  };
}

function normalizePanelContent(content, renderMode, basePath, diagnostics) {
  const normalized = {
    fields: Array.isArray(content?.fields)
      ? content.fields.map((field, index) =>
          normalizeField(field, `${basePath}.fields[${index}]`, diagnostics)
        )
      : [],
    rows: Array.isArray(content?.rows) ? content.rows : [],
    actions: Array.isArray(content?.actions)
      ? content.actions.map((action, index) =>
          normalizeAction(action, `${basePath}.actions[${index}]`, diagnostics)
        )
      : [],
    blocks: Array.isArray(content?.blocks)
      ? content.blocks.map((block, index) =>
          normalizeBlock(block, `${basePath}.blocks[${index}]`, diagnostics)
        )
      : [],
    summary: {
      fieldCount: Array.isArray(content?.fields) ? content.fields.length : 0,
      rowCount: Array.isArray(content?.rows) ? content.rows.length : 0,
      actionCount: Array.isArray(content?.actions) ? content.actions.length : 0,
      blockCount: Array.isArray(content?.blocks) ? content.blocks.length : 0,
    },
  };

  if (!content) {
    diagnostics.warnings.push({
      code: "panel_content_missing",
      path: basePath,
      message: "content fehlt.",
    });
    return normalized;
  }

  switch (renderMode) {
    case "readonly":
      if (!normalized.fields.length && !normalized.rows.length) {
        diagnostics.errors.push({
          code: "readonly_content_invalid",
          path: basePath,
          message: "readonly benoetigt fields oder rows.",
        });
      }
      break;
    case "form":
      if (!normalized.fields.length) {
        diagnostics.errors.push({
          code: "form_fields_missing",
          path: `${basePath}.fields`,
          message: "form benoetigt mindestens ein field.",
        });
      }
      break;
    case "table":
      if (!normalized.rows.length) {
        diagnostics.warnings.push({
          code: "table_rows_empty",
          path: `${basePath}.rows`,
          message: "table hat aktuell keine rows.",
        });
      }
      break;
    case "actions":
      if (!normalized.actions.length) {
        diagnostics.errors.push({
          code: "actions_missing",
          path: `${basePath}.actions`,
          message: "actions benoetigt mindestens eine action.",
        });
      }
      break;
    case "mixed":
      if (!normalized.fields.length && !normalized.rows.length && !normalized.actions.length && !normalized.blocks.length) {
        diagnostics.errors.push({
          code: "mixed_content_empty",
          path: basePath,
          message: "mixed benoetigt fields, rows, actions oder blocks.",
        });
      }
      break;
    default:
      break;
  }

  return normalized;
}

function normalizeBlock(block, basePath, diagnostics) {
  const rawType = asText(block?.type);
  const componentType = normalizeBlockComponentType(block?.componentType || rawType, `${basePath}.componentType`, diagnostics);
  const renderMode = normalizeBlockRenderMode(block?.renderMode, componentType);
  const columns = Array.isArray(block?.columns) ? block.columns : [];
  const tableConfig = normalizeTableConfig(block?.tableConfig, `${basePath}.tableConfig`, diagnostics, componentType, columns);

  const normalized = {
    id: asText(block?.id),
    label: asText(block?.label),
    title: asText(block?.title),
    type: rawType,
    componentType,
    renderMode,
    valuePath: asText(block?.valuePath),
    rowsPath: asText(block?.rowsPath),
    displaySpan: asText(block?.displaySpan) || null,
    emptyStateText: asText(block?.emptyStateText),
    columns,
    tableConfig,
    content: block?.content && typeof block.content === "object" ? block.content : null,
    actions: Array.isArray(block?.actions)
      ? block.actions.map((action, index) =>
          normalizeAction(action, `${basePath}.actions[${index}]`, diagnostics)
        )
      : [],
  };

  for (const key of ["id"]) {
    if (!normalized[key]) {
      diagnostics.errors.push({
        code: "block_required_missing",
        path: `${basePath}.${key}`,
        message: `Block-Pflichtfeld fehlt: ${key}`,
      });
    }
  }

  if (!normalized.componentType) {
    diagnostics.warnings.push({
      code: "block_component_type_missing",
      path: `${basePath}.componentType`,
      message: "Block componentType fehlt.",
    });
  }

  if (normalized.componentType === "data-table" || normalized.componentType === "inline-data-table") {
    if (!normalized.rowsPath) {
      diagnostics.warnings.push({
        code: "table_block_rows_path_missing",
        path: `${basePath}.rowsPath`,
        message: "Table-Block sollte einen rowsPath definieren.",
      });
    }
    if (!normalized.columns.length) {
      diagnostics.errors.push({
        code: "table_block_columns_missing",
        path: `${basePath}.columns`,
        message: "Table-Block braucht mindestens eine Spalte.",
      });
    }
    if (!normalized.tableConfig.tableId) {
      diagnostics.warnings.push({
        code: "table_block_table_id_missing",
        path: `${basePath}.tableConfig.tableId`,
        message: "Table-Block sollte eine stabile tableId definieren.",
      });
    }
    if (!normalized.tableConfig.rowKeyField && !normalized.tableConfig.rowKey) {
      diagnostics.warnings.push({
        code: "table_block_row_key_missing",
        path: `${basePath}.tableConfig`,
        message: "Table-Block sollte rowKeyField oder rowKey definieren.",
      });
    }
  }

  if (normalized.componentType === "stats" && !normalized.valuePath && !normalized.content) {
    diagnostics.warnings.push({
      code: "stats_block_value_path_missing",
      path: `${basePath}.valuePath`,
      message: "Stats-Block sollte valuePath oder content definieren.",
    });
  }

  return normalized;
}

function normalizeBlockComponentType(value, basePath, diagnostics) {
  const type = asText(value);
  if (!type) return null;

  const aliases = {
    table: "data-table",
    table_inline: "inline-data-table",
  };

  const resolved = aliases[type] || type;
  if (!BLOCK_COMPONENT_TYPES.has(resolved)) {
    diagnostics.errors.push({
      code: "block_component_type_invalid",
      path: basePath,
      message: `Block componentType ${resolved} ist nicht erlaubt.`,
    });
  }
  return resolved;
}

function normalizeBlockRenderMode(value, componentType) {
  const renderMode = asText(value);
  if (renderMode) return renderMode;
  if (componentType === "data-table" || componentType === "inline-data-table") return "table";
  if (componentType === "stats") return "stats";
  return "readonly";
}

function normalizeTableConfig(config, basePath, diagnostics, componentType, columns) {
  const normalized = {
    tableId: asText(config?.tableId),
    rowKeyField: asText(config?.rowKeyField),
    rowKey: asText(config?.rowKey),
    gridTemplateColumns: asText(config?.gridTemplateColumns),
    rowInteractionMode: asText(config?.rowInteractionMode),
    selectionMode: asText(config?.selectionMode),
    viewMode: asText(config?.viewMode),
    sortKey: asText(config?.sortKey),
    sortDir: asText(config?.sortDir),
    filterFields: Array.isArray(config?.filterFields) ? config.filterFields : [],
  };

  if ((componentType === "data-table" || componentType === "inline-data-table") && normalized.sortKey) {
    const hasSortColumn = columns.some((column) => column?.key === normalized.sortKey);
    if (!hasSortColumn) {
      diagnostics.warnings.push({
        code: "table_sort_key_unknown",
        path: `${basePath}.sortKey`,
        message: "tableConfig.sortKey verweist auf keine definierte Spalte.",
      });
    }
  }

  return normalized;
}

function normalizeField(field, basePath, diagnostics) {
  const normalized = {
    name: asText(field?.name),
    label: asText(field?.label),
    type: asText(field?.type),
    componentType: asText(field?.componentType),
    scope: normalizeOwnership(field?.scope, `${basePath}.scope`, diagnostics),
    ownership: normalizeOwnership(field?.ownership, `${basePath}.ownership`, diagnostics),
    valuePath: asText(field?.valuePath),
    payloadKey: asText(field?.payloadKey),
    group: asText(field?.group) || "default",
    displaySpan: asText(field?.displaySpan) || null,
    order: Number.isFinite(field?.order) ? field.order : null,
    placeholder: asText(field?.placeholder),
    helpText: asText(field?.helpText),
    readonly: field?.readonly === true,
    required: field?.required === true,
    defaultValue: field?.defaultValue ?? null,
    validationRules: Array.isArray(field?.validationRules) ? field.validationRules : [],
    options: Array.isArray(field?.options) ? field.options : [],
  };

  for (const key of ["name", "label", "type"]) {
    if (!normalized[key]) {
      diagnostics.errors.push({
        code: "field_required_missing",
        path: `${basePath}.${key}`,
        message: `Field-Pflichtfeld fehlt: ${key}`,
      });
    }
  }

  if (!normalized.scope) {
    diagnostics.errors.push({
      code: "field_scope_missing",
      path: `${basePath}.scope`,
      message: "Field scope fehlt.",
    });
  }

  if (!normalized.ownership) {
    diagnostics.warnings.push({
      code: "field_ownership_missing",
      path: `${basePath}.ownership`,
      message: "Field ownership fehlt.",
    });
  }

  if (!normalized.componentType) {
    diagnostics.warnings.push({
      code: "field_component_type_missing",
      path: `${basePath}.componentType`,
      message: "Field componentType fehlt.",
    });
  } else if (!FIELD_COMPONENT_TYPES.has(normalized.componentType)) {
    diagnostics.errors.push({
      code: "field_component_type_invalid",
      path: `${basePath}.componentType`,
      message: `componentType ${normalized.componentType} ist nicht erlaubt.`,
    });
  }

  if (!normalized.valuePath) {
    diagnostics.warnings.push({
      code: "field_value_path_missing",
      path: `${basePath}.valuePath`,
      message: "Field valuePath fehlt.",
    });
  }

  if (!normalized.payloadKey && normalized.readonly !== true) {
    diagnostics.warnings.push({
      code: "field_payload_key_missing",
      path: `${basePath}.payloadKey`,
      message: "Editierbares Field sollte einen payloadKey haben.",
    });
  }

  if (normalized.order === null) {
    diagnostics.warnings.push({
      code: "field_order_missing",
      path: `${basePath}.order`,
      message: "Field order fehlt.",
    });
  }

  if (normalized.componentType === "select" && normalized.options.length === 0) {
    diagnostics.warnings.push({
      code: "select_options_missing",
      path: `${basePath}.options`,
      message: "Select-Feld sollte options definieren.",
    });
  }

  if (normalized.componentType === "toggle" && normalized.type !== "boolean") {
    diagnostics.feedback.push({
      code: "toggle_non_boolean_type",
      path: `${basePath}.type`,
      message: "Toggle wird meist mit type = boolean verwendet.",
    });
  }

  if (normalized.scope === "auth_system" && normalized.readonly !== true) {
    diagnostics.warnings.push({
      code: "auth_system_field_not_readonly",
      path: basePath,
      message: "auth_system-Felder sollten in der Regel readonly sein.",
    });
  }

  if (normalized.scope === "consent_append_only" && normalized.readonly !== true) {
    diagnostics.warnings.push({
      code: "consent_field_not_readonly",
      path: basePath,
      message: "consent_append_only-Felder sollten nicht direkt editierbar sein.",
    });
  }

  return normalized;
}

function normalizeAction(action, basePath, diagnostics) {
  const normalized = {
    id: asText(action?.id),
    label: asText(action?.label),
    kind: asText(action?.kind) || "custom",
    binding: normalizeBinding(action?.binding, `${basePath}.binding`, diagnostics, { allowNone: false }),
  };

  for (const key of ["id", "label"]) {
    if (!normalized[key]) {
      diagnostics.errors.push({
        code: "action_required_missing",
        path: `${basePath}.${key}`,
        message: `Action-Pflichtfeld fehlt: ${key}`,
      });
    }
  }

  return normalized;
}

function compareInferredSecurity(inferredSecurity, securityContext, basePath, diagnostics) {
  if (!inferredSecurity || !securityContext) return;

  const comparableKeys = ["rlsKey", "membershipKey", "requiresTenantAccess", "requiresRoleCheck"];
  for (const key of comparableKeys) {
    const inferredValue = inferredSecurity[key] ?? null;
    const resolvedValue = securityContext[key] ?? null;
    if (inferredValue !== null && resolvedValue !== null && inferredValue !== resolvedValue) {
      diagnostics.warnings.push({
        code: "inferred_security_mismatch",
        path: `${basePath}.securityContext.${key}`,
        message: `inferredSecurity.${key} (${String(inferredValue)}) weicht von securityContext.${key} (${String(resolvedValue)}) ab.`,
      });
    }
  }

  if (
    inferredSecurity.requiresRoleCheck === true &&
    securityContext.requiresRoleCheck === true &&
    inferredSecurity.allowedRoles.length > 0 &&
    securityContext.allowedRoles.length === 0
  ) {
    diagnostics.errors.push({
      code: "inferred_security_roles_dropped",
      path: `${basePath}.securityContext.allowedRoles`,
      message: "inferredSecurity verlangt Rollen, aber securityContext.allowedRoles ist leer.",
    });
  }

  if (
    inferredSecurity.serverValidatedRecommended === true &&
    securityContext.serverValidated !== true
  ) {
    diagnostics.errors.push({
      code: "server_validation_recommendation_ignored",
      path: `${basePath}.securityContext.serverValidated`,
      message: "inferredSecurity empfiehlt serverValidated, aber securityContext.serverValidated ist nicht true.",
    });
  }
}

function applyTenantFieldChecks(content, securityContext, basePath, diagnostics) {
  if (!content || !Array.isArray(content.fields)) return;

  const tenantSensitiveFieldNames = new Set(["club_id", "tenant_id", "canonical_membership_id"]);
  const hasTenantSensitiveField = content.fields.some((field) => tenantSensitiveFieldNames.has(field.name));

  if (hasTenantSensitiveField && securityContext && securityContext.requiresTenantAccess !== true) {
    diagnostics.errors.push({
      code: "tenant_fields_without_tenant_access",
      path: `${basePath}.securityContext.requiresTenantAccess`,
      message: "Panel enthaelt club-/tenant-/membership-Felder, aber requiresTenantAccess ist nicht true.",
    });
  }
}

function applyRoleProcessChecks(panel, basePath, diagnostics) {
  if (!panel || !panel.securityContext) return;

  const roleSensitiveByFlowType = new Set(["auth_critical", "admin_critical", "role_managed"]);
  const roleSensitiveByOwnership = panel.meta?.ownership === "club_override";
  const roleSensitiveByInference = panel.meta?.inferredSecurity?.requiresRoleCheck === true;

  if (
    (roleSensitiveByFlowType.has(panel.flowType) || roleSensitiveByOwnership || roleSensitiveByInference) &&
    panel.securityContext.requiresRoleCheck !== true
  ) {
    diagnostics.warnings.push({
      code: "role_sensitive_process_without_role_check",
      path: `${basePath}.securityContext.requiresRoleCheck`,
      message: "Panel wirkt rollenpflichtig, aber requiresRoleCheck ist nicht true.",
    });
  }

  if (
    panel.securityContext.requiresRoleCheck === true &&
    panel.securityContext.allowedRoles.length === 0
  ) {
    diagnostics.errors.push({
      code: "role_check_without_allowed_roles",
      path: `${basePath}.securityContext.allowedRoles`,
      message: "Rollenpflichtiger Prozess braucht allowedRoles.",
    });
  }
}

function normalizePermissions(permissions, basePath, diagnostics) {
  const normalized = {
    view: permissions?.view === true,
    write: permissions?.write === true,
    update: permissions?.update === true,
    delete: permissions?.delete === true,
    roles: Array.isArray(permissions?.roles) ? permissions.roles.filter(Boolean) : [],
  };

  if (!permissions) {
    diagnostics.warnings.push({
      code: "permissions_missing",
      path: basePath,
      message: "permissions fehlt.",
    });
  }

  return normalized;
}

function normalizeBinding(binding, basePath, diagnostics, options = {}) {
  const allowNone = options.allowNone !== false;
  const kind = asText(binding?.kind) || (allowNone ? "none" : null);
  const target = binding?.target ?? null;
  const pathValue = binding?.path ?? (kind === "none" ? "none" : null);

  if (!kind) {
    diagnostics.errors.push({
      code: "binding_kind_missing",
      path: `${basePath}.kind`,
      message: "Binding kind fehlt.",
    });
  } else if (!BINDING_KINDS.has(kind)) {
    diagnostics.errors.push({
      code: "binding_kind_invalid",
      path: `${basePath}.kind`,
      message: `Binding kind ${kind} ist nicht erlaubt.`,
    });
  }

  if (kind !== "none" && !target) {
    diagnostics.errors.push({
      code: "binding_target_missing",
      path: `${basePath}.target`,
      message: "Binding target fehlt.",
    });
  }

  if (kind !== "none" && !pathValue) {
    diagnostics.errors.push({
      code: "binding_path_missing",
      path: `${basePath}.path`,
      message: "Binding path fehlt.",
    });
  }

  if (kind && pathValue && !bindingPathMatchesKind(kind, pathValue)) {
    diagnostics.errors.push({
      code: "binding_path_kind_mismatch",
      path: `${basePath}.path`,
      message: `Binding path ${pathValue} passt nicht zu kind ${kind}.`,
    });
  }

  return {
    kind,
    target,
    path: pathValue,
  };
}

function normalizeSecurityContext(value, basePath, diagnostics, options = {}) {
  const required = options.required === true;
  if (!value) {
    if (required) {
      diagnostics.warnings.push({
        code: "security_context_missing",
        path: basePath,
        message: "securityContext fehlt.",
      });
    }
    return null;
  }

  const normalized = {
    rlsKey: normalizeSecurityKey(value?.rlsKey, `${basePath}.rlsKey`, diagnostics),
    membershipKey: normalizeSecurityKey(value?.membershipKey, `${basePath}.membershipKey`, diagnostics, { allowNull: true }),
    requiresTenantAccess: value?.requiresTenantAccess === true,
    requiresRoleCheck: value?.requiresRoleCheck === true,
    allowedRoles: Array.isArray(value?.allowedRoles) ? value.allowedRoles.filter(Boolean) : [],
    serverValidated: value?.serverValidated === true,
  };

  if (normalized.requiresTenantAccess && !normalized.rlsKey) {
    diagnostics.errors.push({
      code: "security_context_rls_key_missing",
      path: `${basePath}.rlsKey`,
      message: "requiresTenantAccess verlangt einen rlsKey.",
    });
  }

  if (normalized.requiresRoleCheck && normalized.allowedRoles.length === 0) {
    diagnostics.errors.push({
      code: "security_context_roles_missing",
      path: `${basePath}.allowedRoles`,
      message: "requiresRoleCheck verlangt allowedRoles.",
    });
  }

  if (value?.membershipKey && !normalized.membershipKey) {
    diagnostics.errors.push({
      code: "security_context_membership_key_invalid",
      path: `${basePath}.membershipKey`,
      message: "membershipKey ist ungueltig.",
    });
  }

  if (options.flowType === "auth_critical" && normalized.serverValidated !== true) {
    diagnostics.errors.push({
      code: "auth_critical_server_validation_missing",
      path: `${basePath}.serverValidated`,
      message: "auth_critical verlangt serverValidated = true.",
    });
  }

  if (["rpc", "auth_action", "edge_function"].includes(options.bindingKind) && normalized.serverValidated !== true) {
    diagnostics.errors.push({
      code: "server_validated_required",
      path: `${basePath}.serverValidated`,
      message: "Nicht-lokale Bindings verlangen serverValidated = true.",
    });
  }

  return normalized;
}

function normalizeSecurityKey(value, basePath, diagnostics, options = {}) {
  if (value === null && options.allowNull) return null;
  const normalized = asText(value);
  if (!normalized) return null;

  if (!SECURITY_KEYS.has(normalized)) {
    diagnostics.errors.push({
      code: "security_key_invalid",
      path: basePath,
      message: `${normalized} ist kein erlaubter security key.`,
    });
  }

  return normalized;
}

function normalizeOwnership(value, basePath, diagnostics) {
  const normalized = asText(value);
  if (!normalized) return null;

  if (!OWNERSHIP_VALUES.has(normalized)) {
    diagnostics.errors.push({
      code: "ownership_or_scope_invalid",
      path: basePath,
      message: `${normalized} ist kein erlaubter scope/ownership-Wert.`,
    });
    return normalized;
  }

  return normalized;
}

function normalizeSpecialCases(items, diagnostics) {
  const list = Array.isArray(items) ? items : [];
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    if (!item || !item.id || !item.type) {
      diagnostics.errors.push({
        code: "special_case_invalid",
        path: `specialCases[${index}]`,
        message: "Sonderfall braucht mindestens id und type.",
      });
      continue;
    }

    if (!item.domKey || !item.cssKey) {
      diagnostics.errors.push({
        code: "special_case_dom_css_missing",
        path: `specialCases[${index}]`,
        message: "Sonderfall braucht domKey und cssKey.",
      });
    }
  }
  return list;
}

function buildRenderPlan(resolved) {
  const sections = resolved.sections.map((section, sectionIndex) => ({
    order: sectionIndex + 1,
    id: section.id,
    title: section.title,
    workspaceSlot: section.workspaceSlot,
    sectionLayout: section.sectionLayout,
    securityContext: section.securityContext,
    panelCount: section.panels.length,
    panels: section.panels.map((panel, panelIndex) => ({
      order: panelIndex + 1,
      id: panel.id,
      title: panel.title,
      renderMode: panel.renderMode,
      contentArea: panel.contentArea,
      componentType: panel.componentType || componentTypeForRenderMode(panel.renderMode),
      securityContext: panel.securityContext,
      contentSummary: panel.content.summary,
      tableConfig: panel.tableConfig || null,
      blocks: Array.isArray(panel.content?.blocks)
        ? panel.content.blocks.map((block, blockIndex) => ({
            order: blockIndex + 1,
            id: block.id,
            label: block.label || block.title || block.id,
            componentType: block.componentType,
            renderMode: block.renderMode,
            rowsPath: block.rowsPath || null,
            tableConfig: block.tableConfig || null,
          }))
        : [],
      source: {
        table: panel.meta.sourceTable,
        kind: panel.meta.sourceKind,
      },
    })),
  }));

  return {
    family: resolved.maskFamily,
    renderer: resolved.renderer,
    maskType: resolved.maskType,
    workspaceMode: resolved.workspaceMode || null,
    workspaceNav: resolved.workspaceNav || null,
    process: resolved.process
      ? {
          processId: resolved.process.processId,
          resumeKey: resolved.process.resumeKey,
          stepCount: resolved.process.steps.length,
          steps: resolved.process.steps.map((step, index) => ({
            order: index + 1,
            id: step.id,
            stepType: step.stepType,
            statusSource: step.statusSource,
          })),
        }
      : null,
    securityContext: resolved.securityContext,
    sectionCount: sections.length,
    sections,
  };
}

function componentTypeForRenderMode(renderMode) {
  switch (renderMode) {
    case "readonly":
      return "ReadonlyPanel";
    case "form":
      return "FormPanel";
    case "table":
      return "DataTablePanel";
    case "actions":
      return "ActionPanel";
    case "mixed":
      return "MixedPanel";
    default:
      return "UnknownPanel";
  }
}

function bindingPathMatchesKind(kind, pathValue) {
  if (kind === "none") return pathValue === "none";
  if (typeof pathValue !== "string") return false;

  const prefixByKind = {
    rpc: "rpc:",
    auth_action: "auth:",
    edge_function: "edge:",
    local_only: "local:",
  };

  return pathValue.startsWith(prefixByKind[kind] || "");
}

function detectPrefix(fileName) {
  if (!fileName) return null;
  if (fileName.startsWith("QFM_")) return "QFM";
  if (fileName.startsWith("ADM_")) return "ADM";
  return null;
}

function createDiagnostics() {
  return {
    errors: [],
    warnings: [],
    feedback: [],
  };
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && value !== "";
}

function asText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node scripts/fcp-mask-reader.mjs <path-to-mask-json>");
    process.exitCode = 1;
    return;
  }

  const resolved = await readMaskJsonFile(filePath);
  process.stdout.write(JSON.stringify(resolved, null, 2));
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
