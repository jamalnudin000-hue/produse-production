document.addEventListener('DOMContentLoaded', function() {
  const allCard = document.querySelectorAll('.pricing_card');
  const allButton = document.querySelectorAll('.pricing_card button');
  
  allCard.forEach(function(click) {
    const button = click.querySelector('button');
    click.addEventListener('click', function() {
      allCard.forEach(function(cardReset) {
        cardReset.style.border = '';
      });
      allButton.forEach(function(buttonReset) {
        buttonReset.style.backgroundColor = '#f0f0f0'
        buttonReset.style.color = 'black'
      });
      if (click.style.border === '') {
        click.style.border = '2px solid green';
        button.style.backgroundColor = 'green';
        button.style.color = 'white';
      } else {
        click.style.border = '#d9d9d9';
        button.style.backgroundColor = '#f0f0f0';
        button.style.color = 'black';
      }
    });
  });
});