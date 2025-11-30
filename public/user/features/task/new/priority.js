document.addEventListener('DOMContentLoaded', function() {
  // ===== Bagian styling priority badge (sama seperti sebelumnya) =====
  const prioritySelect = document.getElementById('priority');
  const labelStyle = document.getElementById('label');
  const dotStyle = document.getElementById('dot');
  const text = document.querySelector('#label span');

  function updatePriorityLabel(value) {
    if (!labelStyle || !text) return;

    if (value === 'low') {
      text.textContent = 'Low Priority';
      labelStyle.style.color = '#3CB93C';
      labelStyle.style.borderColor = '#A6ECA6';
      labelStyle.style.backgroundColor = '#E5FFE5';
      if (dotStyle) dotStyle.style.backgroundColor = '#3CB93C';
    } else if (value === 'medium') {
      text.textContent = 'Medium Priority';
      labelStyle.style.color = '#C68B00';
      labelStyle.style.borderColor = '#FFE499';
      labelStyle.style.backgroundColor = '#FFF4CC';
      if (dotStyle) dotStyle.style.backgroundColor = '#C68B00';
    } else if (value === 'high') {
      text.textContent = 'High Priority';
      labelStyle.style.color = '#E23C3C';
      labelStyle.style.borderColor = '#FFB2B2';
      labelStyle.style.backgroundColor = '#FFE5E5';
      if (dotStyle) dotStyle.style.backgroundColor = '#E23C3C';
    }
  }

  if (prioritySelect) {
    updatePriorityLabel(prioritySelect.value);
    prioritySelect.addEventListener('change', function() {
      updatePriorityLabel(prioritySelect.value);
    });
  }

  // ===== Bagian form create / edit task =====
  const title = document.getElementById('title_input');
  const desc = document.getElementById('description_input');
  const category = document.getElementById('category');
  const date = document.querySelector('.date');
  const month = document.querySelector('.month');
  const year = document.querySelector('.year');
  const time = document.getElementById('time');
  const button = document.getElementById('create_reminder');

  // Deteksi mode edit
  const params = new URLSearchParams(window.location.search);
  const taskId = params.get('id');
  const isEditMode = !!taskId;

  async function loadTaskForEdit() {
    if (!isEditMode) return;
    if (!(title && category && date && month && year && time)) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) {
        console.error('Gagal mengambil data task untuk edit');
        return;
      }
      const data = await res.json();

      title.value = data.title || '';
      if (desc) desc.value = data.description || '';
      if (prioritySelect) {
        prioritySelect.value = data.priority || 'low';
        updatePriorityLabel(prioritySelect.value);
      }
      category.value = data.category || '';

      // due_date: "YYYY-MM-DD"
      if (data.due_date) {
        const [y, m, d] = data.due_date.split('-');
        date.value = d;
        month.value = parseInt(m, 10); // HTML month option value="1"... etc.
        year.value = y;
      }
      // due_time: "HH:MM"
      if (data.due_time) {
        time.value = data.due_time.slice(0, 5);
      }

      if (button) {
        button.textContent = 'Update Task';
      }
    } catch (err) {
      console.error('Error loadTaskForEdit:', err);
    }
  }

  if (button && title && category && date && month && year && time) {
    button.addEventListener('click', async function() {
      const titleVal = title.value.trim();
      const descVal = desc ? desc.value.trim() : '';
      const priorityVal = prioritySelect ? prioritySelect.value : 'low';
      const categoryVal = category.value;
      const dayVal = date.value;
      const monthVal = month.value;
      const yearVal = year.value;
      const timeVal = time.value;

      if (!titleVal) {
        alert('Title wajib diisi');
        return;
      }
      if (!categoryVal) {
        alert('Category wajib diisi');
        return;
      }
      if (!dayVal || !monthVal || !yearVal) {
        alert('Tanggal (dd/mm/yyyy) wajib diisi');
        return;
      }
      if (!timeVal) {
        alert('Time wajib diisi');
        return;
      }

      const payload = {
        title: titleVal,
        description: descVal,
        priority: priorityVal,
        category: categoryVal,
        day: dayVal,
        month: monthVal,
        year: yearVal,
        time: timeVal
      };

      const oldText = button.textContent;
      button.disabled = true;
      button.textContent = isEditMode ? 'Updating...' : 'Saving...';

            try {
        const url = isEditMode ? `/api/tasks/${taskId}` : '/api/tasks';
        const method = isEditMode ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        // Coba baca JSON response (baik sukses maupun gagal)
        let data = null;
        try {
          data = await res.json();
        } catch (_) {
          data = null;
        }

        if (!res.ok) {
          let msg = isEditMode ? 'Gagal mengupdate task' : 'Gagal membuat task';
          if (data && data.message) msg = data.message;
          alert(msg);
        } else {
          // ====> SIMPAN task terakhir kalau mode CREATE, untuk dipakai di halaman task/index
          if (!isEditMode && data) {
            try {
              sessionStorage.setItem('lastCreatedTask', JSON.stringify(data));
            } catch (e) {
              console.warn('Gagal menyimpan lastCreatedTask ke sessionStorage', e);
            }
          }

          // Balik ke halaman list task
          window.location.href = '../';
        }
      } catch (err) {
        console.error('Error submit task:', err);
        alert('Network error saat submit task');
      } finally {
        button.disabled = false;
        button.textContent = oldText;
      }

    });
  }

  // Kalau mode edit, prefill form
  loadTaskForEdit();
});