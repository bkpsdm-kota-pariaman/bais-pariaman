const fs = require('fs');
const path = require('path');

function loadCredentials() {
    const realCsv = path.join(__dirname, 'credentials.csv');
    const exampleCsv = path.join(__dirname, 'credentials.csv.example');
    const targetFile = fs.existsSync(realCsv) ? realCsv : exampleCsv;

    if (!fs.existsSync(targetFile)) {
        return {
            users: [],
            superAdminUser: null,
            adminUser: null,
            adminUsers: [],
            asnUsers: [],
            getSampleAsnUsers: () => [],
            getUserByNip: () => null,
            getRandomAsnUser: () => null
        };
    }

    const content = fs.readFileSync(targetFile, 'utf-8');
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    const dataRows = lines.slice(1); // Lewati baris header

    const users = dataRows.map(row => {
        const cols = row.split(';').map(c => c.trim());
        const nip = cols[0] || '';
        const nama = cols[1] || '';
        const rawNik = cols[2] ? cols[2].trim() : '';
        const hasValidNik = rawNik.length === 16 && rawNik !== nip;
        const nik = hasValidNik ? rawNik : nip;
        const roleStr = cols[3] || 'asn';
        const roles = roleStr.split(',').map(r => r.trim()).filter(Boolean);
        
        const isSuperAdmin = roles.some(r => r.toLowerCase() === 'super admin');
        const isAdmin = isSuperAdmin || roles.some(r => r.toLowerCase() === 'admin');

        return {
            nip,
            nama,
            nik,
            hasValidNik,
            role: roles.length > 0 ? roles : ['asn'],
            isSuperAdmin,
            isAdmin
        };
    }).filter(u => u.nip.length > 0);

    // Filter pengguna berdasarkan peran
    const superAdminUser = users.find(u => u.isSuperAdmin) || users.find(u => u.isAdmin) || null;
    const adminUsers = users.filter(u => u.isAdmin);
    // Murni ASN biasa yang memiliki NIK terdaftar di CSV
    const asnUsers = users.filter(u => !u.isAdmin && u.hasValidNik);

    /**
     * Memilih sampel acak sejumlah N user ASN biasa (di luar Super Admin/Admin).
     * @param {number} count Jumlah sampel ASN yang ingin diambil. Default dari env TEST_ASN_COUNT atau 25.
     * @returns {Array} Array berisi user ASN terpilih secara acak.
     */
    function getSampleAsnUsers(count) {
        const targetCount = Number.isInteger(Number(count)) && Number(count) > 0 
            ? Number(count) 
            : (Number(process.env.TEST_ASN_COUNT) || 25);

        // Fisher-Yates shuffle array ASN saja
        const shuffled = [...asnUsers];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, Math.min(targetCount, shuffled.length));
    }

    function getDynamicActiveScheduleTimes() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const tanggal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

        const start = new Date(now.getTime() - 10 * 60 * 1000);
        const jam_mulai = `${pad(start.getHours())}:${pad(start.getMinutes())}`;

        const end = new Date(now.getTime() + 60 * 60 * 1000);
        const jam_selesai = `${pad(end.getHours())}:${pad(end.getMinutes())}`;

        return { tanggal, jam_mulai, jam_selesai };
    }

    return {
        users,
        superAdminUser,
        adminUser: superAdminUser, // Alias untuk backward compatibility
        adminUsers,
        asnUsers,
        getSampleAsnUsers,
        getDynamicActiveScheduleTimes,
        getUserByNip: (nip) => users.find(u => u.nip === nip),
        getRandomAsnUser: () => {
            const sample = getSampleAsnUsers(1);
            return sample.length > 0 ? sample[0] : null;
        }
    };
}

module.exports = loadCredentials();
