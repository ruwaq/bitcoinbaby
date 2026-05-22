const fs = require('fs');
const path = require('path');

const e2eDir = __dirname;
const files = fs.readdirSync(e2eDir);

files.forEach(file => {
  if (file.endsWith('.spec.ts')) {
    const filePath = path.join(e2eDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace standard playwright imports with our custom fixtures
    content = content.replace(
      /import\s+{(.*?)}\s+from\s+["']@playwright\/test["']/g,
      (match, imports) => {
        // If it imports `test` or `expect`, redirect it to `./fixtures`
        if (imports.includes('test') || imports.includes('expect')) {
          // Normalize spaces inside brackets
          const cleanImports = imports.trim();
          return `import { ${cleanImports} } from "./fixtures"`;
        }
        return match;
      }
    );
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated imports in ${file}`);
  }
});
