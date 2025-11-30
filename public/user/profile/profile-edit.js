document.addEventListener('DOMContentLoaded', () => {
  
const editButton = document.querySelector('.btn.btn-primary.profile-edit-btn');
    const dropdown = document.querySelector('.profile-edit-dropdown');
    const uploadButton = document.querySelector('.btn.btn-secondary.btn-upload-photo');
    const deleteButton = document.querySelector('.btn.btn-danger.btn-delete-photo');
console.log(editButton + dropdown + uploadButton + deleteButton);
    console.log('jawa');
    
    if (editButton && dropdown) {
        // Menampilkan/Menyembunyikan dropdown saat Edit Profil diklik
        editButton.addEventListener('click', function(event) {
            event.stopPropagation();
            dropdown.classList.toggle('show'); 
        });

        // Menutup dropdown saat mengklik di luar area
        window.addEventListener('click', function(event) {
            if (!dropdown.contains(event.target) && !editButton.contains(event.target)) {
                dropdown.classList.remove('show');
            }
        });
    }

    // 4. LOGIKA TOMBOL AKSI DI DALAM DROPDOWN (Unggah & Hapus Foto)
    // Di sini Anda dapat menambahkan kode untuk menampilkan modal/popup Unggah/Hapus yang sesungguhnya
    if (uploadButton) {
        uploadButton.addEventListener('click', function() {
            console.log('Aksi: Unggah Foto');
            alert('Popup Unggah Foto akan ditampilkan.'); // Ganti dengan logika modal Anda
            if (dropdown) dropdown.classList.remove('show');
        });
    }

    if (deleteButton) {
        deleteButton.addEventListener('click', function() {
            console.log('Aksi: Hapus Foto');
            alert('Popup Konfirmasi Hapus Foto akan ditampilkan.'); // Ganti dengan logika modal Anda
            if (dropdown) dropdown.classList.remove('show');
        });
    }
    
})