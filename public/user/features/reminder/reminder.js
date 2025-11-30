document.addEventListener('DOMContentLoaded', function () {
  // =========================================
  // BAGIAN 1: SETUP ELEMENT & TEMPLATE
  // =========================================

  // Ambil card contoh sebagai template
  const template = document.querySelector('.reminder-card');
  if (!template) return;

  // Container tempat kita taruh semua card reminder
  const container = template.parentElement;

  // Template tetap terlihat (flex) tapi kita hide via CSS display none
  template.style.display = 'none';

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Variabel untuk menyimpan ID yang sudah dinotifikasi di sesi ini agar tidak spam bunyi terus
  const notifiedSessionIds = new Set();

  // =========================================
  // BAGIAN 2: LOGIC UI (TAMPILAN)
  // =========================================

  // Tutup semua dropdown (titik tiga) di semua card
  function closeAllDropdownMenus() {
    const menus = container.querySelectorAll('.reminder-dropdown-menu');
    menus.forEach(m => {
      m.style.display = 'none';
    });
  }

  // Klik di mana saja → tutup dropdown
  document.addEventListener('click', function () {
    closeAllDropdownMenus();
  });

  // Format tanggal untuk tampilan UI
  function formatDateTime(scheduledLocal) {
    if (!scheduledLocal) {
      return { dateText: '-', timeText: '-' };
    }

    const parts = scheduledLocal.split(' ');
    if (parts.length < 2) {
      return { dateText: scheduledLocal, timeText: '' };
    }

    const [datePart, timePart] = parts;
    const [y, m, d] = datePart.split('-');
    const [hh, mm] = timePart.split(':');

    const monthIndex = parseInt(m, 10) - 1;
    const monthName = MONTH_NAMES[monthIndex] || m;

    const dateText = `${parseInt(d, 10)} ${monthName} ${y}`;
    const timeText = `${hh}:${mm}`;

    return { dateText, timeText };
  }

  // Atur badge status
  function applyStatusBadge(statusEl, status) {
    const s = String(status || '').toLowerCase();
    statusEl.classList.remove('status-scheduled', 'status-fired', 'status-cancelled');

    if (s === 'fired') {
      statusEl.textContent = 'Fired';
      statusEl.classList.add('status-fired');
    } else if (s === 'cancelled') {
      statusEl.textContent = 'Cancelled';
      statusEl.classList.add('status-cancelled');
    } else {
      statusEl.textContent = 'Scheduled';
      statusEl.classList.add('status-scheduled');
    }
  }

  // Buat 1 card reminder dari 1 object data
  function createReminderCard(rem) {
    const card = template.cloneNode(true);
    card.style.display = 'flex';

    // Elemen-elemen dalam card
    const titleEl = card.querySelector('.reminder-title');
    const descEl = card.querySelector('p');
    const timeRow = card.querySelector('.reminder-time');
    const timeSpans = timeRow ? timeRow.querySelectorAll('span') : [];
    const dateSpan = timeSpans[0] || null;
    const timeSpan = timeSpans[2] || null;
    const leadSpan = card.querySelector('.reminder-lead');
    const methodWrapper = card.querySelector('.reminder-method');
    const dropdown = card.querySelector('.reminder-dropdown');
    const dropdownMenu = card.querySelector('.reminder-dropdown-menu');
    const deleteBtn = dropdownMenu ? dropdownMenu.querySelector('span[data-action="delete"]') : null;
    const editBtn = dropdownMenu ? dropdownMenu.querySelector('span[data-action="edit"]') : null;
    const statusEl = card.querySelector('.reminder-status');

    // Isi konten
    if (titleEl) titleEl.textContent = rem.title || 'Untitled reminder';
    if (descEl) descEl.textContent = rem.description || '';

    const { dateText, timeText } = formatDateTime(rem.scheduled_local);

    if (dateSpan) {
      dateSpan.innerHTML = `<i class="fa-regular fa-calendar"></i>${dateText}`;
    }

    if (timeSpan) {
      timeSpan.innerHTML = `<i class="fa-regular fa-clock"></i>${timeText}`;
    }

    if (leadSpan) {
      const lead = typeof rem.lead_minutes === 'number' ? rem.lead_minutes : 0;
      let label;
      if (lead === 0) {
        label = 'at exact time';
      } else {
        label = `${lead} minute${lead === 1 ? '' : 's'} before`;
      }
      leadSpan.innerHTML = `<i class="fa-regular fa-bell"></i>${label}`;
    }

    if (methodWrapper) {
      methodWrapper.innerHTML = '';
      const span = document.createElement('span');
      // Logic tampilan text method
      span.textContent = rem.channel === 'web' ? 'Website Notification' : (rem.channel === 'whatsapp' ? 'WhatsApp Bot' : 'Termux Notification');
      methodWrapper.appendChild(span);
    }

    // Badge status
    if (statusEl) applyStatusBadge(statusEl, rem.status);

    // Event dropdown (titik tiga)
    if (dropdown && dropdownMenu) {
      dropdown.addEventListener('click', function (e) {
        e.stopPropagation();
        const visible = dropdownMenu.style.display === 'flex';
        closeAllDropdownMenus();
        dropdownMenu.style.display = visible ? 'none' : 'flex';
      });
    }

    // Tombol DELETE
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async function (e) {
        e.stopPropagation();
        const yakin = confirm('Yakin ingin menghapus reminder ini?');
        if (!yakin) return;

        try {
          const res = await fetch(`/api/reminders/${rem.id}`, {
            method: 'DELETE'
          });
          if (!res.ok) {
            alert('Gagal menghapus reminder');
            return;
          }
          card.remove();
        } catch (err) {
          console.error('Error delete reminder:', err);
          alert('Network error saat menghapus reminder');
        }
      });
    }

    // Tombol EDIT
    if (editBtn) {
      editBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        window.location.href = `new/?id=${rem.id}`;
      });
    }

    // Tambahkan card ke halaman
    container.appendChild(card);
  }

  // Pesan kosong
  function showEmptyMessage() {
    let empty = document.querySelector('.reminder-empty');
    if (!empty) {
      empty = document.createElement('p');
      empty.classList.add('reminder-empty');
      empty.style.margin = '0 15px 20px 15px';
      empty.style.color = '#555';
      empty.textContent = 'Belum ada reminder. Buat reminder baru dari halaman Task atau halaman ini.';
      container.appendChild(empty);
    }
  }

  function hideEmptyMessage() {
    const empty = document.querySelector('.reminder-empty');
    if (empty) empty.remove();
  }

  // Load data dari backend (Untuk Tampilan List)
  async function loadReminders() {
    try {
      const res = await fetch('/api/reminders');
      if (!res.ok) {
        console.error('Gagal mengambil reminders dari API');
        return;
      }

      const list = await res.json();

      // Hapus card lama kecuali template
      Array.from(container.querySelectorAll('.reminder-card')).forEach(el => {
        if (el !== template) el.remove();
      });

      if (!list || list.length === 0) {
        showEmptyMessage();
        return;
      }

      hideEmptyMessage();

      list.forEach(rem => createReminderCard(rem));
    } catch (err) {
      console.error('Error fetch /api/reminders:', err);
    }
  }

  // =========================================
  // BAGIAN 3: SISTEM NOTIFIKASI WEB (BARU)
  // =========================================

  // 1. Minta Izin Notifikasi Browser
  if ('Notification' in window) {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('Izin notifikasi Produse diberikan!');
        }
      });
    }
  }

  // 2. Fungsi Menampilkan Notifikasi
  function showBrowserNotification(title, body) {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body: body,
        icon: '/public/img/logo.png', // Pastikan ada gambar logo atau hapus baris ini
        requireInteraction: true // Notif tidak hilang sendiri sampai diklik
      });
      
      // Opsional: Mainkan audio jika ada
      // const audio = new Audio('/public/audio/notification.mp3');
      // audio.play().catch(e => {});
    }
  }

  // 3. Interval Checker (Cek setiap 10 detik)
  // Ini memisahkan logic render UI dan logic cek notifikasi agar UI tidak kedip-kedip
  setInterval(async () => {
    try {
      const res = await fetch('/api/reminders');
      if (!res.ok) return;
      const list = await res.json();
      const now = new Date();

      list.forEach(rem => {
        // Cek 1: Apakah channelnya WEB?
        // Cek 2: Apakah statusnya masih SCHEDULED?
        if (rem.channel === 'web' && rem.status === 'scheduled') {
          
          // Parsing Tanggal Manual (Format Server: "YYYY-MM-DD HH:MM")
          const [datePart, timePart] = rem.scheduled_local.split(' ');
          const [y, m, d] = datePart.split('-');
          const [hh, mm] = timePart.split(':');
          
          // Buat objek Date Javascript
          const scheduleTime = new Date(y, m - 1, d, hh, mm);
          
          // Hitung selisih waktu (miliseconds)
          const diff = now - scheduleTime;

          // LOGIKA FIRE:
          // Jika waktu sekarang >= waktu jadwal (diff >= 0)
          // DAN batas toleransi belum lewat 5 menit (diff < 300000 ms)
          // DAN belum dinotifikasi di sesi browser ini
          if (diff >= 0 && diff < 5 * 60 * 1000) {
            
            if (!notifiedSessionIds.has(rem.id)) {
              // FIRE!
              showBrowserNotification(rem.title, rem.description || 'Saatnya mengerjakan tugas ini!');
              
              // Tandai ID ini agar tidak bunyi lagi di looping berikutnya (spam preventer)
              notifiedSessionIds.add(rem.id);
              
              // Opsional: Refresh UI list agar status berubah (jika backend auto-update status)
              // loadReminders(); 
            }
          }
        }
      });
    } catch (e) {
      console.error('Silent check error', e);
    }
  }, 10000); // Jalan setiap 10.000ms (10 detik)

  // =========================================
  // INIT
  // =========================================
  loadReminders();
});
