import crypto from 'crypto';
import open from 'open';
import { saveSpotifyTokens } from './token-storage.js';
import { getApp, startServer, stopServer } from './shared-server.js';

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const REDIRECT_URI = 'http://127.0.0.1:3000/auth/spotify/callback';
const SCOPES = 'user-read-email user-top-read user-read-recently-played user-library-read user-follow-read playlist-read-private';

function generateCodeVerifier(): string {
  return crypto.randomBytes(64).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export async function authenticateSpotify(useSharedServer = false): Promise<void> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET environment variables');
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge
  });

  const authUrl = `https://accounts.spotify.com/authorize?${params}`;

  // Start server if running standalone
  if (!useSharedServer) {
    await startServer();
  }

  return new Promise((resolve, reject) => {
    const app = getApp();

    console.log('🎵 Opening browser for Spotify authentication...');
    open(authUrl);

    app.get('/auth/spotify/callback', async (req, res) => {
      const code = req.query.code as string;
      const error = req.query.error as string;

      if (error) {
        res.send(`<h1>❌ Authentication failed: ${error}</h1>`);
        if (!useSharedServer) await stopServer();
        reject(new Error(error));
        return;
      }

      try {
        // Exchange code for tokens
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI,
            code_verifier: codeVerifier
          })
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorText}`);
        }

        const tokens = await tokenResponse.json();

        // Save to keychain
        await saveSpotifyTokens({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000
        });

        res.send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Spotify Authentication</title>
              <style>
                body { font-family: system-ui; text-align: center; padding: 50px; }
                h1 { color: #1DB954; }
              </style>
            </head>
            <body>
              <h1>✓ Spotify authenticated successfully!</h1>
              <p>You can close this window and return to the terminal.</p>
            </body>
          </html>
        `);
        console.log('✓ Spotify tokens saved to system keychain');

        if (!useSharedServer) await stopServer();
        resolve();
      } catch (err: any) {
        res.send(`<h1>❌ Authentication error: ${err.message}</h1>`);
        if (!useSharedServer) await stopServer();
        reject(err);
      }
    });
  });
}
