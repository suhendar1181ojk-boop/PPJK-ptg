import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDriveFolderUrl,
  chooseGoogleDriveUploadStrategy,
  DEFAULT_DRIVE_ROOT_FOLDER_NAME,
  describeRegisteredDriveDestination,
  extractDriveFolderIdFromInput,
  isValidEmailAddress,
  normalizeGmailAddress,
  sanitizeDriveDocPrefix,
} from './googleDriveFolderLogic';
import { DEFAULT_PENGATURAN } from './ppjkLogic';

describe('googleDriveFolderLogic', () => {
  it('normalizes and validates Gmail addresses cleanly', () => {
    assert.equal(normalizeGmailAddress('  Arsip.PPJK@Gmail.COM  '), 'arsip.ppjk@gmail.com');
    assert.equal(isValidEmailAddress('arsip.ppjk@gmail.com'), true);
    assert.equal(isValidEmailAddress('bukan-email'), false);
    assert.equal(isValidEmailAddress(''), false);
  });

  it('extracts Google Drive folder ID from raw ID and various folder URLs', () => {
    assert.equal(
      extractDriveFolderIdFromInput('1AbCDefGhIjKlMnOpQrStUvWxYz_12345'),
      '1AbCDefGhIjKlMnOpQrStUvWxYz_12345'
    );
    assert.equal(
      extractDriveFolderIdFromInput(
        'https://drive.google.com/drive/folders/1AbCDefGhIjKlMnOpQrStUvWxYz_12345?usp=sharing'
      ),
      '1AbCDefGhIjKlMnOpQrStUvWxYz_12345'
    );
    assert.equal(
      extractDriveFolderIdFromInput(
        'https://drive.google.com/drive/u/0/folders/1XyZ987654321AbCdEfGhIjKlMn'
      ),
      '1XyZ987654321AbCdEfGhIjKlMn'
    );
    assert.equal(
      extractDriveFolderIdFromInput(
        'https://drive.google.com/open?id=1OpenFolderIdSample_123456'
      ),
      '1OpenFolderIdSample_123456'
    );
    assert.equal(extractDriveFolderIdFromInput('PTG_PPJK_DOKUMEN_ROOT'), '');
    assert.equal(extractDriveFolderIdFromInput('https://example.com/folders/1234567890123456'), '');
    assert.equal(extractDriveFolderIdFromInput('short'), '');
  });

  it('builds canonical Drive folder URL and sanitizes doc prefix', () => {
    assert.equal(
      buildDriveFolderUrl('https://drive.google.com/drive/folders/1FolderIdSample_98765'),
      'https://drive.google.com/drive/folders/1FolderIdSample_98765'
    );
    assert.equal(buildDriveFolderUrl('PTG_PPJK_DOKUMEN_ROOT'), '');
    assert.equal(sanitizeDriveDocPrefix('Bill of Lading (BL)'), 'Bill_of_Lading_BL');
  });

  it('chooses optimal upload strategy across OAuth session vs GAS Web App for registered Gmail', () => {
    // 1. Not signed in via Google OAuth, but GAS Web App is configured
    const gasOnly = chooseGoogleDriveUploadStrategy({
      hasOAuthToken: false,
      connectedGoogleEmail: null,
      registeredGmail: 'arsip.kantor@gmail.com',
      configuredFolderInput: 'PTG_PPJK_DOKUMEN_ROOT',
      hasGasWebAppUrl: true,
    });
    assert.equal(gasOnly.primary, 'gas-webapp');
    assert.equal(gasOnly.secondary, null);

    // 2. Signed in via Google OAuth to the same registered Gmail
    const oauthSame = chooseGoogleDriveUploadStrategy({
      hasOAuthToken: true,
      connectedGoogleEmail: 'arsip.kantor@gmail.com',
      registeredGmail: 'arsip.kantor@gmail.com',
      configuredFolderInput: '1AbCDefGhIjKlMnOpQrStUvWxYz_12345',
      hasGasWebAppUrl: true,
    });
    assert.equal(oauthSame.primary, 'oauth-direct');
    assert.equal(oauthSame.secondary, 'gas-webapp');

    // 3. Signed in to a different Gmail without explicit folder ID -> prioritize GAS Web App owned by registered Gmail
    const oauthMismatch = chooseGoogleDriveUploadStrategy({
      hasOAuthToken: true,
      connectedGoogleEmail: 'staff.pribadi@gmail.com',
      registeredGmail: 'arsip.kantor@gmail.com',
      configuredFolderInput: 'PTG_PPJK_DOKUMEN_ROOT',
      hasGasWebAppUrl: true,
    });
    assert.equal(oauthMismatch.primary, 'gas-webapp');
    assert.equal(oauthMismatch.secondary, 'oauth-direct');

    // 4. Signed in to a different Gmail WITH an explicit shared folder URL/ID -> direct OAuth into that folder first
    const oauthSharedFolder = chooseGoogleDriveUploadStrategy({
      hasOAuthToken: true,
      connectedGoogleEmail: 'staff.pribadi@gmail.com',
      registeredGmail: 'arsip.kantor@gmail.com',
      configuredFolderInput: 'https://drive.google.com/drive/folders/1SharedFolder_1234567',
      hasGasWebAppUrl: true,
    });
    assert.equal(oauthSharedFolder.primary, 'oauth-direct');
    assert.equal(oauthSharedFolder.secondary, 'gas-webapp');

    // 5. Neither OAuth nor GAS configured -> local fallback
    const localOnly = chooseGoogleDriveUploadStrategy({
      hasOAuthToken: false,
      connectedGoogleEmail: null,
      registeredGmail: '',
      configuredFolderInput: '',
      hasGasWebAppUrl: false,
    });
    assert.equal(localOnly.primary, 'local-fallback');
  });

  it('describes registered Drive destination consistently for UI badges', () => {
    const desc = describeRegisteredDriveDestination(
      {
        ...DEFAULT_PENGATURAN,
        driveOwnerGmail: 'arsip.ptg@gmail.com',
        driveParentFolderId: 'https://drive.google.com/drive/folders/1RootFolderTest_12345',
        driveParentFolderName: DEFAULT_DRIVE_ROOT_FOLDER_NAME,
        driveParentFolderUrl: '',
        gasWebAppUrl: 'https://script.google.com/macros/s/TEST/exec',
      },
      null
    );
    assert.equal(desc.registeredGmail, 'arsip.ptg@gmail.com');
    assert.equal(desc.folderId, '1RootFolderTest_12345');
    assert.equal(desc.folderLabel, DEFAULT_DRIVE_ROOT_FOLDER_NAME);
    assert.equal(
      desc.folderUrl,
      'https://drive.google.com/drive/folders/1RootFolderTest_12345'
    );
    assert.equal(desc.hasDirectOrGasDestination, true);
  });
});
