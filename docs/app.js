import {
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
} from "./invoice-engine.js";

const STORAGE_KEY = "invoice_a4_opc1_token";

let isPro = false;
let rawInvoices = [];
let activeA4PageIdx = 0;

const previewCanvas = document.getElementById("a4PreviewCanvas");

// Render a realistic Chinese red-grid electronic invoice card (1280x820) when an entry has no uploaded photo
function createSyntheticInvoiceCanvas(inv) {
  const c = document.createElement("canvas");
  c.width = 1280;
  c.height = 820;
  const ctx = c.getContext("2d");

  ctx.fillStyle = "#fffdf9";
  ctx.fillRect(0, 0, c.width, c.height);

  // Outer frame & classic e-invoice red grid
  const red = "#b91c1c";
  ctx.strokeStyle = red;
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 128, 1184, 590);

  // Title & header twin underlines
  ctx.fillStyle = red;
  ctx.textAlign = "center";
  ctx.font = "bold 36px 'Songti SC', 'PingFang SC', serif";
  ctx.fillText("电子发票（普通发票）", 640, 68);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(430, 84);
  ctx.lineTo(850, 84);
  ctx.moveTo(430, 92);
  ctx.lineTo(850, 92);
  ctx.stroke();

  // Top-right Invoice No & Date
  ctx.textAlign = "left";
  ctx.font = "600 20px ui-monospace, 'PingFang SC', sans-serif";
  ctx.fillStyle = "#1e293b";
  ctx.fillText(`发票号码：${inv.invoiceNumber || "待核对"}`, 820, 62);
  ctx.fillText(`开票日期：${inv.issueDate}`, 820, 96);

  // Grid horizontal dividers
  ctx.strokeStyle = red;
  ctx.lineWidth = 2;
  [248, 510, 585].forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(48, y);
    ctx.lineTo(1232, y);
    ctx.stroke();
  });

  // Buyer / Seller vertical split
  ctx.beginPath();
  ctx.moveTo(640, 128);
  ctx.lineTo(640, 248);
  ctx.stroke();

  ctx.fillStyle = red;
  ctx.font = "bold 20px 'PingFang SC', sans-serif";
  ctx.fillText("购买方信息", 68, 166);
  ctx.fillText("销售方信息", 660, 166);

  ctx.fillStyle = "#0f172a";
  ctx.font = "20px 'PingFang SC', sans-serif";
  ctx.fillText(`名称：${inv.buyerName}`, 68, 206);
  ctx.fillText(`名称：${inv.sellerName}`, 660, 206);

  // Item detail area
  ctx.fillStyle = red;
  ctx.font = "bold 19px 'PingFang SC', sans-serif";
  ctx.fillText("项目名称", 76, 286);
  ctx.fillText("类别", 560, 286);
  ctx.fillText("不含税金额", 830, 286);
  ctx.fillText("税额", 1070, 286);

  ctx.fillStyle = "#0f172a";
  ctx.font = "23px 'PingFang SC', sans-serif";
  ctx.fillText(inv.itemName, 76, 350);
  ctx.fillText(inv.category, 560, 350);
  ctx.fillText(`¥${Number(inv.preTaxAmount || 0).toFixed(2)}`, 830, 350);
  ctx.fillText(`¥${Number(inv.taxAmount || 0).toFixed(2)}`, 1070, 350);

  // Total row
  ctx.fillStyle = red;
  ctx.font = "bold 22px 'PingFang SC', sans-serif";
  ctx.fillText("价税合计（小写）", 76, 556);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 30px ui-monospace, sans-serif";
  ctx.fillText(`¥${Number(inv.totalAmount || 0).toFixed(2)}`, 830, 558);

  // Remarks
  ctx.fillStyle = "#475569";
  ctx.font = "18px 'PingFang SC', sans-serif";
  ctx.fillText(`备注：唯一票号精准核验样张 · 文件源 ${inv.fileName || "本地录入"}`, 76, 650);

  // Tax supervisory oval stamp
  ctx.save();
  ctx.translate(640, 68);
  ctx.strokeStyle = "rgba(185, 28, 28, 0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 108, 42, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  return c;
}

function loadBuiltinSamples() {
  rawInvoices = BUILTIN_INVOICE_SAMPLES.map((s) => {
    const parsed = parseInvoiceMetadata(s.rawText, s.fileName);
    return {
      ...parsed,
      imageCanvas: null,
    };
  });
  activeA4PageIdx = 0;
  refreshAll();
}

function refreshAll() {
  const claimant = document.getElementById("claimantInput").value.trim() || "未填报销人";
  const department = document.getElementById("deptInput").value.trim() || "默认部门";
  const dedup = deduplicateInvoices(rawInvoices);

  // 1. Update KPI strip
  const kpiStrip = document.getElementById("kpiStrip");
  kpiStrip.innerHTML = `
    <div class="kpi ok"><span>合格入账张数</span><strong>${dedup.summary.validCount} 张</strong></div>
    <div class="kpi dup"><span>精准拦截真重复</span><strong>${dedup.summary.duplicateCount} 张 (-¥${dedup.summary.duplicateInterceptedAmount.toFixed(2)})</strong></div>
    <div class="kpi ok"><span>合格报销总额</span><strong>¥${dedup.summary.totalValidAmount.toFixed(2)}</strong></div>
  `;

  // 2. Render Ledger Table
  const tbody = document.getElementById("ledgerTbody");
  tbody.innerHTML = "";
  if (dedup.items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#64748b;padding:24px;">暂无发票，请点击上方『⚡ 一键加载 4 张仿真发票』或拖入电子发票文件</td></tr>`;
  } else {
    dedup.items.forEach((item, idx) => {
      const tr = document.createElement("tr");
      if (item.isDuplicate) tr.className = "row-dup";

      let badgeHtml = `<span class="badge-ok">✅ 唯一通过</span>`;
      if (item.isDuplicate) {
        badgeHtml = `<span class="badge-dup">🚫 重复已剔除 (同#${item.duplicateOfIndex + 1})</span>`;
      } else if (item.sameAmountDistinctNumber) {
        badgeHtml = `<span class="badge-sameamt">🛡️ 同额异号·正常放行</span>`;
      }

      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${badgeHtml}</td>
        <td><input class="inline-edit" data-idx="${idx}" data-field="invoiceNumber" value="${item.invoiceNumber}"></td>
        <td><input class="inline-edit" style="width:112px" data-idx="${idx}" data-field="issueDate" value="${item.issueDate}"></td>
        <td>${item.category}</td>
        <td><strong>${item.sellerName}</strong><br><span style="color:#64748b;font-size:11.5px">${item.itemName}</span></td>
        <td>¥${item.taxAmount.toFixed(2)}</td>
        <td>¥<input class="inline-edit inline-amt" data-idx="${idx}" data-field="totalAmount" value="${item.totalAmount.toFixed(2)}"></td>
        <td><button type="button" class="btn-ghost btn-sm" data-del="${idx}">移除</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  tbody.querySelectorAll("input.inline-edit").forEach((inp) => {
    inp.addEventListener("change", () => {
      const idx = Number(inp.dataset.idx);
      const field = inp.dataset.field;
      if (!rawInvoices[idx]) return;
      if (field === "totalAmount") {
        rawInvoices[idx].totalAmount = Number(inp.value) || 0;
        rawInvoices[idx].preTaxAmount = Math.max(0, rawInvoices[idx].totalAmount - (rawInvoices[idx].taxAmount || 0));
      } else {
        rawInvoices[idx][field] = inp.value.trim();
      }
      refreshAll();
    });
  });

  tbody.querySelectorAll("button[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      rawInvoices.splice(Number(btn.dataset.del), 1);
      refreshAll();
    });
  });

  // 3. Compute A4 2-up layout & render page switcher + active A4 preview
  const layout = computeA4TwoUpLayout(dedup.validInvoices, { claimant, department });
  if (activeA4PageIdx >= layout.pageCount) activeA4PageIdx = 0;

  const switcher = document.getElementById("a4PageSwitcher");
  switcher.innerHTML = "";
  layout.pages.forEach((pg, pIdx) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = pIdx === activeA4PageIdx ? "btn-secondary btn-sm active" : "btn-secondary btn-sm";
    b.textContent = `A4 第 ${pg.pageNumber}/${pg.totalPages} 页 (${pg.slots.filter((s) => s.invoice).length} 张发票)${pIdx === 0 ? " · 免费导出" : " · Pro"}`;
    b.addEventListener("click", () => {
      activeA4PageIdx = pIdx;
      refreshAll();
    });
    switcher.appendChild(b);
  });

  renderA4SheetToCanvas(layout.pages[activeA4PageIdx], previewCanvas, 0.5, !isPro && activeA4PageIdx > 0);
}

/**
 * Render a single A4 two-up page at scale (scale=1.0 -> full 2480x3508 300DPI!).
 */
function renderA4SheetToCanvas(pageSpec, canvas, scale = 1.0, watermark = false) {
  const W = Math.round(A4_300DPI.width * scale);
  const H = Math.round(A4_300DPI.height * scale);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  if (!pageSpec) return;

  // Draw Top & Bottom invoice slots
  pageSpec.slots.forEach((slot, sIdx) => {
    const box = {
      x: slot.x * scale,
      y: slot.y * scale,
      width: slot.width * scale,
      height: slot.height * scale,
    };

    if (!slot.invoice) {
      ctx.save();
      ctx.strokeStyle = "#e2e8f0";
      ctx.setLineDash([10 * scale, 10 * scale]);
      ctx.lineWidth = 2 * scale;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.font = `${Math.round(28 * scale)}px -apple-system, PingFang SC, sans-serif`;
      ctx.fillText("（下半联留白 · 单数尾页省纸区）", box.x + box.width / 2, box.y + box.height / 2);
      ctx.restore();
      return;
    }

    const srcVisual = slot.invoice.imageCanvas || createSyntheticInvoiceCanvas(slot.invoice);
    const fit = fitInvoiceAspectContain(srcVisual.width, srcVisual.height, box);
    ctx.drawImage(srcVisual, fit.drawX, fit.drawY, fit.drawWidth, fit.drawHeight);

    // Corner index tag for easy finance audit matching
    ctx.fillStyle = "#0f172a";
    ctx.font = `bold ${Math.round(24 * scale)}px -apple-system, PingFang SC, sans-serif`;
    ctx.fillText(
      `[联 ${sIdx + 1}] 票号 ${slot.invoice.invoiceNumber} · ¥${slot.invoice.totalAmount.toFixed(2)}`,
      box.x,
      box.y - 14 * scale
    );
  });

  // Draw Center Horizontal Dashed Cut Line
  const cut = pageSpec.centerCutLine;
  ctx.save();
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = Math.max(1, 2.5 * scale);
  ctx.setLineDash(cut.dashPattern.map((d) => d * scale));
  ctx.beginPath();
  ctx.moveTo(cut.x1 * scale, cut.y * scale);
  ctx.lineTo(cut.x2 * scale, cut.y * scale);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.fillStyle = "#ffffff";
  const labelW = 580 * scale;
  ctx.fillRect(W / 2 - labelW / 2, cut.y * scale - 18 * scale, labelW, 36 * scale);
  ctx.fillStyle = "#475569";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${Math.round(24 * scale)}px -apple-system, PingFang SC, sans-serif`;
  ctx.fillText(cut.label, W / 2, cut.y * scale);
  ctx.restore();

  // Draw Bottom Reimbursement Summary Bar
  const fb = pageSpec.footerBar;
  const fx = fb.x * scale;
  const fy = fb.y * scale;
  const fw = fb.width * scale;
  const fh = fb.height * scale;

  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = Math.max(1, 2 * scale);
  ctx.fillRect(fx, fy, fw, fh);
  ctx.strokeRect(fx, fy, fw, fh);

  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${Math.round(27 * scale)}px -apple-system, PingFang SC, sans-serif`;
  const summaryText =
    `报销人：${fb.claimant}   |   部门：${fb.department}   |   ` +
    `本页(${pageSpec.pageNumber}/${pageSpec.totalPages})小计：¥${fb.pageSubtotal.toFixed(2)}   |   ` +
    `合格共 ${fb.totalValidCount} 张总计：¥${fb.totalGrandAmount.toFixed(2)}`;
  ctx.fillText(summaryText, fx + 28 * scale, fy + fh / 2);

  if (watermark) {
    ctx.save();
    ctx.fillStyle = "rgba(29, 78, 216, 0.13)";
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.textAlign = "center";
    ctx.font = `bold ${Math.round(68 * scale)}px -apple-system, PingFang SC, sans-serif`;
    ctx.fillText("第 2+ 页预览 · Pro ¥18 解锁多页批量导出", 0, 0);
    ctx.restore();
  }
}

// ---- File Upload & Paste Parsing ----

async function handleUploadedFiles(fileList) {
  const files = Array.from(fileList || []);
  for (const file of files) {
    if (file.type.startsWith("image/")) {
      const imgCanvas = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = img.width;
          c.height = img.height;
          c.getContext("2d").drawImage(img, 0, 0);
          URL.revokeObjectURL(img.src);
          resolve(c);
        };
        img.src = URL.createObjectURL(file);
      });
      const parsed = parseInvoiceMetadata("", file.name);
      rawInvoices.push({ ...parsed, imageCanvas: imgCanvas });
    } else {
      const rawBuf = await file.arrayBuffer();
      const text = new TextDecoder("utf-8", { fatal: false }).decode(rawBuf);
      const parsed = parseInvoiceMetadata(text, file.name);
      rawInvoices.push({ ...parsed, imageCanvas: null });
    }
  }
  refreshAll();
}

document.getElementById("invoiceFilesInput").addEventListener("change", (e) => {
  handleUploadedFiles(e.target.files);
});

const dropzone = document.getElementById("dropzone");
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); });
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  handleUploadedFiles(e.dataTransfer.files);
});

document.getElementById("parsePasteBtn").addEventListener("click", () => {
  const raw = document.getElementById("pasteMetaInput").value.trim();
  if (!raw) return;
  const blocks = raw.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
  blocks.forEach((b, i) => {
    rawInvoices.push({
      ...parseInvoiceMetadata(b, `粘贴录入_${i + 1}.txt`),
      imageCanvas: null,
    });
  });
  document.getElementById("pasteMetaInput").value = "";
  refreshAll();
});

document.getElementById("load4SamplesBtn").addEventListener("click", loadBuiltinSamples);
document.getElementById("clearAllBtn").addEventListener("click", () => {
  rawInvoices = [];
  refreshAll();
});
document.getElementById("claimantInput").addEventListener("input", refreshAll);
document.getElementById("deptInput").addEventListener("input", refreshAll);

// ---- Free Single-Sheet 300DPI Export & Print ----

function buildCurrentLayout() {
  const claimant = document.getElementById("claimantInput").value.trim() || "未填报销人";
  const department = document.getElementById("deptInput").value.trim() || "默认部门";
  const dedup = deduplicateInvoices(rawInvoices);
  return { dedup, layout: computeA4TwoUpLayout(dedup.validInvoices, { claimant, department }), claimant, department };
}

document.getElementById("downloadPage1FreeBtn").addEventListener("click", () => {
  const { layout } = buildCurrentLayout();
  const hiCanvas = document.createElement("canvas");
  renderA4SheetToCanvas(layout.pages[0], hiCanvas, 1.0, false); // Full 2480 x 3508 300DPI!
  const a = document.createElement("a");
  a.href = hiCanvas.toDataURL("image/png");
  a.download = "invoice-a4-page1-300dpi.png";
  a.click();
});

document.getElementById("printPage1FreeBtn").addEventListener("click", () => {
  const { layout } = buildCurrentLayout();
  const hiCanvas = document.createElement("canvas");
  renderA4SheetToCanvas(layout.pages[0], hiCanvas, 1.0, false);
  const dataUrl = hiCanvas.toDataURL("image/png");
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(
    `<!DOCTYPE html><html><head><title>A4 报销两联打印</title>` +
      `<style>@page{size:A4 portrait;margin:0}body{margin:0}img{width:210mm;height:297mm;display:block}</style></head>` +
      `<body><img src="${dataUrl}" onload="window.print()"></body></html>`
  );
  w.document.close();
});

// ---- Pro Batch CSV Ledger & Multi-Page 300DPI A4 PDF ----

function requireProOrFocus() {
  if (isPro) return true;
  document.getElementById("proSection").scrollIntoView({ behavior: "smooth" });
  document.getElementById("licenseCodeInput").focus();
  document.getElementById("verifyHint").style.color = "#b91c1c";
  document.getElementById("verifyHint").textContent =
    "💡 第 1 页 A4 拼版免费！批量查重 Excel 台账与多页 A4 PDF 导出请输入 OPC1. 激活码（¥18 永久买断）。";
  return false;
}

document.getElementById("exportCsvBtn").addEventListener("click", () => {
  if (!requireProOrFocus()) return;
  const { dedup, claimant, department } = buildCurrentLayout();
  const csv = generateReimbursementCsv(dedup, { claimant, department });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `电子发票查重报销台账_${claimant}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});

function dataUrlToBytes(dataUrl) {
  const bin = atob(dataUrl.split(",")[1]);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) u8[i] = bin.charCodeAt(i);
  return u8;
}

document.getElementById("exportAllPdfProBtn").addEventListener("click", () => {
  if (!requireProOrFocus()) return;
  const { layout, claimant } = buildCurrentLayout();
  const hiCanvas = document.createElement("canvas");
  const jpegPages = layout.pages.map((pg) => {
    renderA4SheetToCanvas(pg, hiCanvas, 1.0, false); // True 2480x3508 300DPI!
    return {
      jpegBytes: dataUrlToBytes(hiCanvas.toDataURL("image/jpeg", 0.92)),
      widthPx: hiCanvas.width,
      heightPx: hiCanvas.height,
      pageWidthPt: A4_300DPI.ptWidth,
      pageHeightPt: A4_300DPI.ptHeight,
    };
  });
  const pdfBytes = buildMultiPageJpegPdf(jpegPages);
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `A4两联报销拼版_${claimant}_${layout.pageCount}页.pdf`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// ---- Pro License Verification ----

function updateProState(unlocked, payload = null) {
  isPro = unlocked;
  const dot = document.getElementById("proDot");
  const label = document.getElementById("proStateLabel");
  const csvBtn = document.getElementById("exportCsvBtn");
  const pdfBtn = document.getElementById("exportAllPdfProBtn");

  if (unlocked) {
    dot.classList.add("ok");
    label.textContent = `已解锁 Pro 永久买断版（授权：${payload?.e || PRODUCT_SLUG}）`;
    csvBtn.textContent = "⬇️ 导出财务报销 Excel/CSV 汇总台账";
    pdfBtn.textContent = "⬇️ 批量导出全部多页 A4 300DPI 拼版 PDF";
  } else {
    dot.classList.remove("ok");
    label.textContent = "当前：免费版（第 1 页 A4 两联高清导出永久免费）";
    csvBtn.textContent = "🔒 导出财务报销 Excel/CSV 汇总台账 (Pro ¥18)";
    pdfBtn.textContent = "🔒 批量导出全部多页 A4 300DPI 拼版 PDF (Pro ¥18)";
  }
  refreshAll();
}

document.getElementById("verifyBtn").addEventListener("click", async () => {
  const code = document.getElementById("licenseCodeInput").value.trim();
  const hint = document.getElementById("verifyHint");
  const res = await verifyLicenseToken(code, { expectedProduct: PRODUCT_SLUG });
  if (res.valid) {
    try { localStorage.setItem(STORAGE_KEY, code); } catch {}
    hint.style.color = "#047857";
    hint.textContent = "✅ Ed25519 激活码验证通过！批量 Excel 台账与多页 300DPI A4 PDF 已永久解锁。";
    updateProState(true, res.payload);
  } else {
    hint.style.color = "#b91c1c";
    hint.textContent = `❌ 激活失败（原因：${res.reason}），请核对完整 OPC1. 激活码。`;
    updateProState(false);
  }
});

(async () => {
  loadBuiltinSamples();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      document.getElementById("licenseCodeInput").value = saved;
      const res = await verifyLicenseToken(saved, { expectedProduct: PRODUCT_SLUG });
      if (res.valid) updateProState(true, res.payload);
    }
  } catch {}
})();
