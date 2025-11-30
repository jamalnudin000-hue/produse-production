document.addEventListener('DOMContentLoaded', bootstrapNavbar);
window.addEventListener('navbar:ready', bootstrapNavbar);

let _inited = false;

function bootstrapNavbar() {
  if (_inited) return; // hindari double-init di halaman yang memuat dua event
  const menuWrap = document.getElementById('cik'); // pembungkus profile menu (overlay kecil)
  const btnProfile = document.getElementById('right_profile');
  const linkLogout = document.getElementById('logout');
  const modal = document.getElementById('logout_confirmation');
  const btnCancel = document.getElementById('logout_cancel');
  const btnSubmit = document.getElementById('logout_submit');

  // Pastikan semua elemen sudah ada (karena navbar diinject dinamis)
  if (!menuWrap || !btnProfile || !linkLogout || !modal || !btnCancel || !btnSubmit) {
    return; // belum siap; tunggu event navbar:ready berikutnya
  }
  _inited = true;

  // Helper: dapatkan display aktual
  const isShown = (el) => window.getComputedStyle(el).display !== 'none';
  const show = (el, disp = 'block') => el && (el.style.display = disp);
  const hide = (el) => el && (el.style.display = 'none');

  // 1) Toggle menu profil
  btnProfile.addEventListener('click', () => {
    if (isShown(menuWrap)) hide(menuWrap); else show(menuWrap, 'block');
  });

  // Klik di luar menu → tutup menu
  document.addEventListener('click', (e) => {
    if (!menuWrap.contains(e.target) && e.target !== btnProfile) {
      hide(menuWrap);
    }
  });

  // 2) Klik "Logout" (link di menu) → buka modal konfirmasi
  linkLogout.addEventListener('click', (e) => {
    e.preventDefault();
    hide(menuWrap);
    show(modal, 'flex'); // modal kamu pakai flex
  });

  // 3) Cancel di modal → tutup modal
  btnCancel.addEventListener('click', () => hide(modal));

  // 4) ESC key → tutup modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isShown(modal)) hide(modal);
  });

  // 5) Klik area luar modal → tutup modal (opsional, kalau markup mendukung)
  modal.addEventListener('click', (e) => {
    const box = document.getElementById('logout_confirmation_value');
    if (e.target === modal && box && !box.contains(e.target)) {
      hide(modal);
    }
  });

  // 6) SUBMIT LOGOUT: panggil API, bersihkan state, redirect ke login
  btnSubmit.addEventListener('click', async () => {
    try {
      // panggil API untuk hapus cookie httpOnly di server
      await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
     });
    } catch (e) {
      // kalau server down, tetap lanjut ke redirect
      console.warn('Logout API error:', e);
    } finally {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {}
      window.location.replace('/login/');
    }
  });
}
