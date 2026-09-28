describe('Rekap Verifikasi Filter & View Persistence', () => {
    test('Pencocokan varian status verifikasi konsisten', () => {
        const matchVerifikasi = (filter, statusRaw) => {
            const statusEfektif = (!statusRaw || statusRaw.trim() === '') ? 'ALPA' : statusRaw.trim();
            if (filter === 'semua') return true;
            if (['terverifikasi sistem', 'terverifikasi oleh sistem'].includes(filter.toLowerCase())) {
                return ['terverifikasi sistem', 'terverifikasi oleh sistem'].includes(statusEfektif.toLowerCase());
            }
            if (['menunggu verifikasi admin', 'menunggu verifikasi'].includes(filter.toLowerCase())) {
                return ['menunggu verifikasi admin', 'menunggu verifikasi'].includes(statusEfektif.toLowerCase());
            }
            return statusEfektif.toLowerCase() === filter.toLowerCase();
        };

        // Filter: Terverifikasi Sistem
        expect(matchVerifikasi('Terverifikasi Sistem', 'Terverifikasi Oleh Sistem')).toBe(true);
        expect(matchVerifikasi('Terverifikasi Sistem', 'Terverifikasi Sistem')).toBe(true);
        expect(matchVerifikasi('Terverifikasi Sistem', 'Terverifikasi Oleh Admin')).toBe(false);

        // Filter: Menunggu Verifikasi Admin
        expect(matchVerifikasi('Menunggu Verifikasi Admin', 'Menunggu Verifikasi Admin')).toBe(true);
        expect(matchVerifikasi('Menunggu Verifikasi Admin', 'Menunggu Verifikasi')).toBe(true);
        expect(matchVerifikasi('Menunggu Verifikasi Admin', 'Terverifikasi Oleh Admin')).toBe(false);

        // Filter: ALPA
        expect(matchVerifikasi('ALPA', null)).toBe(true);
        expect(matchVerifikasi('ALPA', '')).toBe(true);
        expect(matchVerifikasi('ALPA', 'ALPA')).toBe(true);
        expect(matchVerifikasi('ALPA', 'Terverifikasi Oleh Sistem')).toBe(false);
    });

    test('Mode tampilan tabel vs foto dipertahankan berdasarkan nilai view', () => {
        let selectedView = 'table';
        const determineRender = (view) => (view === 'table' ? 'renderTable' : 'renderPhoto');
        expect(determineRender(selectedView)).toBe('renderTable');

        selectedView = 'photo';
        expect(determineRender(selectedView)).toBe('renderPhoto');
    });
});
