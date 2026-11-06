const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Load .env manually (zero external dependencies required for VPS deployment)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

const PORT = Number(process.env.PORT || 3000);
const SICKW_API_KEY = process.env.SICKW_API_KEY || '';
const SICKW_BASE_URL = process.env.SICKW_BASE_URL || 'https://sickw.com/api.php';

const DATA_DIR = path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const CATALOG_FILE = path.join(__dirname, 'docs', 'services-catalog.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, '[]', 'utf8');
}

function loadCatalog() {
  try {
    if (fs.existsSync(CATALOG_FILE)) {
      const raw = fs.readFileSync(CATALOG_FILE, 'utf8').replace(/^\uFEFF/, '');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error loading catalog:', err.message);
  }
  return [];
}

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const raw = fs.readFileSync(HISTORY_FILE, 'utf8').replace(/^\uFEFF/, '');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error loading history:', err.message);
  }
  return [];
}

function saveHistoryItem(item) {
  try {
    const history = loadHistory();
    history.unshift(item);
    const trimmed = history.slice(0, 500);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving history:', err.message);
  }
}

function fetchUrl(targetUrl, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const req = https.get(targetUrl, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Tiempo de espera agotado al conectar con Sickw API'));
    });
    req.on('error', (err) => reject(err));
  });
}

function stripHtmlTags(str) {
  if (!str) return '';
  return String(str)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function cleanFieldKeyAndExtractImei(rawKey) {
  let key = String(rawKey || '').trim();
  let embeddedImei = null;

  // Handle keys prefixed with IMEI or Serial, e.g. "359886434930995 Find My iPhone"
  const prefixMatch = key.match(/^([0-9A-Z]{10,18})\s+(.+)$/i);
  if (prefixMatch && /\d{6,}/.test(prefixMatch[1])) {
    embeddedImei = prefixMatch[1];
    key = prefixMatch[2].trim();
  }
  return { key, embeddedImei };
}

function classifyFieldBadge(key, value) {
  const k = String(key || '').toLowerCase();
  const v = String(value || '').replace(/\*Optional info.*/i, '').trim();

  // Locks: iCloud, Find My, MDM, Knox Guard, Mi Activation Lock
  if (/(find my|icloud lock|mdm|knox guard|kg status|mi activation lock|mi lock|activation lock)/i.test(k)) {
    if (/^(off|disabled|none|normal|unlocked|clean)$/i.test(v)) return 'ok';
    if (/^(on|enabled|active|locked|enrolled|prenormal|blink|lost)$/i.test(v)) return 'fail';
  }

  // iCloud Status (Clean vs Lost/Erased)
  if (/icloud status/i.test(k)) {
    if (/^clean$/i.test(v)) return 'ok';
    if (/(lost|erased|stolen)/i.test(v)) return 'fail';
  }

  // Sim-Lock / Carrier Unlock
  if (/(sim-lock|sim lock|unlock status|lock status)/i.test(k)) {
    if (/(unlocked|unlock|sim-free|free)/i.test(v)) return 'ok';
    if (/\blocked\b/i.test(v)) return 'fail';
  }

  // Blacklist / GSMA
  if (/(blacklist|gsma|barred)/i.test(k)) {
    if (/^clean$/i.test(v)) return 'ok';
    if (/(blacklisted|stolen|lost|barred|fraud|blocked)/i.test(v)) return 'fail';
  }

  // Replaced / Refurbished / Loaner / Demo
  if (/(replaced|replacement|refurbished|loaner|demo unit|board swapped)/i.test(k)) {
    if (/^no$/i.test(v)) return 'ok';
    if (/^yes$/i.test(v)) return 'warn';
  }

  // Warranty
  if (/(warranty status|coverage status|repairs and service coverage)/i.test(k)) {
    if (/(active|limited warranty|applecare)/i.test(v) && !/out of|expired/i.test(v)) return 'ok';
    if (/(out of warranty|expired|no coverage)/i.test(v)) return 'warn';
  }

  return null;
}

function parseSickwResult(rawResult, serviceMeta, imeiInput) {
  let rawText = '';
  const fields = [];
  const extraSections = [];
  let detectedImeiFromPrefix = null;

  if (rawResult && typeof rawResult === 'object' && !Array.isArray(rawResult)) {
    for (const [k, v] of Object.entries(rawResult)) {
      const cleanVal = stripHtmlTags(String(v)).trim();
      const { key, embeddedImei } = cleanFieldKeyAndExtractImei(k);
      if (embeddedImei && !detectedImeiFromPrefix) detectedImeiFromPrefix = embeddedImei;
      fields.push({ key, value: cleanVal, badge: classifyFieldBadge(key, cleanVal) });
      rawText += `${k}: ${cleanVal}\n`;
    }
  } else {
    rawText = stripHtmlTags(String(rawResult || '')).trim();
    const lines = rawText.split(/\r?\n/);
    let currentSection = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (/^(Case Details|Replacement History|Possible Messages|Service Info|Supported Status|Not Supported Status|Note:?|Updates:?)$/i.test(line)) {
        currentSection = { title: line.replace(/:$/, ''), items: [] };
        extraSections.push(currentSection);
        continue;
      }

      const colonIdx = line.indexOf(':');
      if (!currentSection && colonIdx > 0 && colonIdx < 65) {
        const rawKey = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        if (rawKey && value) {
          const { key, embeddedImei } = cleanFieldKeyAndExtractImei(rawKey);
          if (embeddedImei && !detectedImeiFromPrefix) detectedImeiFromPrefix = embeddedImei;
          fields.push({ key, value, badge: classifyFieldBadge(key, value) });
          continue;
        }
      }

      // Also support "355313080638xxx - Unlocked" format
      const dashMatch = !currentSection && line.match(/^([0-9A-Z]{10,18})\s+-\s+(.+)$/i);
      if (dashMatch) {
        detectedImeiFromPrefix = detectedImeiFromPrefix || dashMatch[1];
        const val = dashMatch[2].trim();
        fields.push({ key: 'Status', value: val, badge: classifyFieldBadge('Status', val) });
        continue;
      }

      if (currentSection) {
        currentSection.items.push(line);
      } else {
        fields.push({ key: 'Resultado', value: line, badge: null });
      }
    }
  }

  // Flexible field finder (matches key anywhere, case-insensitive)
  const findField = (regex) => {
    const found = fields.find((f) => regex.test(f.key));
    return found ? found.value : null;
  };

  // Extract Hardware Identity
  const identity = {
    model:
      findField(/^(Model Name|Model Description|Model|Description|Product Description|Config Description|Full Name|Model Desc)$/i) ||
      findField(/(Model Name|Model Description|Product Description)/i) ||
      null,
    brand:
      findField(/^(Manufacturer|Brand)$/i) ||
      (serviceMeta && /APPLE|IPHONE|ICLOUD|MACBOOK|IPAD|GSX/i.test(serviceMeta.name)
        ? 'APPLE'
        : serviceMeta && /SAMSUNG|KNOX/i.test(serviceMeta.name)
        ? 'SAMSUNG'
        : serviceMeta && /XIAOMI|REDMI|POCO/i.test(serviceMeta.name)
        ? 'XIAOMI'
        : null),
    modelCode: findField(/^(Model Code|Model Number|Config Code|Part Number|MPN|Basic Material|SKU)$/i),
    imei: findField(/^(IMEI|IMEI Number|IMEI1|DeviceID|Search Term)$/i) || detectedImeiFromPrefix || imeiInput,
    imei2: findField(/^(IMEI2|IMEI2 Number|Secondary IMEI)$/i),
    meid: findField(/^(MEID|MEID Number)$/i),
    serial: findField(/^(Serial|Serial Number|SN)$/i),
    carrier: findField(/^(Locked Carrier|Carrier|Sold To Name|Product Sold By|Sales Buyer Name|Company|Network)$/i),
    country: findField(/^(Purchase Country|Purchase Country Desc|Purchase Country Code|Sold By Country|Country)$/i),
    purchaseDate: findField(/^(Estimated Purchase Date|Purchase Date|Sold Date|Activation Date|First Activation Date|Production Date)$/i)
  };

  // Build Traffic-Light Diagnostics (Semáforo)
  const diagnostics = [];

  // 1. iCloud / Find My (matches even if key had prefix before)
  const fmiRaw = findField(/(Find My iPhone|Find My iPad|Find My Mac|Find My Device|iCloud Lock|^iCloud$)/i);
  const icloudStatusRaw = findField(/(iCloud Status)/i);
  if (fmiRaw || icloudStatusRaw) {
    const combined = [fmiRaw, icloudStatusRaw].filter(Boolean).join(' · ').replace(/\*Optional info.*/gi, '').trim();
    const isOff = /\bOFF\b/i.test(fmiRaw || '');
    const isLost = /\b(LOST|ERASED|STOLEN)\b/i.test(combined);
    const isOn = /\bON\b/i.test(fmiRaw || '') || isLost;
    diagnostics.push({
      id: 'icloud',
      label: 'iCloud / Find My',
      value: combined,
      status: isOff && !isLost ? 'ok' : isOn ? 'fail' : 'warn',
      summary: isOff && !isLost ? 'VERDE · Desactivado (Libre)' : isLost ? 'ROJO · Modo Perdido (LOST)' : 'ROJO · Cuenta Activa (ON)'
    });
  }

  // 2. Sim-Lock / Carrier Lock
  const simLockRaw = findField(/(Sim-Lock|SIM Lock|Sim Lock|Sim-Lock Status|Unlock Status)/i);
  if (simLockRaw) {
    const cleanSim = simLockRaw.replace(/\*Optional info.*/gi, '').trim();
    const isUnlocked = /\b(Unlocked|UNLOCK|Sim-Free|Free)\b/i.test(cleanSim);
    const isLocked = /\b(Locked|LOCKED)\b/i.test(cleanSim) && !isUnlocked;
    diagnostics.push({
      id: 'simlock',
      label: 'Sim-Lock (Operador)',
      value: cleanSim,
      status: isUnlocked ? 'ok' : isLocked ? 'fail' : 'warn',
      summary: isUnlocked ? 'VERDE · Libre de Fábrica' : isLocked ? 'ROJO · Bloqueado de Operador' : cleanSim
    });
  }

  // 3. Blacklist / GSMA Status
  const blacklistRaw = findField(/(Blacklist Status|GSMA Status|Blacklist Report|Worldwide Blacklist|^Blacklist$)/i);
  if (blacklistRaw) {
    const cleanBl = blacklistRaw.replace(/\*Optional info.*/gi, '').trim();
    const isClean = /\b(Clean)\b/i.test(cleanBl) && !/\b(Not Clean|Blacklisted|Stolen|Lost|Barred|Fraud)\b/i.test(cleanBl);
    const isBad = /\b(Blacklisted|Stolen|Lost|Barred|Fraud|Blocked)\b/i.test(cleanBl);
    diagnostics.push({
      id: 'blacklist',
      label: 'Reporte Blacklist',
      value: cleanBl,
      status: isClean ? 'ok' : isBad ? 'fail' : 'warn',
      summary: isClean ? 'VERDE · Sin Reporte (Clean)' : isBad ? 'ROJO · Reportado en Lista Negra' : cleanBl
    });
  }

  // 4. MDM / Knox Guard / Mi Lock
  const mdmRaw = findField(/(MDM Lock|MDM Status|Mobile Device Management|Knox Guard|KG Status|MI Activation Lock|Mi Lock)/i);
  if (mdmRaw) {
    const cleanMdm = mdmRaw.replace(/\*Optional info.*/gi, '').trim();
    const isOff = /\b(OFF|NONE|CLEAN|COMPLETED|NORMAL|UNLOCKED)\b/i.test(cleanMdm) && !/\b(ON|LOCKED|ACTIVE)\b/i.test(cleanMdm);
    const isOn = /\b(ON|LOCKED|ACTIVE|ENROLLED|PRENORMAL|BLINK)\b/i.test(cleanMdm);
    diagnostics.push({
      id: 'mdm',
      label: 'Bloqueo MDM / Knox / Mi',
      value: cleanMdm,
      status: isOff ? 'ok' : isOn ? 'fail' : 'warn',
      summary: isOff ? 'VERDE · Sin Bloqueo' : 'ROJO · Bloqueo Activo'
    });
  }

  // 5. Warranty / Coverage
  const warrantyRaw = findField(/(Coverage Status|Warranty Status Description|Warranty Status|^Warranty$)/i);
  if (warrantyRaw) {
    const cleanWar = warrantyRaw.replace(/\*Optional info.*/gi, '').trim();
    const isExpired = /\b(Out Of Warranty|Expired|No Coverage|No)\b/i.test(cleanWar);
    const isActive = /\b(Limited Warranty|AppleCare|Active|In Warranty|Valid)\b/i.test(cleanWar) && !isExpired;
    diagnostics.push({
      id: 'warranty',
      label: 'Garantía Oficial',
      value: cleanWar,
      status: isActive ? 'ok' : isExpired ? 'neutral' : 'warn',
      summary: isActive ? 'Garantía Vigente' : isExpired ? 'Fuera de Garantía' : cleanWar
    });
  }

  // 6. Replaced / Refurbished
  const replacedRaw = findField(/(Replaced Device|^Replaced$|^Refurbished$|Refurbished Device)/i);
  if (replacedRaw) {
    const cleanRep = replacedRaw.replace(/\*Optional info.*/gi, '').trim();
    const isNo = /\bNO\b/i.test(cleanRep);
    const isYes = /\bYES\b/i.test(cleanRep);
    diagnostics.push({
      id: 'replaced',
      label: 'Equipo Reemplazado',
      value: cleanRep,
      status: isNo ? 'ok' : isYes ? 'warn' : 'neutral',
      summary: isNo ? 'Original (No Reemplazado)' : 'Unidad de Reemplazo'
    });
  }

  // Compute Executive Verdict (Green = OK/OFF/Clean, Red = ON/Locked/Blacklisted)
  const criticalFails = diagnostics.filter((d) => ['icloud', 'blacklist', 'mdm'].includes(d.id) && d.status === 'fail');
  const simFail = diagnostics.find((d) => d.id === 'simlock' && d.status === 'fail');
  const okItems = diagnostics.filter((d) => d.status === 'ok');

  let verdict = {
    status: 'neutral',
    title: 'DIAGNÓSTICO COMPLETADO',
    subtitle: 'Revisa los parámetros técnicos devueltos para este equipo.'
  };

  if (criticalFails.length > 0) {
    const labels = criticalFails.map((c) => `${c.label}: ${c.value}`).join(' · ');
    verdict = {
      status: 'fail',
      title: `EN ROJO · BLOQUEO ACTIVO (${criticalFails[0].value.toUpperCase()})`,
      subtitle: `Atención: ${labels}. No recibir o verificar cuenta antes de comprar.`
    };
  } else if (simFail) {
    verdict = {
      status: 'warn',
      title: 'EQUIPO CON SIM-LOCK DE OPERADOR',
      subtitle: `Sin bloqueos de cuenta/reporte, pero bloqueado con operador (${identity.carrier || simFail.value}).`
    };
  } else if (okItems.length > 0) {
    const mainOk = okItems.map((c) => `${c.label}: ${c.value}`).join(' · ');
    verdict = {
      status: 'ok',
      title: `EN VERDE · EQUIPO LIBRE (${okItems[0].value.toUpperCase()})`,
      subtitle: `Verificado correctamente: ${mainOk}.`
    };
  }

  return {
    rawText,
    fields,
    extraSections,
    identity,
    diagnostics,
    verdict
  };
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('JSON inválido en la petición'));
      }
    });
    req.on('error', reject);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // 1. GET /api/balance
    if (req.method === 'GET' && pathname === '/api/balance') {
      const url = `${SICKW_BASE_URL}?action=balance&key=${encodeURIComponent(SICKW_API_KEY)}`;
      const resp = await fetchUrl(url, 15000);
      const text = (resp.body || '').trim();
      const isNumeric = /^-?\d+(\.\d+)?$/.test(text);
      if (!isNumeric) {
        return sendJson(res, 400, { ok: false, error: text || 'Respuesta inesperada de Sickw' });
      }
      return sendJson(res, 200, { ok: true, balance: Number(text).toFixed(2), rawBalance: text });
    }

    // 2. GET /api/services
    if (req.method === 'GET' && pathname === '/api/services') {
      const catalog = loadCatalog();
      const flatMap = new Map();
      for (const group of catalog) {
        for (const svc of group.services || []) {
          flatMap.set(String(svc.id), { ...svc, category: group.category });
        }
      }
      return sendJson(res, 200, {
        ok: true,
        catalog,
        totalServices: flatMap.size
      });
    }

    // 3. GET /api/history
    if (req.method === 'GET' && pathname === '/api/history') {
      const q = (parsedUrl.searchParams.get('q') || '').trim().toLowerCase();
      let items = loadHistory();
      if (q) {
        items = items.filter(
          (item) =>
            String(item.imei || '').toLowerCase().includes(q) ||
            String(item.orderId || '').toLowerCase().includes(q) ||
            String(item.serviceName || '').toLowerCase().includes(q) ||
            String(item.parsed?.identity?.model || '').toLowerCase().includes(q)
        );
      }
      return sendJson(res, 200, { ok: true, items: items.slice(0, 100) });
    }

    // 4. GET /api/history/remote?imei=...
    if (req.method === 'GET' && pathname === '/api/history/remote') {
      const imei = (parsedUrl.searchParams.get('imei') || '').replace(/[^a-zA-Z0-9]/g, '');
      if (!imei) {
        return sendJson(res, 400, { ok: false, error: 'Ingresa un IMEI u Order ID para buscar en Sickw.' });
      }
      const url = `${SICKW_BASE_URL}?format=json&key=${encodeURIComponent(SICKW_API_KEY)}&imei=${encodeURIComponent(imei)}&action=history`;
      const resp = await fetchUrl(url, 20000);
      let data;
      try {
        data = JSON.parse(resp.body);
      } catch {
        data = { status: 'raw', result: resp.body };
      }
      return sendJson(res, 200, { ok: true, data });
    }

    // 5. POST /api/check
    if (req.method === 'POST' && pathname === '/api/check') {
      const body = await readJsonBody(req);
      const rawImei = String(body.imei || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const serviceId = String(body.service || '').trim();
      const mode = body.mode === 'sample' ? 'sample' : 'live';

      if (!serviceId) {
        return sendJson(res, 400, { ok: false, error: 'Selecciona un servicio de consulta.' });
      }

      // Find service metadata from catalog
      const catalog = loadCatalog();
      let serviceMeta = { id: serviceId, name: serviceId === 'demo' ? 'DEMO TEST SERVICE' : `Servicio #${serviceId}`, price: '0.00', category: 'General' };
      for (const group of catalog) {
        const found = (group.services || []).find((s) => String(s.id) === serviceId);
        if (found) {
          serviceMeta = { ...found, category: group.category };
          break;
        }
      }

      // Mode "sample": preview official sample output without spending balance
      if (mode === 'sample') {
        const sampleText = serviceMeta.sample || 'IMEI: 354442067957452\nManufacturer: APPLE\nModel Name: IPHONE 15 PRO MAX 256GB\nFind My iPhone: OFF\nSim-Lock: Unlocked\nBlacklist Status: Clean';
        const parsed = parseSickwResult(sampleText, serviceMeta, rawImei || '354442067957452');
        const record = {
          id: `SAMPLE-${Date.now()}`,
          orderId: 'MUESTRA-SIN-COSTO',
          timestamp: new Date().toISOString(),
          mode: 'sample',
          imei: rawImei || parsed.identity.imei || '354442067957452',
          serviceId,
          serviceName: serviceMeta.name,
          price: '0.00',
          status: 'success',
          parsed
        };
        return sendJson(res, 200, { ok: true, record });
      }

      // Validate IMEI/Serial length for live API call
      if (rawImei.length < 10 || rawImei.length > 18) {
        return sendJson(res, 400, {
          ok: false,
          error: 'El IMEI o Número de Serie debe tener entre 10 y 15 caracteres alfanuméricos.'
        });
      }

      // Live API call to Sickw
      const apiUrl = `${SICKW_BASE_URL}?format=json&key=${encodeURIComponent(SICKW_API_KEY)}&imei=${encodeURIComponent(rawImei)}&service=${encodeURIComponent(serviceId)}`;
      const resp = await fetchUrl(apiUrl, 60000);

      let apiData;
      try {
        apiData = JSON.parse(resp.body);
      } catch {
        apiData = {
          status: resp.body && /Error|Wrong|Low Balance|Not Found/i.test(resp.body) ? 'error' : 'success',
          result: resp.body,
          imei: rawImei
        };
      }

      if (apiData.status === 'error' || /^(Error\s+[A-Z]\d+|IMEI is Wrong|API KEY is Wrong|Low Balance)/i.test(stripHtmlTags(apiData.result || ''))) {
        const errMsg = stripHtmlTags(apiData.result || 'Error devuelto por Sickw API').trim();
        return sendJson(res, 400, {
          ok: false,
          error: errMsg,
          raw: apiData
        });
      }

      const parsed = parseSickwResult(apiData.result, serviceMeta, rawImei);
      const record = {
        id: `CHK-${Date.now()}`,
        orderId: apiData.id || `ORD-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toISOString(),
        mode: 'live',
        imei: rawImei,
        serviceId,
        serviceName: serviceMeta.name,
        price: apiData.price !== undefined ? String(apiData.price) : serviceMeta.price,
        balanceAfter: apiData.balance || null,
        status: apiData.status || 'success',
        parsed
      };

      saveHistoryItem(record);
      return sendJson(res, 200, { ok: true, record });
    }

    // Serve static files from /public
    const publicDir = path.join(__dirname, 'public');
    let filePath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);
    if (!filePath.startsWith(publicDir)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      return fs.createReadStream(filePath).pipe(res);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No encontrado');
  } catch (err) {
    console.error('Server error:', err);
    sendJson(res, 500, { ok: false, error: err.message || 'Error interno del servidor' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Sickw Store Diagnostic Server running at http://0.0.0.0:${PORT}`);
});

if (process.env.DOCKER === 'true' && PORT !== 80) {
  http.createServer(server.listeners('request')[0]).listen(80, '0.0.0.0', () => {
    console.log('Easypanel compatibility listener active on port 80');
  });
}
