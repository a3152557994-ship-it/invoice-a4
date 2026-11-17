import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PUBLIC_SPKI_BASE64,
  PRODUCT_SLUG,
  A4_300DPI,
  BUILTIN_INVOICE_SAMPLES,
  parseInvoiceMetadata,
  deduplicateInvoices,
  generateReimbursementCsv,
  computeA4TwoUpLayout,
  fitInvoiceAspectContain,
  buildMultiPageJpegPdf,
  verifyLicenseToken,
} from "../src/invoice-engine.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function toBase64Url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function signTestToken(payloadObj, privateKey) {
  const payloadB64 = toBase64Url(Buffer.from(JSON.stringify(payloadObj), "utf8"));
  const sig = crypto.sign(null, Buffer.from(`OPC1.${payloadB64}`, "utf8"), privateKey);
  return `OPC1.${payloadB64}.${toBase64Url(sig)}`;
}

test("src/invoice-engine.mjs and docs/invoice-engine.js stay byte-identical", () => {
  const srcBytes = fs.readFileSync(path.join(ROOT, "src", "invoice-engine.mjs"), "utf8");
  const docsBytes = fs.readFileSync(path.join(ROOT, "docs", "invoice-engine.js"), "utf8");
  assert.equal(srcBytes, docsBytes);
  assert.equal(PUBLIC_SPKI_BASE64, "MCowBQYDK2VwAyEAP5NCVP7CT0tgaGLSGMe4r87SjYRWTM6gN6igBZYSXys=");
  assert.equal(PRODUCT_SLUG, "invoice-a4");
});

test("Extracts 20-digit all-electronic invoice (数电票) and 8-digit classic VAT e-invoice metadata accurately", () => {
  const digital20 = parseInvoiceMetadata(BUILTIN_INVOICE_SAMPLES[3].rawText, BUILTIN_INVOICE_SAMPLES[3].fileName);
  assert.equal(digital20.invoiceNumber, "26442000000291847560");
  assert.equal(digital20.invoiceNumber.length, 20);
  assert.equal(digital20.issueDate, "2026-11-14");
  assert.equal(digital20.totalAmount, 426.0);
  assert.equal(digital20.taxAmount, 24.11);
  assert.equal(digital20.preTaxAmount, 401.89);
  assert.equal(digital20.category, "差旅住宿");
  assert.ok(digital20.sellerName.includes("华住酒店"));

  const classic8 = parseInvoiceMetadata(
    "增值税电子普通发票\n发票代码：031002300111\n发票号码：89421056\n开票日期：2026-11-09\n项目名称：*餐饮服务*餐费\n税额：¥6.00\n价税合计（小写）￥106.00\n销售方名称：上海星巴克咖啡经营有限公司"
  );
  assert.equal(classic8.invoiceCode, "031002300111");
  assert.equal(classic8.invoiceNumber, "89421056");
  assert.equal(classic8.issueDate, "2026-11-09");
  assert.equal(classic8.totalAmount, 106.0);
  assert.equal(classic8.taxAmount, 6.0);
  assert.equal(classic8.category, "餐饮招待");
});

test("Exact-ID deduplication NEVER falsely flags same-amount distinct-number invoices, while 100% intercepting true duplicates", () => {
  const parsedSamples = BUILTIN_INVOICE_SAMPLES.map((s) => parseInvoiceMetadata(s.rawText, s.fileName));
  assert.equal(parsedSamples.length, 4);

  const dedup = deduplicateInvoices(parsedSamples);

  // Sample 0 (#...3911, ¥38.00) and Sample 1 (#...9402, ¥38.00) have identical ¥38.00 amount & seller,
  // MUST BOTH PASS as VALID!
  assert.equal(dedup.items[0].isDuplicate, false);
  assert.equal(dedup.items[0].status, "VALID");
  assert.equal(dedup.items[0].sameAmountDistinctNumber, true);

  assert.equal(dedup.items[1].isDuplicate, false);
  assert.equal(dedup.items[1].status, "VALID");
  assert.equal(dedup.items[1].sameAmountDistinctNumber, true);
  assert.equal(dedup.items[1].statusNote, "同金额异单号·正常放行");

  // Sample 2 (#...3911 imported again from WeChat) MUST be intercepted as DUPLICATE of index 0!
  assert.equal(dedup.items[2].isDuplicate, true);
  assert.equal(dedup.items[2].status, "DUPLICATE");
  assert.equal(dedup.items[2].duplicateOfIndex, 0);

  // Sample 3 (#...7560, ¥426.00) is VALID
  assert.equal(dedup.items[3].isDuplicate, false);

  // Totals must sum ONLY the 3 valid unique invoices: 38 + 38 + 426 = 502.00 (excluding duplicate ¥38.00)
  assert.equal(dedup.summary.validCount, 3);
  assert.equal(dedup.summary.duplicateCount, 1);
  assert.equal(dedup.summary.totalValidAmount, 502.0);
  assert.equal(dedup.summary.duplicateInterceptedAmount, 38.0);

  // Verify CSV ledger output protects 20-digit invoice numbers & carries UTF-8 BOM
  const csv = generateReimbursementCsv(dedup, { claimant: "林知远", department: "研发部" });
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.includes("\t26312000000108523911"));
  assert.ok(csv.includes("502.00"));
  assert.ok(csv.includes("同金额异单号·正常放行"));
});

test("Standard A4 300DPI (2480x3508) two-up layout places non-overlapping top/bottom slots, center cut line, and footer bar", () => {
  const parsedSamples = BUILTIN_INVOICE_SAMPLES.map((s) => parseInvoiceMetadata(s.rawText, s.fileName));
  const { validInvoices } = deduplicateInvoices(parsedSamples); // 3 valid invoices -> 2 A4 pages

  const layout = computeA4TwoUpLayout(validInvoices, {
    claimant: "林知远",
    department: "产品研发部",
  });

  assert.equal(layout.dpi, 300);
  assert.equal(layout.pageWidth, 2480);
  assert.equal(layout.pageHeight, 3508);
  assert.equal(layout.pageCount, 2);
  assert.equal(layout.totalGrandAmount, 502.0);

  const page1 = layout.pages[0];
  const topSlot = page1.slots[0];
  const bottomSlot = page1.slots[1];
  const cutY = page1.centerCutLine.y;
  const footer = page1.footerBar;

  // Verify strict vertical ordering: topSlot < centerCutLine < bottomSlot < footerBar <= 3508
  assert.ok(topSlot.y > 0);
  assert.ok(topSlot.y + topSlot.height < cutY, "Top invoice slot must stay strictly above center cut line");
  assert.ok(cutY < bottomSlot.y, "Center cut line must stay strictly above bottom invoice slot");
  assert.ok(bottomSlot.y + bottomSlot.height <= footer.y, "Bottom slot must stay above reimbursement summary footer");
  assert.ok(footer.y + footer.height <= A4_300DPI.height);
  assert.equal(page1.footerBar.pageSubtotal, 76.0); // 38 + 38 on page 1
  assert.equal(layout.pages[1].footerBar.pageSubtotal, 426.0); // 426 on page 2

  // Verify aspect-ratio contain fit inside top slot
  const fit = fitInvoiceAspectContain(1280, 820, topSlot);
  assert.ok(fit.drawX >= topSlot.x);
  assert.ok(fit.drawY >= topSlot.y);
  assert.ok(fit.drawWidth <= topSlot.width);
  assert.ok(fit.drawHeight <= topSlot.height);
  assert.ok(Math.abs(fit.drawWidth / fit.drawHeight - 1280 / 820) < 0.01);

  // Verify PDF 1.4 binary builder
  const pdf = buildMultiPageJpegPdf([
    { jpegBytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), widthPx: 2480, heightPx: 3508 },
  ]);
  assert.equal(Buffer.from(pdf.subarray(0, 8)).toString("ascii"), "%PDF-1.4");
});

test("OPC1 Ed25519 license verification validates invoice-a4 tokens and rejects invalid/wrong-slug tokens", async () => {
  const fakePayload = toBase64Url(Buffer.from(JSON.stringify({ v: 1, p: "invoice-a4", exp: 0 }), "utf8"));
  const bad = await verifyLicenseToken(`OPC1.${fakePayload}.${toBase64Url(Buffer.alloc(64, 5))}`);
  assert.equal(bad.valid, false);
  assert.equal(bad.reason, "BAD_SIGNATURE");

  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const testSpkiB64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
  const nowSec = 1794900000;

  const valid = signTestToken(
    { v: 1, p: "invoice-a4", e: "finance@corp.cn", plan: "pro-lifetime", exp: 0 },
    privateKey
  );
  const ok = await verifyLicenseToken(valid, { publicSpkiBase64: testSpkiB64, nowSec });
  assert.equal(ok.valid, true);
  assert.equal(ok.payload.e, "finance@corp.cn");

  const wrong = signTestToken({ v: 1, p: "safari-clean-speed", exp: 0 }, privateKey);
  const wrongRes = await verifyLicenseToken(wrong, { publicSpkiBase64: testSpkiB64, nowSec });
  assert.equal(wrongRes.valid, false);
  assert.equal(wrongRes.reason, "PRODUCT_MISMATCH");

  const expired = signTestToken({ v: 1, p: "invoice-a4", exp: nowSec - 120 }, privateKey);
  const expRes = await verifyLicenseToken(expired, { publicSpkiBase64: testSpkiB64, nowSec });
  assert.equal(expRes.valid, false);
  assert.equal(expRes.reason, "EXPIRED");
});

test("Repository contains zero local path or private key leaks", () => {
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === ".git" || ent.name === "node_modules") continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (/\.(mjs|js|json|html|css|md|txt|xml)$/i.test(ent.name)) {
        const text = fs.readFileSync(full, "utf8");
        assert.equal(text.includes("/Users/" + "wang"), false, `Path leak in ${full}`);
        assert.equal(text.includes("BEGIN " + "PRIVATE KEY"), false, `Private key leak in ${full}`);
      }
    }
  }
  walk(ROOT);
});
