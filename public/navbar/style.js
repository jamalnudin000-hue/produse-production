document.addEventListener('DOMContentLoaded', function() {
    const sidebar_icon = document.getElementById('sidebar_icon');
    const navbarmenu = document.getElementById('navbar_menu');
    const navbarbottom = document.getElementById('navbar_bottom'); 
    
    if (!sidebar_icon || !navbarmenu || !navbarbottom)
    {
        return;
    }

sidebar_icon.addEventListener('click', function()
{
  navbarmenu.classList.toggle('open');
  navbarbottom.classList.toggle('open');
  
  const iconElement = sidebar_icon.querySelector('i');
  
  if (navbarmenu.classList.contains('open')) {
    iconElement.classList.remove('fa-bars');
    iconElement.classList.add('fa-xmark');
    
  } else {
    iconElement.classList.remove('fa-xmark');
    iconElement.classList.add('fa-bars');
  }
});
});