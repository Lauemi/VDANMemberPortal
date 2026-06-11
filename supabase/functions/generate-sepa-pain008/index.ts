import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// P4 Mitgliederabrechnung — SEPA pain.008 Generator
// Scope: P4 = Verein → Mitglied. Kein Bezug zu P6/Stripe.
// Format: pain.008.003.02 (SEPA CORE Consumer Direct Debit)
// ---------------------------------------------------------------------------

const PAIN008_XMLNS = "urn:iso:std:iso:20022:tech:xsd:pain.008.003.02";

// SEPA-Zeichensatz: Umlaute transliterieren, unerlaubte Zeichen entfernen
function toSepa(s: string, maxLen = 140): string {
  return String(s ?? "")
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[^A-Za-z0-9 /\-?:().,'+ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, maxLen);
}

function xmlEsc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fmtAmount(n: number): string {
  return Number(n).toFixed(2);
}

function fmtDate(d: string | Date): string {
  if (!d) return "";
  return String(d).substring(0, 10);
}

function nowIso(): string {
  return new Date().toISOString().substring(0, 19);
}

// Max 35 Zeichen für IDs
function msgId(runId: string, year: number): string {
  const ts = Date.now().toString(36).toUpperCase();
  return `FCP-${year}-${ts}`.substring(0, 35);
}

function e2eId(memberNo: string, runYear: number): string {
  return `${runYear}-${(memberNo ?? "UNK").replace(/\s/g, "").substring(0, 20)}`.substring(0, 35);
}

// Bestimmt sequence_type aus Mandatszustand
function resolveSeqType(
  lifecycleStatus: string,
  priorDeclared: boolean,
): "FRST" | "RCUR" | null {
  if (lifecycleStatus === "revoked") return null;
  if (lifecycleStatus === "established" || priorDeclared) return "RCUR";
  return "FRST";
}

// Baut einen PmtInf-Block für eine Gruppe (FRST oder RCUR)
function buildPmtInf(
  seqTp: string,
  items: Array<{
    item_id: string;
    member_name_snapshot: string;
    member_no_snapshot: string;
    mandate_reference: string;
    mandate_signed_at: string;
    iban_plaintext: string;
    total_amount: number;
  }>,
  runYear: number,
  executionDate: string,
  creditorName: string,
  creditorIban: string,
  creditorBic: string | null,
  glaeubigerId: string,
  remittanceInfo: string,
): string {
  const count = items.length;
  const subtotal = items.reduce((sum, i) => sum + Number(i.total_amount), 0);
  const pmtInfId = `PMT-${seqTp}-${Date.now().toString(36).toUpperCase()}`.substring(0, 35);

  const creditorAgt = creditorBic && creditorBic.trim()
    ? `<FinInstnId><BIC>${xmlEsc(creditorBic.trim())}</BIC></FinInstnId>`
    : `<FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId>`;

  const txns = items.map((item) => {
    const e2e = e2eId(item.member_no_snapshot ?? item.item_id.substring(0, 8), runYear);
    return `
      <DrctDbtTxInf>
        <PmtId><EndToEndId>${xmlEsc(e2e)}</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">${fmtAmount(item.total_amount)}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>${xmlEsc(toSepa(item.mandate_reference, 35))}</MndtId>
            <DtOfSgntr>${fmtDate(item.mandate_signed_at)}</DtOfSgntr>
          </MndtRltdInf>
        </DrctDbtTx>
        <DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt>
        <Dbtr><Nm>${xmlEsc(toSepa(item.member_name_snapshot, 70))}</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>${xmlEsc(item.iban_plaintext.replace(/\s/g, "").toUpperCase())}</IBAN></Id></DbtrAcct>
        <Purp><Cd>OTHR</Cd></Purp>
        <RmtInf><Ustrd>${xmlEsc(toSepa(remittanceInfo, 140))}</Ustrd></RmtInf>
      </DrctDbtTxInf>`;
  }).join("");

  return `
    <PmtInf>
      <PmtInfId>${xmlEsc(pmtInfId)}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${count}</NbOfTxs>
      <CtrlSum>${fmtAmount(subtotal)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl><Cd>SEPA</Cd></SvcLvl>
        <LclInstrm><Cd>CORE</Cd></LclInstrm>
        <SeqTp>${seqTp}</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${fmtDate(executionDate)}</ReqdColltnDt>
      <Cdtr><Nm>${xmlEsc(toSepa(creditorName, 70))}</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>${xmlEsc(creditorIban.replace(/\s/g, "").toUpperCase())}</IBAN></Id></CdtrAcct>
      <CdtrAgt>${creditorAgt}</CdtrAgt>
      <CdtrSchmeId>
        <Id><PrvtId><Othr>
          <Id>${xmlEsc(glaeubigerId.trim())}</Id>
          <SchmeNm><Prtry>SEPA</Prtry></SchmeNm>
        </Othr></PrvtId></Id>
      </CdtrSchmeId>${txns}
    </PmtInf>`;
}

// Haupt-XML-Builder
function buildPain008(
  msgIdStr: string,
  totalCount: number,
  totalAmount: number,
  clubName: string,
  frstItems: Parameters<typeof buildPmtInf>[1],
  rcurItems: Parameters<typeof buildPmtInf>[1],
  runYear: number,
  executionDate: string,
  creditorIban: string,
  creditorBic: string | null,
  glaeubigerId: string,
  runLabel: string,
): string {
  const pmtInfs = [
    frstItems.length > 0
      ? buildPmtInf("FRST", frstItems, runYear, executionDate, clubName, creditorIban, creditorBic, glaeubigerId, runLabel)
      : "",
    rcurItems.length > 0
      ? buildPmtInf("RCUR", rcurItems, runYear, executionDate, clubName, creditorIban, creditorBic, glaeubigerId, runLabel)
      : "",
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="${PAIN008_XMLNS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${PAIN008_XMLNS} pain.008.003.02.xsd">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${xmlEsc(msgIdStr)}</MsgId>
      <CreDtTm>${nowIso()}</CreDtTm>
      <NbOfTxs>${totalCount}</NbOfTxs>
      <CtrlSum>${fmtAmount(totalAmount)}</CtrlSum>
      <InitgPty><Nm>${xmlEsc(toSepa(clubName, 70))}</Nm></InitgPty>
    </GrpHdr>${pmtInfs}
  </CstmrDrctDbtInitn>
</Document>`;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey" } });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader  = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";

  // Auth: verify caller is admin via user token
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  let body: { billing_run_id: string; club_id: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
  }

  const { billing_run_id, club_id } = body;
  if (!billing_run_id || !club_id) {
    return new Response(JSON.stringify({ error: "billing_run_id and club_id required" }), { status: 400 });
  }

  // Service-role client for internal RPCs
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    // 1. Load billing_run (verify draft + execution_date)
    const { data: runs, error: runErr } = await sb
      .from("billing_runs")
      .select("id, run_year, run_label, status, execution_date, total_amount, member_count")
      .eq("id", billing_run_id)
      .eq("club_id", club_id)
      .single();

    if (runErr || !runs) {
      return new Response(JSON.stringify({ error: "billing_run_not_found" }), { status: 404 });
    }
    if (runs.status !== "draft") {
      return new Response(JSON.stringify({ error: "billing_run_not_in_draft", current_status: runs.status }), { status: 409 });
    }
    if (!runs.execution_date) {
      return new Response(JSON.stringify({ error: "execution_date_missing" }), { status: 422 });
    }

    // 2. Load club SEPA config (with plaintext IBAN)
    const { data: sepaRows, error: sepaErr } = await sb
      .rpc("admin_get_club_sepa_data", { p_club_id: club_id });

    if (sepaErr || !sepaRows?.length) {
      return new Response(JSON.stringify({ error: "sepa_config_missing", detail: sepaErr?.message }), { status: 422 });
    }
    const sepa = sepaRows[0];
    if (!sepa.glaeubiger_id || !sepa.club_iban_plaintext) {
      return new Response(JSON.stringify({ error: "sepa_config_incomplete", missing: !sepa.glaeubiger_id ? "glaeubiger_id" : "club_iban" }), { status: 422 });
    }

    // 3. Load member IBANs + mandate data
    const { data: ibanRows, error: ibanErr } = await sb
      .rpc("admin_get_billing_run_iban_data", { p_billing_run_id: billing_run_id });

    if (ibanErr) {
      return new Response(JSON.stringify({ error: "iban_load_failed", detail: ibanErr.message }), { status: 500 });
    }
    if (!ibanRows?.length) {
      return new Response(JSON.stringify({ error: "no_sepa_items" }), { status: 422 });
    }

    // 4. Validate and classify FRST/RCUR
    const frstItems: typeof ibanRows = [];
    const rcurItems: typeof ibanRows = [];
    const itemSeqTypes: Array<{ item_id: string; sequence_type: string }> = [];
    const skipped: string[] = [];

    for (const row of ibanRows) {
      if (!row.iban_plaintext) { skipped.push(row.item_id); continue; }
      if (!row.mandate_reference) { skipped.push(row.item_id); continue; }
      if (!row.mandate_signed_at) { skipped.push(row.item_id); continue; }

      const seqType = resolveSeqType(row.mandate_lifecycle_status, row.prior_collections_declared);
      if (!seqType) { skipped.push(row.item_id); continue; } // revoked mandate

      itemSeqTypes.push({ item_id: row.item_id, sequence_type: seqType });
      if (seqType === "FRST") {
        frstItems.push(row);
      } else {
        rcurItems.push(row);
      }
    }

    if (frstItems.length === 0 && rcurItems.length === 0) {
      return new Response(JSON.stringify({ error: "no_valid_items", skipped }), { status: 422 });
    }

    // 5. Build pain.008 XML
    const totalCount  = frstItems.length + rcurItems.length;
    const totalAmount = [...frstItems, ...rcurItems].reduce((s, i) => s + Number(i.total_amount), 0);
    const msgIdStr    = msgId(billing_run_id, runs.run_year);
    const xmlString   = buildPain008(
      msgIdStr, totalCount, totalAmount,
      sepa.club_legal_name,
      frstItems, rcurItems,
      runs.run_year, runs.execution_date,
      sepa.club_iban_plaintext, sepa.club_bic,
      sepa.glaeubiger_id, runs.run_label,
    );

    // 6. SHA-256 Hash
    const xmlHash = await sha256Hex(xmlString);

    // 7. Atomic state write — mandate lifecycle NOT transitioned here (happens at completed)
    const { error: finalErr } = await sb.rpc("admin_finalize_sepa_export", {
      p_billing_run_id:      billing_run_id,
      p_sepa_message_id:     msgIdStr,
      p_sepa_xml_hash:       xmlHash,
      p_item_sequence_types: itemSeqTypes,
    });

    if (finalErr) {
      return new Response(JSON.stringify({ error: "finalize_failed", detail: finalErr.message }), { status: 500 });
    }

    // 8. Return XML as download
    const filename = `sepa-${sepa.club_code ?? "club"}-${runs.run_year}-${billing_run_id.substring(0, 8)}.xml`;
    return new Response(xmlString, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Sepa-Message-Id": msgIdStr,
        "X-Sepa-Hash-Sha256": xmlHash,
        "X-Items-Total": String(totalCount),
        "X-Items-Skipped": String(skipped.length),
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "Content-Disposition, X-Sepa-Message-Id, X-Sepa-Hash-Sha256",
      },
    });

  } catch (err) {
    console.error("[generate-sepa-pain008] unexpected error", err);
    return new Response(JSON.stringify({ error: "internal_error", detail: String(err) }), { status: 500 });
  }
});
