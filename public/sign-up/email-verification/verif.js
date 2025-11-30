document.addEventListener('DOMContentLoaded', () => {
    const email = localStorage.getItem('registered_email');
    const pElement = document.querySelector('#card > p');
    
    // Tampilkan email
    if (email && pElement) {
        pElement.innerHTML = `We have sent a verification link to <b>${email}</b>. Please check your inbox and click on the link to verify your email.`;
    } else if (!email) {
        alert("Session expired. Please register again.");
        window.location.href = '../index.html';
        return;
    }

    // Elemen UI
    // Kita buat elemen timer secara dinamis atau ambil dari HTML jika sudah diupdate
    let actionArea = document.querySelector('.action-area');
    
    // Jika user belum update HTML, kita inject elemen timer via JS biar ga error
    if (!actionArea) {
        const btn = document.getElementById('resend_button');
        const wrapper = document.createElement('div');
        wrapper.className = 'action-area';
        btn.parentNode.insertBefore(wrapper, btn);
        wrapper.appendChild(btn);
        
        const txt = document.createElement('p');
        txt.id = 'countdown_text';
        txt.style.cssText = "color: #64748b; font-size: 14px; margin-top: 15px;";
        txt.innerHTML = 'Resend available in <span id="timer">60</span>s';
        wrapper.insertBefore(txt, btn);
        actionArea = wrapper;
    }

    const resendBtn = document.getElementById('resend_button');
    const countdownText = document.getElementById('countdown_text');
    const timerSpan = document.getElementById('timer');
    let countdownInterval;

    // Fungsi Timer UI
    function startTimer(seconds) {
        if (seconds <= 0) {
            finishTimer();
            return;
        }

        // Sembunyikan tombol, Munculkan teks
        resendBtn.style.display = 'none';
        countdownText.style.display = 'block';
        countdownText.innerHTML = `Resend available in <span id="timer">${seconds}</span>s`;
        
        if (countdownInterval) clearInterval(countdownInterval);

        let timeLeft = seconds;
        countdownInterval = setInterval(() => {
            timeLeft--;
            const span = document.getElementById('timer');
            if(span) span.textContent = timeLeft;

            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                finishTimer();
            }
        }, 1000);
    }

    function finishTimer() {
        countdownText.style.display = 'none';
        resendBtn.style.display = 'inline-block';
        resendBtn.disabled = false;
        resendBtn.textContent = "Resend Email";
        resendBtn.style.backgroundColor = "#1976D2";
        resendBtn.style.cursor = "pointer";
    }

    // === LOGIC UTAMA ===
    // 1. Saat halaman dimuat, kita asumsikan user baru saja register.
    // Default cooldown level 0 adalah 60 detik.
    startTimer(60);

    // 2. Event Klik
    resendBtn.addEventListener('click', async () => {
        // UI Loading
        resendBtn.disabled = true;
        resendBtn.textContent = "Processing...";
        resendBtn.style.backgroundColor = "#ccc";
        resendBtn.style.cursor = "not-allowed";

        try {
            const r = await fetch('/api/auth/resend-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email })
            });

            const data = await r.json();

            // KASUS 1: Sukses Kirim
            if (r.ok) {
                alert(`Success! Email sent. Please check your inbox.`);
                // Server memberitahu durasi cooldown berikutnya lewat data.nextCooldown
                // Jika tidak ada data, default ke 60 (fallback)
                const nextWait = data.nextCooldown || 60;
                
                if (nextWait === -1) {
                    // Level max reached (walau aneh kalau sukses tapi -1, buat jaga2)
                    resendBtn.style.display = 'none';
                    countdownText.style.display = 'block';
                    countdownText.innerHTML = "<b style='color:red'>Maximum attempts reached.</b>";
                } else {
                    startTimer(nextWait);
                }
            } 
            
            // KASUS 2: Kena Rate Limit (429) - Terlalu Cepat
            else if (r.status === 429) {
                if (data.blocked) {
                    // Kena Blokir Permanen (Level 5)
                    resendBtn.style.display = 'none';
                    countdownText.style.display = 'block';
                    countdownText.innerHTML = "<b style='color:red'>Too many attempts. Please try again later.</b>";
                } else {
                    // Kena Cooldown (User mungkin refresh page untuk bypass timer)
                    // Ambil sisa waktu dari server (source of truth)
                    const serverRemaining = data.remainingSeconds || 60;
                    alert(`Too fast! Please wait ${serverRemaining} seconds.`);
                    startTimer(serverRemaining);
                }
            } 
            
            // KASUS 3: Error Lain
            else {
                throw new Error(data.message || 'Error occurred');
            }

        } catch (err) {
            alert(err.message);
            // Kembalikan tombol agar bisa dicoba (kecuali kalau logic diatas sudah menyembunyikannya)
            if (countdownText.style.display === 'none') {
                resendBtn.disabled = false;
                resendBtn.textContent = "Resend Email";
                resendBtn.style.backgroundColor = "#1976D2";
            }
        }
    });
});
