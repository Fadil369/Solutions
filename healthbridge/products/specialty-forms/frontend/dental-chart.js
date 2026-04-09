// ── Dental Chart Interactive Module ──
const API_BASE = '/api/dental';

// ── State ──
let selectedTooth = null;
let selectedSurface = null;
let selectedProcedure = null;
let treatmentPlan = [];
let chartData = {};
let isRTL = false;

// ── Tooth Definitions (FDI notation) ──
const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

// ── Initialize ──
document.addEventListener('DOMContentLoaded', () => {
  renderTeeth();
  setupSurfaceButtons();
});

// ── Render All 32 Teeth ──
function renderTeeth() {
  const upperJaw = document.getElementById('upperJaw');
  const lowerJaw = document.getElementById('lowerJaw');

  upperJaw.innerHTML = UPPER_TEETH.map(n => createToothSVG(n)).join('');
  lowerJaw.innerHTML = LOWER_TEETH.map(n => createToothSVG(n)).join('');

  document.querySelectorAll('.tooth').forEach(el => {
    el.addEventListener('click', () => selectTooth(parseInt(el.dataset.tooth)));
  });
}

// ── Create SVG for a single tooth ──
function createToothSVG(number) {
  const data = chartData[number] || { status: 'healthy', surfaces: {} };
  return `
    <div class="tooth" data-tooth="${number}" data-status="${data.status || 'healthy'}">
      <div class="tooth-number">${number}</div>
      <svg class="tooth-svg" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
        <!-- Crown -->
        <path class="tooth-crown ${data.status || 'healthy'}"
          d="M8,8 Q8,2 16,2 L32,2 Q40,2 40,8 L44,20 Q46,28 44,36 L40,42 L8,42 L4,36 Q2,28 4,20 Z"
          onclick="selectTooth(${number})" />
        <!-- Root -->
        <path class="tooth-root" fill="#e5e7eb" stroke="#d1d5db" stroke-width="1"
          d="M10,42 L14,58 Q15,62 18,62 L20,62 Q22,60 22,56 L22,42 M26,42 L26,56 Q26,60 28,62 L30,62 Q33,62 34,58 L38,42" />
        <!-- Surface markers -->
        <circle cx="24" cy="10" r="3" fill="${data.surfaces?.mesial?.status === 'treated' ? '#2563eb' : 'transparent'}" />
        <circle cx="24" cy="34" r="3" fill="${data.surfaces?.distal?.status === 'treated' ? '#2563eb' : 'transparent'}" />
        <circle cx="24" cy="22" r="3" fill="${data.surfaces?.occlusal?.status === 'treated' ? '#2563eb' : 'transparent'}" />
        <circle cx="10" cy="22" r="3" fill="${data.surfaces?.buccal?.status === 'treated' ? '#2563eb' : 'transparent'}" />
        <circle cx="38" cy="22" r="3" fill="${data.surfaces?.lingual?.status === 'treated' ? '#2563eb' : 'transparent'}" />
      </svg>
    </div>`;
}

// ── Select a Tooth ──
function selectTooth(number) {
  // Deselect previous
  document.querySelectorAll('.tooth.selected').forEach(el => el.classList.remove('selected'));

  selectedTooth = number;
  selectedSurface = null;
  selectedProcedure = null;

  const toothEl = document.querySelector(`.tooth[data-tooth="${number}"]`);
  if (toothEl) toothEl.classList.add('selected');

  // Update panel
  document.getElementById('panelTitle').textContent = `Tooth #${number}`;
  document.getElementById('detailPanel').classList.add('active');

  // Reset surface buttons
  document.querySelectorAll('.surface-btn').forEach(btn => btn.classList.remove('active'));

  // Show surfaces with existing data
  const data = chartData[number] || { surfaces: {} };
  Object.entries(data.surfaces || {}).forEach(([surface, info]) => {
    const btn = document.querySelector(`.surface-btn[data-surface="${surface}"]`);
    if (btn && info.status === 'treated') {
      btn.style.borderColor = 'var(--primary)';
      btn.style.background = 'var(--gray-50)';
    }
  });
}

function closePanel() {
  document.getElementById('detailPanel').classList.remove('active');
  document.querySelectorAll('.tooth.selected').forEach(el => el.classList.remove('selected'));
  selectedTooth = null;
}

// ── Surface Selection ──
function setupSurfaceButtons() {
  document.querySelectorAll('.surface-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.surface-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSurface = btn.dataset.surface;
    });
  });
}

// ── Procedure Search ──
let searchTimeout = null;
function searchProcedures(query) {
  clearTimeout(searchTimeout);
  if (query.length < 2) {
    document.getElementById('searchResults').classList.remove('active');
    return;
  }

  searchTimeout = setTimeout(async () => {
    try {
      const resp = await fetch(`${API_BASE}/procedures/search?q=${encodeURIComponent(query)}`);
      const json = await resp.json();
      const container = document.getElementById('searchResults');

      if (json.data && json.data.length > 0) {
        container.innerHTML = json.data.slice(0, 20).map(p => `
          <div class="search-result-item" onclick="selectProcedure('${p.code}', '${escapeHtml(p.description)}', ${p.costRange[0]})">
            <span class="code">${p.adaCode}</span>
            <span class="cost">SAR ${p.costRange[0]}-${p.costRange[1]}</span>
            <div>${p.description}</div>
          </div>
        `).join('');
        container.classList.add('active');
      } else {
        container.innerHTML = '<div class="search-result-item">No procedures found</div>';
        container.classList.add('active');
      }
    } catch (e) {
      console.error('Search error:', e);
    }
  }, 300);
}

function selectProcedure(code, description, cost) {
  selectedProcedure = { code, description, cost };
  document.getElementById('procedureSearch').value = `${code} — ${description}`;
  document.getElementById('searchResults').classList.remove('active');
}

// ── Add Procedure to Chart & Treatment Plan ──
function addProcedure() {
  if (!selectedTooth || !selectedProcedure) {
    alert('Please select a tooth and procedure');
    return;
  }

  const item = {
    id: Date.now(),
    toothNumber: selectedTooth,
    surface: selectedSurface,
    procedureCode: selectedProcedure.code,
    description: selectedProcedure.description,
    cost: selectedProcedure.cost,
    notes: document.getElementById('procedureNotes').value,
  };

  treatmentPlan.push(item);
  updateTreatmentPlanUI();

  // Update tooth visual
  if (!chartData[selectedTooth]) {
    chartData[selectedTooth] = { status: 'treated', surfaces: {} };
  }
  chartData[selectedTooth].status = 'treated';
  if (selectedSurface) {
    chartData[selectedTooth].surfaces[selectedSurface] = { status: 'treated', procedure_code: selectedProcedure.code };
  }

  // Re-render the tooth
  const toothEl = document.querySelector(`.tooth[data-tooth="${selectedTooth}"]`);
  if (toothEl) {
    toothEl.outerHTML = createToothSVG(selectedTooth);
    document.querySelector(`.tooth[data-tooth="${selectedTooth}"]`)
      .addEventListener('click', () => selectTooth(selectedTooth));
  }

  // Reset form
  document.getElementById('procedureSearch').value = '';
  document.getElementById('procedureNotes').value = '';
  selectedProcedure = null;
  selectedSurface = null;
  document.querySelectorAll('.surface-btn').forEach(b => b.classList.remove('active'));
}

// ── Update Treatment Plan UI ──
function updateTreatmentPlanUI() {
  const container = document.getElementById('treatmentItems');
  if (treatmentPlan.length === 0) {
    container.innerHTML = '<p class="empty-state">No procedures added yet</p>';
    document.getElementById('totalCost').textContent = 'SAR 0.00';
    document.getElementById('preauthWarning').style.display = 'none';
    return;
  }

  container.innerHTML = treatmentPlan.map(item => `
    <div class="treatment-item">
      <span class="tooth-num">#${item.toothNumber}${item.surface ? ' ' + item.surface : ''}</span>
      <span class="proc-desc">${item.procedureCode} — ${item.description}</span>
      <span class="cost">SAR ${item.cost.toFixed(2)}</span>
      <button class="remove-btn" onclick="removeTreatmentItem(${item.id})">×</button>
    </div>
  `).join('');

  const total = treatmentPlan.reduce((sum, i) => sum + i.cost, 0);
  document.getElementById('totalCost').textContent = `SAR ${total.toFixed(2)}`;

  // Check pre-auth threshold (1000 SAR)
  document.getElementById('preauthWarning').style.display = total >= 1000 ? 'flex' : 'none';
}

function removeTreatmentItem(id) {
  treatmentPlan = treatmentPlan.filter(i => i.id !== id);
  updateTreatmentPlanUI();
}

// ── Save Treatment Plan ──
async function saveTreatmentPlan() {
  const patientId = document.getElementById('patientId').value;
  if (!patientId) {
    alert('Please enter a Patient ID');
    return;
  }
  if (treatmentPlan.length === 0) {
    alert('No procedures in treatment plan');
    return;
  }

  try {
    const resp = await fetch(`${API_BASE}/treatment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        chartEntries: treatmentPlan.map(t => ({
          procedureCode: t.procedureCode,
          surface: t.surface,
          notes: t.notes,
        })),
        totalCost: treatmentPlan.reduce((s, t) => s + t.cost, 0),
      }),
    });

    const result = await resp.json();
    if (result.data) {
      alert(`Treatment plan saved! ${result.preauthRequired ? '⚠️ Pre-authorization required.' : ''}`);
      treatmentPlan = [];
      updateTreatmentPlanUI();
    }
  } catch (e) {
    console.error('Save error:', e);
    alert('Error saving treatment plan');
  }
}

// ── Load Existing Chart ──
async function loadChart() {
  const patientId = document.getElementById('patientId').value;
  if (!patientId) { alert('Enter a Patient ID'); return; }

  try {
    const resp = await fetch(`${API_BASE}/chart/${patientId}`);
    const json = await resp.json();

    if (json.data) {
      // Build chart data from API response
      chartData = {};
      json.data.forEach(tooth => {
        chartData[tooth.number] = {
          status: tooth.procedures.length > 0 ? 'treated' : 'healthy',
          surfaces: tooth.surfaces || {},
        };
      });
      renderTeeth();
    }
  } catch (e) {
    console.error('Load error:', e);
    alert('Error loading chart');
  }
}

// ── RTL Toggle ──
function toggleRTL() {
  isRTL = !isRTL;
  document.body.dir = isRTL ? 'rtl' : 'ltr';

  // Update jaw labels
  document.querySelectorAll('.jaw-label').forEach(el => {
    const arText = el.dataset.ar;
    if (arText) {
      const enText = el.textContent;
      el.dataset.ar = enText;
      el.textContent = isRTL ? arText : enText;
    }
  });
}

// ── Utility ──
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
