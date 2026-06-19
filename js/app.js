// ============================================================
//  DUTY SCHEDULE PRO - MAIN APPLICATION
// ============================================================

// ============================================================
//  🔐 KONFIGURASI SUPABASE
// ============================================================
const SUPABASE_URL = 'https://afbqoyqzkkjwuncgrkys.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmYnFveXF6a2tqd3VuY2dya3lzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NTY3OTEsImV4cCI6MjA5NzQzMjc5MX0.Dt4RX8sYL7rCY11-5UG-P0f15FIWwXmSuQcazbtK0sg';

// ============================================================
//  PIN ADMIN
// ============================================================
const ADMIN_PIN = '6600';

// ============================================================
//  STATE
// ============================================================
let dataJadwal = {};
let isAdmin = false;
let settings = {
  petugas: ['Ajik Su', 'Wayan S', 'Mang Beni', 'Indra S', 'Kadek Widana'],
  jenisJaga: ['Bungkulan Post', 'Komodo Warehouse']
};
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let isLoading = false;
let supabaseClient = null;
let chartInstance = null;

// ============================================================
//  HELPERS
// ============================================================
function pad(n) { return n.toString().padStart(2, '0'); }
function formatDate(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

function formatTanggalLengkap(t) {
  const d = new Date(t + 'T12:00:00');
  const hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return `${hari[d.getDay()]}, ${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

// ============================================================
//  INDIKATOR SINYAL
// ============================================================
function updateSignalIndicator() {
  const indicator = document.getElementById('signal-indicator');
  const text = document.getElementById('signal-text');
  if (navigator.onLine) {
    indicator.className = 'online';
    text.textContent = 'Online';
  } else {
    indicator.className = 'offline';
    text.textContent = 'Offline';
  }
}
window.addEventListener('online', updateSignalIndicator);
window.addEventListener('offline', updateSignalIndicator);
updateSignalIndicator();

// ============================================================
//  SUPABASE CLIENT
// ============================================================
function getSupabase() {
  if (!supabaseClient) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

// ============================================================
//  LOAD SETTINGS FROM SUPABASE
// ============================================================
async function loadSettings() {
  try {
    const client = getSupabase();
    const { data, error } = await client.from('settings').select('*');
    if (error) throw error;
    
    if (data && data.length > 0) {
      // Ambil data pertama
      const setting = data[0];
      settings.petugas = setting.petugas || ['Ajik Su', 'Wayan S', 'Mang Beni', 'Indra S', 'Kadek Widana'];
      settings.jenisJaga = setting.jenis_jaga || ['Bungkulan Post', 'Komodo Warehouse'];
    } else {
      // Jika belum ada, buat default
      await saveSettings();
    }
    renderSettings();
  } catch (err) {
    console.error('Error load settings:', err);
    // Gunakan default jika error
    settings.petugas = ['Ajik Su', 'Wayan S', 'Mang Beni', 'Indra S', 'Kadek Widana'];
    settings.jenisJaga = ['Bungkulan Post', 'Komodo Warehouse'];
    renderSettings();
  }
}

// ============================================================
//  SAVE SETTINGS TO SUPABASE
// ============================================================
async function saveSettings() {
  try {
    const client = getSupabase();
    const payload = {
      petugas: settings.petugas,
      jenis_jaga: settings.jenisJaga,
      updated_at: new Date().toISOString()
    };
    
    // Cek apakah sudah ada data
    const { data: existing } = await client.from('settings').select('id').limit(1);
    let result;
    if (existing && existing.length > 0) {
      result = await client.from('settings').update(payload).eq('id', existing[0].id);
    } else {
      result = await client.from('settings').insert(payload);
    }
    if (result.error) throw result.error;
    return true;
  } catch (err) {
    console.error('Error save settings:', err);
    return false;
  }
}

// ============================================================
//  RENDER SETTINGS UI
// ============================================================
function renderSettings() {
  // Render Petugas
  const petugasList = document.getElementById('petugas-list');
  if (petugasList) {
    petugasList.innerHTML = '';
    settings.petugas.forEach((nama, index) => {
      const div = document.createElement('div');
      div.className = 'settings-item';
      div.innerHTML = `
        <input type="text" value="${escapeHtml(nama)}" data-index="${index}" data-type="petugas" />
        <button class="btn-sm btn-sm-remove" onclick="removeSettingItem('petugas', ${index})">
          <i class="fas fa-trash"></i>
        </button>
      `;
      petugasList.appendChild(div);
    });
  }

  // Render Jenis Jaga
  const jenisList = document.getElementById('jenis-list');
  if (jenisList) {
    jenisList.innerHTML = '';
    settings.jenisJaga.forEach((nama, index) => {
      const div = document.createElement('div');
      div.className = 'settings-item';
      div.innerHTML = `
        <input type="text" value="${escapeHtml(nama)}" data-index="${index}" data-type="jenis" />
        <button class="btn-sm btn-sm-remove" onclick="removeSettingItem('jenis', ${index})">
          <i class="fas fa-trash"></i>
        </button>
      `;
      jenisList.appendChild(div);
    });
  }

  // Update modal checkbox jika terbuka
  // (akan di-refresh saat openModal)
}

// ============================================================
//  SETTINGS CRUD OPERATIONS
// ============================================================
window.addSettingItem = function(type) {
  const input = document.getElementById(`new-${type}-input`);
  const value = input.value.trim();
  if (!value) {
    Swal.fire('Peringatan', 'Nama tidak boleh kosong', 'warning');
    return;
  }
  
  if (type === 'petugas') {
    settings.petugas.push(value);
  } else {
    settings.jenisJaga.push(value);
  }
  input.value = '';
  saveSettings().then(() => {
    renderSettings();
    Swal.fire('Berhasil', `Data ${type} berhasil ditambahkan`, 'success');
  });
};

window.removeSettingItem = function(type, index) {
  Swal.fire({
    title: 'Hapus Data?',
    text: `Yakin akan menghapus data ini?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#e74c3c',
    cancelButtonColor: '#555',
    confirmButtonText: 'Ya, hapus!',
    cancelButtonText: 'Batal'
  }).then((result) => {
    if (result.isConfirmed) {
      if (type === 'petugas') {
        settings.petugas.splice(index, 1);
      } else {
        settings.jenisJaga.splice(index, 1);
      }
      saveSettings().then(() => {
        renderSettings();
        Swal.fire('Terhapus!', 'Data berhasil dihapus', 'success');
      });
    }
  });
};

window.saveSettingChanges = function() {
  // Ambil semua input petugas
  const petugasInputs = document.querySelectorAll('#petugas-list input[type="text"]');
  const newPetugas = [];
  petugasInputs.forEach(input => {
    if (input.value.trim()) newPetugas.push(input.value.trim());
  });
  
  // Ambil semua input jenis
  const jenisInputs = document.querySelectorAll('#jenis-list input[type="text"]');
  const newJenis = [];
  jenisInputs.forEach(input => {
    if (input.value.trim()) newJenis.push(input.value.trim());
  });
  
  if (newPetugas.length === 0) {
    Swal.fire('Peringatan', 'Minimal 1 petugas harus ada', 'warning');
    return;
  }
  if (newJenis.length === 0) {
    Swal.fire('Peringatan', 'Minimal 1 jenis jaga harus ada', 'warning');
    return;
  }
  
  settings.petugas = newPetugas;
  settings.jenisJaga = newJenis;
  
  saveSettings().then(() => {
    renderSettings();
    // Refresh kalender dan preview
    if (isAdmin) renderCalendar(currentMonth, currentYear);
    Swal.fire('Berhasil', 'Pengaturan berhasil disimpan', 'success');
  });
};

// ============================================================
//  ESCAPE HTML
// ============================================================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================
//  CRUD SUPABASE - JADWAL
// ============================================================
async function fetchJadwal() {
  if (isLoading) return;
  isLoading = true;
  showStatus('info', '⏳ Mengambil data...');
  try {
    const client = getSupabase();
    const { data, error } = await client.from('jadwal').select('*');
    if (error) throw error;
    dataJadwal = {};
    data.forEach(row => {
      dataJadwal[row.tanggal] = {
        bungkulan: row.bungkulan || [],
        komodo: row.komodo || []
      };
    });
    renderPreview();
    if (isAdmin) renderCalendar(currentMonth, currentYear);
    updateStats();
    showStatus('success', '✅ Data dimuat dari Supabase');
  } catch (err) {
    console.error(err);
    showStatus('error', '❌ Gagal ambil data: ' + err.message);
  }
  isLoading = false;
}

async function saveJadwal(tanggal, bungkulan, komodo) {
  try {
    const client = getSupabase();
    const { error } = await client
      .from('jadwal')
      .upsert({ tanggal, bungkulan, komodo }, { onConflict: 'tanggal' });
    if (error) throw error;
    Swal.fire({
      icon: 'success',
      title: 'Berhasil!',
      text: 'Jadwal berhasil disimpan ke Supabase',
      timer: 1500,
      showConfirmButton: false
    });
    await fetchJadwal();
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Gagal!',
      text: err.message
    });
  }
}

// ============================================================
//  AUTO DELETE EXPIRED
// ============================================================
function autoDeleteExpired() {
  const todayStr = formatDate(new Date());
  let hasDeleted = false;
  for (const [tgl] of Object.entries(dataJadwal)) {
    if (tgl < todayStr) {
      delete dataJadwal[tgl];
      hasDeleted = true;
    }
  }
  if (hasDeleted) {
    renderPreview();
    if (isAdmin) renderCalendar(currentMonth, currentYear);
  }
}

// ============================================================
//  RENDER PREVIEW
// ============================================================
function renderPreview() {
  const tbody = document.getElementById('preview-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  const entries = Object.entries(dataJadwal).sort((a, b) => a[0].localeCompare(b[0]));
  if (entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="preview-empty">Belum ada jadwal.</td></tr>`;
    return;
  }
  entries.forEach(([tgl, data]) => {
    const bungkulan = data.bungkulan?.length ? data.bungkulan.map(n => '🪖 ' + n).join('<br>') : '—';
    const komodo = data.komodo?.length ? data.komodo.map(n => '🪖 ' + n).join('<br>') : '—';
    const row = document.createElement('tr');
    row.innerHTML = `<td>${formatTanggalLengkap(tgl)}</td><td>${bungkulan}</td><td>${komodo}</td>`;
    tbody.appendChild(row);
  });
}

// ============================================================
//  KALENDER (ADMIN)
// ============================================================
function renderCalendar(month, year) {
  const cal = document.getElementById('calendar');
  if (!cal) return;
  cal.innerHTML = '';

  const days = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const namaHari = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  for (let i = 0; i < 7; i++) {
    const header = document.createElement('div');
    header.className = 'calendar-header';
    if (i === 0) header.classList.add('minggu');
    header.textContent = namaHari[i];
    cal.appendChild(header);
  }

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.style.cssText = 'background:transparent;border:none;box-shadow:none;cursor:default;';
    cal.appendChild(empty);
  }

  const today = new Date();
  for (let d = 1; d <= days; d++) {
    const dateStr = `${year}-${pad(month+1)}-${pad(d)}`;
    const el = document.createElement('div');
    el.className = 'day';

    const dateObj = new Date(year, month, d);
    if (dateObj.getDay() === 0) el.classList.add('minggu');

    if (dateStr === formatDate(today)) el.classList.add('today');

    const hasData = dataJadwal[dateStr] &&
      ((dataJadwal[dateStr].bungkulan?.length || 0) + (dataJadwal[dateStr].komodo?.length || 0) > 0);
    if (hasData) el.classList.add('has-data');

    el.innerHTML = `<strong>${d}</strong>`;
    if (hasData) {
      const count = (dataJadwal[dateStr].bungkulan?.length || 0) + (dataJadwal[dateStr].komodo?.length || 0);
      el.innerHTML += `<span style="font-size:10px;opacity:0.9;margin-top:2px;">${count} jaga</span>`;
    }

    el.onclick = () => openModal(dateStr);
    cal.appendChild(el);
  }

  const bulanNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const greetingEl = document.getElementById('greeting');
  if (greetingEl) greetingEl.innerText = `📅 ${bulanNames[month]} ${year}`;
}

// ============================================================
//  MODAL (Menggunakan settings dinamis)
// ============================================================
window.openModal = function(dateStr) {
  if (!isAdmin) {
    Swal.fire('Akses Ditolak', 'Anda harus login sebagai admin terlebih dahulu.', 'warning');
    return;
  }
  const modal = document.getElementById('modal');
  document.getElementById('modal-date').innerText = '📅 ' + formatTanggalLengkap(dateStr);
  if (!dataJadwal[dateStr]) dataJadwal[dateStr] = { bungkulan: [], komodo: [] };

  const modalGrid = document.getElementById('modal-grid');
  modalGrid.innerHTML = '';

  // Buat kolom berdasarkan jenisJaga dari settings
  settings.jenisJaga.forEach((jenis, idx) => {
    const key = jenis.toLowerCase().replace(/ /g, '_');
    const colClass = idx === 0 ? 'blue' : 'green';
    const icon = idx === 0 ? 'fa-shield-halved' : 'fa-dragon';
    const iconColor = idx === 0 ? '#2a7faa' : '#2ecc71';

    const col = document.createElement('div');
    col.className = `modal-col ${colClass}`;
    col.innerHTML = `
      <h4><i class="fas ${icon}" style="color:${iconColor};"></i> ${jenis.toUpperCase()}</h4>
      <div id="list-${key}"></div>
    `;
    modalGrid.appendChild(col);

    const list = col.querySelector(`#list-${key}`);
    settings.petugas.forEach(nama => {
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = dataJadwal[dateStr][key]?.includes(nama) || false;
      cb.dataset.nama = nama;
      cb.dataset.lokasi = key;
      label.appendChild(cb);
      label.append(' ' + nama);
      list.appendChild(label);
    });
  });

  // Simpan data dari checkbox
  const saveBtn = document.getElementById('modal-save-btn');
  saveBtn.onclick = async function() {
    const result = {};
    settings.jenisJaga.forEach(jenis => {
      const key = jenis.toLowerCase().replace(/ /g, '_');
      const list = document.getElementById(`list-${key}`);
      const checked = list.querySelectorAll('input[type="checkbox"]:checked');
      result[key] = Array.from(checked).map(cb => cb.dataset.nama);
    });
    // Simpan ke dataJadwal
    settings.jenisJaga.forEach(jenis => {
      const key = jenis.toLowerCase().replace(/ /g, '_');
      dataJadwal[dateStr][key] = result[key] || [];
    });
    await saveJadwal(dateStr, dataJadwal[dateStr], {});
    closeModal();
  };

  modal.style.display = 'flex';
};

window.closeModal = function() {
  document.getElementById('modal').style.display = 'none';
};
window.onclick = function(e) {
  const modal = document.getElementById('modal');
  if (e.target === modal) closeModal();
};

// ============================================================
//  ADMIN PIN LOGIN
// ============================================================
document.getElementById('pin-login-btn').addEventListener('click', function() {
  const pin = document.getElementById('pin-input').value;
  if (pin === ADMIN_PIN) {
    isAdmin = true;
    document.getElementById('admin-pin-screen').style.display = 'none';
    document.getElementById('admin-content').style.display = 'block';
    renderCalendar(currentMonth, currentYear);
    document.getElementById('pin-error').style.display = 'none';
  } else {
    document.getElementById('pin-error').style.display = 'block';
  }
});
document.getElementById('pin-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('pin-login-btn').click();
});

// ============================================================
//  MONTH / YEAR SELECTOR
// ============================================================
function populateYearSelector() {
  const sel = document.getElementById('year-selector');
  if (!sel) return;
  sel.innerHTML = '';
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 5; y <= currentYear + 1; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === currentYear) opt.selected = true;
    sel.appendChild(opt);
  }
}

function setCurrentMonth() {
  const monthSelector = document.getElementById('month-selector');
  if (monthSelector) monthSelector.value = new Date().getMonth();
}

document.getElementById('btn-go-month')?.addEventListener('click', function() {
  const month = parseInt(document.getElementById('month-selector').value);
  const year = parseInt(document.getElementById('year-selector').value);
  currentMonth = month;
  currentYear = year;
  if (isAdmin) renderCalendar(month, year);
});

document.getElementById('month-selector')?.addEventListener('change', function() {
  document.getElementById('btn-go-month').click();
});
document.getElementById('year-selector')?.addEventListener('change', function() {
  document.getElementById('btn-go-month').click();
});

// ============================================================
//  JAM
// ============================================================
function updateClock() {
  const now = new Date();
  const clock = document.getElementById('live-clock');
  if (clock) clock.innerText = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
setInterval(updateClock, 1000);
updateClock();

// ============================================================
//  SHARE WHATSAPP
// ============================================================
window.shareToday = function() {
  const ting = document.getElementById('tingtong');
  if (ting) ting.play().catch(() => {});
  const dateStr = formatDate(new Date());
  const data = dataJadwal[dateStr];
  if (!data || Object.keys(data).length === 0) {
    Swal.fire('Info', 'Belum ada jadwal untuk hari ini.', 'info');
    return;
  }
  let teks = `🪖 *DUTY SCHEDULE*\n━━━━━━━━━━━━━━━━\n📅 ${formatTanggalLengkap(dateStr)}\n\n`;
  settings.jenisJaga.forEach((jenis, idx) => {
    const key = jenis.toLowerCase().replace(/ /g, '_');
    const icon = idx === 0 ? '🔵' : '🟢';
    teks += `${icon} *${jenis.toUpperCase()}*\n`;
    if (data[key] && data[key].length) {
      teks += data[key].map((n, i) => `${i+1}. 🪖 ${n}`).join('\n');
    } else {
      teks += '   -';
    }
    teks += '\n\n';
  });
  teks += '━━━━━━━━━━━━━━━━\n#DutyToday';
  window.open(`https://wa.me/?text=${encodeURIComponent(teks)}`, '_blank');
};

// ============================================================
//  EXPORT PNG
// ============================================================
window.exportPNG = function() {
  const printArea = document.getElementById('print-area');
  const table = document.getElementById('print-table');
  buildPrintTable(table);
  printArea.style.position = 'fixed';
  printArea.style.left = '0';
  printArea.style.top = '0';
  printArea.style.zIndex = '9999';
  printArea.style.background = 'white';
  html2canvas(printArea, { scale: 2, backgroundColor: '#ffffff', logging: false, allowTaint: false, useCORS: true })
    .then(canvas => {
      printArea.style.position = 'absolute';
      printArea.style.left = '-9999px';
      const link = document.createElement('a');
      link.download = `DutySchedule-${formatDate(new Date())}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    })
    .catch(err => {
      Swal.fire('Error!', 'Gagal export PNG: ' + err, 'error');
      printArea.style.position = 'absolute';
      printArea.style.left = '-9999px';
    });
};

// ============================================================
//  BUILD PRINT TABLE
// ============================================================
function buildPrintTable(table) {
  table.innerHTML = '';
  let headerHtml = `<tr><th style="width:35%;">Tanggal</th>`;
  settings.jenisJaga.forEach((jenis, idx) => {
    const icon = idx === 0 ? '🔵' : '🟢';
    headerHtml += `<th style="width:${idx === 0 ? '32' : '33'}%;">${icon} ${jenis}</th>`;
  });
  headerHtml += '</tr>';
  table.innerHTML = headerHtml;

  const entries = Object.entries(dataJadwal).sort((a, b) => a[0].localeCompare(b[0]));
  if (entries.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="${settings.jenisJaga.length + 1}" style="text-align:center;padding:20px;font-style:italic;">Belum ada data jadwal</td>`;
    table.appendChild(row);
    return;
  }
  entries.forEach(([tgl, data]) => {
    let rowHtml = `<td>${formatTanggalLengkap(tgl)}</td>`;
    settings.jenisJaga.forEach(jenis => {
      const key = jenis.toLowerCase().replace(/ /g, '_');
      const items = data[key]?.length ? data[key].map(n => '🪖 ' + n).join('<br>') : '—';
      rowHtml += `<td>${items}</td>`;
    });
    const row = document.createElement('tr');
    row.innerHTML = rowHtml;
    table.appendChild(row);
  });
}

// ============================================================
//  EXPORT PDF
// ============================================================
window.exportPDF = function() {
  const entries = Object.entries(dataJadwal);
  if (entries.length === 0) {
    Swal.fire('Info', 'Belum ada data jadwal untuk diexport.', 'info');
    return;
  }

  const printArea = document.getElementById('print-area');
  const table = document.getElementById('print-table');
  buildPrintTable(table);

  printArea.style.position = 'fixed';
  printArea.style.left = '0';
  printArea.style.top = '0';
  printArea.style.zIndex = '9999';
  printArea.style.background = 'white';
  printArea.style.width = '794px';
  printArea.style.padding = '30px 35px';

  const opt = {
    margin: [15, 15, 15, 15],
    filename: `DutySchedule-${formatDate(new Date())}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      logging: false,
      allowTaint: false,
      useCORS: true,
      width: 794,
      height: printArea.scrollHeight + 50
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: 'avoid-all' }
  };

  Swal.fire({
    title: 'Membuat PDF...',
    text: 'Mohon tunggu sebentar',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  html2pdf()
    .set(opt)
    .from(printArea)
    .save()
    .then(() => {
      printArea.style.position = 'absolute';
      printArea.style.left = '-9999px';
      Swal.close();
      Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'PDF berhasil diunduh', timer: 1500, showConfirmButton: false });
    })
    .catch((err) => {
      printArea.style.position = 'absolute';
      printArea.style.left = '-9999px';
      Swal.close();
      Swal.fire('Error!', 'Gagal export PDF: ' + err.message, 'error');
      console.error('PDF Error:', err);
    });
};

// ============================================================
//  STATISTIK
// ============================================================
function updateStats() {
  const now = new Date();
  const bulan = now.getMonth();
  const tahun = now.getFullYear();
  let totalHari = 0;
  const totals = {};

  settings.jenisJaga.forEach(jenis => {
    const key = jenis.toLowerCase().replace(/ /g, '_');
    totals[key] = 0;
  });

  Object.entries(dataJadwal).forEach(([tgl, data]) => {
    const d = new Date(tgl + 'T12:00:00');
    if (d.getMonth() === bulan && d.getFullYear() === tahun) {
      totalHari++;
      settings.jenisJaga.forEach(jenis => {
        const key = jenis.toLowerCase().replace(/ /g, '_');
        totals[key] += data[key]?.length || 0;
      });
    }
  });

  const rekapEl = document.getElementById('rekap-bulan');
  if (rekapEl) {
    let html = `<div class="flex justify-center gap-6 flex-wrap"><span><i class="fa-solid fa-calendar-day text-blue-400"></i> Hari: <strong>${totalHari}</strong></span>`;
    const colors = ['text-blue-400', 'text-green-400', 'text-yellow-400', 'text-purple-400', 'text-red-400'];
    settings.jenisJaga.forEach((jenis, idx) => {
      const key = jenis.toLowerCase().replace(/ /g, '_');
      const icon = idx === 0 ? 'fa-shield-halved' : 'fa-dragon';
      html += `<span><i class="fa-solid ${icon} ${colors[idx % colors.length]}"></i> ${jenis}: <strong>${totals[key] || 0}</strong></span>`;
    });
    const totalAll = Object.values(totals).reduce((a, b) => a + b, 0);
    html += `<span><i class="fa-solid fa-users text-yellow-400"></i> Total: <strong>${totalAll}</strong></span></div>`;
    rekapEl.innerHTML = html;
  }

  const ctx = document.getElementById('statsChart');
  if (!ctx) return;
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

  const labels = [];
  const datasets = [];

  settings.jenisJaga.forEach((jenis, idx) => {
    const key = jenis.toLowerCase().replace(/ /g, '_');
    const colors = ['rgba(42, 127, 170, 0.7)', 'rgba(46, 204, 113, 0.7)', 'rgba(241, 196, 15, 0.7)', 'rgba(155, 89, 182, 0.7)', 'rgba(231, 76, 60, 0.7)'];
    const borders = ['#2a7faa', '#2ecc71', '#f1c40f', '#9b59b6', '#e74c3c'];
    datasets.push({
      label: jenis,
      data: [],
      backgroundColor: colors[idx % colors.length],
      borderColor: borders[idx % borders.length],
      borderWidth: 1
    });
  });

  for (let i = 0; i < 12; i++) {
    const bulanIdx = (bulan - i + 12) % 12;
    const tahunIdx = bulan - i < 0 ? tahun - 1 : tahun;
    const namaBulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][bulanIdx];
    labels.unshift(namaBulan + ' ' + tahunIdx);

    settings.jenisJaga.forEach((jenis, idx) => {
      const key = jenis.toLowerCase().replace(/ /g, '_');
      let total = 0;
      Object.entries(dataJadwal).forEach(([tgl, data]) => {
        const d = new Date(tgl + 'T12:00:00');
        if (d.getMonth() === bulanIdx && d.getFullYear() === tahunIdx) {
          total += data[key]?.length || 0;
        }
      });
      datasets[idx].data.unshift(total);
    });
  }

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { labels: { color: '#aaa' } } },
      scales: {
        x: { ticks: { color: '#888', maxRotation: 45 } },
        y: { ticks: { color: '#888', stepSize: 1 } }
      }
    }
  });
}

// ============================================================
//  STATUS DISPLAY
// ============================================================
function showStatus(type, message) {
  const container = document.getElementById('preview-table-wrap');
  if (!container) return;
  let box = container.querySelector('.status-box');
  if (!box) {
    box = document.createElement('div');
    box.className = 'status-box';
    container.prepend(box);
  }
  box.className = `status-box ${type}`;
  const icon = type === 'error' ? 'circle-exclamation' : type === 'success' ? 'circle-check' : 'circle-info';
  box.innerHTML = `<i class="fa-solid fa-${icon}"></i> ${message}`;
}

// ============================================================
//  TAB SWITCHING
// ============================================================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));

    const tab = this.dataset.tab;
    const target = document.getElementById(tab + '-tab');
    if (target) target.classList.add('active');

    if (tab === 'preview') renderPreview();
    if (tab === 'admin') {
      if (!isAdmin) {
        document.getElementById('admin-pin-screen').style.display = 'block';
        document.getElementById('admin-content').style.display = 'none';
      } else {
        document.getElementById('admin-pin-screen').style.display = 'none';
        document.getElementById('admin-content').style.display = 'block';
        renderCalendar(currentMonth, currentYear);
      }
    }
    if (tab === 'stats') setTimeout(() => updateStats(), 100);
    if (tab === 'settings') {
      renderSettings();
    }
  });
});

// ============================================================
//  HILANGKAN POPUP INSTALL
// ============================================================
window.addEventListener('beforeinstallprompt', (e) => e.preventDefault());

// ============================================================
//  AOS INIT
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  if (typeof AOS !== 'undefined') {
    AOS.init({ duration: 600, once: true, offset: 50 });
  }
});

// ============================================================
//  INISIALISASI
// ============================================================
async function initApp() {
  populateYearSelector();
  setCurrentMonth();
  await loadSettings();
  await fetchJadwal();
  autoDeleteExpired();
  document.querySelector('.tab-btn[data-tab="preview"]').click();
  console.log('✅ Aplikasi siap (Settings Dinamis - Supabase)');
}

initApp();
