(function() {
  console.log('%c [AUTH-GUARD] Script Started ', 'background: #222; color: #bada55');

  // 1. Sembunyikan Body Segera
  const style = document.createElement('style');
  style.id = 'auth-guard-style';
  style.innerHTML = 'body { display: none !important; }';
  document.head.appendChild(style);

  async function checkAuth() {
    console.log('[AUTH-GUARD] Fetching /api/auth/me...');
    try {
      // Tambahkan timestamp agar browser tidak berani mengambil cache
      const r = await fetch('/api/auth/me?t=' + new Date().getTime(), { 
        headers: { 'Cache-Control': 'no-cache' }
      });

      console.log('[AUTH-GUARD] Status:', r.status);

      if (r.ok) {
        console.log('[AUTH-GUARD] Authorized! Showing content.');
        const s = document.getElementById('auth-guard-style');
        if (s) s.remove();
      } else {
        throw new Error('Unauthorized');
      }

    } catch (e) {
      console.warn('[AUTH-GUARD] Access Denied:', e);
      try { 
        localStorage.clear(); 
        sessionStorage.clear(); 
      } catch {}
      
      console.log('[AUTH-GUARD] Redirecting to /login/...');
      window.location.replace('/login/');
    }
  }

  // 2. Cek saat halaman dimuat
  checkAuth();

  // 3. Cek saat tombol Back ditekan (BFCache)
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      console.log('[AUTH-GUARD] Page loaded from cache (Back button). Force Reloading...');
      window.location.reload();
    }
  });
})();