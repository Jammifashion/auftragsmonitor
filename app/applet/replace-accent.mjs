import fs from 'fs';
import path from 'path';

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('emerald-')) {
        content = content.replace(/emerald-/g, 'accent-');
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory('./src/pages');
processDirectory('./src/components');
// we dont process App.tsx here just in case, but let's process it too
const appPath = './src/App.tsx';
if (fs.existsSync(appPath)) {
  let content = fs.readFileSync(appPath, 'utf8');
  if (content.includes('emerald-')) {
    content = content.replace(/emerald-/g, 'accent-');
    fs.writeFileSync(appPath, content, 'utf8');
    console.log(`Updated ${appPath}`);
  }
}
