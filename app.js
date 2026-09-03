function formatLine(left, right, maxLen = 32) {
  left = String(left || '');
  right = String(right || '');
  let spaceNeeded = maxLen - left.length - right.length;
  if (spaceNeeded < 1) {
    left = left.substring(0, Math.max(1, maxLen - right.length - 1));
    spaceNeeded = 1;
  }
  return left + ' '.repeat(spaceNeeded) + right;
}

(function setupPWAInSingleFile() {
  const manifest = {
    name: "Goklin POS Laundry",
    short_name: "Goklin POS",
    start_url: ".",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    icons: [{
      src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%232563eb'/><path d='M20 50 Q35 30 50 50 T80 50' fill='none' stroke='white' stroke-width='10' stroke-linecap='round'/></svg>",
      sizes: "192x192 512x512",
      type: "image/svg+xml"
    }]
  };
  const manifestBlob = new Blob([JSON.stringify(manifest)], {type: 'application/json'});
  const manifestURL = URL.createObjectURL(manifestBlob);
  let manifestLink = document.createElement('link');
  manifestLink.rel = 'manifest';
  manifestLink.href = manifestURL;
  document.head.appendChild(manifestLink);

  if ('serviceWorker' in navigator) {
    const swCode = `
      self.addEventListener('install', e => e.waitUntil(self.skipWaiting()));
      self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
      self.addEventListener('fetch', e => {
        e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
      });
    `;
    const swBlob = new Blob([swCode], { type: 'text/javascript' });
    const swUrl = URL.createObjectURL(swBlob);
    navigator.serviceWorker.register(swUrl).catch(err => console.log('PWA SW Register:', err));
  }
})();

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) installBtn.classList.remove('hidden');
});

window.addEventListener('appinstalled', () => {
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) installBtn.classList.add('hidden');
  deferredPrompt = null;
});

function triggerPwaInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        const installBtn = document.getElementById('pwa-install-btn');
        if (installBtn) installBtn.classList.add('hidden');
      }
      deferredPrompt = null;
    });
  } else {
    alert('Untuk mengunduh ke layar utama: Klik Titik Tiga (⋮) di Chrome ➔ Pilih "Tambahkan ke Layar Utama" / "Install Aplikasi".');
  }
}

function safeRenderIcons() {
  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem('goklin_theme') || 'dark';
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  updateThemeIcon();
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('goklin_theme', isDark ? 'dark' : 'light');
  updateThemeIcon();
}

function updateThemeIcon() {
  const isDark = document.documentElement.classList.contains('dark');
  const icon = document.getElementById('theme-icon');
  if (icon) {
    icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    safeRenderIcons();
  }
}

let currentCart = [];
let orders = JSON.parse(localStorage.getItem('goklin_pwa_orders')) || [];
let expenses = JSON.parse(localStorage.getItem('goklin_pwa_expenses')) || [
  { id: 'EXP-01', date: new Date().toISOString(), category: 'Sabun / Chemical', amount: 150000, notes: 'Deterjen Kiloan 5L & Parfum' },
  { id: 'EXP-02', date: new Date().toISOString(), category: 'Gas LPG', amount: 22000, notes: 'LPG 3kg Pengering' }
];

let customers = JSON.parse(localStorage.getItem('goklin_pwa_customers')) || [
  { name: "Ibu Rangga", phone: "6281234567890", address: "Kost Melati, Jl. Dukuhwaluh Gg. 2", deposit: 0 },
  { name: "Fajar Pratama Teknik", phone: "6289876543210", address: "Kost Putra Garuda, Kembaran", deposit: 0 },
  { name: "Siti Wulandari", phone: "6285712345678", address: "Perum Arcawinangun Indah Blok B", deposit: 5000 }
];

let kostPartners = JSON.parse(localStorage.getItem('goklin_pwa_kost')) || [
  { id: 'K01', name: 'Kost Melati', phone: '6281234567890', rate: 1000 },
  { id: 'K02', name: 'Garuda', phone: '6289876543210', rate: 1000 }
];

const DEFAULT_SERVICES = [
  { id: '1', name: 'GOKIL', cat: 'Kiloan', price: 4000, unit: 'kg', duration: 72 },
  { id: '2', name: 'Cuci Setrika (3 Hari)', cat: 'Kiloan', price: 6000, unit: 'kg', duration: 72 },
  { id: '3', name: 'Cuci Express (1 Hari)', cat: 'Kiloan', price: 10000, unit: 'kg', duration: 24 },
  { id: '4', name: 'Cuci Kilat (4 Jam)', cat: 'Kiloan', price: 30000, unit: 'kg', duration: 4 },
  { id: '5', name: 'Gosok / Setrika Kilat (1 Hari)', cat: 'Kiloan', price: 6000, unit: 'kg', duration: 24 },
  { id: '6', name: 'Gosok / Setrika Kilat (6 Jam)', cat: 'Kiloan', price: 8000, unit: 'kg', duration: 6 },
  { id: '7', name: 'Selimut / Sprei / Handuk / Sajadah', cat: 'Satuan', price: 10000, unit: 'pcs', duration: 48 },
  { id: '8', name: 'Bedcover Kecil', cat: 'Satuan', price: 25000, unit: 'pcs', duration: 72 },
  { id: '9', name: 'Bedcover Besar', cat: 'Satuan', price: 35000, unit: 'pcs', duration: 72 },
  { id: '10', name: 'Cuci Sepatu', cat: 'Satuan', price: 25000, unit: 'pasang', duration: 72 }
];

const DEFAULT_WA_TEMPLATE = "Halo Kak *{nama}*, kami dari *GOKLIN LAUNDRY* menginformasikan bahwa cucian Kakak (No. Nota: *{nota}*) sudah *SELESAI, RAPI & WANGI* ✨\n\n*Total Tagihan:* Rp {total} ({status})\n*Alamat Tujuan:* {alamat}\n\nCucian Kakak sudah siap bisa diambil atau bisa kami antarkan skarang kak? 😊";

const CURRENT_SVC_VER = "35.2_CLOUD_SETTINGS";
if (localStorage.getItem('goklin_svc_ver') !== CURRENT_SVC_VER) {
  localStorage.setItem('goklin_pwa_services', JSON.stringify(DEFAULT_SERVICES));
  localStorage.setItem('goklin_svc_ver', CURRENT_SVC_VER);
}

let services = JSON.parse(localStorage.getItem('goklin_pwa_services')) || DEFAULT_SERVICES;

const CLOUD_URL = "https://script.google.com/macros/s/AKfycbyE_rThs8_8F-K1R22WWuE5X_8nKlpT1VpDxhA47WGSMGdQmklCe36i27bt_Hp8kCPz/exec";

let settings = JSON.parse(localStorage.getItem('goklin_pwa_settings')) || {
  storeName: 'GOKLIN LAUNDRY',
  storeAddress: 'perum tegalsari gg seruni blok 0.02 belakang ump',
  storePhone: '6285716561112',
  storeLogo: '',
  paperWidth: '58mm',
  maxChars: 32,
  feedLines: 3,
  receiptHeader: '',
  receiptFooter: 'Terimakasih telah mempercayakan cucian anda pada GOKLin LAUNDRY',
  yearlyRent: 15000000,
  ownerPin: '1234',
  waReadyTemplate: DEFAULT_WA_TEMPLATE
};

if (!settings.yearlyRent) settings.yearlyRent = 15000000;
if (!settings.ownerPin) settings.ownerPin = '1234';
if (!settings.waReadyTemplate) settings.waReadyTemplate = DEFAULT_WA_TEMPLATE;
if (!settings.maxChars) settings.maxChars = 32;
if (!settings.feedLines) settings.feedLines = 3;

let selectedCustomer = null;
let bluetoothDevice = null;
let printCharacteristic = null;
let editingOrderId = null;
let editingCart = [];
let editingServiceIdx = null;
let editingCustomerIdx = null;
let revenueChartInstance = null;
let activeFilterPreset = 'week';
let pendingPinCallback = null;

function formatDateInput(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function populateSettingsForm() {
  if (document.getElementById('setting-store-name')) document.getElementById('setting-store-name').value = settings.storeName || '';
  if (document.getElementById('setting-store-address')) document.getElementById('setting-store-address').value = settings.storeAddress || '';
  if (document.getElementById('setting-store-phone')) document.getElementById('setting-store-phone').value = settings.storePhone || '';
  if (document.getElementById('setting-store-logo')) document.getElementById('setting-store-logo').value = settings.storeLogo || '';
  if (document.getElementById('setting-yearly-rent')) document.getElementById('setting-yearly-rent').value = settings.yearlyRent || 15000000;
  if (document.getElementById('setting-owner-pin')) document.getElementById('setting-owner-pin').value = settings.ownerPin || '1234';
  if (document.getElementById('setting-wa-ready-template')) document.getElementById('setting-wa-ready-template').value = settings.waReadyTemplate || DEFAULT_WA_TEMPLATE;
  if (document.getElementById('setting-paper-width')) document.getElementById('setting-paper-width').value = settings.paperWidth || '58mm';
  if (document.getElementById('setting-max-chars')) document.getElementById('setting-max-chars').value = settings.maxChars || 32;
  if (document.getElementById('setting-feed-lines')) document.getElementById('setting-feed-lines').value = settings.feedLines || 3;
  if (document.getElementById('setting-receipt-header')) document.getElementById('setting-receipt-header').value = settings.receiptHeader || '';
  if (document.getElementById('setting-receipt-footer')) document.getElementById('setting-receipt-footer').value = settings.receiptFooter || '';
}

window.onload = function() {
  initTheme();
  safeRenderIcons();
  updateClock();
  setInterval(updateClock, 1000);
  populateServicesDropdown();
  renderCart();
  renderOrders();
  renderCustomers();
  renderServicesTable();
  renderExpenses();
  renderManageOrdersTable();

  const now = new Date();
  if (document.getElementById('kost-month-filter')) document.getElementById('kost-month-filter').value = now.getMonth().toString();
  if (document.getElementById('kost-year-filter')) document.getElementById('kost-year-filter').value = now.getFullYear().toString();
  renderKostPartners();

  setFilterPreset('week');
  checkDeliveryAlerts();
  setInterval(checkDeliveryAlerts, 30000);

  if (document.getElementById('expense-date')) document.getElementById('expense-date').value = formatDateInput(new Date());
  populateSettingsForm();
  applyLogoDisplay(settings.storeLogo);
  fetchDataFromCloud();

  document.addEventListener('click', function(e) {
    const searchBox = document.getElementById('cust-search-input');
    const resultsBox = document.getElementById('cust-search-results');
    if (searchBox && resultsBox && !searchBox.contains(e.target) && !resultsBox.contains(e.target)) {
      resultsBox.classList.add('hidden');
    }
  });
};

function applyLogoDisplay(url) {
  const img = document.getElementById('app-header-logo');
  const icon = document.getElementById('app-header-icon');
  if (url && url.trim() !== '') {
    img.src = url.trim();
    img.classList.remove('hidden');
    icon.classList.add('hidden');
  } else {
    img.classList.add('hidden');
    icon.classList.remove('hidden');
  }
}

function onLogoError() {
  document.getElementById('app-header-logo').classList.add('hidden');
  document.getElementById('app-header-icon').classList.remove('hidden');
}

function updateLogoFromInput() {
  const val = document.getElementById('setting-store-logo').value;
  applyLogoDisplay(val);
}

function updateClock() {
  const now = new Date();
  document.getElementById('clock').innerText = now.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
}

function triggerFileInput() {
  const fileInput = document.getElementById('file-vcf-csv');
  if (fileInput) fileInput.click();
}

function importPhoneContacts() {
  if ('contacts' in navigator && 'ContactsManager' in window) {
    navigator.contacts.select(['name', 'tel'], { multiple: true })
      .then(contacts => {
        if (!contacts || contacts.length === 0) return;
        let addedCount = 0;
        contacts.forEach(c => {
          const name = c.name && c.name[0] ? c.name[0] : 'Kontak Tanpa Nama';
          const rawTel = c.tel && c.tel[0] ? c.tel[0].replace(/[^0-9]/g, '') : '';
          if (rawTel) {
            const phone = rawTel.startsWith('0') ? '62' + rawTel.slice(1) : rawTel;
            if (!customers.some(exist => exist.phone === phone)) {
              customers.push({ name, phone, address: 'Buku Telepon', deposit: 0 });
              addedCount++;
            }
          }
        });
        localStorage.setItem('goklin_pwa_customers', JSON.stringify(customers));
        syncToCloud();
        renderCustomers();
        alert(`Berhasil mengimpor ${addedCount} kontak dari HP!`);
      })
      .catch(err => alert("Akses kontak dibatalkan atau tidak diizinkan."));
  } else {
    alert("Browser HP Anda tidak mendukung akses Buku Telepon secara langsung. Gunakan opsi Impor File VCF / CSV.");
  }
}

function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    const text = evt.target.result;
    let addedCount = 0;
    if (file.name.endsWith('.vcf')) {
      const lines = text.split('\n');
      let currentName = '', currentPhone = '';
      lines.forEach(line => {
        if (line.startsWith('FN:')) currentName = line.replace('FN:', '').trim();
        if (line.startsWith('TEL')) {
          const matches = line.match(/[0-9]+/g);
          if (matches) currentPhone = matches.join('');
        }
        if (line.startsWith('END:VCARD')) {
          if (currentName && currentPhone) {
            const phone = currentPhone.startsWith('0') ? '62' + currentPhone.slice(1) : currentPhone;
            if (!customers.some(c => c.phone === phone)) {
              customers.push({ name: currentName, phone: phone, address: 'Impor VCF', deposit: 0 });
              addedCount++;
            }
          }
          currentName = ''; currentPhone = '';
        }
      });
    } else if (file.name.endsWith('.csv')) {
      const lines = text.split('\n');
      lines.forEach(line => {
        const parts = line.split(',');
        if (parts.length >= 2) {
          const name = parts[0].trim().replace(/"/g, '');
          const rawPhone = parts[1].trim().replace(/[^0-9]/g, '');
          if (name && rawPhone) {
            const phone = rawPhone.startsWith('0') ? '62' + rawPhone.slice(1) : rawPhone;
            if (!customers.some(c => c.phone === phone)) {
              customers.push({ name: name, phone: phone, address: parts[2] ? parts[2].trim() : 'Impor CSV', deposit: 0 });
              addedCount++;
            }
          }
        }
      });
    }
    localStorage.setItem('goklin_pwa_customers', JSON.stringify(customers));
    syncToCloud();
    renderCustomers();
    alert(`Berhasil mengimpor ${addedCount} pelanggan baru!`);
  };
  reader.readAsText(file);
}

function exportPelangganExcel() {
  if (customers.length === 0) {
    alert("Database pelanggan kosong.");
    return;
  }
  let csvContent = "data:text/csv;charset=utf-8,Nama,WhatsApp,Alamat,Saldo Deposit\n";
  customers.forEach(c => {
    csvContent += `"${c.name}","${c.phone}","${c.address || '-'}","${c.deposit || 0}"\n`;
  });
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Goklin_Pelanggan_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function exportLaporanExcel() {
  let csvContent = "data:text/csv;charset=utf-8,No Nota,Tanggal,Pelanggan,WhatsApp,Metode Bayar,Status Bayar,Subtotal,Diskon,Total\n";
  orders.forEach(o => {
    csvContent += `"${o.id}","${new Date(o.date).toLocaleDateString('id-ID')}","${o.customer ? o.customer.name : 'Umum'}","${o.customer ? o.customer.phone : '-'}","${o.payMethod}","${o.payStatus}","${o.subtotal}","${o.discount}","${o.grandTotal}"\n`;
  });
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Goklin_Laporan_Omset_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function exportLaporanPDF() {
  const pdfArea = document.getElementById('pdf-report-print');
  let omset = document.getElementById('metric-omset-total').innerText;
  let kas = document.getElementById('metric-expenses-total').innerText;
  let laba = document.getElementById('metric-net-profit').innerText;

  pdfArea.innerHTML = `
    <div style="font-family: sans-serif; padding: 20px;">
      <h2 style="text-align: center; margin-bottom: 5px;">LAPORAN KEUANGAN ${settings.storeName || 'GOKLIN LAUNDRY'}</h2>
      <p style="text-align: center; font-size: 12px; margin-bottom: 20px;">Periode: ${document.getElementById('chart-period-label').innerText}</p>
      <hr>
      <div style="margin: 15px 0; font-size: 14px; line-height: 1.8;">
        <b>Total Omset Kotor:</b> ${omset}<br>
        <b>Total Kas Keluar:</b> ${kas}<br>
        <b>Laba Bersih Murni:</b> ${laba}
      </div>
      <hr>
      <h4>Rincian Transaksi:</h4>
      <table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th>Nota</th><th>Tanggal</th><th>Pelanggan</th><th>Metode</th><th>Status</th><th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(o => `
            <tr>
              <td>${o.id}</td>
              <td>${new Date(o.date).toLocaleDateString('id-ID')}</td>
              <td>${o.customer ? o.customer.name : 'Umum'}</td>
              <td>${o.payMethod}</td>
              <td>${o.payStatus}</td>
              <td align="right">Rp ${Number(o.grandTotal).toLocaleString('id-ID')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  document.body.className = "print-mode-pdf";
  window.print();
  setTimeout(() => { pdfArea.innerHTML = ''; }, 1000);
}

function resetDefaultServicesForce() {
  if (confirm("Reset ulang seluruh daftar layanan dan harga ke standar awal?")) {
    services = [...DEFAULT_SERVICES];
    localStorage.setItem('goklin_pwa_services', JSON.stringify(services));
    syncToCloud();
    renderServicesTable();
    populateServicesDropdown();
    alert("Daftar layanan berhasil di-reset!");
  }
}

async function syncToCloud() {
  if (!CLOUD_URL) return;
  try {
    await fetch(CLOUD_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: "syncAll",
        orders: orders,
        customers: customers,
        services: services,
        expenses: expenses,
        settings: settings,
        kost: kostPartners
      })
    });
  } catch (err) {
    console.error("Cloud sync error:", err);
  }
}

async function fetchDataFromCloud() {
  if (!CLOUD_URL) return;
  const syncBtn = document.getElementById('btn-sync');
  const cloudBadge = document.getElementById('cloud-status-badge');
  if (syncBtn) syncBtn.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>';
  safeRenderIcons();

  try {
    const res = await fetch(`${CLOUD_URL}?action=getData`);
    const json = await res.json();
    if (json.status === "success") {
      if (json.orders) orders = json.orders;
      if (json.customers) customers = json.customers;
      if (json.services) services = json.services;
      if (json.expenses) expenses = json.expenses;
      if (json.kost) kostPartners = json.kost;
      
      if (json.settings) {
        settings = { ...settings, ...json.settings };
        localStorage.setItem('goklin_pwa_settings', JSON.stringify(settings));
      }

      localStorage.setItem('goklin_pwa_orders', JSON.stringify(orders));
      localStorage.setItem('goklin_pwa_customers', JSON.stringify(customers));
      localStorage.setItem('goklin_pwa_services', JSON.stringify(services));
      localStorage.setItem('goklin_pwa_expenses', JSON.stringify(expenses));
      localStorage.setItem('goklin_pwa_kost', JSON.stringify(kostPartners));

      renderOrders();
      renderCustomers();
      renderServicesTable();
      renderExpenses();
      renderManageOrdersTable();
      renderKostPartners();
      populateServicesDropdown();
      populateSettingsForm();
      applyActiveDateFilter();
      checkDeliveryAlerts();

      if (cloudBadge) {
        cloudBadge.innerText = "Online";
        cloudBadge.className = "text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.2 rounded border border-emerald-500/30";
      }
    }
  } catch (err) {
    if (cloudBadge) {
      cloudBadge.innerText = "Offline";
      cloudBadge.className = "text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.2 rounded border border-amber-500/30";
    }
  } finally {
    if (syncBtn) syncBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-3.5 h-3.5 text-indigo-400"></i> <span class="hidden sm:inline">Sinkron</span>';
    safeRenderIcons();
  }
}

function saveKostPartner() {
  const name = document.getElementById('kost-name').value.trim();
  let phone = document.getElementById('kost-owner-phone').value.trim();
  const rate = parseFloat(document.getElementById('kost-commission-rate').value) || 1000;

  if (!name || !phone) { alert("Isi Nama Kost dan WA!"); return; }
  if (phone.startsWith('0')) phone = '62' + phone.slice(1);

  kostPartners.push({ id: `K-${Date.now().toString().slice(-4)}`, name, phone, rate });
  localStorage.setItem('goklin_pwa_kost', JSON.stringify(kostPartners));
  syncToCloud();

  document.getElementById('kost-name').value = '';
  document.getElementById('kost-owner-phone').value = '';
  renderKostPartners();
  alert("Mitra Kost Berhasil Disimpan!");
}

function deleteKostPartner(idx) {
  if (confirm(`Apakah Anda yakin ingin menghapus mitra kost "${kostPartners[idx].name}"?`)) {
    kostPartners.splice(idx, 1);
    localStorage.setItem('goklin_pwa_kost', JSON.stringify(kostPartners));
    syncToCloud();
    renderKostPartners();
    alert("Mitra kost berhasil dihapus!");
  }
}

function editKostPartner(idx) {
  const k = kostPartners[idx];
  if (!k) return;

  const newName = prompt("Edit Kata Kunci / Nama Kost:", k.name);
  if (newName === null) return;

  let newPhone = prompt("Edit No. WA Pemilik Kost:", k.phone);
  if (newPhone === null) return;

  const newRate = prompt("Edit Tarif Komisi (Rp/Kg):", k.rate);
  if (newRate === null) return;

  if (!newName.trim() || !newPhone.trim()) {
    alert("Nama dan No. WA tidak boleh kosong!");
    return;
  }

  if (newPhone.startsWith('0')) newPhone = '62' + newPhone.slice(1);

  kostPartners[idx] = {
    ...kostPartners[idx],
    name: newName.trim(),
    phone: newPhone.trim(),
    rate: parseFloat(newRate) || 1000
  };

  localStorage.setItem('goklin_pwa_kost', JSON.stringify(kostPartners));
  syncToCloud();
  renderKostPartners();
  alert("Data mitra kost berhasil diperbarui!");
}

function renderKostPartners() {
  const tbody = document.getElementById('kost-table-body');
  if (!tbody) return;

  const selectedMonth = parseInt(document.getElementById('kost-month-filter').value, 10);
  const selectedYear = parseInt(document.getElementById('kost-year-filter').value, 10);

  if (kostPartners.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-400">Belum ada mitra kost terdaftar.</td></tr>';
    return;
  }

  tbody.innerHTML = kostPartners.map((k, idx) => {
    let totalNota = 0;
    let totalWeight = 0;
    let totalOmset = 0;

    orders.forEach(o => {
      const oDate = new Date(o.date);
      if (oDate.getMonth() === selectedMonth && oDate.getFullYear() === selectedYear) {
        const addr = (o.customer && o.customer.address) ? o.customer.address.toLowerCase() : '';
        if (addr.includes(k.name.toLowerCase())) {
          totalNota++;
          totalOmset += parseFloat(o.grandTotal || 0);
          (o.items || []).forEach(item => {
            if (item.unit === 'kg') totalWeight += parseFloat(item.qty) || 0;
          });
        }
      }
    });

    const totalCommission = totalWeight * k.rate;

    return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40">
        <td class="p-2.5 font-bold text-slate-800 dark:text-slate-200">
          ${k.name}
          <p class="text-[10px] text-slate-400 font-mono">${k.phone} (Rp ${k.rate}/kg)</p>
        </td>
        <td class="p-2.5 text-center font-bold text-indigo-500">${totalNota} Nota</td>
        <td class="p-2.5 text-right font-bold text-purple-600 font-mono">${totalWeight.toFixed(1)} Kg</td>
        <td class="p-2.5 text-right font-bold text-slate-700 dark:text-slate-300 font-mono">Rp ${totalOmset.toLocaleString('id-ID')}</td>
        <td class="p-2.5 text-right font-black text-emerald-600 font-mono">Rp ${totalCommission.toLocaleString('id-ID')}</td>
        <td class="p-2.5 text-center">
          <div class="flex items-center justify-center gap-1">
            <button onclick="generateKostPDF('${k.name}', '${k.phone}', ${k.rate}, ${selectedMonth}, ${selectedYear})" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2 py-1 rounded-lg text-[10px] shadow-sm" title="Download PDF">
              PDF
            </button>
            <button onclick="sendKostWA('${k.name}', '${k.phone}', ${k.rate}, ${totalNota}, ${totalWeight}, ${totalOmset}, ${totalCommission}, ${selectedMonth}, ${selectedYear})" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-1 rounded-lg text-[10px] shadow-sm" title="Kirim WA">
              WA
            </button>
            <button onclick="editKostPartner(${idx})" class="text-amber-500 hover:text-amber-700 p-1" title="Edit Data Kost">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="deleteKostPartner(${idx})" class="text-red-500 hover:text-red-700 p-1" title="Hapus Kost">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  safeRenderIcons();
}

function generateKostPDF(kostName, phone, rate, month, year) {
  const monthNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let matchedOrders = orders.filter(o => {
    const oDate = new Date(o.date);
    const addr = (o.customer && o.customer.address) ? o.customer.address.toLowerCase() : '';
    return oDate.getMonth() === month && oDate.getFullYear() === year && addr.includes(kostName.toLowerCase());
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`REKAP KOMISI LAUNDRY - ${kostName.toUpperCase()}`, 14, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Periode: ${monthNames[month]} ${year} | No. WA Pemilik: ${phone}`, 14, 24);

  let tableBody = [];
  let grandKg = 0;
  let grandOmset = 0;

  matchedOrders.forEach(o => {
    let kg = 0;
    (o.items || []).forEach(i => { if (i.unit === 'kg') kg += parseFloat(i.qty) || 0; });
    grandKg += kg;
    grandOmset += parseFloat(o.grandTotal || 0);

    tableBody.push([
      o.id,
      new Date(o.date).toLocaleDateString('id-ID'),
      o.customer ? o.customer.name : 'Anak Kost',
      `${kg.toFixed(1)} Kg`,
      `Rp ${Number(o.grandTotal).toLocaleString('id-ID')}`
    ]);
  });

  let totalKomisi = grandKg * rate;

  doc.autoTable({
    startY: 30,
    head: [['No. Nota', 'Tanggal', 'Nama Penghuni', 'Volume (Kg)', 'Total Tagihan']],
    body: tableBody,
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229] }
  });

  let finalY = doc.lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "bold");
  doc.text(`RINGKASAN KOMISI PEMILIK KOST:`, 14, finalY);
  doc.setFont("helvetica", "normal");
  doc.text(`• Total Akumulasi Volume: ${grandKg.toFixed(1)} Kg`, 14, finalY + 6);
  doc.text(`• Tarif Komisi Per Kg: Rp ${rate.toLocaleString('id-ID')} / Kg`, 14, finalY + 12);
  doc.text(`• TOTAL KOMISI BERSIH: Rp ${totalKomisi.toLocaleString('id-ID')}`, 14, finalY + 18);

  doc.save(`Laporan_Komisi_${kostName}_${monthNames[month]}_${year}.pdf`);
}

function sendKostWA(kostName, phone, rate, totalNota, totalWeight, totalOmset, totalCommission, month, year) {
  const monthNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  
  const waMessage = `Halo Pemilik *${kostName}*,\nBerikut rekapitulasi *Komisi Laundry* anak kost periode *${monthNames[month]} ${year}*:\n\n` +
    `• Total Transaksi: *${totalNota} Nota*\n` +
    `• Total Volume Cucian: *${totalWeight.toFixed(1)} Kg*\n` +
    `• Rate Komisi: *Rp ${rate.toLocaleString('id-ID')}/Kg*\n` +
    `• *TOTAL KOMISI CAIR:* *Rp ${totalCommission.toLocaleString('id-ID')}*\n\n` +
    `Rincian nota transaksi lengkap dalam bentuk PDF sudah otomatis kami buatkan. Terima kasih atas kerjasamanya! 🙏✨`;

  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(waMessage)}`, '_blank');
}

function requirePin(actionCallback) {
  pendingPinCallback = actionCallback;
  document.getElementById('input-pin-code').value = '';
  document.getElementById('pin-modal').classList.remove('hidden');
  setTimeout(() => { document.getElementById('input-pin-code').focus(); }, 100);
}

function closePinModal() {
  document.getElementById('pin-modal').classList.add('hidden');
  pendingPinCallback = null;
}

function verifyPinAndProceed() {
  const pinInput = document.getElementById('input-pin-code').value.trim();
  const currentOwnerPin = settings.ownerPin || '1234';

  if (pinInput === currentOwnerPin) {
    const callback = pendingPinCallback;
    closePinModal();
    if (typeof callback === 'function') {
      callback();
    }
  } else {
    alert("❌ PIN Salah! Akses ditolak.");
    document.getElementById('input-pin-code').value = '';
  }
}

function renderManageOrdersTable() {
  const tbody = document.getElementById('orders-manage-table-body');
  const selectAllCb = document.getElementById('select-all-orders');
  if (selectAllCb) selectAllCb.checked = false;

  if (!orders || orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-slate-400 font-medium">Tidak ada transaksi terdaftar.</td></tr>';
    updateBulkDeleteOrdersUI();
    return;
  }

  tbody.innerHTML = orders.map((o) => `
    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-xs">
      <td class="p-2 text-center">
        <input type="checkbox" class="order-checkbox rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer" data-id="${o.id}" onchange="updateBulkDeleteOrdersUI()">
      </td>
      <td class="p-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">${o.id}</td>
      <td class="p-2 font-bold text-slate-800 dark:text-slate-200">${o.customer ? o.customer.name : 'Umum'}</td>
      <td class="p-2 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">Rp ${Number(o.grandTotal || 0).toLocaleString('id-ID')}</td>
      <td class="p-2 text-center">
        <button onclick="requestDeleteSingleOrder('${o.id}')" class="text-red-500 hover:text-red-700 p-1" title="Hapus Transaksi Ini">
          <i data-lucide="trash-2" class="w-3.5 h-3.5 inline"></i>
        </button>
      </td>
    </tr>
  `).join('');

  safeRenderIcons();
  updateBulkDeleteOrdersUI();
}

function toggleSelectAllOrders(isChecked) {
  const checkboxes = document.querySelectorAll('.order-checkbox');
  checkboxes.forEach(cb => cb.checked = isChecked);
  updateBulkDeleteOrdersUI();
}

function updateBulkDeleteOrdersUI() {
  const checkboxes = document.querySelectorAll('.order-checkbox:checked');
  const count = checkboxes.length;
  const btn = document.getElementById('btn-bulk-delete-orders');
  const countLabel = document.getElementById('selected-orders-count');
  
  if (btn && countLabel) {
    countLabel.innerText = count;
    if (count > 0) btn.classList.remove('hidden');
    else btn.classList.add('hidden');
  }

  const allCheckboxes = document.querySelectorAll('.order-checkbox');
  const selectAllCb = document.getElementById('select-all-orders');
  if (selectAllCb && allCheckboxes.length > 0) {
    selectAllCb.checked = (checkboxes.length === allCheckboxes.length);
  }
}

function requestDeleteSingleOrder(orderId) {
  requirePin(() => {
    if (confirm(`Apakah Anda yakin ingin menghapus transaksi nota ${orderId}?`)) {
      orders = orders.filter(o => o.id !== orderId);
      localStorage.setItem('goklin_pwa_orders', JSON.stringify(orders));
      syncToCloud();
      renderOrders();
      renderManageOrdersTable();
      applyActiveDateFilter();
      alert(`Transaksi ${orderId} berhasil dihapus!`);
    }
  });
}

function requestDeleteSelectedOrders() {
  const checkboxes = document.querySelectorAll('.order-checkbox:checked');
  const selectedIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-id'));

  if (selectedIds.length === 0) return;

  requirePin(() => {
    if (confirm(`Apakah Anda yakin ingin MENGHAPUS ${selectedIds.length} transaksi uji coba terpilih?`)) {
      orders = orders.filter(o => !selectedIds.includes(o.id));
      localStorage.setItem('goklin_pwa_orders', JSON.stringify(orders));
      syncToCloud();
      renderOrders();
      renderManageOrdersTable();
      applyActiveDateFilter();
      alert(`Berhasil menghapus ${selectedIds.length} transaksi uji coba!`);
    }
  });
}

function requestMasterReset() {
  requirePin(() => {
    const confirmText = prompt("⚠️ MASTER RESET DATA:\nKetik tulisan 'HAPUS TOTAL' di bawah untuk mengonfirmasi pembersihan seluruh data transaksi:");
    if (confirmText === 'HAPUS TOTAL') {
      orders = [];
      localStorage.setItem('goklin_pwa_orders', JSON.stringify(orders));
      syncToCloud();
      renderOrders();
      renderManageOrdersTable();
      applyActiveDateFilter();
      alert("Seluruh data transaksi uji coba telah dibersihkan secara total!");
    } else if (confirmText !== null) {
      alert("Teks konfirmasi salah. Master Reset dibatalkan.");
    }
  });
}

function addExpense() {
  const dateVal = document.getElementById('expense-date').value;
  const category = document.getElementById('expense-category').value;
  const amount = parseFloat(document.getElementById('expense-amount').value);
  const notes = document.getElementById('expense-notes').value.trim();

  if (!dateVal || isNaN(amount) || amount <= 0) {
    alert("Mohon masukan tanggal dan nominal pengeluaran dengan benar.");
    return;
  }

  const newExpense = {
    id: `EXP-${Date.now().toString().slice(-4)}`,
    date: new Date(dateVal).toISOString(),
    category: category,
    amount: amount,
    notes: notes || '-'
  };

  expenses.unshift(newExpense);
  localStorage.setItem('goklin_pwa_expenses', JSON.stringify(expenses));
  syncToCloud();

  document.getElementById('expense-amount').value = '';
  document.getElementById('expense-notes').value = '';
  renderExpenses();
  applyActiveDateFilter();
  alert("Pengeluaran operasional tersimpan!");
}

function deleteExpense(idx) {
  if (confirm(`Hapus catatan pengeluaran "${expenses[idx].category} - Rp ${expenses[idx].amount.toLocaleString('id-ID')}"?`)) {
    expenses.splice(idx, 1);
    localStorage.setItem('goklin_pwa_expenses', JSON.stringify(expenses));
    syncToCloud();
    renderExpenses();
    applyActiveDateFilter();
  }
}

function renderExpenses() {
  const tbody = document.getElementById('expense-table-body');
  let totalAmount = 0;

  if (expenses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-slate-400 font-medium">Belum ada pengeluaran dicatat.</td></tr>';
    document.getElementById('expense-total-badge').innerText = 'Total: Rp 0';
    return;
  }

  tbody.innerHTML = expenses.map((exp, idx) => {
    totalAmount += parseFloat(exp.amount) || 0;
    return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-xs">
        <td class="p-2.5 font-medium text-slate-600 dark:text-slate-400">${new Date(exp.date).toLocaleDateString('id-ID')}</td>
        <td class="p-2.5 font-bold text-slate-800 dark:text-slate-200">${exp.category}</td>
        <td class="p-2.5 text-slate-600 dark:text-slate-400">${exp.notes}</td>
        <td class="p-2.5 text-right font-bold text-red-600 dark:text-red-400 font-mono">Rp ${Number(exp.amount).toLocaleString('id-ID')}</td>
        <td class="p-2.5 text-center">
          <button onclick="deleteExpense(${idx})" class="text-red-500 hover:text-red-700 p-1">
            <i data-lucide="trash-2" class="w-3.5 h-3.5 inline"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  document.getElementById('expense-total-badge').innerText = `Total: Rp ${totalAmount.toLocaleString('id-ID')}`;
  safeRenderIcons();
}

function filterCustomerSearch() {
  const q = document.getElementById('cust-search-input').value.toLowerCase().trim();
  const resultsContainer = document.getElementById('cust-search-results');

  if (!q) {
    resultsContainer.classList.add('hidden');
    return;
  }

  const matches = customers.filter(c => 
    c.name.toLowerCase().includes(q) || 
    c.phone.includes(q) || 
    (c.address && c.address.toLowerCase().includes(q))
  );

  if (matches.length === 0) {
    resultsContainer.innerHTML = `
      <div class="p-3 text-xs text-slate-500 dark:text-slate-400 text-center">
        Pelanggan tidak ditemukan. <button onclick="openQuickNewCustModal('${q}')" class="text-indigo-600 dark:text-indigo-400 font-bold underline ml-1">+ Tambah Baru</button>
      </div>`;
  } else {
    resultsContainer.innerHTML = matches.map(c => `
      <div onclick="selectCustomerDirect('${c.phone}')" class="p-2.5 hover:bg-indigo-50 dark:hover:bg-slate-700/60 cursor-pointer border-b last:border-b-0 border-slate-100 dark:border-slate-700 transition flex justify-between items-center text-xs">
        <div>
          <span class="font-extrabold text-slate-900 dark:text-slate-100">${c.name}</span>
          <p class="text-[11px] text-slate-500 dark:text-slate-400 font-medium">${c.phone} • Saldo Deposit: Rp ${Number(c.deposit || 0).toLocaleString('id-ID')}</p>
        </div>
        <span class="text-[10px] bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 font-bold px-2 py-0.5 rounded-md">Pilih</span>
      </div>
    `).join('');
  }
  resultsContainer.classList.remove('hidden');
}

function selectCustomerDirect(phone) {
  const c = customers.find(item => item.phone === phone);
  if (c) {
    selectedCustomer = c;
    document.getElementById('selected-cust-name-text').innerText = c.name;
    document.getElementById('selected-cust-phone-text').innerText = c.phone;
    document.getElementById('selected-cust-address-text').innerText = c.address || 'Alamat tidak diisi';

    const depInfo = document.getElementById('cust-deposit-info');
    const depText = document.getElementById('selected-cust-deposit-text');
    const depCheck = document.getElementById('use-deposit-checkbox');

    if ((c.deposit || 0) > 0) {
      if (depText) depText.innerText = `Rp ${Number(c.deposit).toLocaleString('id-ID')}`;
      if (depInfo) depInfo.classList.remove('hidden');
      if (depCheck) depCheck.checked = false;
    } else {
      if (depInfo) depInfo.classList.add('hidden');
      if (depCheck) depCheck.checked = false;
    }

    document.getElementById('cust-search-section').classList.add('hidden');
    document.getElementById('cust-selected-card').classList.remove('hidden');
    document.getElementById('cust-search-results').classList.add('hidden');
    calculateTotal();
  }
}

function resetCustomerSelection() {
  selectedCustomer = null;
  document.getElementById('cust-search-input').value = '';
  document.getElementById('cust-search-section').classList.remove('hidden');
  document.getElementById('cust-selected-card').classList.add('hidden');
  calculateTotal();
}

function toggleDiscountInput() {
  const container = document.getElementById('discount-input-container');
  if (container) {
    container.classList.toggle('hidden');
    if (container.classList.contains('hidden')) {
      const discInput = document.getElementById('discount-amount');
      if (discInput) discInput.value = '0';
      calculateTotal();
    }
  }
}

function togglePaidAmountInput() {
  const status = document.getElementById('pay-status').value;
  const container = document.getElementById('paid-amount-container');
  if (container) {
    if (status === 'LUNAS') {
      container.classList.remove('hidden');
    } else {
      container.classList.add('hidden');
      const paidInput = document.getElementById('paid-amount');
      if (paidInput) paidInput.value = '';
      calculateOverpayment();
    }
  }
}

function openQuickNewCustModal(initialName = '') {
  document.getElementById('quick-cust-name').value = typeof initialName === 'string' ? initialName : '';
  document.getElementById('quick-cust-phone').value = '';
  document.getElementById('quick-cust-address').value = '';
  document.getElementById('quick-cust-modal').classList.remove('hidden');
}

function closeQuickNewCustModal() {
  document.getElementById('quick-cust-modal').classList.add('hidden');
}

function saveQuickCustomer() {
  const name = document.getElementById('quick-cust-name').value.trim();
  const rawPhone = document.getElementById('quick-cust-phone').value.trim();
  const address = document.getElementById('quick-cust-address').value.trim();

  if (!name || !rawPhone) {
    alert('Mohon isi nama dan no WhatsApp.');
    return;
  }

  const phone = rawPhone.startsWith('0') ? '62' + rawPhone.slice(1) : rawPhone;
  const newCust = { name, phone, address, deposit: 0 };
  
  const existIdx = customers.findIndex(c => c.phone === phone);
  if (existIdx >= 0) {
    customers[existIdx] = { ...customers[existIdx], name, address };
  } else {
    customers.push(newCust);
  }

  localStorage.setItem('goklin_pwa_customers', JSON.stringify(customers));
  syncToCloud();

  closeQuickNewCustModal();
  selectCustomerDirect(phone);
  renderCustomers();
}

function populateServicesDropdown() {
  const sel = document.getElementById('item-service');
  const editSel = document.getElementById('edit-add-service-select');
  let kiloan = [];
  let satuan = [];

  services.forEach((s, index) => {
    const optionHTML = `<option value="${index}">${s.name} (Rp ${Number(s.price).toLocaleString('id-ID')}/${s.unit})</option>`;
    if (s.cat === 'Kiloan') {
      kiloan.push(optionHTML);
    } else {
      satuan.push(optionHTML);
    }
  });

  let finalHTML = '';
  if (kiloan.length > 0) finalHTML += `<optgroup label="--- LAYANAN KILOAN ---">${kiloan.join('')}</optgroup>`;
  if (satuan.length > 0) finalHTML += `<optgroup label="--- LAYANAN SATUAN ---">${satuan.join('')}</optgroup>`;

  if (sel) sel.innerHTML = finalHTML;
  if (editSel) editSel.innerHTML = finalHTML;
  onServiceChange();
}

function onServiceChange() {
  const idx = parseInt(document.getElementById('item-service').value, 10);
  const s = services[idx];
  if (s) {
    document.getElementById('unit-label').innerText = s.unit;
  }
}

function addItemToCart() {
  const idx = parseInt(document.getElementById('item-service').value, 10);
  const s = services[idx];
  if (!s) {
    alert('Silakan pilih layanan terlebih dahulu.');
    return;
  }

  const qtyInput = document.getElementById('item-qty');
  const qty = parseFloat(qtyInput.value) || 1;
  const price = Number(s.price) || 0;
  const subtotal = price * qty;

  currentCart.push({
    name: s.name,
    price: price,
    unit: s.unit,
    duration: Number(s.duration) || 72,
    qty: qty,
    subtotal: subtotal
  });

  renderCart();
  qtyInput.value = '1';
}

function removeItemFromCart(index) {
  currentCart.splice(index, 1);
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cart-list');
  if (currentCart.length === 0) {
    container.innerHTML = '<p class="text-center text-xs text-slate-400 py-6 font-medium">Belum ada item ditambahkan</p>';
  } else {
    container.innerHTML = currentCart.map((item, idx) => `
      <div class="flex justify-between items-center bg-slate-50 dark:bg-slate-800/80 p-2 rounded-xl border border-slate-100 dark:border-slate-700/60 text-xs">
        <div>
          <p class="font-bold text-slate-900 dark:text-slate-100">${item.name}</p>
          <p class="text-slate-500 dark:text-slate-400 text-[11px] font-medium">${item.qty} ${item.unit} x Rp ${Number(item.price).toLocaleString('id-ID')}</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-bold text-indigo-600 dark:text-indigo-400 font-mono">Rp ${Number(item.subtotal).toLocaleString('id-ID')}</span>
          <button onclick="removeItemFromCart(${idx})" class="text-red-400 hover:text-red-600 p-1">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `).join('');
    safeRenderIcons();
  }
  calculateTotal();
}

function calculateTotal() {
  const subtotal = currentCart.reduce((sum, item) => sum + Number(item.subtotal), 0);

  const discountInput = document.getElementById('discount-amount');
  const discountTypeEl = document.getElementById('discount-type');
  const discVal = discountInput ? (parseFloat(discountInput.value) || 0) : 0;
  const discType = discountTypeEl ? discountTypeEl.value : 'flat';

  let manualDiscount = 0;
  if (discType === 'percent') {
    manualDiscount = Math.round((subtotal * discVal) / 100);
  } else {
    manualDiscount = discVal;
  }

  let totalBeforeDeposit = Math.max(0, subtotal - manualDiscount);
  let depositDeduction = 0;

  const useDepositChk = document.getElementById('use-deposit-checkbox');
  if (useDepositChk && useDepositChk.checked && selectedCustomer && (selectedCustomer.deposit || 0) > 0) {
    depositDeduction = Math.min(selectedCustomer.deposit, totalBeforeDeposit);
  }

  const grandTotal = Math.max(0, totalBeforeDeposit - depositDeduction);

  const subDisplay = document.getElementById('subtotal-display');
  if (subDisplay) subDisplay.innerText = `Rp ${Number(subtotal).toLocaleString('id-ID')}`;
  
  const depRow = document.getElementById('deposit-deduction-row');
  const depDisplay = document.getElementById('deposit-deduction-display');
  if (depRow && depDisplay) {
    if (depositDeduction > 0) {
      depRow.classList.remove('hidden');
      depDisplay.innerText = `-Rp ${depositDeduction.toLocaleString('id-ID')}`;
    } else {
      depRow.classList.add('hidden');
    }
  }

  const grandDisplay = document.getElementById('grand-total-display');
  if (grandDisplay) grandDisplay.innerText = `Rp ${Number(grandTotal).toLocaleString('id-ID')}`;

  calculateOverpayment(grandTotal);
  return { subtotal, discount: manualDiscount, depositDeduction, grandTotal };
}

function calculateOverpayment(grandTotal) {
  if (grandTotal === undefined) {
    const subtotal = currentCart.reduce((sum, item) => sum + Number(item.subtotal), 0);
    const discountInput = document.getElementById('discount-amount');
    const discountTypeEl = document.getElementById('discount-type');
    const discVal = discountInput ? (parseFloat(discountInput.value) || 0) : 0;
    const discType = discountTypeEl ? discountTypeEl.value : 'flat';
    let manualDiscount = (discType === 'percent') ? Math.round((subtotal * discVal) / 100) : discVal;
    let totalBeforeDeposit = Math.max(0, subtotal - manualDiscount);
    let depositDeduction = 0;
    const useDepositChk = document.getElementById('use-deposit-checkbox');
    if (useDepositChk && useDepositChk.checked && selectedCustomer && (selectedCustomer.deposit || 0) > 0) {
      depositDeduction = Math.min(selectedCustomer.deposit, totalBeforeDeposit);
    }
    grandTotal = Math.max(0, totalBeforeDeposit - depositDeduction);
  }

  const paidAmtEl = document.getElementById('paid-amount');
  const paid = paidAmtEl ? (parseFloat(paidAmtEl.value) || 0) : 0;
  const payStatusEl = document.getElementById('pay-status');
  const payStatus = payStatusEl ? payStatusEl.value : 'LUNAS';
  const overBadge = document.getElementById('overpayment-badge');
  const overText = document.getElementById('overpayment-amount-text');
  const excessChoiceContainer = document.getElementById('excess-choice-container');

  if (payStatus === 'LUNAS' && paid > grandTotal && grandTotal > 0) {
    const extra = paid - grandTotal;
    const selectedOption = document.querySelector('input[name="excess-option"]:checked')?.value || 'kembalian';
    
    if (overText) {
      if (selectedOption === 'deposit') {
        overText.innerText = `+ Deposit Rp ${extra.toLocaleString('id-ID')}`;
      } else {
        overText.innerText = `Kembalian Rp ${extra.toLocaleString('id-ID')}`;
      }
    }
    if (overBadge) overBadge.classList.remove('hidden');
    if (excessChoiceContainer) excessChoiceContainer.classList.remove('hidden');
  } else {
    if (overBadge) overBadge.classList.add('hidden');
    if (excessChoiceContainer) excessChoiceContainer.classList.add('hidden');
  }
}

function resetCart() {
  currentCart = [];
  resetCustomerSelection();
  document.getElementById('item-notes').value = '';
  document.getElementById('discount-amount').value = '0';
  const paidInput = document.getElementById('paid-amount');
  if (paidInput) paidInput.value = '';
  renderCart();
}

function saveTransaction() {
  if (!selectedCustomer) {
    alert('Mohon pilih pelanggan terlebih dahulu di Langkah 1.');
    return;
  }
  if (currentCart.length === 0) {
    alert('Tambahkan minimal 1 jenis cucian di Langkah 2.');
    return;
  }

  const maxHours = Math.max(...currentCart.map(i => Number(i.duration) || 72));
  const orderDate = new Date();
  const readyDate = new Date(orderDate.getTime() + maxHours * 3600 * 1000);

  const { subtotal, discount, depositDeduction, grandTotal } = calculateTotal();
  const paidAmtEl = document.getElementById('paid-amount');
  const paid = paidAmtEl ? (parseFloat(paidAmtEl.value) || 0) : 0;
  const payStatusEl = document.getElementById('pay-status');
  const payStatus = payStatusEl ? payStatusEl.value : 'LUNAS';

  let extraDepositAdded = 0;
  let changeAmount = 0;

  if (payStatus === 'LUNAS' && paid > grandTotal) {
    const extra = paid - grandTotal;
    const excessOption = document.querySelector('input[name="excess-option"]:checked')?.value || 'kembalian';
    if (excessOption === 'deposit') {
      extraDepositAdded = extra;
    } else {
      changeAmount = extra;
    }
  }

  const custIndex = customers.findIndex(c => c.phone === selectedCustomer.phone);
  if (custIndex >= 0) {
    customers[custIndex].deposit = (customers[custIndex].deposit || 0) - depositDeduction + extraDepositAdded;
    localStorage.setItem('goklin_pwa_customers', JSON.stringify(customers));
  }

  const yyyy = orderDate.getFullYear();
  const mm = (orderDate.getMonth() + 1).toString().padStart(2, '0');
  const dd = orderDate.getDate().toString().padStart(2, '0');
  const hh = orderDate.getHours().toString().padStart(2, '0');
  const min = orderDate.getMinutes().toString().padStart(2, '0');
  const ss = orderDate.getSeconds().toString().padStart(2, '0');
  const rand = Math.floor(Math.random() * 90 + 10);
  const invoiceNo = `TRS-${yyyy}${mm}${dd}${hh}${min}${ss}${rand}`;

  const chosenPayMethod = document.getElementById('pay-method').value;

  const newOrder = {
    id: invoiceNo,
    date: orderDate.toISOString(),
    readyAt: readyDate.toISOString(),
    durationHours: maxHours,
    customer: { 
      name: selectedCustomer.name, 
      phone: selectedCustomer.phone, 
      address: selectedCustomer.address || '-' 
    },
    items: [...currentCart],
    notes: document.getElementById('item-notes').value.trim(),
    subtotal: subtotal,
    discount: discount,
    depositDeduction: depositDeduction,
    grandTotal: grandTotal,
    paidAmount: paid,
    changeAmount: changeAmount,
    payMethod: chosenPayMethod,
    payStatus: payStatus,
    status: 'Sedang Diproses'
  };

  orders.unshift(newOrder);
  localStorage.setItem('goklin_pwa_orders', JSON.stringify(orders));
  syncToCloud();

  let msg = `Transaksi ${invoiceNo} berhasil disimpan!`;
  if (depositDeduction > 0) {
    msg += `\n- Saldo deposit terpakai: Rp ${depositDeduction.toLocaleString('id-ID')}`;
  }
  if (extraDepositAdded > 0) {
    msg += `\n+ Kelebihan bayar Rp ${extraDepositAdded.toLocaleString('id-ID')} masuk ke saldo deposit pelanggan!`;
  } else if (changeAmount > 0) {
    msg += `\n💵 Kembalian Tunai: Rp ${changeAmount.toLocaleString('id-ID')}`;
  }
  alert(msg);

  sendWhatsAppInvoiceById(newOrder.id);

  if (confirm('Transaksi tersimpan! Mau cetak struk sekarang?')) {
    smartPrintById(newOrder.id);
  }

  resetCart();
  renderOrders();
  renderCustomers();
  renderManageOrdersTable();
  applyActiveDateFilter();
  checkDeliveryAlerts();

  switchMainTab('antrean');
}

function setFilterPreset(preset) {
  activeFilterPreset = preset;
  const now = new Date();
  let start = new Date();
  let end = new Date();

  ['today', 'week', 'month', 'year'].forEach(p => {
    const btn = document.getElementById(`filter-${p}`);
    if (btn) {
      btn.className = (p === preset) ? 
        "px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold" : 
        "px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700";
    }
  });

  if (preset === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    document.getElementById('chart-period-label').innerText = "Hari Ini";
  } else if (preset === 'week') {
    start = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);
    document.getElementById('chart-period-label').innerText = "7 Hari Terakhir";
  } else if (preset === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    document.getElementById('chart-period-label').innerText = "Bulan Ini";
  } else if (preset === 'year') {
    start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    document.getElementById('chart-period-label').innerText = "Tahun Ini";
  }

  document.getElementById('filter-start-date').value = formatDateInput(start);
  document.getElementById('filter-end-date').value = formatDateInput(end);

  calculateAndRenderAnalytics(start, end);
}

function applyCustomDateFilter() {
  const sVal = document.getElementById('filter-start-date').value;
  const eVal = document.getElementById('filter-end-date').value;
  if (!sVal || !eVal) return;

  const start = new Date(sVal + "T00:00:00");
  const end = new Date(eVal + "T23:59:59");

  ['today', 'week', 'month', 'year'].forEach(p => {
    const btn = document.getElementById(`filter-${p}`);
    if (btn) btn.className = "px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700";
  });

  document.getElementById('chart-period-label').innerText = `${sVal} s/d ${eVal}`;
  calculateAndRenderAnalytics(start, end);
}

function applyActiveDateFilter() {
  applyCustomDateFilter();
}

function calculateAndRenderAnalytics(startDate, endDate) {
  let totalOmset = 0;
  let totalQris = 0;
  let totalCash = 0;
  let totalWeight = 0;
  let totalOrders = 0;
  let totalUnpaid = 0;
  let dateMap = {};

  orders.forEach(o => {
    const oDate = new Date(o.date);
    if (oDate >= startDate && oDate <= endDate) {
      const grandTotal = parseFloat(o.grandTotal) || 0;
      totalOmset += grandTotal;
      totalOrders++;

      if (o.payMethod === 'QRIS') totalQris += grandTotal;
      else totalCash += grandTotal;

      if (o.payStatus !== 'LUNAS') {
        totalUnpaid += grandTotal;
      }

      if (o.items && Array.isArray(o.items)) {
        o.items.forEach(item => {
          if (item.unit === 'kg') {
            totalWeight += parseFloat(item.qty) || 0;
          }
        });
      }

      const dateKey = oDate.toLocaleDateString('id-ID', {day:'numeric', month:'short'});
      dateMap[dateKey] = (dateMap[dateKey] || 0) + grandTotal;
    }
  });

  let totalExpenseInPeriod = 0;
  expenses.forEach(exp => {
    const expDate = new Date(exp.date);
    if (expDate >= startDate && expDate <= endDate) {
      totalExpenseInPeriod += parseFloat(exp.amount) || 0;
    }
  });

  const yearlyRent = parseFloat(settings.yearlyRent) || 15000000;
  const monthlyRentAllocation = Math.round(yearlyRent / 12);
  
  // RUMUS REVISI: Omset Bersih -> Potong Cadangan Darurat 10% -> Gaji Owner (90%)
  const omsetBersih = totalOmset - totalExpenseInPeriod - monthlyRentAllocation;
  const cadanganDarurat = omsetBersih > 0 ? Math.round(omsetBersih * 0.10) : 0;
  const goklinOwnerIncome = omsetBersih > 0 ? (omsetBersih - cadanganDarurat) : omsetBersih;
  
  const avgOrder = totalOrders > 0 ? Math.round(totalOmset / totalOrders) : 0;

  document.getElementById('metric-omset-total').innerText = `Rp ${totalOmset.toLocaleString('id-ID')}`;
  document.getElementById('metric-qris-total').innerText = `Rp ${totalQris.toLocaleString('id-ID')}`;
  document.getElementById('metric-cash-total').innerText = `Rp ${totalCash.toLocaleString('id-ID')}`;
  document.getElementById('metric-expenses-total').innerText = `Rp ${totalExpenseInPeriod.toLocaleString('id-ID')}`;
  document.getElementById('metric-expenses-count').innerText = `${expenses.length} Item Kas Keluar`;
  document.getElementById('metric-rent-allocation').innerText = `Rp ${monthlyRentAllocation.toLocaleString('id-ID')}`;
  
  if (document.getElementById('metric-emergency-fund')) {
    document.getElementById('metric-emergency-fund').innerText = `Rp ${cadanganDarurat.toLocaleString('id-ID')}`;
  }

  const netProfitEl = document.getElementById('metric-net-profit');
  netProfitEl.innerText = `Rp ${goklinOwnerIncome.toLocaleString('id-ID')}`;

  if (goklinOwnerIncome < 0) {
    netProfitEl.className = "text-xl sm:text-2xl font-black text-red-400 font-mono mt-0.5";
  } else {
    netProfitEl.className = "text-xl sm:text-2xl font-black text-emerald-400 font-mono mt-0.5";
  }

  document.getElementById('metric-weight-total').innerText = `${totalWeight.toFixed(1)} Kg`;
  document.getElementById('metric-avg-order').innerText = `Rp ${avgOrder.toLocaleString('id-ID')}`;
  document.getElementById('metric-unpaid-total').innerText = `Rp ${totalUnpaid.toLocaleString('id-ID')}`;

  renderRevenueChart(dateMap);
}

function renderRevenueChart(dateMap) {
  const ctx = document.getElementById('revenueChart');
  if (!ctx) return;

  const labels = Object.keys(dateMap);
  const dataValues = Object.values(dateMap);

  if (revenueChartInstance) {
    revenueChartInstance.destroy();
  }

  const isDark = document.documentElement.classList.contains('dark');

  revenueChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length > 0 ? labels : ['Tidak Ada Data'],
      datasets: [{
        label: 'Omset (Rp)',
        data: dataValues.length > 0 ? dataValues : [0],
        backgroundColor: isDark ? 'rgba(99, 102, 241, 0.85)' : 'rgba(79, 70, 229, 0.85)',
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 1.5,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return 'Rp ' + Number(context.raw).toLocaleString('id-ID');
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: isDark ? '#94a3b8' : '#64748b' },
          grid: { color: isDark ? '#334155' : '#e2e8f0' }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: isDark ? '#94a3b8' : '#64748b',
            callback: function(value) {
              return 'Rp ' + (value >= 1000 ? (value/1000) + 'k' : value);
            }
          },
          grid: { color: isDark ? '#334155' : '#e2e8f0' }
        }
      }
    }
  });
}

function openCustomerDetailModal(phone) {
  const c = customers.find(item => item.phone === phone);
  if (!c) return;

  const custOrders = orders.filter(o => o.customer && (o.customer.phone === c.phone || o.customer.name.toLowerCase() === c.name.toLowerCase()));
  
  let totalVisits = custOrders.length;
  let totalSpent = 0;
  let totalKg = 0;

  custOrders.forEach(o => {
    totalSpent += parseFloat(o.grandTotal) || 0;
    if (o.items) {
      o.items.forEach(i => {
        if (i.unit === 'kg') totalKg += parseFloat(i.qty) || 0;
      });
    }
  });

  document.getElementById('cd-modal-name').innerText = c.name;
  document.getElementById('cd-modal-contact').innerText = `${c.phone} • ${c.address || 'Alamat belum diisi'}`;
  document.getElementById('cd-modal-visits').innerText = `${totalVisits} Kali`;
  document.getElementById('cd-modal-weight').innerText = `${totalKg.toFixed(1)} Kg`;
  document.getElementById('cd-modal-spent').innerText = `Rp ${totalSpent.toLocaleString('id-ID')}`;

  const tbody = document.getElementById('cd-modal-table-body');
  if (custOrders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-slate-400">Belum ada riwayat transaksi.</td></tr>';
  } else {
    tbody.innerHTML = custOrders.map(o => {
      let itemsDesc = (o.items || []).map(i => `${i.name} (${i.qty} ${i.unit})`).join(', ');
      return `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40">
          <td class="p-2">
            <span class="font-bold text-indigo-600 dark:text-indigo-400">${o.id}</span>
            <p class="text-[10px] text-slate-400">${new Date(o.date).toLocaleDateString('id-ID')}</p>
          </td>
          <td class="p-2 text-slate-700 dark:text-slate-300">${itemsDesc}</td>
          <td class="p-2 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">Rp ${Number(o.grandTotal).toLocaleString('id-ID')}</td>
          <td class="p-2 text-center">
            <span class="text-[9px] px-1.5 py-0.5 rounded font-bold ${o.payStatus === 'LUNAS' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'}">${o.payStatus}</span>
          </td>
        </tr>
      `;
    }).join('');
  }

  document.getElementById('customer-detail-modal').classList.remove('hidden');
}

function closeCustomerDetailModal() {
  document.getElementById('customer-detail-modal').classList.add('hidden');
}

function openEditCustomerModal(idx) {
  const c = customers[idx];
  if (!c) return;
  editingCustomerIdx = idx;
  document.getElementById('edit-cust-db-name').value = c.name || '';
  document.getElementById('edit-cust-db-phone').value = c.phone || '';
  document.getElementById('edit-cust-db-address').value = c.address || '';
  document.getElementById('edit-customer-modal').classList.remove('hidden');
}

function closeEditCustomerModal() {
  document.getElementById('edit-customer-modal').classList.add('hidden');
  editingCustomerIdx = null;
}

function saveEditedCustomer() {
  if (editingCustomerIdx === null) return;
  const name = document.getElementById('edit-cust-db-name').value.trim();
  const rawPhone = document.getElementById('edit-cust-db-phone').value.trim();
  const address = document.getElementById('edit-cust-db-address').value.trim();

  if (!name || !rawPhone) {
    alert('Mohon isi nama dan No WhatsApp.');
    return;
  }

  const phone = rawPhone.startsWith('0') ? '62' + rawPhone.slice(1) : rawPhone;
  customers[editingCustomerIdx] = { ...customers[editingCustomerIdx], name, phone, address };

  localStorage.setItem('goklin_pwa_customers', JSON.stringify(customers));
  syncToCloud();

  renderCustomers();
  closeEditCustomerModal();
  alert('Data pelanggan berhasil diperbarui!');
}

function openEditModal(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  editingOrderId = orderId;
  editingCart = JSON.parse(JSON.stringify(order.items || []));

  document.getElementById('edit-order-id').innerText = order.id;
  document.getElementById('edit-cust-name').value = order.customer ? order.customer.name : '';
  document.getElementById('edit-cust-phone').value = order.customer ? order.customer.phone : '';
  document.getElementById('edit-cust-address').value = order.customer ? order.customer.address : '';
  document.getElementById('edit-pay-method').value = order.payMethod || 'QRIS';
  document.getElementById('edit-pay-status').value = order.payStatus || 'LUNAS';
  document.getElementById('edit-discount').value = Number(order.discount) || 0;

  populateServicesDropdown();
  renderEditCart();
  document.getElementById('edit-order-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-order-modal').classList.add('hidden');
  editingOrderId = null;
  editingCart = [];
}

function renderEditCart() {
  const list = document.getElementById('edit-items-list');
  if (editingCart.length === 0) {
    list.innerHTML = '<p class="text-center text-xs text-slate-400 py-3">Tidak ada item layanan.</p>';
  } else {
    list.innerHTML = editingCart.map((item, idx) => `
      <div class="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
        <div class="flex-1 pr-2">
          <span class="font-bold text-slate-800 dark:text-slate-200">${item.name}</span>
          <p class="text-[11px] text-slate-500 dark:text-slate-400">Rp ${Number(item.price).toLocaleString('id-ID')} / ${item.unit}</p>
        </div>
        <div class="flex items-center gap-1.5">
          <input type="number" step="0.1" value="${item.qty}" min="0.1" oninput="changeEditQty(${idx}, this.value)" class="w-16 text-center font-bold px-1.5 py-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs">
          <span class="text-[10px] text-slate-500 dark:text-slate-400">${item.unit}</span>
          <button onclick="removeEditItem(${idx})" class="text-red-500 hover:text-red-700 p-1">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `).join('');
    safeRenderIcons();
  }
  recalcEditTotal();
}

function changeEditQty(idx, newQty) {
  const q = parseFloat(newQty) || 0;
  if (editingCart[idx]) {
    editingCart[idx].qty = q;
    editingCart[idx].subtotal = (Number(editingCart[idx].price) || 0) * q;
  }
  recalcEditTotal();
}

function removeEditItem(idx) {
  editingCart.splice(idx, 1);
  renderEditCart();
}

function addItemInEditModal() {
  const idx = parseInt(document.getElementById('edit-add-service-select').value, 10);
  const s = services[idx];
  if (!s) return;

  const qty = parseFloat(document.getElementById('edit-add-service-qty').value) || 1;
  const price = Number(s.price) || 0;

  editingCart.push({
    name: s.name,
    price: price,
    unit: s.unit,
    duration: Number(s.duration) || 72,
    qty: qty,
    subtotal: price * qty
  });

  renderEditCart();
  document.getElementById('edit-add-service-qty').value = '1';
}

function recalcEditTotal() {
  const subtotal = editingCart.reduce((sum, i) => sum + (Number(i.subtotal) || 0), 0);
  const discount = parseFloat(document.getElementById('edit-discount').value) || 0;
  const grandTotal = Math.max(0, subtotal - discount);

  document.getElementById('edit-grand-total').innerText = `Rp ${Number(grandTotal).toLocaleString('id-ID')}`;
  return { subtotal, discount, grandTotal };
}

function saveEditedOrder() {
  if (!editingOrderId) return;
  const order = orders.find(o => o.id === editingOrderId);
  if (!order) return;

  const newName = document.getElementById('edit-cust-name').value.trim();
  const newPhone = document.getElementById('edit-cust-phone').value.trim();
  const newAddress = document.getElementById('edit-cust-address').value.trim();

  if (!newName || !newPhone) {
    alert('Mohon isi nama dan No WhatsApp.');
    return;
  }
  if (editingCart.length === 0) {
    alert('Item cucian tidak boleh kosong.');
    return;
  }

  const { subtotal, discount, grandTotal } = recalcEditTotal();

  if (!order.customer) order.customer = {};
  order.customer.name = newName;
  order.customer.phone = newPhone.startsWith('0') ? '62' + newPhone.slice(1) : newPhone;
  order.customer.address = newAddress;
  order.payMethod = document.getElementById('edit-pay-method').value;
  order.payStatus = document.getElementById('edit-pay-status').value;
  order.items = [...editingCart];
  order.subtotal = subtotal;
  order.discount = discount;
  order.grandTotal = grandTotal;

  localStorage.setItem('goklin_pwa_orders', JSON.stringify(orders));
  syncToCloud();

  alert('Nota transaksi berhasil diperbarui!');
  closeEditModal();
  renderOrders();
  renderManageOrdersTable();
  applyActiveDateFilter();
}

function switchMainTab(tabName) {
  ['kasir', 'antrean', 'pengaturan'].forEach(t => {
    document.getElementById(`view-${t}`).classList.add('hidden');
    const dTab = document.getElementById(`tab-${t}`);
    if(dTab) {
      dTab.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
      dTab.classList.add('text-slate-400');
    }
    const mTab = document.getElementById(`mob-tab-${t}`);
    if(mTab) {
      mTab.classList.remove('text-indigo-400');
      mTab.classList.add('text-slate-400');
    }
  });

  document.getElementById(`view-${tabName}`).classList.remove('hidden');

  const activeDTab = document.getElementById(`tab-${tabName}`);
  if(activeDTab) {
    activeDTab.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
    activeDTab.classList.remove('text-slate-400');
  }

  const activeMTab = document.getElementById(`mob-tab-${tabName}`);
  if(activeMTab) {
    activeMTab.classList.add('text-indigo-400');
    activeMTab.classList.remove('text-slate-400');
  }
  
  if(tabName === 'kasir') populateServicesDropdown();
  if(tabName === 'antrean') renderOrders();
  if(tabName === 'pengaturan') {
    renderCustomers();
    renderServicesTable();
    renderExpenses();
    renderManageOrdersTable();
    renderKostPartners();
    applyActiveDateFilter();
  }
}

function switchSubTab(subName) {
  ['laporan', 'mitra', 'kas', 'pelanggan', 'layanan', 'printer', 'toko'].forEach(s => {
    const subView = document.getElementById(`subview-${s}`);
    const subTab = document.getElementById(`subtab-${s}`);
    if (subView) subView.classList.add('hidden');
    if (subTab) {
      subTab.classList.remove('bg-white', 'dark:bg-slate-900', 'text-indigo-600', 'dark:text-indigo-400', 'shadow-sm');
      subTab.classList.add('text-slate-600', 'dark:text-slate-400');
    }
  });
  const activeSubView = document.getElementById(`subview-${subName}`);
  const activeSubTab = document.getElementById(`subtab-${subName}`);
  if (activeSubView) activeSubView.classList.remove('hidden');
  if (activeSubTab) {
    activeSubTab.classList.add('bg-white', 'dark:bg-slate-900', 'text-indigo-600', 'dark:text-indigo-400', 'shadow-sm');
    activeSubTab.classList.remove('text-slate-600', 'dark:text-slate-400');
  }

  if (subName === 'laporan' || subName === 'kas') {
    applyActiveDateFilter();
  }
  if (subName === 'mitra') {
    renderKostPartners();
  }
  if (subName === 'toko') {
    renderManageOrdersTable();
  }
}

function renderCustomers() {
  const searchInput = document.getElementById('search-db-pelanggan');
  const q = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const filteredCust = customers.filter(c => 
    c.name.toLowerCase().includes(q) || 
    c.phone.toLowerCase().includes(q) ||
    (c.address && c.address.toLowerCase().includes(q))
  );

  document.getElementById('cust-count').innerText = `${filteredCust.length} Pelanggan`;
  const tbody = document.getElementById('customer-table-body');
  
  const selectAllCb = document.getElementById('select-all-cust');
  if (selectAllCb) selectAllCb.checked = false;

  if (filteredCust.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-slate-400 font-medium">Pelanggan tidak ditemukan</td></tr>';
    updateBulkDeleteUI();
    return;
  }

  tbody.innerHTML = filteredCust.map((c) => {
    const originalIdx = customers.findIndex(item => item.phone === c.phone);
    const custOrders = orders.filter(o => o.customer && (o.customer.phone === c.phone || o.customer.name.toLowerCase() === c.name.toLowerCase()));
    const totalVisits = custOrders.length;
    let totalSpent = 0;
    let totalKg = 0;

    custOrders.forEach(o => {
      totalSpent += parseFloat(o.grandTotal) || 0;
      if (o.items) {
        o.items.forEach(i => {
          if (i.unit === 'kg') totalKg += parseFloat(i.qty) || 0;
        });
      }
    });

    return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40">
        <td class="p-2.5 text-center">
          <input type="checkbox" class="cust-checkbox rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer" data-index="${originalIdx}" onchange="updateBulkDeleteUI()">
        </td>
        <td class="p-2.5 font-bold text-slate-900 dark:text-slate-100">
          <button onclick="openCustomerDetailModal('${c.phone}')" class="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
            ${c.name}
          </button>
        </td>
        <td class="p-2.5 text-slate-600 dark:text-slate-400 font-mono">${c.phone}</td>
        <td class="p-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">Rp ${Number(c.deposit || 0).toLocaleString('id-ID')}</td>
        <td class="p-2.5 text-center font-bold text-indigo-600 dark:text-indigo-400">${totalVisits}x</td>
        <td class="p-2.5 text-right font-bold text-purple-600 dark:text-purple-400">${totalKg.toFixed(1)} kg</td>
        <td class="p-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">Rp ${totalSpent.toLocaleString('id-ID')}</td>
        <td class="p-2.5 text-center flex items-center justify-center gap-1">
          <button onclick="openEditCustomerModal(${originalIdx})" class="text-amber-600 dark:text-amber-400 hover:text-amber-800 p-1" title="Edit Data Pelanggan">
            <i data-lucide="edit-3" class="w-3.5 h-3.5 inline"></i>
          </button>
          <button onclick="openCustomerDetailModal('${c.phone}')" class="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded text-[10px] font-bold">
            Detail
          </button>
          <button onclick="selectCustomerDirect('${c.phone}'); switchMainTab('kasir');" class="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 px-2 py-1 rounded text-[10px] font-bold">
            Pilih
          </button>
          <button onclick="deleteCustomer(${originalIdx})" class="text-red-500 hover:text-red-700 p-1">
            <i data-lucide="trash-2" class="w-3.5 h-3.5 inline"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
  safeRenderIcons();
  updateBulkDeleteUI();
}

function toggleSelectAllCustomers(isChecked) {
  const checkboxes = document.querySelectorAll('.cust-checkbox');
  checkboxes.forEach(cb => cb.checked = isChecked);
  updateBulkDeleteUI();
}

function updateBulkDeleteUI() {
  const checkboxes = document.querySelectorAll('.cust-checkbox:checked');
  const count = checkboxes.length;
  const btn = document.getElementById('btn-bulk-delete');
  const countLabel = document.getElementById('selected-cust-count');
  
  if (btn && countLabel) {
    countLabel.innerText = count;
    if (count > 0) {
      btn.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
    }
  }

  const allCheckboxes = document.querySelectorAll('.cust-checkbox');
  const selectAllCb = document.getElementById('select-all-cust');
  if (selectAllCb && allCheckboxes.length > 0) {
    selectAllCb.checked = (checkboxes.length === allCheckboxes.length);
  }
}

function deleteSelectedCustomers() {
  const checkboxes = document.querySelectorAll('.cust-checkbox:checked');
  const indicesToDelete = Array.from(checkboxes).map(cb => parseInt(cb.getAttribute('data-index'), 10));

  if (indicesToDelete.length === 0) return;

  if (confirm(`Apakah Anda yakin ingin MENGHAPUS ${indicesToDelete.length} pelanggan terpilih sekaligus?`)) {
    indicesToDelete.sort((a, b) => b - a);
    indicesToDelete.forEach(idx => {
      customers.splice(idx, 1);
    });

    localStorage.setItem('goklin_pwa_customers', JSON.stringify(customers));
    syncToCloud();
    renderCustomers();
    alert(`Berhasil menghapus ${indicesToDelete.length} pelanggan!`);
  }
}

function addManualCustomer() {
  const name = document.getElementById('manual-cust-name').value.trim();
  const rawPhone = document.getElementById('manual-cust-phone').value.trim();
  const address = document.getElementById('manual-cust-address').value.trim();

  if (!name || !rawPhone) {
    alert('Mohon isi nama dan no WhatsApp.');
    return;
  }

  const phone = rawPhone.startsWith('0') ? '62' + rawPhone.slice(1) : rawPhone;
  customers.push({ name, phone, address, deposit: 0 });
  localStorage.setItem('goklin_pwa_customers', JSON.stringify(customers));
  syncToCloud();

  document.getElementById('manual-cust-name').value = '';
  document.getElementById('manual-cust-phone').value = '';
  document.getElementById('manual-cust-address').value = '';
  renderCustomers();
  alert('Pelanggan berhasil disimpan!');
}

function deleteCustomer(idx) {
  if (confirm(`Hapus pelanggan "${customers[idx].name}"?`)) {
    customers.splice(idx, 1);
    localStorage.setItem('goklin_pwa_customers', JSON.stringify(customers));
    syncToCloud();
    renderCustomers();
  }
}

function renderServicesTable() {
  const tbody = document.getElementById('services-table-body');
  tbody.innerHTML = services.map((s, idx) => `
    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40">
      <td class="p-2.5 font-bold text-slate-800 dark:text-slate-200">${s.name}</td>
      <td class="p-2.5"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${s.cat === 'Kiloan' ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300' : 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300'}">${s.cat}</span></td>
      <td class="p-2.5 font-bold text-slate-700 dark:text-slate-300 font-mono">Rp ${Number(s.price).toLocaleString('id-ID')}</td>
      <td class="p-2.5 text-slate-600 dark:text-slate-400">${s.unit}</td>
      <td class="p-2.5 text-slate-600 dark:text-slate-400">${s.duration} Jam</td>
      <td class="p-2.5 text-center">
        <button onclick="openEditServiceModal(${idx})" class="text-amber-600 dark:text-amber-400 hover:text-amber-800 p-1 mr-1">
          <i data-lucide="edit-3" class="w-4 h-4"></i>
        </button>
        <button onclick="deleteService(${idx})" class="text-red-500 hover:text-red-700 p-1">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </td>
    </tr>
  `).join('');
  safeRenderIcons();
}

function addService() {
  const name = document.getElementById('new-svc-name').value.trim();
  const cat = document.getElementById('new-svc-cat').value;
  const price = parseFloat(document.getElementById('new-svc-price').value);
  const unit = document.getElementById('new-svc-unit').value.trim() || 'kg';
  const duration = parseFloat(document.getElementById('new-svc-duration').value) || 72;

  if (!name || isNaN(price)) {
    alert('Mohon isi nama layanan dan harga.');
    return;
  }

  services.push({ id: Date.now().toString(), name, cat, price, unit, duration });
  localStorage.setItem('goklin_pwa_services', JSON.stringify(services));
  syncToCloud();
  
  document.getElementById('new-svc-name').value = '';
  document.getElementById('new-svc-price').value = '';
  renderServicesTable();
  populateServicesDropdown();
  alert('Layanan berhasil ditambahkan!');
}

function openEditServiceModal(idx) {
  const s = services[idx];
  if (!s) return;
  editingServiceIdx = idx;
  document.getElementById('edit-svc-name').value = s.name;
  document.getElementById('edit-svc-cat').value = s.cat;
  document.getElementById('edit-svc-price').value = s.price;
  document.getElementById('edit-svc-unit').value = s.unit || 'kg';
  document.getElementById('edit-svc-duration').value = s.duration || 72;
  document.getElementById('edit-service-modal').classList.remove('hidden');
}

function closeEditServiceModal() {
  document.getElementById('edit-service-modal').classList.add('hidden');
  editingServiceIdx = null;
}

function saveEditedService() {
  if (editingServiceIdx === null) return;
  const name = document.getElementById('edit-svc-name').value.trim();
  const cat = document.getElementById('edit-svc-cat').value;
  const price = parseFloat(document.getElementById('edit-svc-price').value);
  const unit = document.getElementById('edit-svc-unit').value.trim() || 'kg';
  const duration = parseFloat(document.getElementById('edit-svc-duration').value) || 72;

  if (!name || isNaN(price)) {
    alert('Mohon isi nama layanan dan harga.');
    return;
  }

  services[editingServiceIdx] = {
    ...services[editingServiceIdx],
    name: name,
    cat: cat,
    price: price,
    unit: unit,
    duration: duration
  };

  localStorage.setItem('goklin_pwa_services', JSON.stringify(services));
  syncToCloud();
  renderServicesTable();
  populateServicesDropdown();
  closeEditServiceModal();
  alert('Layanan berhasil diperbarui!');
}

function deleteService(idx) {
  if (confirm(`Hapus layanan "${services[idx].name}"?`)) {
    services.splice(idx, 1);
    localStorage.setItem('goklin_pwa_services', JSON.stringify(services));
    syncToCloud();
    renderServicesTable();
    populateServicesDropdown();
  }
}

function getOrderById(orderId) {
  return orders.find(o => o.id === orderId);
}

function sendWhatsAppInvoiceById(orderId) {
  const order = getOrderById(orderId);
  if (!order || !order.customer) return;

  const maxLen = settings.maxChars || 32;
  const lineDash = "-".repeat(maxLen);

  let pDate = new Date(order.date);
  let rDate = new Date(order.readyAt);
  let pStr = `${pDate.getDate().toString().padStart(2,'0')}-${(pDate.getMonth()+1).toString().padStart(2,'0')}-${pDate.getFullYear()} ${pDate.getHours().toString().padStart(2,'0')}:${pDate.getMinutes().toString().padStart(2,'0')}`;
  let rStr = `${rDate.getDate().toString().padStart(2,'0')}-${(rDate.getMonth()+1).toString().padStart(2,'0')}-${rDate.getFullYear()} ${rDate.getHours().toString().padStart(2,'0')}:${rDate.getMinutes().toString().padStart(2,'0')}`;

  let totalQty = (order.items || []).reduce((sum, i) => sum + Number(i.qty), 0);
  let itemCount = (order.items || []).length;

  let itemLines = (order.items || []).map(i => {
    let q = Number(i.qty).toFixed(1);
    let sub = Number(i.subtotal).toLocaleString('id-ID');
    return formatLine(`${i.name} (${q} ${i.unit})`, `Rp ${sub}`, maxLen);
  }).join('\n');

  let rawText = "```\n" +
    `      ${settings.storeName || 'GOKLIN LAUNDRY'}\n` +
    `    ${settings.storeAddress}\n` +
    `       Tel: ${settings.storePhone}\n` +
    `${lineDash}\n` +
    `Nota: ${order.id}\n` +
    `Pel : ${order.customer ? order.customer.name : 'Umum'}\n` +
    `Bayar: ${order.payMethod || 'QRIS'} (${order.payStatus})\n` +
    `${lineDash}\n` +
    `${itemLines}\n` +
    `${lineDash}\n` +
    formatLine(`BRS=${itemCount} QTY=${totalQty.toFixed(1)}`, `Sub: Rp ${Number(order.subtotal).toLocaleString('id-ID')}`, maxLen) + '\n' +
    formatLine("TOTAL AKHIR", `Rp ${Number(order.grandTotal).toLocaleString('id-ID')}`, maxLen) + '\n' +
    `${lineDash}\n` +
    `TglPesan: ${pStr}\n` +
    `Estimasi: ${rStr}\n\n` +
    `    Terimakasih telah    \n` +
    `  mempercayakan cucian   \n` +
    `anda pada GOKLin LAUNDRY\n` +
    "```";

  window.open(`https://wa.me/${order.customer.phone}?text=${encodeURIComponent(rawText)}`, '_blank');
}

function sendWhatsAppReadyById(orderId) {
  const order = getOrderById(orderId);
  if (!order || !order.customer) return;

  let template = settings.waReadyTemplate || DEFAULT_WA_TEMPLATE;

  let msgText = template
    .replace(/{nama}/g, order.customer.name)
    .replace(/{nota}/g, order.id)
    .replace(/{total}/g, Number(order.grandTotal).toLocaleString('id-ID'))
    .replace(/{status}/g, order.payStatus)
    .replace(/{alamat}/g, order.customer.address || 'Ambil di outlet');

  window.open(`https://wa.me/${order.customer.phone}?text=${encodeURIComponent(msgText)}`, '_blank');
}

async function smartPrintById(orderId) {
  const order = getOrderById(orderId);
  if (!order) return;

  if (bluetoothDevice && bluetoothDevice.gatt && bluetoothDevice.gatt.connected && printCharacteristic) {
    const printed = await printDirectBluetooth(order);
    if (printed) return;
  }

  if (bluetoothDevice) {
    const reconnect = confirm("Koneksi Printer Bluetooth terputus. Sambungkan ulang Bluetooth sekarang?");
    if (reconnect) {
      await connectBluetoothPrinter();
      if (bluetoothDevice && bluetoothDevice.gatt && bluetoothDevice.gatt.connected && printCharacteristic) {
        await printDirectBluetooth(order);
        return;
      }
    }
  }

  printThermalReceipt(order);
}

function printThermalReceipt(order) {
  const receipt = document.getElementById('thermal-receipt');
  document.documentElement.style.setProperty('--print-paper-width', settings.paperWidth || '58mm');
  
  let pDate = new Date(order.date);
  let dStr = `${pDate.getDate().toString().padStart(2,'0')}-${(pDate.getMonth()+1).toString().padStart(2,'0')}-${pDate.getFullYear()}`;
  let tStr = `${pDate.getHours().toString().padStart(2,'0')}:${pDate.getMinutes().toString().padStart(2,'0')}`;

  let custName = order.customer ? order.customer.name : (order.customerName || 'Umum');

  let itemLines = (order.items || []).map(i => {
    let name = i.name.length > 16 ? i.name.substring(0, 16) : i.name.padEnd(16, ' ');
    let price = Number(i.subtotal).toLocaleString('id-ID').padStart(10, ' ');
    return `${name} ${price}`;
  }).join('\n');

  let subtotalVal = Number(order.subtotal).toLocaleString('id-ID').padStart(12, ' ');
  let discountVal = Number(order.discount || 0).toLocaleString('id-ID').padStart(12, ' ');
  let grandTotalVal = Number(order.grandTotal).toLocaleString('id-ID').padStart(10, ' ');

  receipt.innerHTML = `
    <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; line-height: 1.3; width: 100%; color: #000; padding: 5px;">
      <div style="text-align: center; margin-bottom: 8px;">
        <div style="font-size: 15px; font-weight: 900; text-transform: uppercase;">${settings.storeName || 'GOKLIN LAUNDRY'}</div>
        <div style="font-size: 10px;">${settings.storeAddress}</div>
        <div style="font-size: 10px;">Tel: ${settings.storePhone}</div>
        ${settings.receiptHeader ? `<div style="font-size: 10px;">${settings.receiptHeader}</div>` : ''}
      </div>

      <div style="border-top: 1px dashed #000; padding-top: 4px; margin-top: 4px; display: flex; justify-content: space-between; font-size: 10px;">
        <span>Date: ${dStr}</span>
        <span>${tStr}</span>
      </div>
      <div style="font-size: 10px; font-weight: bold;">Nota: ${order.id}</div>
      <div style="font-size: 10px; font-weight: bold; margin-bottom: 4px;">Pel : ${custName}</div>

      <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>

      <div style="white-space: pre-wrap;">${itemLines}</div>

      <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>

      <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; margin-bottom: 6px;">
        <span>AMOUNT</span>
        <span>Rp ${grandTotalVal}</span>
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 10px;">
        <span>Sub-total</span>
        <span>Rp ${subtotalVal}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 10px;">
        <span>Diskon/Promo</span>
        <span>-Rp ${discountVal}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: bold;">
        <span>Metode Bayar</span>
        <span>${order.payMethod || 'QRIS'} (${order.payStatus})</span>
      </div>

      <div style="border-top: 1px dashed #000; margin: 8px 0 6px 0;"></div>

      <div style="text-align: center; font-size: 9px; margin-top: 6px;">
        ${settings.receiptFooter || 'Terimakasih telah mempercayakan cucian anda pada GOKLin LAUNDRY'}
      </div>
    </div>
  `;

  document.body.className = "print-mode-thermal";
  window.print();
  setTimeout(() => { receipt.innerHTML = ''; }, 1000);
}

async function connectBluetoothPrinter() {
  if (!navigator.bluetooth) {
    alert("Browser belum mendukung Web Bluetooth. Buka di Google Chrome Android/PC.");
    return;
  }
  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '0000ffe0-0000-1000-8000-00805f9b34fb'
      ]
    });
    const server = await device.gatt.connect();
    const servicesList = await server.getPrimaryServices();
    for (const service of servicesList) {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          printCharacteristic = char;
          bluetoothDevice = device;
          break;
        }
      }
      if (printCharacteristic) break;
    }
    if (printCharacteristic) {
      const btName = device.name || 'Printer BT';
      const headerBadge = document.getElementById('printer-status-badge');
      if (headerBadge) headerBadge.innerText = `BT Ready (${btName})`;

      const frontStatusText = document.getElementById('bt-front-status-text');
      if (frontStatusText) {
        frontStatusText.innerText = `Tersambung: ${btName}`;
        frontStatusText.className = "font-bold text-emerald-600 dark:text-emerald-400";
      }

      const settingStatusText = document.getElementById('bt-status-text');
      if (settingStatusText) {
        settingStatusText.innerText = `Tersambung: ${btName}`;
        settingStatusText.className = "font-bold text-emerald-600 dark:text-emerald-400";
      }

      alert(`Tersambung ke ${btName}!`);
    }
  } catch (err) {
    alert("Gagal koneksi Bluetooth: " + err.message);
  }
}

async function printDirectBluetooth(order) {
  if (!printCharacteristic || !bluetoothDevice || !bluetoothDevice.gatt || !bluetoothDevice.gatt.connected) return false;
  try {
    const encoder = new TextEncoder();
    const maxLen = settings.maxChars || 32;
    let bytes = [0x1B, 0x40];
    
    let pDate = new Date(order.date);
    let dStr = `${pDate.getDate().toString().padStart(2,'0')}-${(pDate.getMonth()+1).toString().padStart(2,'0')}-${pDate.getFullYear()}`;
    let tStr = `${pDate.getHours().toString().padStart(2,'0')}:${pDate.getMinutes().toString().padStart(2,'0')}`;

    let custName = 'Umum';
    if (order.customer && typeof order.customer === 'object' && order.customer.name) {
      custName = order.customer.name;
    } else if (order.customerName) {
      custName = order.customerName;
    }

    bytes.push(0x1B, 0x61, 0x01);
    bytes.push(...encoder.encode(`${settings.storeName || 'GOKLIN LAUNDRY'}\n`));
    bytes.push(...encoder.encode(`${settings.storeAddress}\n`));
    bytes.push(...encoder.encode(`Tel: ${settings.storePhone}\n`));
    if (settings.receiptHeader) {
      bytes.push(...encoder.encode(`${settings.receiptHeader}\n`));
    }

    bytes.push(0x1B, 0x61, 0x00);
    bytes.push(...encoder.encode('-'.repeat(maxLen) + '\n'));
    bytes.push(...encoder.encode(formatLine(`Date: ${dStr}`, tStr, maxLen) + '\n'));
    bytes.push(...encoder.encode(`Nota: ${order.id}\n`));
    bytes.push(...encoder.encode(`Pel : ${custName}\n`));
    bytes.push(...encoder.encode('-'.repeat(maxLen) + '\n'));

    (order.items || []).forEach(i => {
      let leftPart = `${i.name}`;
      let rightPart = `Rp ${Number(i.subtotal).toLocaleString('id-ID')}`;
      bytes.push(...encoder.encode(formatLine(leftPart, rightPart, maxLen) + '\n'));
    });

    bytes.push(...encoder.encode('-'.repeat(maxLen) + '\n'));

    bytes.push(0x1B, 0x45, 0x01);
    let amountVal = `Rp ${Number(order.grandTotal).toLocaleString('id-ID')}`;
    bytes.push(...encoder.encode(formatLine("AMOUNT", amountVal, maxLen) + '\n'));
    bytes.push(0x1B, 0x45, 0x00);

    let subVal = `Rp ${Number(order.subtotal).toLocaleString('id-ID')}`;
    let discVal = `-Rp ${Number(order.discount || 0).toLocaleString('id-ID')}`;
    bytes.push(...encoder.encode(formatLine("Sub-total", subVal, maxLen) + '\n'));
    bytes.push(...encoder.encode(formatLine("Diskon/Promo", discVal, maxLen) + '\n'));
    if (order.depositDeduction && order.depositDeduction > 0) {
      bytes.push(...encoder.encode(formatLine("Pot. Deposit", `-Rp ${Number(order.depositDeduction).toLocaleString('id-ID')}`, maxLen) + '\n'));
    }
    bytes.push(...encoder.encode(`Bayar: ${order.payMethod || 'QRIS'} (${order.payStatus})\n`));

    bytes.push(...encoder.encode('-'.repeat(maxLen) + '\n'));

    bytes.push(0x1B, 0x61, 0x01);
    bytes.push(...encoder.encode(`${settings.receiptFooter || 'Terimakasih!'}\n`));

    let feedNum = settings.feedLines || 3;
    bytes.push(...encoder.encode('\n'.repeat(feedNum)));

    const dataArray = new Uint8Array(bytes);
    for (let i = 0; i < dataArray.length; i += 100) {
      await printCharacteristic.writeValue(dataArray.slice(i, i + 100));
    }
    return true;
  } catch (err) {
    console.error("BT Print Error:", err);
    return false;
  }
}

async function testPrintBluetooth() {
  const dummy = {
    id: "TRS-TEST1234", date: new Date().toISOString(), readyAt: new Date().toISOString(),
    customer: { name: "Ibu Rangga", address: "-" },
    items: [{ name: "Cuci Setrika (3 Hari)", qty: 2, unit: "kg", price: 6000, subtotal: 12000 }],
    subtotal: 12000, discount: 0, depositDeduction: 0, grandTotal: 12000, payStatus: "LUNAS", payMethod: "QRIS"
  };
  if (!(await printDirectBluetooth(dummy))) alert("Sambungkan printer Bluetooth terlebih dahulu.");
}

function checkDeliveryAlerts() {
  const now = new Date();
  const dueOrders = orders.filter(o => o.status !== 'Sudah Diantar' && new Date(o.readyAt) <= now);
  const banner = document.getElementById('delivery-alert-banner');
  if (dueOrders.length > 0) {
    banner.classList.remove('hidden');
    document.getElementById('delivery-alert-text').innerText = `Ada ${dueOrders.length} cucian yang sudah mencapai estimasi waktu & siap diambil/diantar!`;
  } else {
    banner.classList.add('hidden');
  }
}

function showDeliveryModal() {
  const activeOrders = orders.filter(o => o.status !== 'Sudah Diantar');
  const list = document.getElementById('delivery-modal-list');
  if (activeOrders.length === 0) {
    list.innerHTML = '<p class="text-center text-xs text-slate-400 py-6 font-medium">Tidak ada cucian aktif saat ini.</p>';
  } else {
    list.innerHTML = activeOrders.map(o => `
      <div class="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-3 rounded-2xl flex flex-col justify-between gap-2">
        <div>
          <div class="flex justify-between text-xs font-bold">
            <span class="text-indigo-900 dark:text-indigo-200">${o.id} - ${o.customer ? o.customer.name : 'Umum'}</span>
            <span class="text-emerald-800 dark:text-emerald-300 font-mono">${o.payMethod || 'QRIS'} • ${o.payStatus}</span>
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-400 mt-0.5"><i data-lucide="map-pin" class="w-3.5 h-3.5 inline text-slate-400"></i> ${o.customer ? o.customer.address : 'Ambil di outlet'}</p>
        </div>
        <div class="flex gap-2 pt-1.5 border-t border-emerald-200/60 dark:border-emerald-900/60">
          <button onclick="sendWhatsAppReadyById('${o.id}')" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1 shadow-sm transition">
            <i data-lucide="message-circle" class="w-3.5 h-3.5"></i> 📲 WA Siap Ambil / Antar
          </button>
          <button onclick="markAsDelivered('${o.id}')" class="bg-slate-900 dark:bg-slate-800 text-white font-bold py-2 px-3 rounded-xl text-xs transition">
            Selesai
          </button>
        </div>
      </div>
    `).join('');
    safeRenderIcons();
  }
  document.getElementById('delivery-modal').classList.remove('hidden');
}

function closeDeliveryModal() {
  document.getElementById('delivery-modal').classList.add('hidden');
}

function markAsDelivered(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (order) {
    order.status = 'Sudah Diantar';
    localStorage.setItem('goklin_pwa_orders', JSON.stringify(orders));
    syncToCloud();
    renderOrders();
    applyActiveDateFilter();
    checkDeliveryAlerts();
    showDeliveryModal();
  }
}

function getTimeRemainingBadge(readyAtIso, isDelivered) {
  if (isDelivered) {
    return `<span class="text-[9px] px-2 py-0.5 rounded-md font-extrabold border bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700">✅ Selesai Diantar/Ambil</span>`;
  }
  
  const now = new Date();
  const target = new Date(readyAtIso);
  const diffMs = target - now;

  if (diffMs <= 0) {
    const overdueMin = Math.floor(Math.abs(diffMs) / (1000 * 60));
    const hrs = Math.floor(overdueMin / 60);
    const mins = overdueMin % 60;
    let timeStr = hrs > 0 ? `${hrs}j ${mins}m` : `${mins}m`;
    return `<span class="text-[9px] px-2 py-0.5 rounded-md font-extrabold border bg-red-600 text-white border-red-700 animate-pulse">🚨 LEWAT TARGET (${timeStr})</span>`;
  } else {
    const totalMin = Math.floor(diffMs / (1000 * 60));
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    let timeStr = hrs > 0 ? `${hrs}j ${mins}m` : `${mins}m`;
    return `<span class="text-[9px] px-2 py-0.5 rounded-md font-extrabold border bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">⏱️ Sisa Waktu: ${timeStr}</span>`;
  }
}

function renderOrders() {
  const q = document.getElementById('search-antrean').value.toLowerCase();
  const grid = document.getElementById('orders-grid');
  const now = new Date();

  let filtered = orders.filter(o => (o.customer && o.customer.name.toLowerCase().includes(q)) || o.id.toLowerCase().includes(q));
  
  const activeCount = orders.filter(o => o.status !== 'Sudah Diantar').length;
  document.getElementById('count-active').innerText = activeCount;
  document.getElementById('mob-count-active').innerText = activeCount;

  if (filtered.length === 0) {
    grid.innerHTML = '<p class="col-span-full text-center text-slate-400 py-10 text-xs font-medium">Tidak ada antrean aktif.</p>';
    return;
  }

  filtered.sort((a, b) => {
    const aDelivered = a.status === 'Sudah Diantar' ? 1 : 0;
    const bDelivered = b.status === 'Sudah Diantar' ? 1 : 0;

    if (aDelivered !== bDelivered) return aDelivered - bDelivered;

    if (!aDelivered) {
      const aTime = new Date(a.readyAt);
      const bTime = new Date(b.readyAt);
      return aTime - bTime;
    } else {
      return new Date(b.date) - new Date(a.date);
    }
  });

  grid.innerHTML = filtered.map(order => {
    const isTimeReached = new Date(order.readyAt) <= now;
    const isDelivered = order.status === 'Sudah Diantar';

    let cardBorderClass = 'border-slate-200 dark:border-slate-800';
    if (!isDelivered && isTimeReached) {
      cardBorderClass = 'border-red-500 ring-2 ring-red-400/50 bg-red-50/20 dark:bg-red-950/20';
    } else if (!isDelivered) {
      cardBorderClass = 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700';
    } else {
      cardBorderClass = 'border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 opacity-80';
    }

    const custName = order.customer ? order.customer.name : 'Umum';
    const custDesc = order.customer ? (order.customer.address || order.customer.phone) : '-';

    return `
      <div class="bg-white dark:bg-slate-900 p-4 rounded-2xl border ${cardBorderClass} shadow-sm flex flex-col justify-between hover:shadow-md transition">
        <div>
          <div class="flex justify-between items-start mb-2">
            <div class="flex items-center gap-1.5">
              <span class="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-900">${order.id}</span>
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${order.payMethod === 'QRIS' ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'}">${order.payMethod || 'QRIS'}</span>
            </div>
            ${getTimeRemainingBadge(order.readyAt, isDelivered)}
          </div>
          <h4 class="font-extrabold text-slate-900 dark:text-slate-100 text-sm">${custName}</h4>
          <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">${custDesc}</p>
          
          <div class="my-2.5 py-2 border-y border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1">
            ${(order.items || []).map(i => `<div class="flex justify-between font-medium"><span>${i.name} (${i.qty} ${i.unit})</span><span class="font-bold font-mono">Rp ${Number(i.subtotal).toLocaleString('id-ID')}</span></div>`).join('')}
            <div class="text-[10px] font-semibold text-slate-400 dark:text-slate-500 pt-0.5">
              ⏱️ Target Selesai: ${new Date(order.readyAt).toLocaleDateString('id-ID')} ${new Date(order.readyAt).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}
            </div>
          </div>
        </div>

        <div class="space-y-1.5 pt-1">
          ${!isDelivered ? `
            <div class="flex gap-1.5">
              <button onclick="sendWhatsAppReadyById('${order.id}')" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2 rounded-xl text-xs flex items-center justify-center gap-1 shadow-sm transition">
                <i data-lucide="message-circle" class="w-3.5 h-3.5"></i> 📲 WA Siap Ambil / Antar
              </button>
              <button onclick="markAsDelivered('${order.id}')" class="bg-slate-900 dark:bg-slate-800 hover:bg-black text-white font-bold py-2 px-3 rounded-xl text-xs transition">
                Selesai
              </button>
            </div>
          ` : ''}

          <div class="flex gap-1.5">
            <button onclick="openEditModal('${order.id}')" class="flex-1 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-800 dark:text-amber-300 font-bold py-1.5 rounded-xl text-xs border border-amber-200 dark:border-amber-900 flex items-center justify-center gap-1 transition">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Edit
            </button>
            <button onclick="sendWhatsAppInvoiceById('${order.id}')" class="bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold px-2.5 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1 transition">
              <i data-lucide="receipt" class="w-3.5 h-3.5"></i> Nota
            </button>
            <button onclick="smartPrintById('${order.id}')" class="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 transition">
              <i data-lucide="printer" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  safeRenderIcons();
}

function saveSettings() {
  settings.storeName = document.getElementById('setting-store-name').value;
  settings.storeAddress = document.getElementById('setting-store-address').value;
  settings.storePhone = document.getElementById('setting-store-phone').value;
  settings.storeLogo = document.getElementById('setting-store-logo').value.trim();
  settings.yearlyRent = parseFloat(document.getElementById('setting-yearly-rent').value) || 15000000;
  settings.ownerPin = document.getElementById('setting-owner-pin').value.trim() || '1234';
  
  const waInput = document.getElementById('setting-wa-ready-template');
  if (waInput) {
    settings.waReadyTemplate = waInput.value.trim() || DEFAULT_WA_TEMPLATE;
  }

  if (document.getElementById('setting-paper-width')) settings.paperWidth = document.getElementById('setting-paper-width').value;
  if (document.getElementById('setting-max-chars')) settings.maxChars = parseInt(document.getElementById('setting-max-chars').value, 10) || 32;
  if (document.getElementById('setting-feed-lines')) settings.feedLines = parseInt(document.getElementById('setting-feed-lines').value, 10) || 3;
  if (document.getElementById('setting-receipt-header')) settings.receiptHeader = document.getElementById('setting-receipt-header').value.trim();
  if (document.getElementById('setting-receipt-footer')) settings.receiptFooter = document.getElementById('setting-receipt-footer').value.trim();

  localStorage.setItem('goklin_pwa_settings', JSON.stringify(settings));
  applyLogoDisplay(settings.storeLogo);
  calculateTotal();
  applyActiveDateFilter();
  syncToCloud();
  alert('Pengaturan Toko, Format Struk & Cloud tersimpan!');
}

function exportData() {
  const backup = { orders, customers, services, expenses, settings, kost: kostPartners };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
  const a = document.createElement('a');
  a.setAttribute("href", dataStr);
  a.setAttribute("download", `goklin_backup_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
}
