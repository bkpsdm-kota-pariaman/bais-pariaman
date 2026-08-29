const credentials = require('../fixtures/load-credentials');

describe('Test Credentials CSV Loader with Dynamic ASN Sampling & Super Admin Detection', () => {
    test('should load credentials from CSV or CSV example', () => {
        expect(credentials.users.length).toBeGreaterThan(0);
    });

    test('should identify super admin user correctly', () => {
        expect(credentials.superAdminUser).toBeDefined();
        expect(credentials.superAdminUser.isAdmin).toBe(true);
        expect(credentials.superAdminUser.role.some(r => ['admin', 'super admin'].includes(r.toLowerCase()))).toBe(true);
    });

    test('should sample exact N random ASN users (excluding super admin & admin)', () => {
        const sampleCount = 5;
        const sampledAsn = credentials.getSampleAsnUsers(sampleCount);
        
        expect(sampledAsn.length).toBeLessThanOrEqual(sampleCount);
        expect(sampledAsn.length).toBeLessThanOrEqual(credentials.asnUsers.length);
        
        // Pastikan tidak ada satupun super admin atau admin di dalam sampel ASN
        for (const asn of sampledAsn) {
            expect(asn.isAdmin).toBe(false);
            expect(asn.isSuperAdmin).toBe(false);
            expect(asn.role).not.toContain('super admin');
            expect(asn.role).not.toContain('admin');
        }
    });

    test('should sample custom count (e.g. 25 users or max available)', () => {
        const sampled25 = credentials.getSampleAsnUsers(25);
        expect(sampled25.length).toBe(Math.min(25, credentials.asnUsers.length));
        expect(sampled25.every(u => !u.isAdmin)).toBe(true);
    });

    test('should find user by NIP', () => {
        const targetNip = credentials.users[0].nip;
        const user = credentials.getUserByNip(targetNip);
        expect(user).toBeDefined();
        expect(user.nip).toBe(targetNip);
    });
});
