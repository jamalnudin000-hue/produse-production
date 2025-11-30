document.addEventListener("DOMContentLoaded", function() {
    const amount = document.querySelector("#custom_main input");
    const price = document.querySelector("#custom_price");

    amount.addEventListener("keydown", function(event) {
        if (["e", "E", "+", "-"].includes(event.key)) {
            event.preventDefault();
        }
    });

    amount.addEventListener("input", function(){
        const coin = parseInt(amount.value);
        if (isNaN(coin)) {
            price.textContent = "Total Price: $0.00";
        }
        else if (coin < 0) {
            price.textContent = "Invalid Amount";
        }
         else {
        price.textContent = "Total Price: $" + (coin * 0.10).toFixed(1);
    }
    });

});