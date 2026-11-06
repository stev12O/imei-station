(function () {
  'use strict';

  // Quick presets tailored for phone store managers ("los jefes")
  const QUICK_PRESETS = [
    { id: '61', title: 'iPhone Completo', desc: 'Carrier + iCloud + Blacklist', price: '0.10', category: 'Apple Check Services' },
    { id: '3', title: 'iCloud ON/OFF', desc: 'Estado Find My iPhone', price: '0.02', category: 'Apple Check Services' },
    { id: '103', title: 'iPhone Carrier', desc: 'Operador + Sim-Lock + Garantía', price: '0.06', category: 'Apple Check Services' },
    { id: '72', title: 'Apple MDM + iCloud', desc: 'MDM + iCloud + Políticas GSX', price: '0.30', category: 'Apple Check Services' },
    { id: '146', title: 'Apple GSX Promo', desc: 'Casos, reemplazos y políticas', price: '0.60', category: 'Apple Check Services' },
    { id: '54', title: 'Blacklist Mundial', desc: 'Reporte robo/extravío global', price: '0.04', category: 'Status Check Services' },
    { id: '1', title: 'Samsung Info Pro', desc: 'Modelo, operador y garantía', price: '0.10', category: 'Generic Services' },
    { id: '82', title: 'Samsung Knox Guard', desc: 'Estado bloqueo financiero KG', price: '0.30', category: 'Generic Services' },
    { id: '206', title: 'Xiaomi Mi Lock', desc: 'Cuenta Mi Cloud ON/OFF', price: '0.10', category: 'Generic Services' },
    { id: 'demo', title: 'Test Demo Gratis', desc: 'Prueba en vivo sin costo', price: '0.00', category: 'Demo' }
  ];

  // State
  let selectedService = { ...QUICK_PRESETS[0] };
  let fullCatalog = [];
  let currentRecord = null;
  let html5QrScanner = null;
  let camerasList = [];
  let currentCameraIdx = 0;

  // DOM Elements
  const balanceBtn = document.getElementById('balanceBtn');
  const balanceValue = document.getElementById('balanceValue');
  const balanceDot = document.getElementById('balanceDot');

  const tabChecker = document.getElementById('tabChecker');
  const tabHistory = document.getElementById('tabHistory');
  const viewChecker = document.getElementById('viewChecker');
  const viewHistory = document.getElementById('viewHistory');
  const historyCount = document.getElementById('historyCount');

  const checkForm = document.getElementById('checkForm');
  const imeiInput = document.getElementById('imeiInput');
  const clearImeiBtn = document.getElementById('clearImeiBtn');
  const pasteBtn = document.getElementById('pasteBtn');
  const validationBadge = document.getElementById('validationBadge');
  const imeiPreview = document.getElementById('imeiPreview');
  const imeiFormattedText = document.getElementById('imeiFormattedText');

  const quickPresetsEl = document.getElementById('quickPresets');
  const selectedServiceIdEl = document.getElementById('selectedServiceId');
  const selectedServiceNameEl = document.getElementById('selectedServiceName');
  const selectedServiceCategoryEl = document.getElementById('selectedServiceCategory');
  const selectedServicePriceEl = document.getElementById('selectedServicePrice');
  const totalServicesCountEl = document.getElementById('totalServicesCount');

  const sampleBtn = document.getElementById('sampleBtn');
  const submitCheckBtn = document.getElementById('submitCheckBtn');
  const submitBtnText = document.getElementById('submitBtnText');

  const errorBanner = document.getElementById('errorBanner');
  const errorTitle = document.getElementById('errorTitle');
  const errorMessage = document.getElementById('errorMessage');
  const closeErrorBtn = document.getElementById('closeErrorBtn');

  const diagnosticContainer = document.getElementById('diagnosticContainer');
  const verdictBanner = document.getElementById('verdictBanner');
  const verdictIcon = document.getElementById('verdictIcon');
  const resultModeBadge = document.getElementById('resultModeBadge');
  const resultTimestamp = document.getElementById('resultTimestamp');
  const resultOrderId = document.getElementById('resultOrderId');
  const resultCost = document.getElementById('resultCost');
  const verdictTitle = document.getElementById('verdictTitle');
  const verdictSubtitle = document.getElementById('verdictSubtitle');
  const copyWhatsappBtn = document.getElementById('copyWhatsappBtn');
  const copyWhatsappText = document.getElementById('copyWhatsappText');
  const printSheetBtn = document.getElementById('printSheetBtn');

  const hwBrand = document.getElementById('hwBrand');
  const hwModel = document.getElementById('hwModel');
  const hwSub = document.getElementById('hwSub');
  const hwIdentifiers = document.getElementById('hwIdentifiers');

  const semaforoSection = document.getElementById('semaforoSection');
  const semaforoGrid = document.getElementById('semaforoGrid');
  const specsGrid = document.getElementById('specsGrid');
  const extraSectionsContainer = document.getElementById('extraSectionsContainer');
  const toggleRawBtn = document.getElementById('toggleRawBtn');
  const rawOutputBox = document.getElementById('rawOutputBox');

  const historySearchInput = document.getElementById('historySearchInput');
  const remoteHistoryBtn = document.getElementById('remoteHistoryBtn');
  const historyList = document.getElementById('historyList');

  const openScannerBtn = document.getElementById('openScannerBtn');
  const scannerModal = document.getElementById('scannerModal');
  const closeScannerBtn = document.getElementById('closeScannerBtn');
  const scannerStatus = document.getElementById('scannerStatus');
  const photoScanInput = document.getElementById('photoScanInput');
  const torchBtn = document.getElementById('torchBtn');
  let torchEnabled = false;

  const openCatalogBtn = document.getElementById('openCatalogBtn');
  const catalogModal = document.getElementById('catalogModal');
  const closeCatalogBtn = document.getElementById('closeCatalogBtn');
  const catalogSearchInput = document.getElementById('catalogSearchInput');
  const catalogList = document.getElementById('catalogList');

  // --- Luhn Checksum Algorithm for 15-digit IMEIs ---
  function computeLuhnCheckDigit(first14) {
    let sum = 0;
    for (let i = 0; i < 14; i++) {
      let d = parseInt(first14.charAt(i), 10);
      if (i % 2 === 1) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
    }
    return (10 - (sum % 10)) % 10;
  }

  function formatImeiReadable(digits) {
    if (digits.length !== 15) return digits;
    return `${digits.slice(0, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 14)} ${digits.slice(14)}`;
  }

  function updateImeiValidation() {
    const raw = imeiInput.value;
    const clean = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    clearImeiBtn.hidden = raw.length === 0;

    if (!clean) {
      validationBadge.removeAttribute('data-state');
      validationBadge.textContent = 'Marca *#06# en el teléfono o escanea la caja';
      imeiPreview.hidden = true;
      return;
    }

    const isAllDigits = /^\d+$/.test(clean);

    if (isAllDigits) {
      if (clean.length === 15) {
        const expected = computeLuhnCheckDigit(clean.slice(0, 14));
        const actual = parseInt(clean.charAt(14), 10);
        imeiPreview.hidden = false;
        imeiFormattedText.textContent = formatImeiReadable(clean);

        if (expected === actual) {
          validationBadge.setAttribute('data-state', 'valid');
          validationBadge.textContent = '✓ IMEI de 15 dígitos · Luhn válido';
        } else {
          validationBadge.setAttribute('data-state', 'invalid');
          validationBadge.textContent = `⚠ Dígito verificador inválido (debería terminar en ${expected})`;
        }
      } else {
        imeiPreview.hidden = true;
        validationBadge.removeAttribute('data-state');
        validationBadge.textContent = `IMEI numérico (${clean.length}/15 dígitos)`;
      }
    } else {
      imeiPreview.hidden = true;
      if (clean.length >= 10 && clean.length <= 15) {
        validationBadge.setAttribute('data-state', 'serial');
        validationBadge.textContent = `Número de Serie detectado (${clean.length} caracteres)`;
      } else {
        validationBadge.removeAttribute('data-state');
        validationBadge.textContent = `Alfanumérico (${clean.length} caracteres)`;
      }
    }
  }

  // --- Render Quick Presets & Selected Service ---
  function renderQuickPresets() {
    quickPresetsEl.innerHTML = '';
    for (const preset of QUICK_PRESETS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `preset-chip${String(selectedService.id) === String(preset.id) ? ' active' : ''}`;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', String(selectedService.id) === String(preset.id) ? 'true' : 'false');
      btn.innerHTML = `
        <div class="preset-left">
          <span class="preset-title">${escapeHtml(preset.title)}</span>
          <span class="preset-desc">${escapeHtml(preset.desc)}</span>
        </div>
        <span class="preset-price">$${escapeHtml(preset.price)}</span>
      `;
      btn.addEventListener('click', () => {
        selectService({
          id: preset.id,
          name: preset.title.toUpperCase() + ' · ' + preset.desc,
          price: preset.price,
          category: preset.category
        });
      });
      quickPresetsEl.appendChild(btn);
    }
  }

  function selectService(svc) {
    selectedService = svc;
    selectedServiceIdEl.textContent = svc.id === 'demo' ? 'DEMO' : `#${svc.id}`;
    selectedServiceNameEl.textContent = svc.name;
    selectedServiceCategoryEl.textContent = svc.category || 'Sickw API';
    selectedServicePriceEl.textContent = svc.price === '0.00' || svc.id === 'demo' ? 'GRATIS' : `$${svc.price}`;
    renderQuickPresets();
  }

  // --- Fetch Live Balance ---
  async function refreshBalance() {
    balanceBtn.classList.add('loading');
    try {
      const res = await fetch('/api/balance');
      const data = await res.json();
      if (data.ok) {
        balanceValue.textContent = `$${data.balance}`;
        balanceDot.style.backgroundColor = parseFloat(data.balance) > 1 ? 'var(--ok-dot)' : 'var(--warn-dot)';
      } else {
        balanceValue.textContent = 'Error';
        balanceDot.style.backgroundColor = 'var(--fail-dot)';
      }
    } catch {
      balanceValue.textContent = 'Offline';
      balanceDot.style.backgroundColor = 'var(--fail-dot)';
    } finally {
      balanceBtn.classList.remove('loading');
    }
  }

  // --- Load Full Catalog ---
  async function loadServicesCatalog() {
    try {
      const res = await fetch('/api/services');
      const data = await res.json();
      if (data.ok && Array.isArray(data.catalog)) {
        fullCatalog = data.catalog;
        totalServicesCountEl.textContent = data.totalServices || 94;
        renderCatalogModalList('');
      }
    } catch (err) {
      console.error('Error loading catalog:', err);
    }
  }

  function renderCatalogModalList(query) {
    const q = (query || '').trim().toLowerCase();
    catalogList.innerHTML = '';

    for (const group of fullCatalog) {
      const matching = (group.services || []).filter(
        (s) =>
          !q ||
          String(s.id).toLowerCase().includes(q) ||
          String(s.name).toLowerCase().includes(q) ||
          String(group.category).toLowerCase().includes(q)
      );
      if (matching.length === 0) continue;

      const groupWrap = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'catalog-group-title';
      title.textContent = `${group.category} (${matching.length})`;
      groupWrap.appendChild(title);

      for (const svc of matching) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'catalog-item';
        item.innerHTML = `
          <div class="catalog-item-left">
            <span class="catalog-id">#${escapeHtml(svc.id)}</span>
            <span class="catalog-name">${escapeHtml(svc.name)}</span>
          </div>
          <span class="catalog-price">$${escapeHtml(svc.price)}</span>
        `;
        item.addEventListener('click', () => {
          selectService({
            id: svc.id,
            name: svc.name,
            price: svc.price,
            category: group.category
          });
          catalogModal.hidden = true;
        });
        groupWrap.appendChild(item);
      }

      catalogList.appendChild(groupWrap);
    }
  }

  // --- Execute Check (Live or Sample) ---
  async function runCheck(mode) {
    errorBanner.hidden = true;
    const rawImei = imeiInput.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    if (mode === 'live' && rawImei.length < 10) {
      showError('Falta el IMEI o Número de Serie', 'Escribe, pega o escanea los 15 dígitos del IMEI (o Serie de 10-14 caracteres) antes de consultar.');
      imeiInput.focus();
      return;
    }

    submitCheckBtn.disabled = true;
    sampleBtn.disabled = true;
    const prevBtnText = submitBtnText.textContent;
    submitBtnText.textContent = mode === 'sample' ? 'Cargando muestra...' : 'Consultando Sickw...';

    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imei: rawImei || '354442067957452',
          service: selectedService.id,
          mode
        })
      });
      const data = await res.json();

      if (!data.ok) {
        showError('Respuesta de Sickw API', data.error || 'No se pudo procesar la consulta.');
        return;
      }

      currentRecord = data.record;
      renderDiagnosticCard(data.record);

      if (data.record.balanceAfter) {
        balanceValue.textContent = `$${Number(data.record.balanceAfter).toFixed(2)}`;
      } else if (mode === 'live') {
        refreshBalance();
      }
      loadHistoryList();
    } catch (err) {
      showError('Error de conexión', err.message || 'No fue posible comunicarse con el servidor.');
    } finally {
      submitCheckBtn.disabled = false;
      sampleBtn.disabled = false;
      submitBtnText.textContent = prevBtnText;
    }
  }

  function showError(title, msg) {
    errorTitle.textContent = title;
    errorMessage.textContent = msg;
    errorBanner.hidden = false;
  }

  // --- Render Visual Diagnostic Sheet ---
  function renderDiagnosticCard(record) {
    const parsed = record.parsed || {};
    const verdict = parsed.verdict || { status: 'neutral', title: 'RESULTADO', subtitle: '' };
    const id = parsed.identity || {};
    const diagnostics = parsed.diagnostics || [];
    const fields = parsed.fields || [];
    const extraSections = parsed.extraSections || [];

    verdictBanner.setAttribute('data-status', verdict.status || 'neutral');
    const verdictSvgMap = {
      ok: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
      warn: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      fail: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
      neutral: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
    };
    verdictIcon.innerHTML = verdictSvgMap[verdict.status] || verdictSvgMap.neutral;

    resultModeBadge.textContent = record.mode === 'sample' ? 'VISTA PREVIA · SIN COSTO' : `SERVICIO #${record.serviceId}`;
    resultTimestamp.textContent = formatDateTime(record.timestamp);
    resultOrderId.textContent = record.orderId && record.mode !== 'sample' ? `Orden #${record.orderId}` : '';
    resultCost.textContent = record.mode === 'sample' ? '$0.00' : record.price ? `Costo: $${record.price}` : '';

    verdictTitle.textContent = String(verdict.title || '').replace(/^(EN\s+)?(VERDE|ROJO)\s*·\s*/i, '');
    verdictSubtitle.textContent = verdict.subtitle;

    // Hardware identity
    hwBrand.textContent = id.brand || record.serviceName || 'EQUIPO';
    hwModel.textContent = id.model || `IMEI ${record.imei}`;
    const subParts = [id.modelCode, id.carrier, id.country, id.purchaseDate ? `Compra: ${id.purchaseDate}` : null].filter(Boolean);
    hwSub.textContent = subParts.join(' · ');

    // Copyable identifiers
    hwIdentifiers.innerHTML = '';
    const idPairs = [
      { label: 'IMEI Principal', val: id.imei || record.imei },
      { label: 'IMEI 2 (eSIM)', val: id.imei2 },
      { label: 'No. Serie (SN)', val: id.serial },
      { label: 'MEID', val: id.meid }
    ].filter((x) => x.val);

    for (const pair of idPairs) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'copy-id-chip';
      chip.title = 'Clic para copiar';
      chip.innerHTML = `
        <span>${escapeHtml(pair.label)}</span>
        <code>${escapeHtml(pair.val)}</code>
      `;
      chip.addEventListener('click', () => {
        copyTextToClipboard(pair.val);
        const span = chip.querySelector('span');
        const old = span.textContent;
        span.textContent = '¡COPIADO!';
        setTimeout(() => (span.textContent = old), 1200);
      });
      hwIdentifiers.appendChild(chip);
    }

    // Semáforo Grid
    if (diagnostics.length > 0) {
      semaforoSection.hidden = false;
      semaforoGrid.innerHTML = '';
      for (const diag of diagnostics) {
        const cleanSummary = String(diag.summary || '').replace(/^(EN\s+)?(VERDE|ROJO)\s*·\s*/i, '');
        const card = document.createElement('div');
        card.className = 'semaforo-card';
        card.setAttribute('data-status', diag.status || 'neutral');
        card.innerHTML = `
          <span class="semaforo-dot"></span>
          <div class="semaforo-body">
            <span class="semaforo-label">${escapeHtml(diag.label)}</span>
            <strong class="semaforo-value">${escapeHtml(diag.value)}</strong>
            <span class="semaforo-summary">${escapeHtml(cleanSummary)}</span>
          </div>
        `;
        semaforoGrid.appendChild(card);
      }
    } else {
      semaforoSection.hidden = true;
    }

    // Technical Specs Table (with green/red status pills on OFF/ON/Clean/Locked)
    specsGrid.innerHTML = '';
    for (const f of fields) {
      const cell = document.createElement('div');
      cell.className = 'spec-cell';
      const badgeType = f.badge || detectClientBadge(f.key, f.value);
      if (badgeType) {
        cell.innerHTML = `
          <span class="spec-key">${escapeHtml(f.key)}</span>
          <span class="spec-badge" data-badge="${escapeHtml(badgeType)}">${escapeHtml(f.value)}</span>
        `;
      } else {
        cell.innerHTML = `
          <span class="spec-key">${escapeHtml(f.key)}</span>
          <span class="spec-val">${escapeHtml(f.value)}</span>
        `;
      }
      specsGrid.appendChild(cell);
    }

    // Extra Sections (GSX Cases, Replacements, Notes)
    extraSectionsContainer.innerHTML = '';
    for (const sec of extraSections) {
      if (!sec.items || sec.items.length === 0) continue;
      const block = document.createElement('div');
      block.className = 'extra-block';
      block.innerHTML = `
        <h5>${escapeHtml(sec.title)}</h5>
        <ul>${sec.items.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
      `;
      extraSectionsContainer.appendChild(block);
    }

    rawOutputBox.textContent = parsed.rawText || '';
    rawOutputBox.hidden = true;
    toggleRawBtn.textContent = 'Ver respuesta original';

    diagnosticContainer.hidden = false;
  }

  // --- Copy Formatted Summary for WhatsApp ---
  function buildWhatsappSummary(record) {
    if (!record || !record.parsed) return '';
    const p = record.parsed;
    const id = p.identity || {};
    const lines = [];
    const statusEmoji = p.verdict?.status === 'ok' ? '🟢' : p.verdict?.status === 'fail' ? '🔴' : '🟡';

    lines.push(`${statusEmoji} *DIAGNÓSTICO DE EQUIPO*`);
    if (id.model) lines.push(`📱 *Modelo:* ${id.model}`);
    if (id.imei || record.imei) lines.push(`🔢 *IMEI:* ${id.imei || record.imei}`);
    if (id.serial) lines.push(`🏷️ *Serie:* ${id.serial}`);
    lines.push('');

    if (Array.isArray(p.diagnostics) && p.diagnostics.length > 0) {
      for (const d of p.diagnostics) {
        const icon = d.status === 'ok' ? '✅' : d.status === 'fail' ? '❌' : '⚠️';
        lines.push(`${icon} *${d.label}:* ${d.value}`);
      }
      lines.push('');
    } else {
      for (const f of (p.fields || []).slice(0, 10)) {
        lines.push(`• *${f.key}:* ${f.value}`);
      }
    }

    if (id.carrier) lines.push(`📡 *Operador:* ${id.carrier}`);
    if (id.country) lines.push(`🌍 *País:* ${id.country}`);
    lines.push(`🕒 *Verificado:* ${formatDateTime(record.timestamp)}`);
    return lines.join('\n');
  }

  // --- History Management ---
  async function loadHistoryList(query = '') {
    try {
      const res = await fetch(`/api/history?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!data.ok) return;
      const items = data.items || [];
      historyCount.textContent = items.length;

      if (items.length === 0) {
        historyList.innerHTML = `<p class="panel-subtitle" style="padding: 16px 4px;">Aún no hay consultas registradas.</p>`;
        return;
      }

      historyList.innerHTML = '';
      for (const item of items) {
        const vStatus = item.parsed?.verdict?.status || 'neutral';
        const model = item.parsed?.identity?.model || item.serviceName;
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'history-row';
        row.innerHTML = `
          <div class="history-left">
            <span class="history-status-dot" data-status="${escapeHtml(vStatus)}"></span>
            <div class="history-info">
              <strong class="history-title">${escapeHtml(model)}</strong>
              <span class="history-sub mono">${escapeHtml(item.imei)} · ${escapeHtml(item.serviceName)}</span>
            </div>
          </div>
          <div class="history-right">
            <span class="mono">$${escapeHtml(item.price || '0.00')}</span>
            <span>${escapeHtml(formatDateTime(item.timestamp))}</span>
          </div>
        `;
        row.addEventListener('click', () => {
          currentRecord = item;
          renderDiagnosticCard(item);
          switchView('checker');
        });
        historyList.appendChild(row);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    }
  }

  // --- Camera Barcode / QR / Photo Scanner ---
  function extractImeiOrSerialFromText(text) {
    if (!text) return null;
    const raw = String(text).trim();
    // 1. Look for 15-digit IMEI candidate
    const digitMatches = raw.replace(/[\s-]/g, '').match(/\d{15}/g);
    if (digitMatches) {
      for (const candidate of digitMatches) {
        if (computeLuhnCheckDigit(candidate.slice(0, 14)) === parseInt(candidate.charAt(14), 10)) {
          return candidate;
        }
      }
      return digitMatches[0];
    }
    // 2. Look for clean alphanumeric serial (10-15 chars)
    const cleanToken = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (cleanToken.length >= 10 && cleanToken.length <= 15) {
      return cleanToken;
    }
    return null;
  }

  function playScanBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {}
  }

  function detectClientBadge(key, value) {
    const k = String(key || '').toLowerCase();
    const v = String(value || '').trim();
    if (/(find my|icloud lock|mdm|knox|mi activation|mi lock|activation lock)/i.test(k)) {
      if (/^(off|disabled|none|normal|unlocked|clean)$/i.test(v)) return 'ok';
      if (/^(on|enabled|active|locked|lost)$/i.test(v)) return 'fail';
    }
    if (/(sim-lock|sim lock|unlock status|lock status)/i.test(k)) {
      if (/(unlocked|unlock|sim-free|free)/i.test(v)) return 'ok';
      if (/\blocked\b/i.test(v)) return 'fail';
    }
    if (/(blacklist|gsma)/i.test(k)) {
      if (/^clean$/i.test(v)) return 'ok';
      if (/(blacklisted|stolen|lost|barred|fraud)/i.test(v)) return 'fail';
    }
    return null;
  }

  function pickAutomaticBestCamera(cameras) {
    if (!Array.isArray(cameras) || cameras.length === 0) {
      return { facingMode: 'environment' };
    }

    // Filter rear cameras
    const backCams = cameras.filter((c) => /back|trasera|posterior|environment|rear/i.test(c.label));
    if (backCams.length === 0) {
      return { facingMode: 'environment' };
    }

    // 1. On iPhone Pro / multi-lens iOS, "Back Triple Camera" / "Cámara triple trasera" / "Back Dual Wide Camera"
    // is the virtual fusion camera that automatically switches to macro/autofocus when close!
    const appleFusion = backCams.find((c) =>
      /(triple|dual wide|dual amplia|fusion)/i.test(c.label)
    );
    if (appleFusion) return appleFusion.id;

    // 2. Otherwise avoid dedicated ultra-wide (0.5x) or telephoto-only lenses
    const standardBack = backCams.filter(
      (c) => !/(ultra|0\.5|tele|depth)/i.test(c.label)
    );
    if (standardBack.length > 0) {
      // On iOS/Android, the last standard rear camera in the list is typically the main/fusion sensor
      return standardBack[standardBack.length - 1].id;
    }

    return backCams[backCams.length - 1].id;
  }

  async function applyCameraFocusAndZoom() {
    try {
      const videoEl = document.querySelector('#cameraReader video');
      if (!videoEl || !videoEl.srcObject) return;
      const track = videoEl.srcObject.getVideoTracks()[0];
      if (!track || !track.getCapabilities) return;

      const caps = track.getCapabilities();
      const advanced = {};

      if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
        advanced.focusMode = 'continuous';
      }

      torchBtn.hidden = !caps.torch;

      if (Object.keys(advanced).length > 0) {
        await track.applyConstraints({ advanced: [advanced] });
      }
    } catch {}
  }

  let nativeDetectorTimer = null;

  async function openCameraScanner() {
    scannerModal.hidden = false;
    scannerStatus.hidden = true;
    scannerStatus.textContent = '';

    // Clear any previously locked camera in localStorage so it never gets stuck on Camera 1
    try {
      localStorage.removeItem('imei_preferred_camera');
    } catch {}

    if (typeof Html5Qrcode === 'undefined') {
      scannerStatus.hidden = false;
      scannerStatus.textContent = 'Usa el botón de abajo para tomar o subir una foto.';
      return;
    }

    try {
      let targetCamera = { facingMode: 'environment' };
      try {
        const cams = await Html5Qrcode.getCameras();
        if (cams && cams.length > 0) {
          targetCamera = pickAutomaticBestCamera(cams);
        }
      } catch {}

      await startCameraStream(targetCamera);
    } catch {
      try {
        await startCameraStream({ facingMode: 'environment' });
      } catch {
        scannerStatus.hidden = false;
        scannerStatus.textContent = 'Permiso de cámara no concedido. Usa "Subir / Tomar Foto".';
      }
    }
  }

  function onBarcodeDetectedSuccess(decodedText) {
    const extracted = extractImeiOrSerialFromText(decodedText);
    if (extracted) {
      playScanBeep();
      imeiInput.value = extracted;
      updateImeiValidation();
      closeCameraScannerModal();
      return true;
    }
    return false;
  }

  function startNativeHardwareBarcodeLoop(videoEl) {
    if (nativeDetectorTimer) {
      clearInterval(nativeDetectorTimer);
      nativeDetectorTimer = null;
    }
    if (typeof window.BarcodeDetector === 'undefined') return;

    try {
      const detector = new window.BarcodeDetector({
        formats: ['code_128', 'code_39', 'code_93', 'itf', 'qr_code', 'data_matrix']
      });
      nativeDetectorTimer = setInterval(async () => {
        if (!videoEl || videoEl.readyState < 2 || scannerModal.hidden) return;
        try {
          const barcodes = await detector.detect(videoEl);
          if (barcodes && barcodes.length > 0) {
            for (const b of barcodes) {
              if (b.rawValue && onBarcodeDetectedSuccess(b.rawValue)) {
                return;
              }
            }
          }
        } catch {}
      }, 90);
    } catch {}
  }

  async function startCameraStream(cameraTarget) {
    await stopCameraScanner();

    const formats =
      typeof Html5QrcodeSupportedFormats !== 'undefined'
        ? [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.DATA_MATRIX
          ]
        : undefined;

    html5QrScanner = new Html5Qrcode('cameraReader', {
      formatsToSupport: formats,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true
      },
      verbose: false
    });

    scannerStatus.hidden = true;
    torchEnabled = false;

    await html5QrScanner.start(
      cameraTarget,
      {
        fps: 20,
        qrbox: { width: 240, height: 95 }
      },
      (decodedText) => {
        onBarcodeDetectedSuccess(decodedText);
      },
      () => {}
    );

    setTimeout(() => {
      applyCameraFocusAndZoom();
      const videoEl = document.querySelector('#cameraReader video');
      if (videoEl) {
        startNativeHardwareBarcodeLoop(videoEl);
      }
    }, 300);
  }

  async function stopCameraScanner() {
    if (nativeDetectorTimer) {
      clearInterval(nativeDetectorTimer);
      nativeDetectorTimer = null;
    }
    if (html5QrScanner) {
      try {
        if (html5QrScanner.isScanning) {
          await html5QrScanner.stop();
        }
        html5QrScanner.clear();
      } catch {}
      html5QrScanner = null;
    }
  }

  async function closeCameraScannerModal() {
    await stopCameraScanner();
    scannerModal.hidden = true;
  }

  // Handle Photo Upload / Capture (Barcode + OCR fallback)
  photoScanInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    scannerStatus.textContent = 'Analizando imagen...';

    try {
      await stopCameraScanner();
      if (typeof Html5Qrcode !== 'undefined') {
        const fileScanner = new Html5Qrcode('cameraReader');
        try {
          const decoded = await fileScanner.scanFile(file, true);
          const extracted = extractImeiOrSerialFromText(decoded);
          if (extracted) {
            playScanBeep();
            imeiInput.value = extracted;
            updateImeiValidation();
            closeCameraScannerModal();
            return;
          }
        } catch {}
      }

      scannerStatus.textContent = 'No se detectó código de barras nítido. Acerca más la cámara al código de barras de la caja.';
    } finally {
      photoScanInput.value = '';
    }
  });

  // --- Utilities ---
  function switchView(viewName) {
    const isChecker = viewName === 'checker';
    tabChecker.classList.toggle('active', isChecker);
    tabChecker.setAttribute('aria-selected', isChecker ? 'true' : 'false');
    tabHistory.classList.toggle('active', !isChecker);
    tabHistory.setAttribute('aria-selected', !isChecker ? 'true' : 'false');
    viewChecker.hidden = !isChecker;
    viewHistory.hidden = isChecker;
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch {}
    document.body.removeChild(ta);
  }

  function formatDateTime(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Event Listeners ---
  imeiInput.addEventListener('input', updateImeiValidation);

  clearImeiBtn.addEventListener('click', () => {
    imeiInput.value = '';
    updateImeiValidation();
    imeiInput.focus();
  });

  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const extracted = extractImeiOrSerialFromText(text) || text.trim();
        imeiInput.value = extracted;
        updateImeiValidation();
      }
    } catch {
      imeiInput.focus();
    }
  });

  checkForm.addEventListener('submit', (e) => {
    e.preventDefault();
    runCheck('live');
  });

  sampleBtn.addEventListener('click', () => {
    runCheck('sample');
  });

  closeErrorBtn.addEventListener('click', () => {
    errorBanner.hidden = true;
  });

  balanceBtn.addEventListener('click', refreshBalance);

  tabChecker.addEventListener('click', () => switchView('checker'));
  tabHistory.addEventListener('click', () => {
    switchView('history');
    loadHistoryList(historySearchInput.value);
  });

  copyWhatsappBtn.addEventListener('click', () => {
    if (!currentRecord) return;
    const summary = buildWhatsappSummary(currentRecord);
    copyTextToClipboard(summary);
    const old = copyWhatsappText.textContent;
    copyWhatsappText.textContent = '¡Resumen copiado!';
    setTimeout(() => (copyWhatsappText.textContent = old), 1500);
  });

  printSheetBtn.addEventListener('click', () => {
    window.print();
  });

  toggleRawBtn.addEventListener('click', () => {
    const isHidden = rawOutputBox.hidden;
    rawOutputBox.hidden = !isHidden;
    toggleRawBtn.textContent = isHidden ? 'Ocultar respuesta original' : 'Ver respuesta original';
  });

  historySearchInput.addEventListener('input', () => {
    loadHistoryList(historySearchInput.value);
  });

  remoteHistoryBtn.addEventListener('click', async () => {
    const q = historySearchInput.value.trim();
    if (!q) {
      historySearchInput.focus();
      return;
    }
    remoteHistoryBtn.disabled = true;
    remoteHistoryBtn.textContent = 'Buscando...';
    try {
      const res = await fetch(`/api/history/remote?imei=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.ok && data.data && data.data.result) {
        const fakeRecord = {
          id: `REMOTE-${Date.now()}`,
          orderId: data.data.id || q,
          timestamp: new Date().toISOString(),
          mode: 'live',
          imei: data.data.imei || q,
          serviceId: data.data.service || 'HIST',
          serviceName: 'HISTORIAL SICKW',
          price: data.data.price || '0.00',
          parsed: {
            rawText: String(data.data.result).replace(/<br\s*\/?>/gi, '\n'),
            fields: String(data.data.result)
              .split(/<br\s*\/?>|\r?\n/i)
              .map((l) => l.replace(/<[^>]+>/g, '').trim())
              .filter(Boolean)
              .map((l) => {
                const idx = l.indexOf(':');
                return idx > 0 ? { key: l.slice(0, idx).trim(), value: l.slice(idx + 1).trim() } : { key: 'Info', value: l };
              }),
            extraSections: [],
            identity: { imei: data.data.imei || q, model: `Historial #${q}` },
            diagnostics: [],
            verdict: { status: 'neutral', title: 'REGISTRO RECUPERADO DE SICKW', subtitle: 'Consulta histórica recuperada del servidor Sickw.' }
          }
        };
        currentRecord = fakeRecord;
        renderDiagnosticCard(fakeRecord);
        switchView('checker');
      }
    } finally {
      remoteHistoryBtn.disabled = false;
      remoteHistoryBtn.textContent = 'Buscar en Sickw';
    }
  });

  // Modals
  openScannerBtn.addEventListener('click', openCameraScanner);
  closeScannerBtn.addEventListener('click', closeCameraScannerModal);

  torchBtn.addEventListener('click', async () => {
    try {
      const videoEl = document.querySelector('#cameraReader video');
      if (!videoEl || !videoEl.srcObject) return;
      const track = videoEl.srcObject.getVideoTracks()[0];
      torchEnabled = !torchEnabled;
      await track.applyConstraints({ advanced: [{ torch: torchEnabled }] });
      torchBtn.classList.toggle('active', torchEnabled);
    } catch {}
  });

  openCatalogBtn.addEventListener('click', () => {
    catalogModal.hidden = false;
    catalogSearchInput.value = '';
    renderCatalogModalList('');
    setTimeout(() => catalogSearchInput.focus(), 50);
  });

  closeCatalogBtn.addEventListener('click', () => {
    catalogModal.hidden = true;
  });

  catalogSearchInput.addEventListener('input', () => {
    renderCatalogModalList(catalogSearchInput.value);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!scannerModal.hidden) closeCameraScannerModal();
      if (!catalogModal.hidden) catalogModal.hidden = true;
    }
  });

  // Initialize
  renderQuickPresets();
  selectService({
    id: QUICK_PRESETS[0].id,
    name: `${QUICK_PRESETS[0].title.toUpperCase()} · ${QUICK_PRESETS[0].desc}`,
    price: QUICK_PRESETS[0].price,
    category: QUICK_PRESETS[0].category
  });
  refreshBalance();
  loadServicesCatalog();
  loadHistoryList();
})();
