(() => {
  // Button buat trigger submit
  const btn = document.getElementById('create_reminder');
  if (!btn) return;

  // Elemen input form
  const titleInput = document.getElementById('title_input');
  const descInput  = document.getElementById('description_input');
  const dateSelect = document.querySelector('select.date');
  const monthSelect = document.querySelector('select.month');
  const yearSelect = document.querySelector('select.year');
  const clockInput = document.querySelector('input#clock_time[type="time"]');
  const leadInput  = document.getElementById('reminder_lead');

  // Helper ambil nilai input
  const pick = {
    title: () => titleInput?.value?.trim() || '',
    desc:  () => descInput?.value?.trim() || '',
    day:   () => dateSelect?.value || '',
    month: () => monthSelect?.value || '',
    year:  () => yearSelect?.value || '',
    clock: () => clockInput?.value || '',
    lead:  () => Number(leadInput?.value || 0)
  };

  // Autodetect timezone IANA dari browser
  function detectBrowserTZ() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return typeof tz === 'string' && tz ? tz : '';
    } catch {
      return '';
    }
  }

  // Tampilkan hint timezone di bawah input time
  const hint = document.getElementById('tz_hint');
  if (hint) {
    const tz = detectBrowserTZ();
    if (tz) {
      const now = new Date().toLocaleString([], { timeZone: tz });
      hint.textContent = `Timezone detected: ${tz} · Now: ${now}`;
    } else {
      hint.textContent = `Timezone cannot detected, use the default server`;
    }
  }

  // ====== Deteksi mode edit ======
  const params = new URLSearchParams(window.location.search);
  const reminderId = params.get('id');
  const isEditMode = !!reminderId;
  let editTz = ''; // simpan tz dari server kalau edit

  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  // Load data reminder kalau mode edit
  async function loadReminderForEdit() {
    if (!isEditMode) return;

    try {
      const r = await fetch(`/api/reminders/${reminderId}`);
      if (!r.ok) {
        console.error('Gagal mengambil data reminder untuk edit');
        return;
      }
      const data = await r.json();

      if (titleInput) titleInput.value = data.title || '';
      if (descInput) descInput.value = data.description || '';

      // scheduled_local: "YYYY-MM-DD HH:MM"
      if (data.scheduled_local && dateSelect && monthSelect && yearSelect && clockInput) {
        const parts = String(data.scheduled_local).split(' ');
        if (parts.length >= 2) {
          const [datePart, timePart] = parts;
          const [y, m, d] = datePart.split('-');
          yearSelect.value = y;
          dateSelect.value = String(parseInt(d, 10));

          const monthIndex = parseInt(m, 10) - 1;
          if (monthIndex >= 0 && monthIndex < MONTH_NAMES.length) {
            monthSelect.value = MONTH_NAMES[monthIndex];
          }

          clockInput.value = timePart.slice(0,5); // HH:MM
        }
      }

      if (typeof data.lead_minutes === 'number' && leadInput) {
        leadInput.value = data.lead_minutes;
      }

      // --- LOGIC UNTUK MENANDAI CHECKBOX SAAT EDIT ---
      // Kita cari channel apa yang tersimpan di database
      const savedChannel = data.channel || 'termux';
      
      // Cari elemen checkbox berdasarkan icon di dekatnya
      // 1. Checkbox WhatsApp (cari yang ada icon fa-whatsapp)
      const waCheckbox = document.querySelector('.reminder-option i.fa-whatsapp')
        ?.closest('.reminder-option')
        ?.querySelector('input[type="checkbox"]');
        
      // 2. Checkbox Notifikasi Biasa (cari yang ada icon fa-bell)
      const termuxCheckbox = document.querySelector('.reminder-option i.fa-bell')
        ?.closest('.reminder-option')
        ?.querySelector('input[type="checkbox"]');

      if (savedChannel === 'whatsapp') {
        if (waCheckbox) waCheckbox.checked = true;
      } else {
        // Default atau termux
        if (termuxCheckbox) termuxCheckbox.checked = true;
      }

      editTz = data.tz || '';

      if (btn) {
        btn.textContent = 'Update Reminder';
      }
    } catch (err) {
      console.error('Error load reminder for edit:', err);
    }
  }

  // ====== Submit handler (create / update) ======
  const submit = async () => {
    if (!pick.title()) return alert('Title wajib diisi');
    if (!pick.day() || !pick.month() || !pick.year()) return alert('Tanggal wajib diisi');
    if (!pick.clock()) return alert('Jam wajib diisi');

    // Gunakan tz dari server saat edit, kalau tidak ada pakai deteksi browser
    let tz = isEditMode && editTz ? editTz : detectBrowserTZ();
    if (!tz) {
      console.warn('Timezone tidak terdeteksi; backend akan fallback (jika disetel).');
    }

    // --- LOGIC BARU: DETEKSI PILIHAN CHANNEL ---
    
    // 1. Cari checkbox WhatsApp (navigasi dari icon .fa-whatsapp ke parent .reminder-option lalu ke input)
    const waCheckbox = document.querySelector('.reminder-option i.fa-whatsapp')
      ?.closest('.reminder-option')
      ?.querySelector('input[type="checkbox"]');

    // 2. Tentukan channel yang akan dikirim ke database
    // Defaultnya 'termux' (Notifikasi biasa)
    let selectedChannel = 'web';

    // Jika checkbox WhatsApp ada DAN dicentang, ubah jadi 'whatsapp'
    if (waCheckbox && waCheckbox.checked) {
        selectedChannel = 'whatsapp';
    }

    const payload = {
      title: pick.title(),
      description: pick.desc(),
      day: pick.day(),
      month: pick.month(),      // BE sudah handle angka / nama
      year: pick.year(),
      time: pick.clock(),       // "HH:MM" 24 jam
      timezone: tz,
      leadMinutes: pick.lead(),
      channel: selectedChannel  // <--- Bagian ini yang diubah (Dinadmis)
    };

    const url = isEditMode ? `/api/reminders/${reminderId}` : '/api/reminders';
    const method = isEditMode ? 'PUT' : 'POST';

    const r = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Timezone': tz || ''   // header fallback untuk BE
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json().catch(() => null);
    if (!r.ok) {
      throw new Error((data && data.message) || 'Gagal menyimpan reminder');
    }

    // Pesan sukses disesuaikan
    let msgSuccess = 'Reminder dibuat.';
    if (selectedChannel === 'whatsapp') {
        msgSuccess += ' Akan dikirim via WhatsApp Bot.';
    } else {
        msgSuccess += ' Akan diingatkan via Termux-API.';
    }

    alert(isEditMode ? 'Reminder berhasil diupdate.' : msgSuccess);
    
    // Redirect kembali ke list setelah sukses (opsional, agar user melihat hasilnya)
    // window.location.href = '../'; 
  };

  btn.addEventListener('click', () => {
    submit().catch(e => alert('Error: ' + e.message));
  });

  // Kalau mode edit, prefill form
  loadReminderForEdit();
})();
