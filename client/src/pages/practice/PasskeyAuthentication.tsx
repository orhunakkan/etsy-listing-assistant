import { useState } from 'react';
import { useNavigate } from 'react-router';
import { LabHeader } from '../../components/LabHeader';
import { labs } from '../../labs';

const lab = labs.find((l) => l.slug === 'passkey-authentication')!;

interface RegistrationOptions {
  challenge: string;
  rpId: string;
  rpName: string;
  userId: string;
  userName: string;
  userDisplayName: string;
}

interface LoginOptions {
  challenge: string;
  allowCredentialIds: string[];
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const padded = base64url.padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), '=');
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function PasskeyAuthentication() {
  const navigate = useNavigate();
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const registerPasskey = async () => {
    setError(null);
    setBusy(true);
    try {
      const optionsRes = await fetch('/api/passkey/register/challenge', {
        credentials: 'include',
      });
      const options = (await optionsRes.json()) as RegistrationOptions;

      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: base64urlToBuffer(options.challenge),
          rp: { id: options.rpId, name: options.rpName },
          user: {
            id: base64urlToBuffer(options.userId),
            name: options.userName,
            displayName: options.userDisplayName,
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 }, // ES256
            { type: 'public-key', alg: -257 }, // RS256
          ],
          authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
          attestation: 'none',
        },
      })) as PublicKeyCredential | null;

      if (!credential) throw new Error('No credential returned');

      const attestation = credential.response as AuthenticatorAttestationResponse | undefined;
      const publicKey =
        typeof attestation?.getPublicKey === 'function' ? attestation.getPublicKey() : null;

      const res = await fetch('/api/passkey/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          credentialId: bufferToBase64url(credential.rawId),
          ...(publicKey ? { publicKey: bufferToBase64url(publicKey) } : {}),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRegistered(true);
    } catch {
      setError('Passkey registration failed. Make sure a virtual authenticator is attached.');
    } finally {
      setBusy(false);
    }
  };

  const signInWithPasskey = async () => {
    setError(null);
    setBusy(true);
    try {
      const optionsRes = await fetch('/api/passkey/login/challenge', {
        credentials: 'include',
      });
      const options = (await optionsRes.json()) as LoginOptions;

      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge: base64urlToBuffer(options.challenge),
          allowCredentials: options.allowCredentialIds.map((id) => ({
            id: base64urlToBuffer(id),
            type: 'public-key',
          })),
          userVerification: 'required',
        },
      })) as PublicKeyCredential | null;

      if (!assertion) throw new Error('No assertion returned');

      const res = await fetch('/api/passkey/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credentialId: bufferToBase64url(assertion.rawId) }),
      });
      if (res.status === 401) {
        setError('No matching passkey found. Register one first.');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      void navigate('/practice/passkey-authentication/dashboard');
    } catch {
      setError('Passkey sign-in failed. Make sure a virtual authenticator is attached.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <LabHeader lab={lab} />

      <div className="max-w-sm">
        <div className="rounded-xl border border-edge bg-surface p-6">
          <h2 className="text-lg font-semibold text-content">Passkey for alice</h2>
          <p className="mt-1 text-sm text-muted">
            {registered
              ? 'A passkey is registered for this session.'
              : 'No passkey registered yet.'}
          </p>

          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void registerPasskey()}
              disabled={busy}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Working…' : 'Register passkey'}
            </button>
            <button
              type="button"
              onClick={() => void signInWithPasskey()}
              disabled={busy}
              className="w-full rounded-lg border border-edge px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Working…' : 'Sign in with passkey'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
