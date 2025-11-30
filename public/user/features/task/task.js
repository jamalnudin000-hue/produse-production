document.addEventListener('DOMContentLoaded', function () {
  const typeButtons = document.querySelectorAll('#task_type_part');
  const listContainer = document.getElementById('task_list');

  let tasks = []; // { id, status, el, checkbox }

  function updateStats() {
    const total = tasks.length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const completed = tasks.filter(t => t.status === 'completed').length;

    const totalEl = document.querySelector('#task_list_value #amount');
    const pendingEl = document.querySelector('#task_pending_value #amount');
    const completedEl = document.querySelector('#task_completed_value #amount');

    if (totalEl) totalEl.textContent = total;
    if (pendingEl) pendingEl.textContent = pending;
    if (completedEl) completedEl.textContent = completed;
  }

  function applyFilter(typeName) {
    tasks.forEach(t => {
      if (typeName === 'All Task' || typeName === 'All') {
        t.el.style.display = 'block';
      } else if (typeName === 'Pending') {
        t.el.style.display = (t.status === 'pending') ? 'block' : 'none';
      } else if (typeName === 'Completed') {
        t.el.style.display = (t.status === 'completed') ? 'block' : 'none';
      }
    });
  }

  function selectButton(btn) {
    typeButtons.forEach(b => {
      b.style.backgroundColor = '';
      b.style.color = '#374151';
      b.removeAttribute('data-selected');
    });

    btn.style.backgroundColor = '#2E7D32';
    btn.style.color = 'white';
    btn.setAttribute('data-selected', 'true');
  }

  function formatDate(isoDate) {
    if (!isoDate) return '';
    const parts = String(isoDate).split('-');
    if (parts.length !== 3) return isoDate;
    const [y, m, d] = parts;
    return `${d}/${m}/${y.slice(2)}`; // dd/mm/yy
  }

  function applyCompletedStyle(card, completed) {
    const titleEl = card.querySelector('#top_detail span');
    const descEl = card.querySelector('#main_value p');
    const bottomSpans = card.querySelectorAll('#bottom_info span');
    const priorityLabel = card.querySelector('#label');

    if (!titleEl || !descEl) return;

    if (completed) {
      titleEl.style.color = '#A1A1AA';
      titleEl.style.textDecorationLine = 'line-through';
      descEl.style.color = '#A1A1AA';
      bottomSpans.forEach(x => x.style.color = '#A1A1AA');
      if (priorityLabel) {
        priorityLabel.style.opacity = '0.7';
      }
    } else {
      titleEl.style.color = '';
      titleEl.style.textDecorationLine = '';
      descEl.style.color = '';
      bottomSpans.forEach(x => x.style.color = '');
      if (priorityLabel) {
        priorityLabel.style.opacity = '1';
      }
    }
  }

  function applyPriorityLabel(labelEl, priority) {
    if (!labelEl) return;
    const textSpan = labelEl.querySelector('span');
    const value = String(priority || 'low').toLowerCase();

    if (value === 'low') {
      if (textSpan) textSpan.textContent = 'Low';
      labelEl.style.color = '#3CB93C';
      labelEl.style.borderColor = '#A6ECA6';
      labelEl.style.backgroundColor = '#E5FFE5';
    } else if (value === 'medium') {
      if (textSpan) textSpan.textContent = 'Medium';
      labelEl.style.color = '#C68B00';
      labelEl.style.borderColor = '#FFE499';
      labelEl.style.backgroundColor = '#FFF4CC';
    } else if (value === 'high') {
      if (textSpan) textSpan.textContent = 'High';
      labelEl.style.color = '#E23C3C';
      labelEl.style.borderColor = '#FFB2B2';
      labelEl.style.backgroundColor = '#FFE5E5';
    }
  }

  function closeAllDropdownMenus() {
    if (!listContainer) return;
    const menus = listContainer.querySelectorAll('#dropdown_menu');
    menus.forEach(m => m.style.display = 'none');
  }

  function bindCardEvents(taskObj) {
    const card = taskObj.el;
    const checkbox = taskObj.checkbox;

    if (checkbox) {
      checkbox.addEventListener('change', async function () {
        const checked = checkbox.checked;
        const newStatus = checked ? 'completed' : 'pending';
        taskObj.status = newStatus;

        applyCompletedStyle(card, checked);
        updateStats();

        const active = document.querySelector('#task_type_part[data-selected="true"]');
        if (active) applyFilter(active.textContent.trim());

        try {
          const res = await fetch(`/api/tasks/${taskObj.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
          });
          if (!res.ok) {
            console.error('Gagal update status task di server');
          }
        } catch (err) {
          console.error('Error network saat update status task', err);
        }
      });
    }

    // Dropdown edit/delete
    const dropdown = card.querySelector('#dropdown');
    const dropdownMenu = card.querySelector('#dropdown_menu');
    const deleteBtn = dropdownMenu ? dropdownMenu.querySelector('span[data-action="delete"]') : null;
    const editBtn = dropdownMenu ? dropdownMenu.querySelector('span[data-action="edit"]') : null;

    if (dropdown && dropdownMenu) {
      dropdown.addEventListener('click', function (e) {
        e.stopPropagation();
        const isVisible = dropdownMenu.style.display === 'flex';
        closeAllDropdownMenus();
        dropdownMenu.style.display = isVisible ? 'none' : 'flex';
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', async function (e) {
        e.stopPropagation();
        const yakin = confirm('Yakin ingin menghapus task ini?');
        if (!yakin) return;

        try {
          const res = await fetch(`/api/tasks/${taskObj.id}`, {
            method: 'DELETE'
          });
          if (!res.ok) {
            alert('Gagal menghapus task');
            return;
          }
          // Hapus dari DOM & dari array
          card.remove();
          tasks = tasks.filter(t => t.id !== taskObj.id);
          updateStats();

          const active = document.querySelector('#task_type_part[data-selected="true"]');
          if (active) applyFilter(active.textContent.trim());
        } catch (err) {
          console.error('Error delete task:', err);
          alert('Network error saat menghapus task');
        }
      });
    }

    if (editBtn) {
      editBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        // Arahkan ke halaman /task/new dengan query ?id=...
        window.location.href = `new/?id=${taskObj.id}`;
      });
    }
  }

  function renderTasks(list) {
    if (!listContainer) return;

    listContainer.innerHTML = '';
    tasks = [];

    if (!list || list.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'Belum ada task. Buat task baru di halaman /task/new.';
      empty.style.margin = '16px';
      empty.style.color = '#6B7280';
      listContainer.appendChild(empty);
      updateStats();
      return;
    }

    list.forEach(taskData => {
      const card = document.createElement('div');
      card.id = 'task_card';
      card.dataset.id = taskData.id;
      card.dataset.status = taskData.status || 'pending';

      const isCompleted = (taskData.status === 'completed');

      card.innerHTML = `
        <div id="main_value">
          <div id="1">
            <input type="checkbox" class="round_check" ${isCompleted ? 'checked' : ''}>
          </div>
          <div id="two">
            <div id="top_detail">
              <span>${taskData.title}</span>
              <div id="priority_label">
                <div id="label">
                  <span></span>
                </div>
              </div>
            </div>
            <p>${taskData.description || ''}</p>
            <div id="bottom_detail">
              <div id="bottom_info">
                <span><i class="fa-regular fa-folder"></i>${taskData.category}</span>
                <span><i class="fa-regular fa-calendar"></i>${formatDate(taskData.due_date)}</span>
                <span><i class="fa-regular fa-clock"></i>${taskData.due_time}</span>
              </div>
              <div id="dropdown">
                <a class="fa-solid fa-ellipsis"></a>
              </div>
            </div>
          </div>
        </div>
        <div id="dropdown_menu">
          <span data-action="delete"><i class="fa-solid fa-trash"></i>Delete</span>
          <hr>
          <span data-action="edit"><i class="fa-solid fa-pen-to-square"></i>Edit</span>
        </div>
      `;

      listContainer.appendChild(card);

      const checkbox = card.querySelector('.round_check');
      const labelEl = card.querySelector('#label');

      applyPriorityLabel(labelEl, taskData.priority);
      applyCompletedStyle(card, isCompleted);

      const taskObj = {
        id: taskData.id,
        status: taskData.status || 'pending',
        el: card,
        checkbox
      };

      tasks.push(taskObj);
      bindCardEvents(taskObj);
    });

    updateStats();

    const active = document.querySelector('#task_type_part[data-selected="true"]');
    if (active) {
      applyFilter(active.textContent.trim());
    } else {
      applyFilter('All Task');
    }

    // Tutup dropdown jika klik di luar
    document.addEventListener('click', function () {
      closeAllDropdownMenus();
    });
  }

  async function loadTasksFromServer() {
    try {
      const res = await fetch('/api/tasks');
      if (!res.ok) {
        console.error('Gagal mengambil tasks dari API');
        return;
      }
      const data = await res.json();
      renderTasks(data);
    } catch (err) {
      console.error('Error fetch /api/tasks:', err);
    }
  }

  // Setup button filter di atas
  if (typeButtons.length > 0) {
    selectButton(typeButtons[0]);
    applyFilter('All Task');

    typeButtons.forEach(btn => {
      btn.addEventListener('click', function () {
        selectButton(btn);
        applyFilter(btn.textContent.trim());
      });
    });
  }

  loadTasksFromServer();

  // ====== REMINDER INLINE & MODAL SETUP ======
  const reminderInline = document.querySelector('#reminder_example');
  const reminderAccept = document.querySelector('#reminder_button button:first-child');
  const reminderDecline = document.querySelector('#reminder_button button:last-child');
  const reminderModal = document.querySelector('#reminder_modal');
  const reminderCancel = document.querySelector('#reminder_modal_button button:last-child');
  const reminderCreateBtn = document.querySelector('#reminder_modal_button button:first-child');

  // Input di dalam modal
  const reminderTitleInput = document.getElementById('reminder_title_input');
  const reminderDescInput = document.getElementById('reminder_description_input');
  const reminderDateSelect = document.querySelector('#reminder_modal select.date');
  const reminderMonthSelect = document.querySelector('#reminder_modal select.month');
  const reminderYearSelect = document.querySelector('#reminder_modal select.year');
  const reminderTimeInput = document.getElementById('clock_time');
  const reminderLeadInput = document.getElementById('reminder_lead_input');
  const reminderMethodCheckboxes = document.querySelectorAll('#reminder_method_part input[type="checkbox"]');

  // ===== Helper timezone (dipakai saat kirim reminder) =====
  function detectBrowserTZ() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return typeof tz === 'string' && tz ? tz : '';
    } catch {
      return '';
    }
  }

  // Sembunyikan semua reminder UI di awal
  if (reminderInline) reminderInline.style.display = 'none';
  if (reminderModal) reminderModal.style.display = 'none';

  // ===== Ambil task yang baru saja dibuat dari sessionStorage =====
  let lastCreatedTask = null;
  try {
    const raw = sessionStorage.getItem('lastCreatedTask');
    if (raw) {
      lastCreatedTask = JSON.parse(raw);
      // Tampilkan inline bar hanya kalau memang ada task baru
      if (reminderInline) reminderInline.style.display = 'flex';
    }
  } catch (e) {
    console.warn('Gagal parse lastCreatedTask dari sessionStorage', e);
  }

  // Mapping nomor bulan → nama bulan (sesuai option di <select class="month">)
  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  // Prefill form reminder dari data task
  function prefillReminderFromTask(task) {
    if (!task) return;

    if (reminderTitleInput) {
      reminderTitleInput.value = task.title || '';
    }
    if (reminderDescInput) {
      reminderDescInput.value = task.description || '';
    }

    if (task.due_date && reminderDateSelect && reminderMonthSelect && reminderYearSelect) {
      // task.due_date = "YYYY-MM-DD"
      const parts = String(task.due_date).split('-'); // [yyyy, mm, dd]
      if (parts.length === 3) {
        const year = parts[0];
        const monthNum = parseInt(parts[1], 10); // 1..12
        const dayNum = parseInt(parts[2], 10);   // 1..31

        reminderYearSelect.value = year;
        reminderDateSelect.value = String(dayNum); // select.date pakai "1","2",...

        if (monthNum >= 1 && monthNum <= 12) {
          const monthName = MONTH_NAMES[monthNum - 1];
          reminderMonthSelect.value = monthName;
        }
      }
    }

    if (task.due_time && reminderTimeInput) {
      // task.due_time = "HH:MM"
      reminderTimeInput.value = String(task.due_time).slice(0, 5);
    }

    if (reminderLeadInput) {
      reminderLeadInput.value = 0; // default lead 0 menit
    }

    if (reminderMethodCheckboxes && reminderMethodCheckboxes.length) {
      reminderMethodCheckboxes.forEach(cb => { cb.checked = false; });
    }
  }

  // ===== Event handler tombol di inline bar dan modal =====
  if (reminderAccept && reminderModal) {
    reminderAccept.addEventListener('click', () => {
      // Prefill setiap kali user klik "Yes, add it"
      prefillReminderFromTask(lastCreatedTask);
      reminderModal.style.display = 'flex';
    });
  }

  if (reminderDecline && reminderInline) {
    reminderDecline.addEventListener('click', () => {
      reminderInline.style.display = 'none';
      // Task sudah tidak butuh reminder → hapus flag
      try { sessionStorage.removeItem('lastCreatedTask'); } catch (_) {}
    });
  }

  if (reminderCancel && reminderModal) {
    reminderCancel.addEventListener('click', () => {
      reminderModal.style.display = 'none';
    });
  }

  // ===== Submit reminder dari modal ke /api/reminders =====
  if (reminderCreateBtn) {
    reminderCreateBtn.addEventListener('click', async () => {
      const title = reminderTitleInput ? reminderTitleInput.value.trim() : '';
      const description = reminderDescInput ? reminderDescInput.value.trim() : '';
      const day = reminderDateSelect ? reminderDateSelect.value : '';
      const month = reminderMonthSelect ? reminderMonthSelect.value : '';
      const year = reminderYearSelect ? reminderYearSelect.value : '';
      const time = reminderTimeInput ? reminderTimeInput.value : '';
      const lead = reminderLeadInput ? Number(reminderLeadInput.value || 0) : 0;

      if (!title) {
        alert('Title wajib diisi');
        return;
      }
      if (!day || !month || !year) {
        alert('Tanggal wajib diisi');
        return;
      }
      if (!time) {
        alert('Jam wajib diisi');
        return;
      }

      const tz = detectBrowserTZ();
      if (!tz) {
        console.warn('Timezone tidak terdeteksi; backend akan fallback/menolak sesuai konfigurasi.');
      }

      const payload = {
        title,
        description,
        day,
        month,       // nama bulan, BE kamu sudah handle
        year,
        time,        // "HH:MM"
        timezone: tz,
        leadMinutes: lead,
        channel: 'termux' // sementara tetap gunakan termux
      };

      try {
        const res = await fetch('/api/reminders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Timezone': tz || ''
          },
          body: JSON.stringify(payload)
        });

        let data = null;
        try {
          data = await res.json();
        } catch (_) {
          data = null;
        }

        if (!res.ok) {
          throw new Error((data && data.message) || 'Gagal membuat reminder');
        }

        alert('Reminder berhasil dibuat. Notifikasi akan dikirim via Termux-API.');

        // Tutup UI & bersihkan flag
        if (reminderModal) reminderModal.style.display = 'none';
        if (reminderInline) reminderInline.style.display = 'none';
        try { sessionStorage.removeItem('lastCreatedTask'); } catch (_) {}
      } catch (err) {
        console.error('Error create reminder:', err);
        alert('Error: ' + err.message);
      }
    });
  }
});