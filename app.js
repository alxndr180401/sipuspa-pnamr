const express = require('express');
const path = require('path');
const { google } = require('googleapis');
const fs = require('fs-extra');
const { PDFDocument } = require('pdf-lib');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const flash = require('connect-flash');

const app = express();
const port = 3000;

// Middleware configuration
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session and flash messages configuration
app.use(session({
    secret: 'secret-key', // Ganti dengan kunci rahasia Anda
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set ke true jika menggunakan HTTPS
}));

app.use(flash());
app.use((req, res, next) => {
    res.locals.messages = req.flash();
    next();
});

// users data (hardcoded)
const users = [
    {
        username: 'dukcapil',
        password: bcrypt.hashSync('minsel2024', 8), // hashed password
        role: 'administrator'
    },
	{
        username: 'admin',
        password: bcrypt.hashSync('amuranghebat', 8), // hashed password
        role: 'administrator'
    }
];

// Middleware function for guest access
function guestAccess(req, res, next) {
    // Set user session to guest role if not logged in as admin
    if (!req.session.users || req.session.users.role !== 'administrator') {
        req.session.users = { role: 'guest' };
    }
    next();
}

// Function to get data from Google Sheets
async function getData(nomorRegister) {
    const auth = new google.auth.GoogleAuth({
        keyFile: './credentials.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    const spreadsheetId = '1aPhi6d17YGY0Rr5ClNl__DCKd9GThvCA5T1aTnv3fSI';
    const range = 'Database!A:F';

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });
        const rows = response.data.values || [];
        if (nomorRegister) {
            return rows.filter(row => row[0] && row[0].toLowerCase() === nomorRegister.toLowerCase());
        }
        return rows;
    } catch (error) {
        console.error("Error fetching data:", error.message);
        return [];
    }
}

// Home route - Selection page
app.get('/', (req, res) => {
    res.render('index'); // Tampilkan file index.ejs untuk halaman utama
});

// Rute untuk halaman login
app.get('/admin', (req, res) => {
    res.render('login'); // Pastikan file login.ejs ada
});

// Rute untuk memproses login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    if (user && bcrypt.compareSync(password, user.password)) {
        req.session.users = user; // Simpan sesi pengguna sebagai admin
        res.redirect('/utama'); // Redirect ke dashboard admin
    } else {
        req.flash('error', 'Username atau password salah.');
        res.redirect('/admin'); // Kembali ke halaman login
    }
});

// Route for guest search
app.get('/guest', guestAccess, (req, res) => {
    // Force user session role to guest if on guest page
    req.session.users.role = 'guest';
    res.render('search_guest');
});

// Route for admin search
app.get('/utama', (req, res) => {
    if (req.session.users && req.session.users.role === 'administrator') {
        res.render('search_admin'); // Tampilkan halaman pencarian admin
    } else {
        req.flash('error', 'Anda harus login sebagai admin.');
        res.redirect('/admin');
    }
});

// Search route for both guest and admin
app.post('/search', async (req, res) => {
    const nomorRegister = req.body.query && req.body.query.trim();
    const data = await getData(nomorRegister);

    if (data.length > 0) {
        if (req.session.users && req.session.users.role === 'administrator') {
            // Tampilkan data lengkap untuk administrator
            const detailedData = data.map(row => ({
                nomorRegister: row[0],
                tanggalPutus: row[1],
                penggugat: row[2],
                tergugat: row[3],
                tanggalRelaas: row[4],
                status: row[5]
            }));
            res.render('result_admin', { data: detailedData, users: req.session.users });
        } else {
            // Tampilkan data terbatas untuk tamu
            const limitedData = data.map(row => ({
                nomorRegister: row[0],
                tanggalPutus: row[1],
                status: row[5]
            }));
            res.render('result_guest', { data: limitedData, users: req.session.users });
        }
    } else {
        req.flash('error', 'Data tidak ditemukan.');
        if (req.session.users && req.session.users.role === 'administrator') {
            res.redirect('/utama');
        } else {
            res.redirect('/guest');
        }
    }
});

app.get('/download/:nomorRegister', async (req, res) => {
    const nomorRegister = req.params.nomorRegister;

    try {
        // Ambil data berdasarkan nomor register
        const data = await getData(nomorRegister);
        if (data.length === 0) {
            return res.status(404).send("Data tidak ditemukan.");
        }

        const row = data[0]; // Ambil baris pertama

        // Baca template PDF
        const templatePath = path.join(__dirname, 'public', 'template.pdf');
        const pdfBytes = await fs.promises.readFile(templatePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);

        // Ambil form dari template PDF
        const form = pdfDoc.getForm();

        // Masukkan data ke dalam field form (pastikan nama field sesuai)
        form.getTextField('NomorRegister').setText(row[0] || ''); {size: 12}
        form.getTextField('TanggalPutus').setText(row[1] || ''); {size: 12}
        form.getTextField('penggugat').setText(row[2] || ''); {size: 12}
        form.getTextField('Tergugat').setText(row[3] || ''); {size: 12}
        form.getTextField('TanggalRelaas').setText(row[4] || ''); {size: 12}
        form.getTextField('Status').setText(row[5] || ''); {size: 12}

        // Simpan PDF yang telah diisi
        await fs.ensureDir(path.join(__dirname, 'surat_keterangan'));
        const outputPath = path.join(__dirname, 'surat_keterangan', `${nomorRegister}.pdf`); // Perbaiki penggunaan template string
        const pdfData = await pdfDoc.save();
        await fs.outputFile(outputPath, pdfData);

        // Unduh PDF
        res.download(outputPath, (err) => {
            if (err) {
                console.error('Error saat mengunduh file:', err);
            } else {
                console.log('File berhasil diunduh:', outputPath);
            }
        });
    } catch (error) {
        console.error('Error saat menghasilkan PDF:', error);
        res.status(500).send('Error saat menghasilkan PDF');
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Aplikasi berjalan di http://localhost:${port}`);
});
