document.addEventListener('DOMContentLoaded', async () => {
    // Referensi elemen HTML
    const elFullname = document.getElementById('profile-fullname');
    const elUsername = document.getElementById('profile-username');
    const elInitial  = document.getElementById('profile-initial');
    const elEmail    = document.getElementById('profile-email');
    const elPhone    = document.getElementById('profile-phone');
    const elJoined   = document.getElementById('profile-joined');
    const elTimezone = document.getElementById('profile-timezone');

    // 1. Deteksi Timezone Browser (Real-time user sekarang)
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        elTimezone.textContent = tz || 'UTC';
    } catch (e) {
        elTimezone.textContent = 'Tidak terdeteksi';
    }

    // 2. Ambil Data User dari Database via API
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
            // Jika gagal (misal sesi habis), redirect ke login
            window.location.href = '../../login/';
            return;
        }

        const user = await res.json();

        // 3. Isi Data ke HTML
        
        // Nama & Username
        elFullname.textContent = user.name;
        elUsername.textContent = '@' + (user.username || 'user');
        
        // Avatar Inisial (Huruf pertama dari nama)
        if (user.name) {
            elInitial.textContent = user.name.charAt(0).toUpperCase();
        }

        // Email
        elEmail.textContent = user.email;

        // Tanggal Bergabung (Format: 3 November 2025)
        if (user.created_at) {
            const date = new Date(user.created_at);
            // Opsi format tanggal Indonesia
            const options = { day: 'numeric', month: 'long', year: 'numeric' };
            elJoined.textContent = date.toLocaleDateString('id-ID', options);
        } else {
            elJoined.textContent = '-';
        }

        // Logika Nomor Telepon
        if (user.phone && user.phone.trim() !== "") {
            // Jika ada nomor di database
            elPhone.textContent = user.phone;
            elPhone.style.color = 'var(--text-main)'; // Warna normal
        } else {
            // Jika kosong, tampilkan Tombol Tambah
            elPhone.innerHTML = ''; // Kosongkan dulu
            
            const addBtn = document.createElement('button');
            addBtn.textContent = '+ Tambahkan Nomor';
            
            // Styling tombol sederhana agar rapi
            addBtn.style.padding = '6px 12px';
            addBtn.style.fontSize = '12px';
            addBtn.style.fontWeight = '500';
            addBtn.style.color = '#2e7d32'; // Warna hijau aksen
            addBtn.style.border = '1px solid #2e7d32';
            addBtn.style.borderRadius = '8px';
            addBtn.style.backgroundColor = 'transparent';
            addBtn.style.cursor = 'pointer';

            // Hover effect sederhana via JS
            addBtn.onmouseover = () => { addBtn.style.backgroundColor = '#e8f5e9'; };
            addBtn.onmouseout  = () => { addBtn.style.backgroundColor = 'transparent'; };

            // Aksi tombol (Nanti diarahkan ke halaman khusus)
            addBtn.onclick = () => {
                alert('Fitur tambah nomor akan segera hadir di halaman pengaturan!');
                // window.location.href = '../settings/phone'; // Contoh nanti
            };

            elPhone.appendChild(addBtn);
        }

    } catch (err) {
        console.error('Gagal memuat profil:', err);
        elFullname.textContent = 'Error memuat data';
    }
});
