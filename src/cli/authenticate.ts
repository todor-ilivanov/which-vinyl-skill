import 'dotenv/config';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

async function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function promptYesNo(rl: readline.Interface, question: string): Promise<boolean> {
  const answer = await prompt(rl, question);
  return answer.toLowerCase() !== 'n' && answer.toLowerCase() !== 'no';
}

function getEnvFilePath(): string {
  return path.resolve(__dirname, '../../.env');
}

function appendToEnvFile(key: string, value: string): void {
  const envPath = getEnvFilePath();
  const line = `${key}=${value}\n`;

  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    if (!content.endsWith('\n')) {
      fs.appendFileSync(envPath, '\n');
    }
  }

  fs.appendFileSync(envPath, line);
}

async function ensureSpotifyCredentials(rl: readline.Interface): Promise<boolean> {
  if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
    return true;
  }

  console.log('\n⚠️  Spotify credentials not found in .env file.');
  const shouldAdd = await promptYesNo(rl, 'Would you like to add them now? [Y/n] ');

  if (!shouldAdd) {
    return false;
  }

  console.log('\nTo get Spotify credentials:');
  console.log('  1. Go to https://developer.spotify.com/dashboard');
  console.log('  2. Create or select an app');
  console.log('  3. Add http://127.0.0.1:3000/auth/spotify/callback to Redirect URIs');
  console.log('  4. Copy your Client ID and Client Secret\n');

  const clientId = await prompt(rl, 'Enter your Spotify Client ID: ');
  const clientSecret = await prompt(rl, 'Enter your Spotify Client Secret: ');

  if (!clientId || !clientSecret) {
    console.log('\n❌ Both Client ID and Client Secret are required.');
    return false;
  }

  // Add comment header if these are the first Spotify credentials
  const envPath = getEnvFilePath();
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    if (!content.includes('SPOTIFY_CLIENT_ID')) {
      fs.appendFileSync(envPath, '\n# Spotify OAuth 2.0 credentials\n');
    }
  } else {
    fs.writeFileSync(envPath, '# Spotify OAuth 2.0 credentials\n');
  }

  appendToEnvFile('SPOTIFY_CLIENT_ID', clientId);
  appendToEnvFile('SPOTIFY_CLIENT_SECRET', clientSecret);

  // Update process.env so the OAuth flow can proceed
  process.env.SPOTIFY_CLIENT_ID = clientId;
  process.env.SPOTIFY_CLIENT_SECRET = clientSecret;

  console.log('\n✓ Spotify credentials saved to .env file.');
  return true;
}

async function ensureDiscogsCredentials(rl: readline.Interface): Promise<boolean> {
  if (process.env.DISCOGS_CONSUMER_KEY && process.env.DISCOGS_CONSUMER_SECRET) {
    return true;
  }

  console.log('\n⚠️  Discogs credentials not found in .env file.');
  const shouldAdd = await promptYesNo(rl, 'Would you like to add them now? [Y/n] ');

  if (!shouldAdd) {
    return false;
  }

  console.log('\nTo get Discogs credentials:');
  console.log('  1. Go to https://www.discogs.com/settings/developers');
  console.log('  2. Click "Add new application"');
  console.log('  3. Set Callback URL to http://127.0.0.1:3000/auth/discogs/callback');
  console.log('  4. Copy your Consumer Key and Consumer Secret\n');

  const consumerKey = await prompt(rl, 'Enter your Discogs Consumer Key: ');
  const consumerSecret = await prompt(rl, 'Enter your Discogs Consumer Secret: ');

  if (!consumerKey || !consumerSecret) {
    console.log('\n❌ Both Consumer Key and Consumer Secret are required.');
    return false;
  }

  // Add comment header if these are the first Discogs credentials
  const envPath = getEnvFilePath();
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    if (!content.includes('DISCOGS_CONSUMER_KEY')) {
      fs.appendFileSync(envPath, '\n# Discogs OAuth 1.0a credentials\n');
    }
  } else {
    fs.writeFileSync(envPath, '# Discogs OAuth 1.0a credentials\n');
  }

  appendToEnvFile('DISCOGS_CONSUMER_KEY', consumerKey);
  appendToEnvFile('DISCOGS_CONSUMER_SECRET', consumerSecret);

  // Update process.env so the OAuth flow can proceed
  process.env.DISCOGS_CONSUMER_KEY = consumerKey;
  process.env.DISCOGS_CONSUMER_SECRET = consumerSecret;

  console.log('\n✓ Discogs credentials saved to .env file.');
  return true;
}

async function main() {
  const service = process.argv[2];

  if (!service || !['spotify', 'discogs', 'all'].includes(service)) {
    console.error('Usage: npm run auth:spotify | auth:discogs | auth:all');
    console.error('\nExamples:');
    console.error('  npm run auth:spotify  - Authenticate with Spotify only');
    console.error('  npm run auth:discogs  - Authenticate with Discogs only');
    console.error('  npm run auth:all      - Authenticate with both services');
    process.exit(1);
  }

  const rl = createReadlineInterface();

  try {
    // Ensure credentials exist for requested services
    if (service === 'spotify' || service === 'all') {
      const hasCredentials = await ensureSpotifyCredentials(rl);
      if (!hasCredentials) {
        console.log('\n❌ Cannot authenticate Spotify without credentials.');
        rl.close();
        process.exit(1);
      }
    }

    if (service === 'discogs' || service === 'all') {
      const hasCredentials = await ensureDiscogsCredentials(rl);
      if (!hasCredentials) {
        console.log('\n❌ Cannot authenticate Discogs without credentials.');
        rl.close();
        process.exit(1);
      }
    }

    rl.close();

    // Import OAuth modules dynamically after credentials are set
    // This ensures they pick up the updated process.env values
    const { authenticateSpotify } = await import('../auth/spotify-oauth.js');
    const { authenticateDiscogs } = await import('../auth/discogs-oauth.js');
    const { startServer, stopServer } = await import('../auth/shared-server.js');

    console.log('\n🔐 Starting OAuth authentication flow...\n');

    const useSharedServer = service === 'all';

    if (useSharedServer) {
      await startServer();
    }

    if (service === 'spotify' || service === 'all') {
      console.log('Authenticating with Spotify...');
      await authenticateSpotify(useSharedServer);
      console.log('');
    }

    if (service === 'discogs' || service === 'all') {
      console.log('Authenticating with Discogs...');
      await authenticateDiscogs(useSharedServer);
      console.log('');
    }

    if (useSharedServer) {
      await stopServer();
    }

    console.log('✓ Authentication complete! Tokens are stored securely in your system keychain.');
    console.log('Restart Claude Code to use the updated credentials.\n');
    process.exit(0);
  } catch (error: any) {
    rl.close();

    // Try to stop server if it was started
    try {
      const { stopServer } = await import('../auth/shared-server.js');
      await stopServer();
    } catch {
      // Server may not have been started
    }

    console.error('\n❌ Authentication failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Check that environment variables are set (SPOTIFY_CLIENT_ID, etc.)');
    console.error('  2. Ensure port 3000 is available');
    console.error('  3. Verify your OAuth app redirect URI is set to http://127.0.0.1:3000/auth/[service]/callback\n');
    process.exit(1);
  }
}

main();
