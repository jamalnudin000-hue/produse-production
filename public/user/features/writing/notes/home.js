document.addEventListener('DOMContentLoaded', () => {
    const tabFilter = document.querySelectorAll('.filter');
    tabFilter[0].style.backgroundColor = '#2e7d32';
    tabFilter[0].style.color = 'white';

    tabFilter.forEach(a => {
        tabFilter.forEach(b => {
        a.addEventListener('click', () => {
            b.style.backgroundColor = '#f7f7f7';
            b.style.color = '#374151';
            a.style.backgroundColor = '#2e7d32';
            a.style.color = 'white';
        })
        });
    });
    
});