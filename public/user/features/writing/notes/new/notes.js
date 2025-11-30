document.addEventListener('DOMContentLoaded', () => {
  console.log('jawa');
  const title = document.querySelector('#main_card input');
  const notes = document.querySelector('#main_card textarea');
  const save = document.querySelector('#card_header button');
  const date = new Date().toLocaleDateString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric'
      });
    const notesCardValue = `
    <div id="notes_top">
            <span>${title}</span>
            <div id="notes_icon">
            <i class="fa-solid fa-pencil"></i>
              </div>
          </div>
          <div id="notes_middle">
            <p>${notes}</p>
          </div>
          <div id="notes_bottom">
            <p>Hari ini</p>
            <div id="right_notes_bottom">
              <i class="fa-regular fa-calendar"></i>
            <p>${date}</p>
            </div>
          </div>
    `;
    save.addEventListener('click', () => {
      const notesCard = document.createElement('div');
      notesCard.id = 'notes_card';
      notesCard.innerHTML = notesCardValue;
      document.body.appendChild(notesCard);
      });
});