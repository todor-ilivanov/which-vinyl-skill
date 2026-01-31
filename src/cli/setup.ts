import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

interface Credentials {
  spotifyClientId?: string;
  spotifyClientSecret?: string;
  discogsConsumerKey?: string;
  discogsConsumerSecret?: string;
}

interface ServiceSelection {
  spotify: boolean;
  discogs: boolean;
}

function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

async function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer.trim());
    });
  });
}

function printBanner(): void {
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Which Vinyl MCP Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

function printOAuthInstructions(services: ServiceSelection): void {
  console.log(`Before we start, you'll need OAuth credentials from:\n`);

  if (services.spotify) {
    console.log(`  Spotify: https://developer.spotify.com/dashboard
    - Create app with redirect URI: http://127.0.0.1:3000/auth/spotify/callback
`);
  }

  if (services.discogs) {
    console.log(`  Discogs: https://www.discogs.com/settings/developers
    - Create app with callback URL: http://127.0.0.1:3000/auth/discogs/callback
`);
  }

  console.log(`See QUICK_START.md for detailed instructions.
`);
}

async function selectServices(rl: readline.Interface): Promise<ServiceSelection> {
  console.log('Which services would you like to configure?\n');
  console.log('  1. Both Spotify and Discogs (recommended)');
  console.log('  2. Spotify only');
  console.log('  3. Discogs only\n');

  const choice = await prompt(rl, '  Select [1/2/3]: ');

  switch (choice) {
    case '2': return { spotify: true, discogs: false };
    case '3': return { spotify: false, discogs: true };
    default: return { spotify: true, discogs: true };
  }
}

function validateCredential(value: string, name: string): boolean {
  if (!value || value.length < 10) {
    console.log(`\n  Invalid ${name}. Please check your credentials and try again.\n`);
    return false;
  }
  return true;
}

async function collectCredentials(rl: readline.Interface, services: ServiceSelection): Promise<Credentials | null> {
  console.log('Enter your OAuth credentials:\n');

  const credentials: Credentials = {};

  if (services.spotify) {
    const spotifyClientId = await prompt(rl, '  Spotify Client ID: ');
    if (!validateCredential(spotifyClientId, 'Spotify Client ID')) return null;

    const spotifyClientSecret = await prompt(rl, '  Spotify Client Secret: ');
    if (!validateCredential(spotifyClientSecret, 'Spotify Client Secret')) return null;

    credentials.spotifyClientId = spotifyClientId;
    credentials.spotifyClientSecret = spotifyClientSecret;
  }

  if (services.discogs) {
    const discogsConsumerKey = await prompt(rl, '  Discogs Consumer Key: ');
    if (!validateCredential(discogsConsumerKey, 'Discogs Consumer Key')) return null;

    const discogsConsumerSecret = await prompt(rl, '  Discogs Consumer Secret: ');
    if (!validateCredential(discogsConsumerSecret, 'Discogs Consumer Secret')) return null;

    credentials.discogsConsumerKey = discogsConsumerKey;
    credentials.discogsConsumerSecret = discogsConsumerSecret;
  }

  return credentials;
}

function writeEnvFile(credentials: Credentials): void {
  const lines: string[] = [];

  if (credentials.spotifyClientId && credentials.spotifyClientSecret) {
    lines.push('# Spotify credentials');
    lines.push(`SPOTIFY_CLIENT_ID=${credentials.spotifyClientId}`);
    lines.push(`SPOTIFY_CLIENT_SECRET=${credentials.spotifyClientSecret}`);
    lines.push('');
  }

  if (credentials.discogsConsumerKey && credentials.discogsConsumerSecret) {
    lines.push('# Discogs credentials');
    lines.push(`DISCOGS_CONSUMER_KEY=${credentials.discogsConsumerKey}`);
    lines.push(`DISCOGS_CONSUMER_SECRET=${credentials.discogsConsumerSecret}`);
    lines.push('');
  }

  const envPath = path.join(PROJECT_ROOT, '.env');
  fs.writeFileSync(envPath, lines.join('\n'));
}

async function runOAuthFlows(credentials: Credentials): Promise<void> {
  // Dynamically import after .env is written so dotenv picks up the values
  const dotenv = await import('dotenv');
  dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

  if (credentials.spotifyClientId && credentials.spotifyClientSecret) {
    const { authenticateSpotify } = await import('../auth/spotify-oauth.js');
    console.log('');
    await authenticateSpotify();
  }

  if (credentials.discogsConsumerKey && credentials.discogsConsumerSecret) {
    const { authenticateDiscogs } = await import('../auth/discogs-oauth.js');
    console.log('');
    await authenticateDiscogs();
  }
}

async function buildProject(): Promise<void> {
  console.log('\nBuilding MCP server...');
  await execAsync('npm run build', { cwd: PROJECT_ROOT });
  console.log('Build complete');
}

async function verifyTokens(credentials: Credentials): Promise<{ spotify: boolean | null; discogs: boolean | null }> {
  const { loadSpotifyTokens, loadDiscogsTokens } = await import('../auth/token-storage.js');

  const hasSpotify = credentials.spotifyClientId && credentials.spotifyClientSecret;
  const hasDiscogs = credentials.discogsConsumerKey && credentials.discogsConsumerSecret;

  const spotifyTokens = hasSpotify ? await loadSpotifyTokens() : null;
  const discogsTokens = hasDiscogs ? await loadDiscogsTokens() : null;

  return {
    spotify: hasSpotify ? spotifyTokens !== null : null,
    discogs: hasDiscogs ? discogsTokens !== null : null
  };
}

async function promptForSettingsUpdate(rl: readline.Interface): Promise<boolean> {
  console.log(`\nWould you like to automatically configure Claude Code?`);
  console.log(`  This will register the MCP server globally via 'claude mcp add'\n`);

  const answer = await prompt(rl, '  Register MCP server? [Y/n]: ');
  return answer.toLowerCase() !== 'n';
}

async function registerMcpServer(credentials: Credentials): Promise<void> {
  const distPath = path.join(PROJECT_ROOT, 'dist', 'index.js');

  // Remove existing server if present (ignore errors)
  try {
    await execAsync('claude mcp remove -s user which-vinyl');
  } catch {
    // Server might not exist, that's fine
  }

  // Build command with only configured service credentials
  const commandParts = ['claude mcp add -s user which-vinyl'];

  if (credentials.spotifyClientId && credentials.spotifyClientSecret) {
    commandParts.push(`-e SPOTIFY_CLIENT_ID=${credentials.spotifyClientId}`);
    commandParts.push(`-e SPOTIFY_CLIENT_SECRET=${credentials.spotifyClientSecret}`);
  }

  if (credentials.discogsConsumerKey && credentials.discogsConsumerSecret) {
    commandParts.push(`-e DISCOGS_CONSUMER_KEY=${credentials.discogsConsumerKey}`);
    commandParts.push(`-e DISCOGS_CONSUMER_SECRET=${credentials.discogsConsumerSecret}`);
  }

  commandParts.push('--', 'node', distPath);

  await execAsync(commandParts.join(' '));
}

function getConfiguredServicesText(credentials: Credentials): string {
  const services: string[] = [];
  if (credentials.spotifyClientId) services.push('Spotify');
  if (credentials.discogsConsumerKey) services.push('Discogs');
  return services.join(' and ');
}

function printSuccessAutomatic(credentials: Credentials): void {
  const servicesText = getConfiguredServicesText(credentials);
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Setup complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Registered 'which-vinyl' MCP server with Claude Code.
Configured services: ${servicesText}

Restart Claude Code and try: "What vinyl should I play?"
`);
}

function printSuccessManual(credentials: Credentials): void {
  const distPath = path.join(PROJECT_ROOT, 'dist', 'index.js');
  const servicesText = getConfiguredServicesText(credentials);

  const envLines: string[] = [];
  if (credentials.spotifyClientId && credentials.spotifyClientSecret) {
    envLines.push(`  -e SPOTIFY_CLIENT_ID=${credentials.spotifyClientId} \\`);
    envLines.push(`  -e SPOTIFY_CLIENT_SECRET=${credentials.spotifyClientSecret} \\`);
  }
  if (credentials.discogsConsumerKey && credentials.discogsConsumerSecret) {
    envLines.push(`  -e DISCOGS_CONSUMER_KEY=${credentials.discogsConsumerKey} \\`);
    envLines.push(`  -e DISCOGS_CONSUMER_SECRET=${credentials.discogsConsumerSecret} \\`);
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Setup complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Configured services: ${servicesText}

Run this command to register the MCP server:

claude mcp add -s user which-vinyl \\
${envLines.join('\n')}
  -- node ${distPath}

Then restart Claude Code and try: "What vinyl should I play?"
`);
}

function printVerificationStatus(status: { spotify: boolean | null; discogs: boolean | null }): void {
  console.log('\nVerifying authentication...');

  if (status.spotify !== null) {
    console.log(`  Spotify: ${status.spotify ? 'authenticated' : 'not authenticated'}`);
  }
  if (status.discogs !== null) {
    console.log(`  Discogs: ${status.discogs ? 'authenticated' : 'not authenticated'}`);
  }

  const failedServices: string[] = [];
  if (status.spotify === false) failedServices.push('Spotify');
  if (status.discogs === false) failedServices.push('Discogs');

  if (failedServices.length > 0) {
    console.log(`\n  ${failedServices.join(' and ')} not authenticated. Run npm run auth:all to retry.`);
  }
}

async function main(): Promise<void> {
  printBanner();

  const rl = createReadlineInterface();

  try {
    const services = await selectServices(rl);
    console.log('');

    printOAuthInstructions(services);

    const credentials = await collectCredentials(rl, services);

    if (!credentials) {
      console.log('Setup cancelled.');
      process.exit(1);
    }

    console.log('\nSaving credentials...');
    writeEnvFile(credentials);
    console.log('Credentials saved to .env');

    await runOAuthFlows(credentials);

    await buildProject();

    const status = await verifyTokens(credentials);
    printVerificationStatus(status);

    const shouldRegister = await promptForSettingsUpdate(rl);

    if (shouldRegister) {
      try {
        console.log('\nRegistering MCP server with Claude Code...');
        await registerMcpServer(credentials);
        printSuccessAutomatic(credentials);
      } catch (error: any) {
        console.log(`\nCould not register MCP server: ${error.message}`);
        console.log('You can register it manually:\n');
        printSuccessManual(credentials);
      }
    } else {
      printSuccessManual(credentials);
    }

    process.exit(0);
  } catch (error: any) {
    console.error(`\nSetup failed: ${error.message}`);
    console.error('\nTroubleshooting:');
    console.error('  1. Check that your OAuth credentials are correct');
    console.error('  2. Ensure port 3000 is available');
    console.error('  3. Verify callback URLs are configured in your OAuth apps');
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
