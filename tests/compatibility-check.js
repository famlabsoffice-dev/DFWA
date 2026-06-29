import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const checks = {
  passed: [],
  failed: [],
  warnings: [],
};

function checkFile(filePath, description) {
  const fullPath = path.join(projectRoot, filePath);
  if (fs.existsSync(fullPath)) {
    checks.passed.push(`✓ ${description}: ${filePath}`);
    return true;
  } else {
    checks.failed.push(`✗ ${description}: ${filePath} (NOT FOUND)`);
    return false;
  }
}

function checkFileContent(filePath, searchString, description) {
  const fullPath = path.join(projectRoot, filePath);
  if (!fs.existsSync(fullPath)) {
    checks.failed.push(`✗ ${description}: File not found - ${filePath}`);
    return false;
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  if (content.includes(searchString)) {
    checks.passed.push(`✓ ${description}`);
    return true;
  } else {
    checks.failed.push(`✗ ${description}: String not found in ${filePath}`);
    return false;
  }
}

function checkBuildOutput() {
  const distPath = path.join(projectRoot, 'dist');
  if (!fs.existsSync(distPath)) {
    checks.failed.push(`✗ Build Output: dist/ directory not found`);
    return false;
  }
  const files = fs.readdirSync(distPath);
  if (files.length === 0) {
    checks.failed.push(`✗ Build Output: dist/ is empty`);
    return false;
  }
  checks.passed.push(`✓ Build Output: ${files.length} files generated`);
  return true;
}

console.log('🔍 DFWA Compatibility & Functionality Check\n');

console.log('📦 Build Artifacts:');
checkBuildOutput();
checkFile('dist/index.html', 'HTML Entry Point');
checkFile('dist/manifest.webmanifest', 'PWA Manifest');
checkFile('dist/sw.js', 'Service Worker');

console.log('\n🎨 UI/UX Assets:');
checkFile('style.css', 'Main Stylesheet');
checkFileContent('style.css', '@media', 'Media Queries Present');
checkFileContent('style.css', 'max-height: 600px', 'Foldable Breakpoint');
checkFileContent('style.css', 'min-width: 2560px', 'Ultra-Wide Breakpoint');

console.log('\n⚙️ Backend Configuration:');
checkFile('server/server.js', 'Express Server');
checkFileContent('server/server.js', "app.set('trust proxy', 1)", 'Proxy Configuration');
checkFileContent('server/server.js', 'NODE_ENV === \'production\'', 'Production Security Check');

console.log('\n🔧 Build Configuration:');
checkFile('vite.config.js', 'Vite Configuration');
checkFileContent('vite.config.js', 'VitePWA', 'PWA Plugin Enabled');
checkFileContent('vite.config.js', 'workbox', 'Workbox Configuration');
checkFileContent('vite.config.js', 'runtimeCaching', 'Runtime Caching Configured');

console.log('\n🔐 PWA Integration:');
checkFileContent('sw.js', 'self.addEventListener', 'Service Worker Events');
checkFileContent('sw.js', 'fetch', 'Fetch Event Handler');

console.log('\n📝 Documentation:');
checkFile('manus.read', 'Project Status Log');
checkFile('package.json', 'Package Configuration');

console.log('\n🧪 Test Suite:');
checkFile('tests/integration.test.js', 'Integration Tests');

console.log('\n📊 Results Summary:');
console.log(`✓ Passed: ${checks.passed.length}`);
console.log(`✗ Failed: ${checks.failed.length}`);
console.log(`⚠ Warnings: ${checks.warnings.length}`);

if (checks.passed.length > 0) {
  console.log('\n✅ Passed Checks:');
  checks.passed.forEach((check) => console.log(`  ${check}`));
}

if (checks.failed.length > 0) {
  console.log('\n❌ Failed Checks:');
  checks.failed.forEach((check) => console.log(`  ${check}`));
}

if (checks.warnings.length > 0) {
  console.log('\n⚠️ Warnings:');
  checks.warnings.forEach((warning) => console.log(`  ${warning}`));
}

const totalChecks = checks.passed.length + checks.failed.length + checks.warnings.length;
const passRate = totalChecks > 0 ? ((checks.passed.length / totalChecks) * 100).toFixed(2) : '0';
console.log(`\n📈 Overall Pass Rate: ${passRate}% (${checks.passed.length}/${checks.passed.length + checks.failed.length})`);

process.exit(checks.failed.length > 0 ? 1 : 0);

