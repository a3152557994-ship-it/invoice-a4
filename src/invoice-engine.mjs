/**
 * Invoice-A4 — Zero-Login Local Electronic Invoice Exact Deduplication Ledger & A4 300DPI 2-Up Print Engine
 * Works identically in Node.js (ESM) and modern browsers (<script type="module">).
 * Zero external dependencies. Zero server uploads.
 */

export const PUBLIC_SPKI_BASE64 = "MCowBQYDK2VwAyEAP5NCVP7CT0tgaGLSGMe4r87SjYRWTM6gN6igBZYSXys=";
export const PRODUCT_SLUG = "invoice-a4";

export const A4_300DPI = {
  width: 2480,
  height: 3508,
  ptWidth: 595.28,
  ptHeight: 841.89,
};

// ---- Built-in 4 Realistic Electronic Invoice Samples ----
export const BUILTIN_INVOICE_SAMPLES = [
  {
    id: "sample-didi-day1",
    fileName: "滴滴出行电子发票_26312000000108523911_38.00.pdf",
    rawText: [
      "电子发票（普通发票）",
      "发票号码：26312000000108523911",
      "开票日期：2026年11月10日",
      "购买方信息 名称：上海瀚海数字科技有限公司 统一社会信用代码/纳税人识别号：91310115MA1K88990X",
      "销售方信息 名称：北京小桔新能源汽车科技有限公司（滴滴出行） 统一社会信用代码/纳税人识别号：91110108MA0199223B",
      "项目名称：*运输服务*客运服务费",
      "合计 金额：¥36.89 税额：¥1.11",
      "价税合计（大写）：叁拾捌圆整 （小写）¥38.00",
      "备注：虹桥火车站—张江高科园区通勤",
    ].join("\n"),
  },
  {
    id: "sample-didi-day2-same-amount",
    fileName: "滴滴出行电子发票_26312000000108599402_38.00.pdf",
    rawText: [
      "电子发票（普通发票）",
      "发票号码：26312000000108599402",
      "开票日期：2026年11月11日",
      "购买方信息 名称：上海瀚海数字科技有限公司 统一社会信用代码/纳税人识别号：91310115MA1K88990X",
      "销售方信息 名称：北京小桔新能源汽车科技有限公司（滴滴出行） 统一社会信用代码/纳税人识别号：91110108MA0199223B",
      "项目名称：*运输服务*客运服务费",
      "合计 金额：¥36.89 税额：¥1.11",
      "价税合计（大写）：叁拾捌圆整 （小写）¥38.00",
      "备注：次日同路线打车（同金额 ¥38.00 但唯一发票号不同，绝不误判重复！）",
    ].join("\n"),
  },
  {
    id: "sample-didi-true-duplicate",
    fileName: "微信卡包重复导出_26312000000108523911.pdf",
    rawText: [
      "电子发票（普通发票）",
      "发票号码：26312000000108523911",
      "开票日期：2026年11月10日",
      "购买方信息 名称：上海瀚海数字科技有限公司 统一社会信用代码/纳税人识别号：91310115MA1K88990X",
      "销售方信息 名称：北京小桔新能源汽车科技有限公司（滴滴出行） 统一社会信用代码/纳税人识别号：91110108MA0199223B",
      "项目名称：*运输服务*客运服务费",
      "合计 金额：¥36.89 税额：¥1.11",
      "价税合计（大写）：叁拾捌圆整 （小写）¥38.00",
      "备注：邮箱与微信卡包重复拖入的同一张发票（真重复必拦截）",
    ].join("\n"),
  },
  {
    id: "sample-hotel-trip",
    fileName: "华住全季差旅住宿票_26442000000291847560_426.00.pdf",
    rawText: [
      "电子发票（增值税专用发票）",
      "发票号码：26442000000291847560",
      "开票日期：2026年11月14日",
      "购买方信息 名称：上海瀚海数字科技有限公司 统一社会信用代码/纳税人识别号：91310115MA1K88990X",
      "销售方信息 名称：深圳华住酒店管理有限公司 统一社会信用代码/纳税人识别号：91440300MA5F11228U",
      "项目名称：*住宿服务*差旅住宿费",
      "合计 金额：¥401.89 税额：¥24.11",
      "价税合计（大写）：肆佰贰拾陆圆整 （小写）¥426.00",
      "备注：深圳客户拜访出差 1 晚",
    ].join("\n"),
  },
];

// ---- Base64 & Pure-JS Ed25519 Fallback + WebCrypto Verifier ----

function base64ToBytes(b64) {
  const clean = String(b64).replace(/\s+/g, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function base64UrlToBytes(b64url) {
  const norm = String(b64url).replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (norm.length % 4)) % 4;
  return base64ToBytes(norm + "=".repeat(pad));
}

const SHA512_K = [
  0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn, 0xe9b5dba58189dbbcn,
  0x3956c25bf348b538n, 0x59f111f1b605d019n, 0x923f82a4af194f9bn, 0xab1c5ed5da6d8118n,
  0xd807aa98a3030242n, 0x12835b0145706fben, 0x243185be4ee4b28cn, 0x550c7dc3d5ffb4e2n,
  0x72be5d74f27b896fn, 0x80deb1fe3b1696b1n, 0x9bdc06a725c71235n, 0xc19bf174cf692694n,
  0xe49b69c19ef14ad2n, 0xefbe4786384f25e3n, 0x0fc19dc68b8cd5b5n, 0x240ca1cc77ac9c65n,
  0x2de92c6f592b0275n, 0x4a7484aa6ea6e483n, 0x5cb0a9dcbd41fbd4n, 0x76f988da831153b5n,
  0x983e5152ee66dfabn, 0xa831c66d2db43210n, 0xb00327c898fb213fn, 0xbf597fc7beef0ee4n,
  0xc6e00bf33da88fc2n, 0xd5a79147930aa725n, 0x06ca6351e003826fn, 0x142929670a0e6e70n,
  0x27b70a8546d22ffcn, 0x2e1b21385c26c926n, 0x4d2c6dfc5ac42aedn, 0x53380d139d95b3dfn,
  0x650a73548baf63den, 0x766a0abb3c77b2a8n, 0x81c2c92e47edaee6n, 0x92722c851482353bn,
  0xa2bfe8a14cf10364n, 0xa81a664bbc423001n, 0xc24b8b70d0f89791n, 0xc76c51a30654be30n,
  0xd192e819d6ef5218n, 0xd69906245565a910n, 0xf40e35855771202an, 0x106aa07032bbd1b8n,
  0x19a4c116b8d2d0c8n, 0x1e376c085141ab53n, 0x2748774cdf8eeb99n, 0x34b0bcb5e19b48a8n,
  0x391c0cb3c5c95a63n, 0x4ed8aa4ae3418acbn, 0x5b9cca4f7763e373n, 0x682e6ff3d6b2b8a3n,
  0x748f82ee5defb2fcn, 0x78a5636f43172f60n, 0x84c87814a1f0ab72n, 0x8cc702081a6439ecn,
  0x90befffa23631e28n, 0xa4506cebde82bde9n, 0xbef9a3f7b2c67915n, 0xc67178f2e372532bn,
  0xca273eceea26619cn, 0xd186b8c721c0c207n, 0xeada7dd6cde0eb1en, 0xf57d4f7fee6ed178n,
  0x06f067aa72176fban, 0x0a637dc5a2c898a6n, 0x113f9804bef90daen, 0x1b710b35131c471bn,
  0x28db77f523047d84n, 0x32caab7b40c72493n, 0x3c9ebe0a15c9bebcn, 0x431d67c49c100d4cn,
  0x4cc5d4becb3e42b6n, 0x597f299cfc657e2an, 0x5fcb6fab3ad6faecn, 0x6c44198c4a475817n,
];
const MASK64 = 0xffffffffffffffffn;
const ED_P = (1n << 255n) - 19n;
const ED_L = (1n << 252n) + 27742317777372353535851937790883648493n;
function rotr64(x, n) { return ((x >> n) | (x << (64n - n))) & MASK64; }
function sha512(msgBytes) {
  const H = [
    0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
    0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n,
  ];
  const len = msgBytes.length;
  const bitLen = BigInt(len) * 8n;
  const padLen = ((112 - ((len + 1) % 128)) + 128) % 128;
  const total = len + 1 + padLen + 16;
  const buf = new Uint8Array(total);
  buf.set(msgBytes, 0);
  buf[len] = 0x80;
  for (let i = 0; i < 8; i += 1) buf[total - 1 - i] = Number((bitLen >> BigInt(i * 8)) & 0xffn);
  const w = new Array(80);
  for (let offset = 0; offset < total; offset += 128) {
    for (let t = 0; t < 16; t += 1) {
      const idx = offset + t * 8;
      w[t] =
        (BigInt(buf[idx]) << 56n) | (BigInt(buf[idx + 1]) << 48n) |
        (BigInt(buf[idx + 2]) << 40n) | (BigInt(buf[idx + 3]) << 32n) |
        (BigInt(buf[idx + 4]) << 24n) | (BigInt(buf[idx + 5]) << 16n) |
        (BigInt(buf[idx + 6]) << 8n) | BigInt(buf[idx + 7]);
    }
    for (let t = 16; t < 80; t += 1) {
      const s0 = rotr64(w[t - 15], 1n) ^ rotr64(w[t - 15], 8n) ^ (w[t - 15] >> 7n);
      const s1 = rotr64(w[t - 2], 19n) ^ rotr64(w[t - 2], 61n) ^ (w[t - 2] >> 6n);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) & MASK64;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 80; t += 1) {
      const S1 = rotr64(e, 14n) ^ rotr64(e, 18n) ^ rotr64(e, 41n);
      const ch = (e & f) ^ ((~e & MASK64) & g);
      const temp1 = (h + S1 + ch + SHA512_K[t] + w[t]) & MASK64;
      const S0 = rotr64(a, 28n) ^ rotr64(a, 34n) ^ rotr64(a, 39n);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) & MASK64;
      h = g; g = f; f = e; e = (d + temp1) & MASK64;
      d = c; c = b; b = a; a = (temp1 + temp2) & MASK64;
    }
    H[0] = (H[0] + a) & MASK64; H[1] = (H[1] + b) & MASK64;
    H[2] = (H[2] + c) & MASK64; H[3] = (H[3] + d) & MASK64;
    H[4] = (H[4] + e) & MASK64; H[5] = (H[5] + f) & MASK64;
    H[6] = (H[6] + g) & MASK64; H[7] = (H[7] + h) & MASK64;
  }
  const out = new Uint8Array(64);
  for (let j = 0; j < 8; j += 1) {
    for (let k = 0; k < 8; k += 1) out[j * 8 + (7 - k)] = Number((H[j] >> BigInt(k * 8)) & 0xffn);
  }
  return out;
}
function modP(a) { const r = a % ED_P; return r >= 0n ? r : r + ED_P; }
function modPow(base, exp, mod) {
  let result = 1n, b = base % mod, e = exp;
  while (e > 0n) { if (e & 1n) result = (result * b) % mod; b = (b * b) % mod; e >>= 1n; }
  return result;
}
const ED_D = modP(-121665n * modPow(121666n, ED_P - 2n, ED_P));
function leBytesToBigInt(bytes) {
  let x = 0n;
  for (let i = bytes.length - 1; i >= 0; i -= 1) x = (x << 8n) | BigInt(bytes[i]);
  return x;
}
function decodeEdPoint(bytes) {
  if (bytes.length !== 32) return null;
  const copy = new Uint8Array(bytes);
  const xSign = (copy[31] >> 7) & 1;
  copy[31] &= 0x7f;
  const y = leBytesToBigInt(copy);
  if (y >= ED_P) return null;
  const y2 = modP(y * y);
  const u = modP(y2 - 1n);
  const v = modP(ED_D * y2 + 1n);
  const v3 = modP(v * v * v);
  const v7 = modP(v3 * v3 * v);
  let x = modP(modP(u * v3) * modPow(modP(u * v7), (ED_P - 5n) / 8n, ED_P));
  const vx2 = modP(v * modP(x * x));
  if (vx2 === u) { /* ok */ }
  else if (vx2 === modP(-u)) x = modP(x * modPow(2n, (ED_P - 1n) / 4n, ED_P));
  else return null;
  if (x === 0n && xSign === 1) return null;
  if (Number(x & 1n) !== xSign) x = ED_P - x;
  return [x, y, 1n, modP(x * y)];
}
function edAdd(P, Q) {
  const [X1, Y1, Z1, T1] = P;
  const [X2, Y2, Z2, T2] = Q;
  const A = modP((Y1 - X1) * (Y2 - X2));
  const B = modP((Y1 + X1) * (Y2 + X2));
  const C = modP(T1 * 2n * ED_D * T2);
  const D = modP(Z1 * 2n * Z2);
  const E = modP(B - A), F = modP(D - C), G = modP(D + C), H = modP(B + A);
  return [modP(E * F), modP(G * H), modP(F * G), modP(E * H)];
}
function edScalarMul(P, scalar) {
  let R = [0n, 1n, 1n, 0n], Q = P, s = scalar;
  while (s > 0n) { if (s & 1n) R = edAdd(R, Q); Q = edAdd(Q, Q); s >>= 1n; }
  return R;
}
const ED_BASE = (() => {
  const enc = new Uint8Array(32);
  let y = modP(4n * modPow(5n, ED_P - 2n, ED_P));
  for (let i = 0; i < 32; i += 1) { enc[i] = Number(y & 0xffn); y >>= 8n; }
  return decodeEdPoint(enc);
})();
function verifyEd25519Pure(sigBytes, msgBytes, rawPub32) {
  if (!sigBytes || sigBytes.length !== 64 || !rawPub32 || rawPub32.length !== 32) return false;
  const RBytes = sigBytes.subarray(0, 32), SBytes = sigBytes.subarray(32, 64);
  const s = leBytesToBigInt(SBytes);
  if (s >= ED_L) return false;
  const R = decodeEdPoint(RBytes), A = decodeEdPoint(rawPub32);
  if (!R || !A) return false;
  const hInput = new Uint8Array(64 + msgBytes.length);
  hInput.set(RBytes, 0); hInput.set(rawPub32, 32); hInput.set(msgBytes, 64);
  const h = leBytesToBigInt(sha512(hInput)) % ED_L;
  const left = edScalarMul(ED_BASE, s), right = edAdd(R, edScalarMul(A, h));
  return (
    modP(left[0] * right[2] - right[0] * left[2]) === 0n &&
    modP(left[1] * right[2] - right[1] * left[2]) === 0n
  );
}

export async function verifyLicenseToken(token, options = {}) {
  const {
    expectedProduct = PRODUCT_SLUG,
    publicSpkiBase64 = PUBLIC_SPKI_BASE64,
    nowSec = Math.floor(Date.now() / 1000),
  } = options;

  if (typeof token !== "string" || !token.trim()) {
    return { valid: false, reason: "EMPTY_TOKEN" };
  }
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "OPC1" || !parts[1] || !parts[2]) {
    return { valid: false, reason: "BAD_FORMAT" };
  }

  try {
    const [, payloadB64, sigB64] = parts;
    const spkiBytes = base64ToBytes(publicSpkiBase64);
    const sigBytes = base64UrlToBytes(sigB64);
    const signedBytes = new TextEncoder().encode(`OPC1.${payloadB64}`);

    let verified = false;
    const subtle = globalThis.crypto?.subtle;
    if (subtle && typeof subtle.importKey === "function") {
      try {
        const key = await subtle.importKey("spki", spkiBytes, { name: "Ed25519" }, false, ["verify"]);
        verified = Boolean(await subtle.verify("Ed25519", key, sigBytes, signedBytes));
      } catch {
        const rawPub = spkiBytes.length === 44 ? spkiBytes.subarray(12, 44) : spkiBytes;
        verified = verifyEd25519Pure(sigBytes, signedBytes, rawPub);
      }
    } else {
      const rawPub = spkiBytes.length === 44 ? spkiBytes.subarray(12, 44) : spkiBytes;
      verified = verifyEd25519Pure(sigBytes, signedBytes, rawPub);
    }

    if (!verified) return { valid: false, reason: "BAD_SIGNATURE" };
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64)));
    const prod = payload.p ?? payload.product ?? payload.slug;
    if (expectedProduct && prod !== expectedProduct && prod !== "*") {
      return { valid: false, reason: "PRODUCT_MISMATCH", payload };
    }
    if (typeof payload.exp === "number" && payload.exp > 0 && nowSec > payload.exp) {
      return { valid: false, reason: "EXPIRED", payload };
    }
    return { valid: true, payload, token: token.trim() };
  } catch (err) {
    return { valid: false, reason: "VERIFY_ERROR", message: err?.message };
  }
}

// ---- 1. Electronic Invoice Metadata Parser (8-Digit VAT & 20-Digit All-Digital 数电票) ----

export function inferExpenseCategory(itemName = "", sellerName = "") {
  const combined = `${itemName} ${sellerName}`;
  if (/运输|客运|出行|打车|滴滴|高铁|铁路|航空|机票|通行费|加油/.test(combined)) return "交通出行";
  if (/住宿|酒店|宾馆|华住|如家|万豪|民宿/.test(combined)) return "差旅住宿";
  if (/餐饮|餐费|咖啡|饮品|食品/.test(combined)) return "餐饮招待";
  if (/软件|信息技术|云|技术服务|网络|电信|宽带/.test(combined)) return "技术与通讯";
  if (/办公|文具|耗材|设备|图书|印刷/.test(combined)) return "办公采购";
  return "其他业务费";
}

function roundMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
}

/**
 * Extract structured electronic invoice metadata from pasted/extracted text, XML, or filename.
 */
export function parseInvoiceMetadata(rawText = "", fileName = "") {
  const text = `${String(rawText || "")}\n${String(fileName || "")}`;

  // 1. Invoice Number: prioritize 20-digit all-digital e-invoice (数电票), then labeled 8-digit classic number
  let invoiceNumber = "";
  let invoiceCode = "";

  const labeled20 = /发票号码\s*[:：]?\s*(\d{20})\b/.exec(text);
  const any20 = /(?:^|[^\d])(\d{20})(?!\d)/.exec(text);
  const labeled8 = /发票号码\s*[:：]?\s*(\d{8})\b/.exec(text);
  const xmlNum = /<(?:InvoiceNumber|Fphm|fphm)>\s*(\d{8,20})\s*<\//i.exec(text);

  if (labeled20) {
    invoiceNumber = labeled20[1];
  } else if (xmlNum) {
    invoiceNumber = xmlNum[1];
  } else if (any20) {
    invoiceNumber = any20[1];
  } else if (labeled8) {
    invoiceNumber = labeled8[1];
  } else {
    const fn8 = /(?:^|[_\-\s])(\d{8})(?:[_\-.\s]|$)/.exec(fileName);
    if (fn8) invoiceNumber = fn8[1];
  }

  const codeMatch = /发票代码\s*[:：]?\s*(\d{10,12})\b/.exec(text);
  if (codeMatch) invoiceCode = codeMatch[1];

  // 2. Issue Date -> YYYY-MM-DD
  let issueDate = "";
  const dateCn = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/.exec(text);
  const dateIso = /(?:开票日期\s*[:：]?\s*)?(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  if (dateCn) {
    issueDate = `${dateCn[1]}-${dateCn[2].padStart(2, "0")}-${dateCn[3].padStart(2, "0")}`;
  } else if (dateIso) {
    issueDate = `${dateIso[1]}-${dateIso[2].padStart(2, "0")}-${dateIso[3].padStart(2, "0")}`;
  }

  // 3. Total Amount (价税合计小写), Pre-Tax Amount, Tax Amount
  let totalAmount = 0;
  let preTaxAmount = 0;
  let taxAmount = 0;

  const totalLabeled =
    /价税合计[\s\S]{0,48}?(?:（小写）|\(小写\)|小写)?\s*[¥￥]?\s*([0-9]+(?:\.[0-9]{1,2})?)/i.exec(text) ||
    /<(?:TotalTax-IncludedAmount|Jshj|TotalAmount)>\s*([0-9]+(?:\.[0-9]{1,2})?)\s*<\//i.exec(text);

  if (totalLabeled) {
    totalAmount = roundMoney(totalLabeled[1]);
  } else {
    // Fallback: largest currency figure with ¥/￥ or filename _38.00
    const yenMatches = Array.from(text.matchAll(/[¥￥]\s*([0-9]+(?:\.[0-9]{1,2})?)/g)).map((m) =>
      roundMoney(m[1])
    );
    if (yenMatches.length > 0) {
      totalAmount = Math.max(...yenMatches);
    } else {
      const fnAmt = /[_\-](\d+\.\d{2})(?:[_\-.]|$)/.exec(fileName);
      if (fnAmt) totalAmount = roundMoney(fnAmt[1]);
    }
  }

  const taxLabeled =
    /合计[\s\S]{0,40}?金额\s*[:：]?\s*[¥￥]?\s*([0-9]+(?:\.[0-9]{1,2})?)[\s\S]{0,24}?税额\s*[:：]?\s*[¥￥]?\s*([0-9]+(?:\.[0-9]{1,2})?)/i.exec(
      text
    );
  if (taxLabeled) {
    preTaxAmount = roundMoney(taxLabeled[1]);
    taxAmount = roundMoney(taxLabeled[2]);
  } else {
    const singleTax = /税额(?:合计)?\s*[:：]?\s*[¥￥]?\s*([0-9]+(?:\.[0-9]{1,2})?)/.exec(text);
    if (singleTax) taxAmount = roundMoney(singleTax[1]);
    preTaxAmount = totalAmount >= taxAmount ? roundMoney(totalAmount - taxAmount) : totalAmount;
  }

  // 4. Buyer & Seller Names
  let buyerName = "";
  let sellerName = "";

  const buyerMatch =
    /购买方(?:信息)?[\s\S]{0,40}?名称\s*[:：]\s*([^\s\n统一纳税]+)/.exec(text) ||
    /购\s*买\s*方\s*名\s*称\s*[:：]\s*([^\n\r]+)/.exec(text);
  if (buyerMatch) buyerName = buyerMatch[1].trim();

  const sellerMatch =
    /销售方(?:信息)?[\s\S]{0,40}?名称\s*[:：]\s*([^\s\n统一纳税]+)/.exec(text) ||
    /销\s*售\s*方\s*名\s*称\s*[:：]\s*([^\n\r]+)/.exec(text);
  if (sellerMatch) sellerName = sellerMatch[1].trim();

  // 5. Item Detail (*大类*明细)
  let itemName = "";
  const starItem = /(\*[^*\n]{1,20}\*[^\s\n¥￥0-9]{1,28})/.exec(text);
  const labeledItem = /项目名称\s*[:：]\s*([^\n\r]+)/.exec(text);
  if (labeledItem) itemName = labeledItem[1].trim();
  else if (starItem) itemName = starItem[1].trim();

  const category = inferExpenseCategory(itemName, sellerName);
  const invoiceType = invoiceNumber.length === 20 ? "数电票(20位)" : invoiceNumber.length === 8 ? "增值税电票(8位)" : "手工/待核票据";

  return {
    invoiceNumber,
    invoiceCode,
    invoiceType,
    issueDate: issueDate || new Date().toISOString().slice(0, 10),
    buyerName: buyerName || "（待补充购买方）",
    sellerName: sellerName || "（待补充销售方）",
    itemName: itemName || "*现代服务*业务费",
    category,
    preTaxAmount,
    taxAmount,
    totalAmount,
    fileName: fileName || "",
  };
}

// ---- 2. Exact Invoice-Number Deduplication Engine ----

export function buildCanonicalInvoiceKey(inv) {
  const num = String(inv.invoiceNumber || "").trim();
  const code = String(inv.invoiceCode || "").trim();
  if (!num) return null;
  return code ? `${code}-${num}` : num;
}

/**
 * Deduplicate invoices strictly by canonical unique invoice number (`invoiceCode` + `invoiceNumber`).
 * NEVER flags two distinct invoice numbers as duplicate merely because `totalAmount` or `sellerName` matches!
 */
export function deduplicateInvoices(invoices = []) {
  const seenKeyToFirstIndex = new Map();
  const amountToValidKeys = new Map();

  const annotated = invoices.map((raw, index) => {
    const inv = {
      ...raw,
      totalAmount: roundMoney(raw.totalAmount),
      taxAmount: roundMoney(raw.taxAmount),
      preTaxAmount: roundMoney(raw.preTaxAmount ?? (Number(raw.totalAmount || 0) - Number(raw.taxAmount || 0))),
    };
    const key = buildCanonicalInvoiceKey(inv);

    if (key && seenKeyToFirstIndex.has(key)) {
      const firstIndex = seenKeyToFirstIndex.get(key);
      return {
        ...inv,
        index,
        canonicalKey: key,
        isDuplicate: true,
        status: "DUPLICATE",
        duplicateOfIndex: firstIndex,
        duplicateOfInvoiceNumber: invoices[firstIndex].invoiceNumber,
        sameAmountDistinctNumber: false,
        statusNote: `拦截重复：与第 ${firstIndex + 1} 张发票号 (${key}) 完全相同`,
      };
    }

    if (key) {
      seenKeyToFirstIndex.set(key, index);
      const amtKey = inv.totalAmount.toFixed(2);
      if (!amountToValidKeys.has(amtKey)) amountToValidKeys.set(amtKey, new Set());
      amountToValidKeys.get(amtKey).add(key);
    }

    return {
      ...inv,
      index,
      canonicalKey: key,
      isDuplicate: false,
      status: "VALID",
      duplicateOfIndex: null,
      duplicateOfInvoiceNumber: null,
      sameAmountDistinctNumber: false,
      statusNote: key ? "唯一票号核验通过" : "无票号手录项（请核对原件）",
    };
  });

  // Annotate valid invoices that share the exact same amount with another distinct invoice number
  // so finance reviewers clearly see both are legitimate separate rides/meals!
  for (const item of annotated) {
    if (!item.isDuplicate && item.canonicalKey) {
      const distinctKeysAtSameAmount = amountToValidKeys.get(item.totalAmount.toFixed(2));
      if (distinctKeysAtSameAmount && distinctKeysAtSameAmount.size > 1) {
        item.sameAmountDistinctNumber = true;
        item.statusNote = "同金额异单号·正常放行";
      }
    }
  }

  const validInvoices = annotated.filter((x) => !x.isDuplicate);
  const duplicateInvoices = annotated.filter((x) => x.isDuplicate);

  const totalValidAmount = roundMoney(validInvoices.reduce((s, x) => s + x.totalAmount, 0));
  const totalValidTax = roundMoney(validInvoices.reduce((s, x) => s + x.taxAmount, 0));
  const totalValidPreTax = roundMoney(validInvoices.reduce((s, x) => s + x.preTaxAmount, 0));
  const duplicateInterceptedAmount = roundMoney(duplicateInvoices.reduce((s, x) => s + x.totalAmount, 0));

  return {
    items: annotated,
    validInvoices,
    duplicateInvoices,
    summary: {
      totalInputCount: annotated.length,
      validCount: validInvoices.length,
      duplicateCount: duplicateInvoices.length,
      totalValidPreTax,
      totalValidTax,
      totalValidAmount,
      duplicateInterceptedAmount,
    },
  };
}

// ---- 3. CSV / Excel Reimbursement Ledger Exporter ----

function csvEscape(val) {
  const s = String(val ?? "");
  // Prevent Excel scientific notation mangling on 20-digit invoice numbers by prefixing tab when all-digits >= 12
  if (/^\d{12,}$/.test(s)) {
    return `"\t${s}"`;
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function generateReimbursementCsv(dedupResult, meta = {}) {
  const claimant = meta.claimant || "未填报销人";
  const department = meta.department || "默认部门";
  const exportDate = meta.exportDate || new Date().toISOString().slice(0, 10);

  const lines = [];
  lines.push(
    [
      "序号",
      "查重状态",
      "发票唯一号码",
      "票种",
      "开票日期",
      "费用类别",
      "项目明细",
      "销售方名称",
      "购买方名称",
      "不含税金额(元)",
      "税额(元)",
      "价税合计(元)",
      "核验说明",
      "报销人",
      "所属部门",
    ]
      .map(csvEscape)
      .join(",")
  );

  dedupResult.items.forEach((item, i) => {
    lines.push(
      [
        i + 1,
        item.isDuplicate ? "重复已剔除" : "合格入账",
        item.invoiceNumber || "-",
        item.invoiceType || "",
        item.issueDate,
        item.category,
        item.itemName,
        item.sellerName,
        item.buyerName,
        item.isDuplicate ? "0.00" : item.preTaxAmount.toFixed(2),
        item.isDuplicate ? "0.00" : item.taxAmount.toFixed(2),
        item.isDuplicate ? "0.00" : item.totalAmount.toFixed(2),
        item.statusNote,
        claimant,
        department,
      ]
        .map(csvEscape)
        .join(",")
    );
  });

  lines.push("");
  lines.push(
    [
      "汇总合计",
      `有效 ${dedupResult.summary.validCount} 张 / 拦截重复 ${dedupResult.summary.duplicateCount} 张`,
      "",
      "",
      exportDate,
      "",
      "",
      "",
      "",
      dedupResult.summary.totalValidPreTax.toFixed(2),
      dedupResult.summary.totalValidTax.toFixed(2),
      dedupResult.summary.totalValidAmount.toFixed(2),
      `已防重止损 ¥${dedupResult.summary.duplicateInterceptedAmount.toFixed(2)}`,
      claimant,
      department,
    ]
      .map(csvEscape)
      .join(",")
  );

  // Prepend UTF-8 BOM so Microsoft Excel / WPS opens Chinese cleanly
  return "\uFEFF" + lines.join("\r\n");
}

// ---- 4. Standard A4 300DPI 2-Up (一页两张上下两联) Coordinate & Print Layout Engine ----

export function fitInvoiceAspectContain(srcWidth, srcHeight, slotBox) {
  const sw = Math.max(1, Number(srcWidth));
  const sh = Math.max(1, Number(srcHeight));
  const scale = Math.min(slotBox.width / sw, slotBox.height / sh);
  const drawWidth = Math.round(sw * scale);
  const drawHeight = Math.round(sh * scale);
  const drawX = Math.round(slotBox.x + (slotBox.width - drawWidth) / 2);
  const drawY = Math.round(slotBox.y + (slotBox.height - drawHeight) / 2);
  return { drawX, drawY, drawWidth, drawHeight, scale };
}

/**
 * Compute exact 300DPI A4 (`2480 × 3508 px`) 2-up top/bottom layout, dashed center cut line,
 * and bottom reimbursement summary bar for any list of valid invoices.
 */
export function computeA4TwoUpLayout(validInvoices = [], options = {}) {
  const pageWidth = Number(options.pageWidth ?? A4_300DPI.width);
  const pageHeight = Number(options.pageHeight ?? A4_300DPI.height);
  const marginX = Math.round(pageWidth * 0.048); // ~119px (~10mm safe print margin)
  const marginTop = Math.round(pageHeight * 0.032); // ~112px
  const footerHeight = Math.round(pageHeight * 0.046); // ~161px summary bar at bottom
  const marginBottom = Math.round(pageHeight * 0.026); // ~91px

  const usableHeight = pageHeight - marginTop - footerHeight - marginBottom;
  const centerCutY = Math.round(marginTop + usableHeight / 2);
  const cutZoneHalfGap = Math.round(pageHeight * 0.014); // ~49px breathing room around dashed cut line

  const slotWidth = pageWidth - marginX * 2;
  const topSlot = {
    slotIndex: 0,
    position: "top",
    x: marginX,
    y: marginTop,
    width: slotWidth,
    height: centerCutY - cutZoneHalfGap - marginTop,
  };
  const bottomSlot = {
    slotIndex: 1,
    position: "bottom",
    x: marginX,
    y: centerCutY + cutZoneHalfGap,
    width: slotWidth,
    height: marginTop + usableHeight - (centerCutY + cutZoneHalfGap),
  };

  const footerBox = {
    x: marginX,
    y: pageHeight - marginBottom - footerHeight,
    width: slotWidth,
    height: footerHeight,
  };

  const totalGrandAmount = roundMoney(
    validInvoices.reduce((s, inv) => s + Number(inv.totalAmount || 0), 0)
  );

  const pageCount = Math.max(1, Math.ceil(validInvoices.length / 2));
  const pages = [];

  for (let p = 0; p < pageCount; p += 1) {
    const pair = validInvoices.slice(p * 2, p * 2 + 2);
    const pageSubtotal = roundMoney(pair.reduce((s, inv) => s + Number(inv.totalAmount || 0), 0));

    pages.push({
      pageNumber: p + 1,
      totalPages: pageCount,
      pageWidth,
      pageHeight,
      centerCutLine: {
        x1: marginX,
        y: centerCutY,
        x2: pageWidth - marginX,
        dashPattern: [18, 14],
        label: "✂ 沿此虚线裁切 · A4 一页两联省纸装订线",
      },
      slots: [
        { ...topSlot, invoice: pair[0] || null },
        { ...bottomSlot, invoice: pair[1] || null },
      ],
      footerBar: {
        ...footerBox,
        claimant: options.claimant || "未填报销人",
        department: options.department || "默认部门",
        pageInvoiceCount: pair.length,
        pageSubtotal,
        totalValidCount: validInvoices.length,
        totalGrandAmount,
      },
    });
  }

  return {
    dpi: 300,
    pageWidth,
    pageHeight,
    pageCount,
    totalValidCount: validInvoices.length,
    totalGrandAmount,
    pages,
  };
}

// ---- 5. Offline Multi-Page PDF 1.4 Generator (for 300DPI A4 Print Sheets) ----

export function buildMultiPageJpegPdf(pages) {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error("At least one A4 page is required");
  }
  const enc = new TextEncoder();
  const chunks = [];
  let offset = 0;
  const pushBytes = (u8) => { chunks.push(u8); offset += u8.length; };
  const pushStr = (s) => pushBytes(enc.encode(s));

  const totalObjects = 2 + pages.length * 3;
  const offsets = new Array(totalObjects + 1).fill(0);

  pushStr("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");
  offsets[1] = offset;
  pushStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  offsets[2] = offset;
  pushStr(`2 0 obj\n<< /Type /Pages /Count ${pages.length} /Kids [ ${kids} ] >>\nendobj\n`);

  pages.forEach((p, i) => {
    const pageId = 3 + i * 3;
    const imgId = pageId + 1;
    const contentId = pageId + 2;
    const pw = Number(p.pageWidthPt ?? A4_300DPI.ptWidth).toFixed(2);
    const ph = Number(p.pageHeightPt ?? A4_300DPI.ptHeight).toFixed(2);
    const imgName = `/Im${i + 1}`;

    offsets[pageId] = offset;
    pushStr(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] ` +
        `/Resources << /XObject << ${imgName} ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
    );

    const jpeg = p.jpegBytes instanceof Uint8Array ? p.jpegBytes : new Uint8Array(p.jpegBytes);
    offsets[imgId] = offset;
    pushStr(
      `${imgId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${Math.round(p.widthPx)} /Height ${Math.round(p.heightPx)} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
    );
    pushBytes(jpeg);
    pushStr("\nendstream\nendobj\n");

    const cmd = `q\n${pw} 0 0 ${ph} 0 0 cm\n${imgName} Do\nQ\n`;
    const cmdBytes = enc.encode(cmd);
    offsets[contentId] = offset;
    pushStr(`${contentId} 0 obj\n<< /Length ${cmdBytes.length} >>\nstream\n`);
    pushBytes(cmdBytes);
    pushStr("endstream\nendobj\n");
  });

  const xrefPos = offset;
  pushStr(`xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= totalObjects; id += 1) {
    pushStr(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  const out = new Uint8Array(offset);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out;
}
