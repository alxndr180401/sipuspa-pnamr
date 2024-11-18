document.addEventListener('DOMContentLoaded', function() {
    // Menangani submit form pencarian
    const searchForm = document.querySelector('form[action="/search"]');
    if (searchForm) {
        searchForm.addEventListener('submit', function(event) {
            const queryInput = searchForm.querySelector('input[name="query"]');
            if (queryInput.value.trim() === '') {
                alert('Nomor register tidak boleh kosong!');
                event.preventDefault(); // Mencegah form dikirim
            }
        });
    }

    // Menangani submit form login
    const loginForm = document.querySelector('form[action="/login"]');
    if (loginForm) {
        loginForm.addEventListener('submit', function(event) {
            const usernameInput = loginForm.querySelector('input[name="username"]');
            const passwordInput = loginForm.querySelector('input[name="password"]');

            if (usernameInput.value.trim() === '' || passwordInput.value.trim() === '') {
                alert('Username dan password tidak boleh kosong!');
                event.preventDefault(); // Mencegah form dikirim
            }
        });
    }
});
