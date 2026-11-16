import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGoogleUserFromDriveAbout,
  buildUnauthorizedDomainHelp,
  classifyGoogleAuthError,
  GoogleAuthDomainError,
  isHostnameInAuthorizedDomains,
} from './googleAuthLogic';

describe('isHostnameInAuthorizedDomains', () => {
  const authorized = [
    'gen-lang-client-0438712649.firebaseapp.com',
    'ais-dev-abc.asia-southeast1.run.app',
    'example.com',
  ];

  it('matches exact hostnames case-insensitively', () => {
    assert.equal(
      isHostnameInAuthorizedDomains('AIS-DEV-ABC.asia-southeast1.run.app', authorized),
      true
    );
    assert.equal(isHostnameInAuthorizedDomains('example.com', authorized), true);
  });

  it('matches valid subdomains while rejecting lookalike suffix domains', () => {
    assert.equal(isHostnameInAuthorizedDomains('app.example.com', authorized), true);
    assert.equal(isHostnameInAuthorizedDomains('evil-example.com', authorized), false);
    assert.equal(isHostnameInAuthorizedDomains('localhost', authorized), false);
    assert.equal(isHostnameInAuthorizedDomains('', authorized), false);
  });
});

describe('classifyGoogleAuthError', () => {
  it('classifies auth/unauthorized-domain and origin_mismatch errors', () => {
    const firebaseErr = Object.assign(new Error('Firebase: Error (auth/unauthorized-domain).'), {
      code: 'auth/unauthorized-domain',
    });
    const res1 = classifyGoogleAuthError(firebaseErr);
    assert.equal(res1.isUnauthorizedDomain, true);
    assert.equal(res1.code, 'auth/unauthorized-domain');

    const gisErr = new Error('Google OAuth origin_mismatch for http://localhost:3000');
    const res2 = classifyGoogleAuthError(gisErr);
    assert.equal(res2.isUnauthorizedDomain, true);

    const domainErr = new GoogleAuthDomainError({
      hostname: 'localhost',
      origin: 'http://localhost:3000',
      projectId: 'gen-lang-client-0438712649',
      oAuthClientId: '123.apps.googleusercontent.com',
      authorizedDomains: ['ais-dev.run.app'],
    });
    assert.equal(classifyGoogleAuthError(domainErr).isUnauthorizedDomain, true);
  });

  it('distinguishes popup-blocked and popup-closed errors', () => {
    const blocked = classifyGoogleAuthError(
      Object.assign(new Error('Popup blocked'), { code: 'auth/popup-blocked' })
    );
    assert.equal(blocked.isPopupBlocked, true);
    assert.equal(blocked.isUnauthorizedDomain, false);

    const closed = classifyGoogleAuthError(
      Object.assign(new Error('Closed'), { code: 'auth/popup-closed-by-user' })
    );
    assert.equal(closed.isPopupClosed, true);
    assert.equal(closed.isUnauthorizedDomain, false);
  });
});

describe('buildGoogleUserFromDriveAbout & buildUnauthorizedDomainHelp', () => {
  it('normalizes Drive About user metadata for GIS fallback', () => {
    const account = buildGoogleUserFromDriveAbout({
      emailAddress: 'ops@ptg.co.id',
      displayName: 'Ops PTG',
      photoLink: 'https://example.com/p.jpg',
    });
    assert.equal(account.email, 'ops@ptg.co.id');
    assert.equal(account.displayName, 'Ops PTG');
    assert.equal(account.authMethod, 'gis');
  });

  it('produces actionable troubleshooting URLs and preferred app URLs', () => {
    const help = buildUnauthorizedDomainHelp({
      currentHostname: 'localhost',
      currentOrigin: 'http://localhost:3000',
      projectId: 'gen-lang-client-0438712649',
      oAuthClientId: '660323480322-xxx.apps.googleusercontent.com',
      authorizedDomains: [
        'gen-lang-client-0438712649.firebaseapp.com',
        'ais-dev-test.asia-southeast1.run.app',
        'ais-pre-test.asia-southeast1.run.app',
      ],
      gisFallbackError: 'origin_mismatch',
    });

    assert.equal(help.currentHostname, 'localhost');
    assert.ok(help.firebaseConsoleUrl.includes('gen-lang-client-0438712649'));
    assert.deepEqual(help.preferredAppUrls, [
      'https://ais-dev-test.asia-southeast1.run.app',
      'https://ais-pre-test.asia-southeast1.run.app',
    ]);
    assert.ok(help.steps.length >= 2);
  });
});
