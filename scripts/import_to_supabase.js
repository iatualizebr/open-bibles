/**
 * import_to_supabase.js
 * 
 * Imports the normalized original verses JSON to Supabase via Edge Function.
 * 
 * Usage: 
 *   export SUPABASE_URL="https://your-project.supabase.co"
 *   export SUPABASE_ANON_KEY="your-anon-key"
 *   node scripts/import_to_supabase.js
 * 
 * Input:
 *   data_normalized/original_verses.json
 * 
 * Target:
 *   Edge Function: import-original-verses
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, '..', 'data_normalized');
const INPUT_PATH = path.join(DATA_DIR, 'original_verses.json');

// Import settings
const BATCH_SIZE = 100;        // Verses per request
const DELAY_MS = 500;          // Delay between batches (ms)
const MAX_RETRIES = 3;         // Retries per batch on failure

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Validate environment
function validateEnv() {
  if (!SUPABASE_URL) {
    console.error('Error: SUPABASE_URL environment variable not set');
    console.log('Set it with: export SUPABASE_URL="https://your-project.supabase.co"');
    process.exit(1);
  }
  
  if (!SUPABASE_ANON_KEY) {
    console.error('Error: SUPABASE_ANON_KEY environment variable not set');
    console.log('Set it with: export SUPABASE_ANON_KEY="your-anon-key"');
    process.exit(1);
  }
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Send batch to Edge Function
async function sendBatch(sourceCode, verses, retryCount = 0) {
  const url = `${SUPABASE_URL}/functions/v1/import-original-verses`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        source_code: sourceCode,
        verses: verses
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    return result;
    
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.log(`  Retry ${retryCount + 1}/${MAX_RETRIES}...`);
      await sleep(DELAY_MS * 2);
      return sendBatch(sourceCode, verses, retryCount + 1);
    }
    throw error;
  }
}

// Main function
async function main() {
  console.log('=== OpenBibles Supabase Importer ===\n');
  
  // Validate environment
  validateEnv();
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  
  // Check input file
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`Error: Input file not found: ${INPUT_PATH}`);
    console.log('Run parse_osis_to_json.js first to generate the file.');
    process.exit(1);
  }
  
  // Load verses
  console.log('\nLoading verses...');
  const content = fs.readFileSync(INPUT_PATH, 'utf-8');
  const allVerses = JSON.parse(content);
  console.log(`  Loaded ${allVerses.length} verses\n`);
  
  // Group by source
  const bySource = {};
  for (const verse of allVerses) {
    const source = verse.source;
    if (!bySource[source]) {
      bySource[source] = [];
    }
    bySource[source].push({
      book_number: verse.bookNumber,
      chapter: verse.chapter,
      verse: verse.verse,
      language: verse.language,
      original_text: verse.original_text,
      transliteration: verse.transliteration || null
    });
  }
  
  // Summary
  console.log('Verses by source:');
  for (const [source, verses] of Object.entries(bySource)) {
    console.log(`  ${source}: ${verses.length} verses`);
  }
  console.log();
  
  // Import each source
  const stats = {
    total: 0,
    inserted: 0,
    updated: 0,
    not_found: 0,
    errors: 0
  };
  
  for (const [sourceCode, verses] of Object.entries(bySource)) {
    console.log(`\n=== Importing ${sourceCode} (${verses.length} verses) ===`);
    
    const totalBatches = Math.ceil(verses.length / BATCH_SIZE);
    let sourceStats = { inserted: 0, updated: 0, not_found: 0, errors: 0 };
    
    for (let i = 0; i < verses.length; i += BATCH_SIZE) {
      const batch = verses.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      
      // Progress indicator
      const firstVerse = batch[0];
      const lastVerse = batch[batch.length - 1];
      process.stdout.write(
        `  Batch ${batchNum}/${totalBatches}: ` +
        `${firstVerse.book_number}:${firstVerse.chapter}:${firstVerse.verse} → ` +
        `${lastVerse.book_number}:${lastVerse.chapter}:${lastVerse.verse}... `
      );
      
      try {
        const result = await sendBatch(sourceCode, batch);
        
        sourceStats.inserted += result.inserted || 0;
        sourceStats.updated += result.updated || 0;
        sourceStats.not_found += result.not_found || 0;
        sourceStats.errors += result.errors || 0;
        
        console.log(`✓ (${result.inserted || 0} new, ${result.updated || 0} updated)`);
        
      } catch (error) {
        console.log(`✗ Error: ${error.message}`);
        sourceStats.errors += batch.length;
      }
      
      // Delay between batches
      if (i + BATCH_SIZE < verses.length) {
        await sleep(DELAY_MS);
      }
    }
    
    // Source summary
    console.log(`\n  ${sourceCode} Summary:`);
    console.log(`    Inserted: ${sourceStats.inserted}`);
    console.log(`    Updated: ${sourceStats.updated}`);
    console.log(`    Not found: ${sourceStats.not_found}`);
    console.log(`    Errors: ${sourceStats.errors}`);
    
    // Accumulate stats
    stats.total += verses.length;
    stats.inserted += sourceStats.inserted;
    stats.updated += sourceStats.updated;
    stats.not_found += sourceStats.not_found;
    stats.errors += sourceStats.errors;
  }
  
  // Final summary
  console.log('\n=== Final Summary ===');
  console.log(`Total processed: ${stats.total}`);
  console.log(`Inserted: ${stats.inserted}`);
  console.log(`Updated: ${stats.updated}`);
  console.log(`Not found in bible_verses: ${stats.not_found}`);
  console.log(`Errors: ${stats.errors}`);
  
  if (stats.not_found > 0) {
    console.log('\n⚠️  Some verses were not found in bible_verses table.');
    console.log('   This might indicate missing verses or numbering differences.');
  }
  
  if (stats.errors > 0) {
    console.log('\n⚠️  Some batches failed. Consider re-running the import.');
  }
  
  console.log('\n✅ Done!');
}

main().catch(console.error);
