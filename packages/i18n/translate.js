/**
 * Automated translation script using json-translator
 * Translates all English JSON files to Norwegian
 */

const translator = require('@parvineyvazov/json-translator');
const fs = require('fs');
const path = require('path');

const EN_DIR = path.join(__dirname, 'messages/en');
const NO_DIR = path.join(__dirname, 'messages/no');

async function translateAllFiles() {
  console.log('🌍 Starting translation of all JSON files from English to Norwegian...\n');
  
  try {
    const files = fs.readdirSync(EN_DIR).filter(file => file.endsWith('.json'));
    
    console.log(`Found ${files.length} files to translate:\n`);
    
    for (const file of files) {
      const enFilePath = path.join(EN_DIR, file);
      const noFilePath = path.join(NO_DIR, file);
      
      console.log(`📄 Translating ${file}...`);
      
      try {
        // Read the English JSON file
        const enContent = JSON.parse(fs.readFileSync(enFilePath, 'utf8'));
        
        // Translate to Norwegian
        const translatedContent = await translator.translateObject(
          enContent,
          translator.languages.English,
          translator.languages.Norwegian
        );
        
        // Write to Norwegian file with pretty formatting
        fs.writeFileSync(
          noFilePath, 
          JSON.stringify(translatedContent, null, 2) + '\n',
          'utf8'
        );
        
        console.log(`✅ ${file} translated successfully!\n`);
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Error translating ${file}:`, error.message);
        console.log(`   Skipping ${file}...\n`);
      }
    }
    
    console.log('\n🎉 Translation completed!');
    console.log(`Translated ${files.length} files from English to Norwegian.`);
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the translation
translateAllFiles();

