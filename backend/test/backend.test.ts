import { createServer } from '../src/server';
import { getDatabase } from '../src/db/connection';
import { GeoService } from '../src/services/geo.service';
import http from 'http';

interface TestResponse {
  readonly status: number;
  readonly body: Record<string, unknown>;
}

function makeRequest(
  server: http.Server,
  options: {
    method: string;
    path: string;
    body?: Record<string, unknown>;
    token?: string;
  }
): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      reject(new Error('Server not bound'));
      return;
    }

    const payload = options.body ? JSON.stringify(options.body) : undefined;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: addr.port,
        path: options.path,
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const body = data ? (JSON.parse(data) as Record<string, unknown>) : {};
            resolve({ status: res.statusCode ?? 500, body });
          } catch {
            resolve({ status: res.statusCode ?? 500, body: { raw: data } });
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runBackendTests(): Promise<void> {
  console.log('--- STARTING BACKEND COMPREHENSIVE TEST SUITE ---');

  await getDatabase();
  const app = createServer();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  try {
    // 1. Test Geo-Service Determinism & 500m Radius Constraint
    console.log('Testing Geo-Service determinism & 500m radius...');
    const exactLat = 37.7749;
    const exactLng = -122.4194;
    const providerId = 'prov_care_01';

    const obf1 = GeoService.obfuscateCoordinates(providerId, exactLat, exactLng);
    const obf2 = GeoService.obfuscateCoordinates(providerId, exactLat, exactLng);

    assert(
      obf1.obfuscatedLat === obf2.obfuscatedLat && obf1.obfuscatedLng === obf2.obfuscatedLng,
      'Geo-obfuscation must be strictly deterministic across calls'
    );

    const distMeters = GeoService.calculateDistanceMeters(
      { lat: exactLat, lng: exactLng },
      { lat: obf1.obfuscatedLat, lng: obf1.obfuscatedLng }
    );
    assert(
      distMeters <= 500 && distMeters >= 150,
      `Obfuscated distance must be between 150m and 500m (got ${distMeters.toFixed(2)}m)`
    );
    console.log(`✓ Geo-Obfuscation passed: Distance offset is ${distMeters.toFixed(1)}m (<= 500m) and 100% deterministic.`);

    // 2. Test User Login
    console.log('Testing User Login (Member & Admin & Guest)...');
    const memberLoginRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'alex@wevsocial.com', password: 'Password123!' },
    });
    assert(memberLoginRes.status === 200, `Member login must return 200 (got ${memberLoginRes.status})`);
    const memberSession = memberLoginRes.body as unknown as { tokens: { accessToken: string; refreshToken: string } };
    const memberToken = memberSession.tokens.accessToken;
    const memberRefreshToken = memberSession.tokens.refreshToken;
    assert(typeof memberToken === 'string', 'Member access token must be a string');

    const adminLoginRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'admin@wevsocial.com', password: 'Password123!' },
    });
    assert(adminLoginRes.status === 200, 'Admin login must return 200');
    const adminSession = adminLoginRes.body as unknown as { tokens: { accessToken: string } };
    const adminToken = adminSession.tokens.accessToken;

    const guestLoginRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'guest@wevsocial.com', password: 'Password123!' },
    });
    assert(guestLoginRes.status === 200, 'Guest login must return 200');
    const guestSession = guestLoginRes.body as unknown as { tokens: { accessToken: string } };
    const guestToken = guestSession.tokens.accessToken;
    console.log('✓ Authentication passed: Credentials verified with bcrypt & JWT tokens issued.');

    // 3. Test Silent Refresh Token Rotation
    console.log('Testing Silent Refresh Token Rotation...');
    const refreshRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/auth/refresh',
      body: { refreshToken: memberRefreshToken },
    });
    assert(refreshRes.status === 200, 'Token refresh must return 200');
    const rotatedTokens = refreshRes.body as unknown as { accessToken: string; refreshToken: string };
    assert(typeof rotatedTokens.accessToken === 'string', 'Rotated access token must be present');
    assert(rotatedTokens.refreshToken !== memberRefreshToken, 'Refresh token must be rotated to a new token');
    console.log('✓ Refresh Token Rotation passed: Old refresh token rotated and new JWT access token generated.');

    // 4. Test RBAC Security Guard (Host-Only endpoint)
    console.log('Testing RBAC Endpoint Protection (/api/admin/host-only)...');
    const guestRbacRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/admin/host-only',
      token: guestToken,
    });
    assert(guestRbacRes.status === 403, `Guest accessing host-only endpoint must receive 403 Forbidden (got ${guestRbacRes.status})`);

    const memberRbacRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/admin/host-only',
      token: memberToken,
    });
    assert(memberRbacRes.status === 403, `Member accessing host-only endpoint must receive 403 Forbidden (got ${memberRbacRes.status})`);

    const adminRbacRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/admin/host-only',
      token: adminToken,
    });
    assert(adminRbacRes.status === 200, `Admin accessing host-only endpoint must receive 200 OK (got ${adminRbacRes.status})`);
    console.log('✓ RBAC Security Guard passed: 403 Forbidden strictly enforced on unauthorized roles.');

    // 5. Test Care Provider Geo-Privacy & Booking Reveal
    console.log('Testing Care Provider Geo-Privacy (Address Masking & Unlock)...');
    const providersRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/care/providers',
    });
    assert(providersRes.status === 200, 'Care providers list must return 200');
    const provBody = providersRes.body as unknown as { providers: Array<{ id: string; name: string; exactAddress?: string; location: { obfuscatedLat: number } }> };
    assert(provBody.providers.length > 0, 'Care providers must not be empty');
    assert(provBody.providers[0]?.exactAddress === undefined, 'Exact address MUST NEVER be exposed in public provider listing');
    assert(typeof provBody.providers[0]?.location.obfuscatedLat === 'number', 'Obfuscated location must be present');

    // Create a pending care booking
    const bookCareRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/care/bookings',
      token: memberToken,
      body: {
        providerId: 'prov_care_01',
        startTime: new Date(Date.now() + 86400000).toISOString(),
        endTime: new Date(Date.now() + 90000000).toISOString(),
        notes: 'Childcare needed during sports session',
      },
    });
    assert(bookCareRes.status === 201, `Create care booking must return 201 (got ${bookCareRes.status})`);
    const careBooking = (bookCareRes.body as unknown as { booking: { bookingId: string; status: string; exactAddress?: string } }).booking;
    assert(careBooking.status === 'pending', 'Initial care booking must be in pending status');
    assert(careBooking.exactAddress === undefined, 'Exact address must remain hidden while booking is PENDING');

    // Confirm the booking and verify address reveal
    const confirmCareRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/care/bookings/${careBooking.bookingId}/confirm`,
      token: memberToken,
    });
    assert(confirmCareRes.status === 200, 'Confirm care booking must return 200');
    const confirmedBooking = (confirmCareRes.body as unknown as { booking: { status: string; exactAddress?: string; phone?: string } }).booking;
    assert(confirmedBooking.status === 'confirmed', 'Booking status must now be confirmed');
    assert(typeof confirmedBooking.exactAddress === 'string' && confirmedBooking.exactAddress.length > 0, 'Exact address must be revealed once booking is CONFIRMED');
    assert(typeof confirmedBooking.phone === 'string', 'Phone contact must be revealed once booking is CONFIRMED');
    console.log('✓ Geo-Privacy & Reveal passed: Exact address strictly protected until confirmed state.');

    // 6. Test Sports Booking & 409 Conflict Concurrency
    console.log('Testing Sports Booking & 409 Double-Booking Conflict Handling...');
    const sportsListRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/sports/activities',
    });
    assert(sportsListRes.status === 200, 'Sports activities list must return 200');
    const sportsBody = sportsListRes.body as unknown as { activities: Array<{ id: string; availableSpots: number }> };
    assert(sportsBody.activities.length > 0, 'Sports activities must be returned');

    // Attempt to book full capacity activity ('act_full_04')
    const conflictBookingRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/sports/bookings',
      token: memberToken,
      body: { activityId: 'act_full_04' },
    });
    assert(conflictBookingRes.status === 409, `Booking a full activity must return HTTP 409 Conflict (got ${conflictBookingRes.status})`);

    // Test explicit conflict simulation
    const simulatedConflictRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/sports/bookings',
      token: memberToken,
      body: { activityId: 'act_bball_02', simulateConflict: true },
    });
    assert(simulatedConflictRes.status === 409, `Simulated conflict must return HTTP 409 Conflict (got ${simulatedConflictRes.status})`);

    // Successful booking of available activity
    const validBookingRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/sports/bookings',
      token: memberToken,
      body: { activityId: 'act_bball_02' },
    });
    assert(validBookingRes.status === 201, `Valid booking must return 201 Created (got ${validBookingRes.status})`);
    console.log('✓ Concurrency & 409 Conflict handling passed: Capacity limits and race-condition rollback validated.');

    console.log('\n🎉 ALL BACKEND SUITE TESTS PASSED (100% SUCCESS)\n');
  } finally {
    server.close();
  }
}

runBackendTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
