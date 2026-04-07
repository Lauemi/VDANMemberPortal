;(() => {
  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function currentSessionRows() {
    const session = window.VDAN_AUTH?.loadSession?.() || null;
    if (!session) return [];
    return [
      {
        slot: "Aktuelle Sitzung",
        status: session.user?.email || session.user?.id || "Aktiv",
      },
    ];
  }

  function resolveLoad(panel, model) {
    const adapter = String(panel?.meta?.processAdapter || "").trim();

    if (adapter === "identity_gate_state") {
      const required = Boolean(model?.record?.requires_verification || model?.record?.identity_required || false);
      return {
        state: {
          message: required ? "Pruefung erforderlich." : "Pruefung derzeit nicht erforderlich.",
        },
      };
    }

    if (adapter === "legal_acceptance_state") {
      const accepted = Boolean(model?.record?.accepted_current || model?.record?.is_current || false);
      return {
        state: {
          message: accepted ? "Aktuelle Einwilligungen bestaetigt." : "Einwilligungen warten auf Bestaetigung.",
        },
      };
    }

    if (adapter === "session_snapshot") {
      return {
        model: {
          ...model,
          rows: toArray(model?.rows).length ? model.rows : currentSessionRows(),
        },
      };
    }

    if (adapter === "app_status_local") {
      const online = Boolean(model?.record?.online);
      return {
        state: {
          message: online ? "App verbunden." : "App derzeit offline.",
        },
      };
    }

    return {};
  }

  function resolveAction(panel, action, result) {
    const adapter = String(panel?.meta?.processAdapter || "").trim();

    if (adapter === "legal_acceptance_state") {
      return {
        message: "Einwilligungen aktualisiert.",
      };
    }

    if (adapter === "app_status_local") {
      const actionTarget = String(action?.binding?.target || "").trim();
      if (actionTarget === "check_update") {
        return { message: "Update-Pruefung angestossen." };
      }
      if (actionTarget === "reload_app") {
        return { message: "App wird neu geladen." };
      }
    }

    return {
      message: result?.record?.status || `${action?.label || action?.id || "Aktion"} ausgefuehrt.`,
    };
  }

  window.FcpMaskProcessState = Object.freeze({
    resolveLoad,
    resolveAction,
  });
})();
