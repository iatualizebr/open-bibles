/**
 * parse_osis_to_json.js
 * 
 * Parses OSIS/USFX XML files from the sources directory and generates
 * a normalized JSON file with all original Bible verses.
 * 
 * Usage: node scripts/parse_osis_to_json.js
 * 
 * Expected directory structure:
 *   sources/
 *     WLC/           # Westminster Leningrad Codex (Hebrew)
 *       *.xml
 *     SBLGNT/        # SBL Greek New Testament
 *       *.xml
 *   data_normalized/
 *     book_map.json  # Book number mappings
 * 
 * Output:
 *   data_normalized/original_verses.json
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SOURCES_DIR = path.join(__dirname, '..', 'sources');
const DATA_DIR = path.join(__dirname, '..', 'data_normalized');
const BOOK_MAP_PATH = path.join(DATA_DIR, 'book_map.json');
const OUTPUT_PATH = path.join(DATA_DIR, 'original_verses.json');

// Source configurations
const SOURCES_CONFIG = {
  'WLC': {
    code: 'WLC',
    language: 'hebrew',
    name: 'Westminster Leningrad Codex',
    testament: 'OT'
  },
  'SBLGNT': {
    code: 'SBLGNT',
    language: 'greek',
    name: 'SBL Greek New Testament',
    testament: 'NT'
  }
};

// Load book map
function loadBookMap() {
  const content = fs.readFileSync(BOOK_MAP_PATH, 'utf-8');
  const books = JSON.parse(content);
  
  // Create lookup by OSIS code
  const byOsis = {};
  books.forEach(book => {
    byOsis[book.osis] = book;
    byOsis[book.osis.toLowerCase()] = book;
  });
  
  return { books, byOsis };
}

// Parse OSIS reference (e.g., "Gen.1.1" or "Ps.119.1")
function parseOsisRef(ref, bookMap) {
  const parts = ref.split('.');
  if (parts.length < 3) return null;
  
  const osisBook = parts[0];
  const chapter = parseInt(parts[1], 10);
  const verse = parseInt(parts[2], 10);
  
  const book = bookMap.byOsis[osisBook] || bookMap.byOsis[osisBook.toLowerCase()];
  if (!book) {
    console.warn(`  Unknown book OSIS code: ${osisBook}`);
    return null;
  }
  
  return {
    bookNumber: book.bookNumber,
    chapter,
    verse,
    language: book.language
  };
}

// Extract text content from XML element (simple regex-based)
function extractVerseText(xmlContent) {
  // Remove XML tags but keep text content
  let text = xmlContent
    .replace(/<w[^>]*>/g, '')      // Remove word start tags
    .replace(/<\/w>/g, ' ')        // Replace word end tags with space
    .replace(/<[^>]+>/g, '')       // Remove all other tags
    .replace(/\s+/g, ' ')          // Normalize whitespace
    .trim();
  
  return text;
}

// Parse OSIS XML file
function parseOsisFile(filePath, sourceConfig, bookMap) {
  const verses = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Match verse elements: <verse osisID="Gen.1.1">...</verse>
  // or self-closing with sID: <verse osisID="Gen.1.1" sID="..."/>
  const versePattern = /<verse[^>]*osisID="([^"]+)"[^>]*>([\s\S]*?)<\/verse>|<verse[^>]*osisID="([^"]+)"[^>]*sID="([^"]*)"[^\/]*\/>/g;
  
  let match;
  let currentVerseId = null;
  let collectingText = false;
  
  // For files with sID/eID pattern, we need different parsing
  if (content.includes('sID=')) {
    // Parse sID/eID pattern (verse markers with text between)
    const lines = content.split('\n');
    let currentVerse = null;
    let textBuffer = [];
    
    for (const line of lines) {
      // Check for verse start
      const startMatch = line.match(/<verse[^>]*osisID="([^"]+)"[^>]*sID="[^"]*"[^>]*\/?>/);
      if (startMatch) {
        // Save previous verse if exists
        if (currentVerse && textBuffer.length > 0) {
          const text = extractVerseText(textBuffer.join(' '));
          if (text) {
            verses.push({
              ...currentVerse,
              original_text: text,
              source: sourceConfig.code
            });
          }
        }
        
        const ref = parseOsisRef(startMatch[1], bookMap);
        if (ref) {
          currentVerse = ref;
          textBuffer = [];
        }
        continue;
      }
      
      // Check for verse end
      const endMatch = line.match(/<verse[^>]*eID="([^"]+)"[^>]*\/?>/);
      if (endMatch && currentVerse) {
        const text = extractVerseText(textBuffer.join(' '));
        if (text) {
          verses.push({
            ...currentVerse,
            original_text: text,
            source: sourceConfig.code
          });
        }
        currentVerse = null;
        textBuffer = [];
        continue;
      }
      
      // Collect text if inside verse
      if (currentVerse) {
        textBuffer.push(line);
      }
    }
  } else {
    // Standard verse element pattern
    while ((match = versePattern.exec(content)) !== null) {
      const osisId = match[1] || match[3];
      const verseContent = match[2] || '';
      
      const ref = parseOsisRef(osisId, bookMap);
      if (!ref) continue;
      
      const text = extractVerseText(verseContent);
      if (!text) continue;
      
      verses.push({
        bookNumber: ref.bookNumber,
        chapter: ref.chapter,
        verse: ref.verse,
        language: ref.language,
        original_text: text,
        source: sourceConfig.code
      });
    }
  }
  
  return verses;
}

// Parse USFX XML file (alternative format)
function parseUsfxFile(filePath, sourceConfig, bookMap) {
  const verses = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // USFX uses <v n="1">verse text</v> within <c n="1"> within <book id="GEN">
  let currentBook = null;
  let currentChapter = 0;
  
  const bookPattern = /<book[^>]*id="([^"]+)"[^>]*>/g;
  const chapterPattern = /<c[^>]*n="(\d+)"[^>]*>/g;
  const versePattern = /<v[^>]*n="(\d+)"[^>]*>([\s\S]*?)<\/v>/g;
  
  // Split by books
  const bookMatches = content.split(/<book[^>]*id="([^"]+)"[^>]*>/);
  
  for (let i = 1; i < bookMatches.length; i += 2) {
    const bookId = bookMatches[i];
    const bookContent = bookMatches[i + 1] || '';
    
    const book = bookMap.byOsis[bookId] || bookMap.byOsis[bookId.toLowerCase()];
    if (!book) {
      console.warn(`  Unknown USFX book ID: ${bookId}`);
      continue;
    }
    
    // Split by chapters
    const chapterMatches = bookContent.split(/<c[^>]*n="(\d+)"[^>]*>/);
    
    for (let j = 1; j < chapterMatches.length; j += 2) {
      const chapterNum = parseInt(chapterMatches[j], 10);
      const chapterContent = chapterMatches[j + 1] || '';
      
      // Extract verses
      let verseMatch;
      while ((verseMatch = versePattern.exec(chapterContent)) !== null) {
        const verseNum = parseInt(verseMatch[1], 10);
        const verseContent = verseMatch[2];
        
        const text = extractVerseText(verseContent);
        if (!text) continue;
        
        verses.push({
          bookNumber: book.bookNumber,
          chapter: chapterNum,
          verse: verseNum,
          language: book.language,
          original_text: text,
          source: sourceConfig.code
        });
      }
    }
  }
  
  return verses;
}

// Detect file format and parse accordingly
function parseFile(filePath, sourceConfig, bookMap) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  if (content.includes('<usfx') || content.includes('<USFX')) {
    console.log(`  Parsing as USFX: ${path.basename(filePath)}`);
    return parseUsfxFile(filePath, sourceConfig, bookMap);
  } else if (content.includes('<osis') || content.includes('<verse')) {
    console.log(`  Parsing as OSIS: ${path.basename(filePath)}`);
    return parseOsisFile(filePath, sourceConfig, bookMap);
  } else {
    console.warn(`  Unknown format: ${path.basename(filePath)}`);
    return [];
  }
}

// Main function
async function main() {
  console.log('=== OpenBibles OSIS/USFX Parser ===\n');
  
  // Check directories exist
  if (!fs.existsSync(SOURCES_DIR)) {
    console.error(`Error: Sources directory not found: ${SOURCES_DIR}`);
    console.log('Please create the directory and add your OSIS/USFX files.');
    process.exit(1);
  }
  
  if (!fs.existsSync(BOOK_MAP_PATH)) {
    console.error(`Error: Book map not found: ${BOOK_MAP_PATH}`);
    process.exit(1);
  }
  
  // Load book map
  console.log('Loading book map...');
  const bookMap = loadBookMap();
  console.log(`  Loaded ${bookMap.books.length} books\n`);
  
  // Find and parse all source files
  const allVerses = [];
  const stats = {};
  
  for (const [sourceName, sourceConfig] of Object.entries(SOURCES_CONFIG)) {
    const sourceDir = path.join(SOURCES_DIR, sourceName);
    
    if (!fs.existsSync(sourceDir)) {
      console.log(`Source directory not found: ${sourceName} (skipping)`);
      continue;
    }
    
    console.log(`Processing source: ${sourceName}`);
    stats[sourceName] = { files: 0, verses: 0 };
    
    // Find XML files
    const files = fs.readdirSync(sourceDir)
      .filter(f => f.endsWith('.xml') || f.endsWith('.XML'));
    
    if (files.length === 0) {
      console.log(`  No XML files found in ${sourceName}`);
      continue;
    }
    
    for (const file of files) {
      const filePath = path.join(sourceDir, file);
      
      try {
        const verses = parseFile(filePath, sourceConfig, bookMap);
        allVerses.push(...verses);
        stats[sourceName].files++;
        stats[sourceName].verses += verses.length;
        console.log(`    ${file}: ${verses.length} verses`);
      } catch (error) {
        console.error(`  Error parsing ${file}: ${error.message}`);
      }
    }
    
    console.log(`  Total: ${stats[sourceName].verses} verses from ${stats[sourceName].files} files\n`);
  }
  
  // Sort by book, chapter, verse
  allVerses.sort((a, b) => {
    if (a.bookNumber !== b.bookNumber) return a.bookNumber - b.bookNumber;
    if (a.chapter !== b.chapter) return a.chapter - b.chapter;
    return a.verse - b.verse;
  });
  
  // Remove duplicates (same book/chapter/verse/source)
  const seen = new Set();
  const uniqueVerses = allVerses.filter(v => {
    const key = `${v.bookNumber}-${v.chapter}-${v.verse}-${v.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  // Ensure output directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  // Write output
  console.log('Writing output...');
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(uniqueVerses, null, 2), 'utf-8');
  
  // Summary
  console.log('\n=== Summary ===');
  console.log(`Total verses: ${uniqueVerses.length}`);
  console.log(`Output file: ${OUTPUT_PATH}`);
  
  for (const [source, data] of Object.entries(stats)) {
    if (data.verses > 0) {
      console.log(`  ${source}: ${data.verses} verses from ${data.files} files`);
    }
  }
  
  // Validation
  const otVerses = uniqueVerses.filter(v => v.bookNumber <= 39).length;
  const ntVerses = uniqueVerses.filter(v => v.bookNumber >= 40).length;
  console.log(`\nBy testament:`);
  console.log(`  OT (Hebrew): ${otVerses} verses`);
  console.log(`  NT (Greek): ${ntVerses} verses`);
  
  if (uniqueVerses.length > 0 && uniqueVerses.length < 31000) {
    console.log('\n⚠️  Warning: Expected ~31,102 verses. Check if all files were parsed correctly.');
  }
  
  console.log('\n✅ Done!');
}

main().catch(console.error);
