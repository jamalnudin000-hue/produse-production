document.addEventListener('DOMContentLoaded', function() {
    const content = document.querySelector('#main_navbar');

    content.innerHTML = `
    <div style="display:block;">
    <div id="top_navbar">
      <button id="sidebar_icon"><i class="fa-solid fa-bars"></i></button>
      <img src="../../../image/logo.png">
      <div id="right_items">
        <a href="../dashboard/" class="fa-solid fa-house"></a>
      <i id="right_profile" class="fa-solid fa-user"></i>
      </div>
    </div>
    <div id="cik">
          <div id="profile_menu">
          <div id="profile_menu_value">
          <a href="https://produse.home.kg/user/profile"><i class="fa-solid fa-user"></i><span>View Profile</span></a><br>
          <a href="../user/settings"><i class="fa-solid fa-gear"></i><span>Settings</span></a><br>
          <a href="../user"><i class="fa-solid fa-key"></i><span>Change Password</span></a><br>
          <hr>
          <a id="logout"><i class="fa-solid fa-right-from-bracket"></i><span>Log out</span></a>
          </div>
          </div>
          </div>
        
    </div>
    <div id="navbar_menu">
            <ul>
        <li><a href="https://produse.home.kg/user/dashboard"><i class="fas fa-home"></i> Dashboard</a></li>
        <li><a href="https://produse.home.kg/user/features/task"><i class="fas fa-check-square"></i> Tasks</a></li>
        <li><a href=#><i class="fas fa-folder"></i> Projects</a></li>
        <li><a href=#><i class="fas fa-file-alt"></i> Documents</a></li>
        <li><a href="https://produse.home.kg/user/features/reminder"><i class="fas fa-bell"></i> Reminders</a></li>
        <li><a href=#><i class="fas fa-gear"></i> Settings</a></li>
      </ul>
    </div>
    <div id="navbar_bottom">
      <ul>
        <li><a href="https://produse.home.kg/user/pricing"><i class="fas fa-crown"></i> Upgrade</a></li>
        <li id="quest"><a href=#><i class="fas fa-question"></i> Support</a></li>
      </ul>
    </div>
    <div id="logout_confirmation">
      <div id="logout_confirmation_value">
        <img id="logout_img" src="../../../image/logout.png">
        <h5>Ready to log out?</h5>
        <span>You’ll be signed out from your workspace — don’t worry, everything stays right where you left it.</span>
        <div id="logout_button">
          <button id="logout_cancel">Cancel</button>
          <button id="logout_submit">Log out</button>
        </div>
      </div>
    </div>
    `;
window.dispatchEvent(new Event('navbar:ready'));
});
