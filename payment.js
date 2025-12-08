document.addEventListener('DOMContentLoaded', () => {
    const order = JSON.parse(sessionStorage.getItem('temp_order'));
    if (!order) {
        alert('No order found. Redirecting to cart.');
        window.location.href = 'webpage.html#cart';
        return;
    }

    const ccFields = document.getElementById('credit-card-fields');
    const paypalFields = document.getElementById('paypal-fields');

    if (order.payment_method === 'Credit Card') ccFields.style.display = 'block';
    if (order.payment_method === 'PayPal') paypalFields.style.display = 'block';

    const paymentForm = document.getElementById('paymentForm');

    paymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(paymentForm);
        let paymentInfo = {};

        if (order.payment_method === 'Credit Card') {
            paymentInfo = {
                cc_number: formData.get('cc_number'),
                cc_name: formData.get('cc_name'),
                cc_expiry: formData.get('cc_expiry'),
                cc_cvc: formData.get('cc_cvc')
            };
        } else if (order.payment_method === 'PayPal') {
            paymentInfo = {
                paypal_email: formData.get('paypal_email')
            };
        }

        // Merge payment info into order
        const finalOrder = { ...order, payment_info: paymentInfo };

        try {
            const response = await fetch(`${API_URL}?action=place_order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalOrder)
            });
            const data = await response.json();

            if (response.ok && data.success) {
                alert('Order placed successfully!');
                sessionStorage.removeItem('temp_order');
                localStorage.removeItem('cart');
                window.location.href = 'webpage.html#products';
            } else {
                alert(data.message || 'Payment failed.');
            }
        } catch (err) {
            console.error(err);
            alert('Error processing payment.');
        }
    });
});
