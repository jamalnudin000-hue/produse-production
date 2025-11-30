const fs = require('fs');
const path = require('path');

const projectRoot = '.';
const outputFile = 'full-project-dump.txt';

// Daftar ekstensi file yang dianggap aman dibaca sebagai teks
const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.d.ts', '.json', '.txt', '.md', '.html', '.htm',
  '.css', '.scss', '.sass', '.less', '.xml', '.yaml', '.yml', '.toml',
  '.ini', '.cfg', '.conf', '.env', '.sh', '.bash', '.zsh', '.dockerfile',
  '.gitignore', '.gitattributes', '.editorconfig', '.lock', '.sql',
  '.ejs', '.pug', '.hbs', '.csv', '.log', '.properties', '.bat', '.cmd'
]);

// Fungsi deteksi kasar apakah file berisi teks
function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;

  // Jika tidak punya ekstensi, coba lihat nama file
  const basename = path.basename(filePath);
  if (['Dockerfile', 'Procfile', 'Makefile', 'README', 'LICENSE', 'CHANGELOG'].includes(basename)) return true;

  // Jika tetap tidak yakin, anggap BUKAN teks (hindari file biner)
  return false;
}

let output = '';

function log(str) {
  output += str + '\n';
}

function dumpDirectory(dirPath, depth = 0) {
  const indent = '  '.repeat(depth);
  const relativeDir = path.relative(projectRoot, dirPath) || '.';
  log(`${indent}[${relativeDir}]`);

  try {
    const items = fs.readdirSync(dirPath);
    items.sort();

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const relativePath = path.relative(projectRoot, fullPath);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (e) {
        log(`${indent}  - [ERROR: Cannot access] ${item}`);
        continue;
      }

      if (stat.isDirectory()) {
        dumpDirectory(fullPath, depth + 1);
      } else {
        log(`${indent}  - ${item}`);
        if (isTextFile(fullPath)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            log(`    <Contents of: ${relativePath}>`);
            output += content + '\n';
            log(`    </End of: ${relativePath}>\n`);
          } catch (err) {
            log(`    [ERROR reading file: ${err.message}]\n`);
          }
        } else {
          log(`    [Binary file — contents skipped]\n`);
        }
      }
    }
  } catch (e) {
    log(`${indent}[ERROR reading directory: ${e.message}]\n`);
  }
}

log(`=== FULL PROJECT DUMP (Text Files Only) ===\n`);
log(`Root: ${projectRoot}\n`);

dumpDirectory(projectRoot);

log(`\n=== END OF DUMP ===`);

fs.writeFileSync(outputFile, output, 'utf8');
console.log(`✅ Dump completed! Output saved to: ${outputFile}`);
console.log(`💡 Only text files were included. Binary files (like .webp, .DS_Store, etc.) were skipped.`);
