const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const diagrams = [
  '01-class-diagram',
  '02-use-case-diagram',
  '03-sequence-registration',
  '04-sequence-contribution',
  '05-sequence-payout',
  '06-sequence-fine',
  '07-sequence-report',
  '08-object-diagram'
];

const inputDir = 'docs/ulm';
const outputDir = 'docs/ulm/images';

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

diagrams.forEach(name => {
  const inputFile = path.join(inputDir, `${name}.md`);
  const outputFile = path.join(outputDir, `${name}.png`);
  
  console.log(`Generating ${name}...`);
  
  try {
    execSync(`npx mmdc -i "${inputFile}" -o "${outputFile}" -b white`, {
      stdio: 'inherit'
    });
    console.log(`✅ ${name} done`);
  } catch (error) {
    console.error(`❌ ${name} failed:`, error.message);
  }
});

console.log('All done!');