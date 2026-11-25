// Reproducible recovery of lock metadata when this development host cannot reach npm.
// This imports exact, already-installed integrity records; it does not invent hashes.
const fs = require('node:fs');
const path = require('node:path');
const runtimeModules = process.argv[2];
if (!runtimeModules) throw new Error('Pass the directory containing the audited runtime packages.');
const source = fs.readFileSync(path.join(runtimeModules, '.pnpm', 'lock.yaml'), 'utf8').replaceAll('\r\n', '\n');
const project = JSON.parse(fs.readFileSync('package.json', 'utf8'));
function blocks(section) {
  const matches = [...section.matchAll(/^  (\S.+?):(?:[ \t]*\{\})?[ \t]*$/gm)];
  return new Map(matches.map((match, index) => {
    const name = match[1].replace(/^['"]|['"]$/g, '');
    return [name, section.slice(match.index, matches[index + 1]?.index ?? section.length).trimEnd()];
  }));
}
const packages = blocks(source.split('\npackages:\n')[1].split('\nsnapshots:\n')[0]);
const snapshots = blocks(source.split('\nsnapshots:\n')[1]);
const chosen = new Set(), importer = [];
const queue = [];
for (const [name, version] of Object.entries(project.dependencies)) {
  const base = `${name}@${version}`;
  const key = [...snapshots.keys()].find(k => k === base || k.startsWith(base + '('));
  if (!key) throw new Error(`No installed lock snapshot for ${base}`);
  queue.push(key);
  importer.push(`      '${name}':\n        specifier: ${version}\n        version: ${key.slice(name.length + 1)}`);
}
while (queue.length) {
  const key = queue.shift();
  if (chosen.has(key)) continue;
  const snapshot = snapshots.get(key);
  if (!snapshot) throw new Error(`Missing transitive snapshot ${key}`);
  chosen.add(key);
  for (const match of snapshot.matchAll(/^      (['"]?)([^\n]+?)\1: (.+)$/gm)) {
    const name = match[2], version = match[3].replace(/^['"]|['"]$/g, '');
    if (['true','false'].includes(version)) continue;
    queue.push(`${name}@${version}`);
  }
}
const packageKeys = [...new Set([...chosen].map(key => key.split('(')[0]))].sort();
const out = ["lockfileVersion: '9.0'", '', 'settings:', '  autoInstallPeers: true', '  excludeLinksFromLockfile: false', '', 'importers:', '  .:', '    dependencies:', ...importer, '', 'packages:', ...packageKeys.map(key => { if (!packages.has(key)) throw new Error(`Missing package integrity ${key}`); return '\n' + packages.get(key); }), '', 'snapshots:', ...[...chosen].sort().map(key => '\n' + snapshots.get(key)), ''].join('\n');
fs.writeFileSync('pnpm-lock.yaml', out);
console.log(`Wrote authentic lock: ${packageKeys.length} package integrity records, ${chosen.size} snapshots.`);
