import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import open from 'open';
import { saveDiscogsTokens } from './token-storage.js';
import { getApp, startServer, stopServer } from './shared-server.js';

const CONSUMER_KEY = process.env.DISCOGS_CONSUMER_KEY!;
const CONSUMER_SECRET = process.env.DISCOGS_CONSUMER_SECRET!;
const REDIRECT_URI = 'http://127.0.0.1:3000/auth/discogs/callback';

const oauth = new OAuth({
  consumer: { key: CONSUMER_KEY, secret: CONSUMER_SECRET },
  signature_method: 'HMAC-SHA1',
  hash_function(baseString, key) {
    return crypto.createHmac('sha1', key).update(baseString).digest('base64');
  }
});

export async function authenticateDiscogs(useSharedServer = false): Promise<void> {
  if (!CONSUMER_KEY || !CONSUMER_SECRET) {
    throw new Error('Missing DISCOGS_CONSUMER_KEY or DISCOGS_CONSUMER_SECRET environment variables');
  }

  // Step 1: Get request token
  const requestTokenUrl = 'https://api.discogs.com/oauth/request_token';
  const requestData = {
    url: requestTokenUrl,
    method: 'GET',
    data: { oauth_callback: REDIRECT_URI }
  };

  const authHeader = oauth.toHeader(oauth.authorize(requestData));
  const response = await fetch(`${requestTokenUrl}?oauth_callback=${encodeURIComponent(REDIRECT_URI)}`, {
    headers: {
      Authorization: authHeader.Authorization
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get request token: ${response.status} - ${errorText}`);
  }

  const responseText = await response.text();
  const params = new URLSearchParams(responseText);
  const requestToken = params.get('oauth_token');
  const requestSecret = params.get('oauth_token_secret');

  if (!requestToken || !requestSecret) {
    throw new Error('Failed to parse request token from Discogs response');
  }

  // Step 2: Open browser for authorization
  const authUrl = `https://www.discogs.com/oauth/authorize?oauth_token=${requestToken}`;

  // Start server if running standalone
  if (!useSharedServer) {
    await startServer();
  }

  return new Promise((resolve, reject) => {
    const app = getApp();

    console.log('💿 Opening browser for Discogs authentication...');
    open(authUrl);

    app.get('/auth/discogs/callback', async (req, res) => {
      const oauthToken = req.query.oauth_token as string;
      const oauthVerifier = req.query.oauth_verifier as string;

      if (!oauthVerifier) {
        res.send('<h1>❌ Authorization denied or failed</h1>');
        if (!useSharedServer) await stopServer();
        reject(new Error('No oauth_verifier received'));
        return;
      }

      try {
        // Step 3: Exchange for access token
        const accessTokenUrl = 'https://api.discogs.com/oauth/access_token';
        const token = { key: requestToken, secret: requestSecret };
        const accessData = {
          url: accessTokenUrl,
          method: 'POST',
          data: { oauth_verifier: oauthVerifier }
        };

        const accessAuthHeader = oauth.toHeader(oauth.authorize(accessData, token));
        const accessResponse = await fetch(`${accessTokenUrl}?oauth_verifier=${oauthVerifier}`, {
          method: 'POST',
          headers: {
            Authorization: accessAuthHeader.Authorization
          }
        });

        if (!accessResponse.ok) {
          const errorText = await accessResponse.text();
          throw new Error(`Failed to get access token: ${accessResponse.status} - ${errorText}`);
        }

        const accessText = await accessResponse.text();
        const accessParams = new URLSearchParams(accessText);
        const accessToken = accessParams.get('oauth_token');
        const accessSecret = accessParams.get('oauth_token_secret');

        if (!accessToken || !accessSecret) {
          throw new Error('Failed to parse access token from Discogs response');
        }

        // Step 4: Get username
        const identityUrl = 'https://api.discogs.com/oauth/identity';
        const identityData = { url: identityUrl, method: 'GET' };
        const identityAuthHeader = oauth.toHeader(
          oauth.authorize(identityData, { key: accessToken, secret: accessSecret })
        );

        const identityResponse = await fetch(identityUrl, {
          headers: {
            Authorization: identityAuthHeader.Authorization
          }
        });

        if (!identityResponse.ok) {
          throw new Error(`Failed to get user identity: ${identityResponse.status}`);
        }

        const identity = await identityResponse.json();

        // Save to keychain
        await saveDiscogsTokens({
          accessToken,
          accessSecret,
          username: identity.username
        });

        res.send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Discogs Authentication</title>
              <style>
                body { font-family: system-ui; text-align: center; padding: 50px; }
                h1 { color: #333333; }
              </style>
            </head>
            <body>
              <h1>✓ Discogs authenticated successfully!</h1>
              <p>Username: ${identity.username}</p>
              <p>You can close this window and return to the terminal.</p>
            </body>
          </html>
        `);
        console.log(`✓ Discogs tokens saved to system keychain (username: ${identity.username})`);

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
