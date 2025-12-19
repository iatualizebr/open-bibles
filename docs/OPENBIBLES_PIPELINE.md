# Pipeline de Integração OpenBibles → Supabase

Este documento descreve como processar textos bíblicos originais do repositório OpenBibles e importá-los para o Supabase.

## Visão Geral do Fluxo

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FLUXO DE INTEGRAÇÃO                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  GitHub OpenBibles          Scripts Locais          Supabase         │
│  ┌─────────────┐           ┌─────────────┐        ┌─────────────┐   │
│  │  /sources   │  parse    │   JSON      │  POST   │  Edge Func  │   │
│  │  WLC, SBLGNT│ ────────► │  normalizado│ ──────► │  import-    │   │
│  │  OSIS, USFX │           │             │         │  original   │   │
│  └─────────────┘           └─────────────┘         └──────┬──────┘   │
│                                                           │          │
│                                                    UPSERT ▼          │
│                                                  ┌─────────────────┐ │
│                                                  │ bible_original  │ │
│                                                  │ _verses         │ │
│                                                  └─────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Estrutura de Pastas (OpenBibles)

```
openbibles/
├── sources/                    # Arquivos originais (SOMENTE LEITURA)
│   ├── hebrew/
│   │   └── wlc/               # Westminster Leningrad Codex
│   │       └── *.osis.xml
│   └── greek/
│       └── sblgnt/            # SBL Greek NT
│           └── *.osis.xml
├── data_normalized/            # JSONs gerados pelos scripts
│   ├── book_map.json          # Mapa dos 66 livros
│   └── original_verses.json   # Versículos normalizados
├── scripts/                    # Scripts Node.js
│   ├── parse_osis_to_json.js
│   └── import_to_supabase.js
└── docs/
    └── PIPELINE.md
```

## Pré-requisitos

- Node.js 18+
- Acesso ao Supabase (URL e anon key)

## Arquivos a Criar no Repositório OpenBibles

### 1. `data_normalized/book_map.json`

```json
[
  { "bookNumber": 1, "name_pt": "Gênesis", "name_en": "Genesis", "osis": "Gen", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 2, "name_pt": "Êxodo", "name_en": "Exodus", "osis": "Exod", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 3, "name_pt": "Levítico", "name_en": "Leviticus", "osis": "Lev", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 4, "name_pt": "Números", "name_en": "Numbers", "osis": "Num", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 5, "name_pt": "Deuteronômio", "name_en": "Deuteronomy", "osis": "Deut", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 6, "name_pt": "Josué", "name_en": "Joshua", "osis": "Josh", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 7, "name_pt": "Juízes", "name_en": "Judges", "osis": "Judg", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 8, "name_pt": "Rute", "name_en": "Ruth", "osis": "Ruth", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 9, "name_pt": "1 Samuel", "name_en": "1 Samuel", "osis": "1Sam", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 10, "name_pt": "2 Samuel", "name_en": "2 Samuel", "osis": "2Sam", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 11, "name_pt": "1 Reis", "name_en": "1 Kings", "osis": "1Kgs", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 12, "name_pt": "2 Reis", "name_en": "2 Kings", "osis": "2Kgs", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 13, "name_pt": "1 Crônicas", "name_en": "1 Chronicles", "osis": "1Chr", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 14, "name_pt": "2 Crônicas", "name_en": "2 Chronicles", "osis": "2Chr", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 15, "name_pt": "Esdras", "name_en": "Ezra", "osis": "Ezra", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 16, "name_pt": "Neemias", "name_en": "Nehemiah", "osis": "Neh", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 17, "name_pt": "Ester", "name_en": "Esther", "osis": "Esth", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 18, "name_pt": "Jó", "name_en": "Job", "osis": "Job", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 19, "name_pt": "Salmos", "name_en": "Psalms", "osis": "Ps", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 20, "name_pt": "Provérbios", "name_en": "Proverbs", "osis": "Prov", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 21, "name_pt": "Eclesiastes", "name_en": "Ecclesiastes", "osis": "Eccl", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 22, "name_pt": "Cantares", "name_en": "Song of Solomon", "osis": "Song", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 23, "name_pt": "Isaías", "name_en": "Isaiah", "osis": "Isa", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 24, "name_pt": "Jeremias", "name_en": "Jeremiah", "osis": "Jer", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 25, "name_pt": "Lamentações", "name_en": "Lamentations", "osis": "Lam", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 26, "name_pt": "Ezequiel", "name_en": "Ezekiel", "osis": "Ezek", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 27, "name_pt": "Daniel", "name_en": "Daniel", "osis": "Dan", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 28, "name_pt": "Oséias", "name_en": "Hosea", "osis": "Hos", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 29, "name_pt": "Joel", "name_en": "Joel", "osis": "Joel", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 30, "name_pt": "Amós", "name_en": "Amos", "osis": "Amos", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 31, "name_pt": "Obadias", "name_en": "Obadiah", "osis": "Obad", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 32, "name_pt": "Jonas", "name_en": "Jonah", "osis": "Jonah", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 33, "name_pt": "Miquéias", "name_en": "Micah", "osis": "Mic", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 34, "name_pt": "Naum", "name_en": "Nahum", "osis": "Nah", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 35, "name_pt": "Habacuque", "name_en": "Habakkuk", "osis": "Hab", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 36, "name_pt": "Sofonias", "name_en": "Zephaniah", "osis": "Zeph", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 37, "name_pt": "Ageu", "name_en": "Haggai", "osis": "Hag", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 38, "name_pt": "Zacarias", "name_en": "Zechariah", "osis": "Zech", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 39, "name_pt": "Malaquias", "name_en": "Malachi", "osis": "Mal", "testament": "OT", "language": "hebrew" },
  { "bookNumber": 40, "name_pt": "Mateus", "name_en": "Matthew", "osis": "Matt", "testament": "NT", "language": "greek" },
  { "bookNumber": 41, "name_pt": "Marcos", "name_en": "Mark", "osis": "Mark", "testament": "NT", "language": "greek" },
  { "bookNumber": 42, "name_pt": "Lucas", "name_en": "Luke", "osis": "Luke", "testament": "NT", "language": "greek" },
  { "bookNumber": 43, "name_pt": "João", "name_en": "John", "osis": "John", "testament": "NT", "language": "greek" },
  { "bookNumber": 44, "name_pt": "Atos", "name_en": "Acts", "osis": "Acts", "testament": "NT", "language": "greek" },
  { "bookNumber": 45, "name_pt": "Romanos", "name_en": "Romans", "osis": "Rom", "testament": "NT", "language": "greek" },
  { "bookNumber": 46, "name_pt": "1 Coríntios", "name_en": "1 Corinthians", "osis": "1Cor", "testament": "NT", "language": "greek" },
  { "bookNumber": 47, "name_pt": "2 Coríntios", "name_en": "2 Corinthians", "osis": "2Cor", "testament": "NT", "language": "greek" },
  { "bookNumber": 48, "name_pt": "Gálatas", "name_en": "Galatians", "osis": "Gal", "testament": "NT", "language": "greek" },
  { "bookNumber": 49, "name_pt": "Efésios", "name_en": "Ephesians", "osis": "Eph", "testament": "NT", "language": "greek" },
  { "bookNumber": 50, "name_pt": "Filipenses", "name_en": "Philippians", "osis": "Phil", "testament": "NT", "language": "greek" },
  { "bookNumber": 51, "name_pt": "Colossenses", "name_en": "Colossians", "osis": "Col", "testament": "NT", "language": "greek" },
  { "bookNumber": 52, "name_pt": "1 Tessalonicenses", "name_en": "1 Thessalonians", "osis": "1Thess", "testament": "NT", "language": "greek" },
  { "bookNumber": 53, "name_pt": "2 Tessalonicenses", "name_en": "2 Thessalonians", "osis": "2Thess", "testament": "NT", "language": "greek" },
  { "bookNumber": 54, "name_pt": "1 Timóteo", "name_en": "1 Timothy", "osis": "1Tim", "testament": "NT", "language": "greek" },
  { "bookNumber": 55, "name_pt": "2 Timóteo", "name_en": "2 Timothy", "osis": "2Tim", "testament": "NT", "language": "greek" },
  { "bookNumber": 56, "name_pt": "Tito", "name_en": "Titus", "osis": "Titus", "testament": "NT", "language": "greek" },
  { "bookNumber": 57, "name_pt": "Filemom", "name_en": "Philemon", "osis": "Phlm", "testament": "NT", "language": "greek" },
  { "bookNumber": 58, "name_pt": "Hebreus", "name_en": "Hebrews", "osis": "Heb", "testament": "NT", "language": "greek" },
  { "bookNumber": 59, "name_pt": "Tiago", "name_en": "James", "osis": "Jas", "testament": "NT", "language": "greek" },
  { "bookNumber": 60, "name_pt": "1 Pedro", "name_en": "1 Peter", "osis": "1Pet", "testament": "NT", "language": "greek" },
  { "bookNumber": 61, "name_pt": "2 Pedro", "name_en": "2 Peter", "osis": "2Pet", "testament": "NT", "language": "greek" },
  { "bookNumber": 62, "name_pt": "1 João", "name_en": "1 John", "osis": "1John", "testament": "NT", "language": "greek" },
  { "bookNumber": 63, "name_pt": "2 João", "name_en": "2 John", "osis": "2John", "testament": "NT", "language": "greek" },
  { "bookNumber": 64, "name_pt": "3 João", "name_en": "3 John", "osis": "3John", "testament": "NT", "language": "greek" },
  { "bookNumber": 65, "name_pt": "Judas", "name_en": "Jude", "osis": "Jude", "testament": "NT", "language": "greek" },
  { "bookNumber": 66, "name_pt": "Apocalipse", "name_en": "Revelation", "osis": "Rev", "testament": "NT", "language": "greek" }
]
```

### 2. `scripts/parse_osis_to_json.js`

```javascript
/**
 * Script para processar arquivos OSIS/XML do OpenBibles
 * e gerar JSON normalizado para importação no Supabase.
 * 
 * USO: node scripts/parse_osis_to_json.js
 * 
 * IMPORTANTE: Este script NÃO interpreta textos bíblicos.
 * Apenas extrai e normaliza dados estruturais.
 */

const fs = require('fs');
const path = require('path');

// Carregar mapa de livros
const BOOK_MAP_PATH = path.join(__dirname, '..', 'data_normalized', 'book_map.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'data_normalized', 'original_verses.json');
const SOURCES_PATH = path.join(__dirname, '..', 'sources');

// Configuração de fontes a processar
const SOURCES_CONFIG = [
  {
    name: 'wlc',
    language: 'hebrew',
    path: 'hebrew/wlc',
    filePattern: /\.xml$/i,
  },
  {
    name: 'sblgnt',
    language: 'greek',
    path: 'greek/sblgnt',
    filePattern: /\.xml$/i,
  },
];

/**
 * Carrega o mapa de livros do JSON
 */
function loadBookMap() {
  const content = fs.readFileSync(BOOK_MAP_PATH, 'utf-8');
  const books = JSON.parse(content);
  
  // Criar índice por código OSIS
  const osisIndex = {};
  for (const book of books) {
    osisIndex[book.osis.toLowerCase()] = book;
  }
  
  return { books, osisIndex };
}

/**
 * Extrai texto de um elemento XML, ignorando tags internas
 */
function extractText(xmlContent) {
  // Remove todas as tags XML, mantém apenas o texto
  return xmlContent
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse de arquivo OSIS XML
 * Formato típico: <verse osisID="Gen.1.1">בְּרֵאשִׁ֖ית...</verse>
 */
function parseOsisFile(filePath, sourceConfig, bookMap) {
  const verses = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Regex para capturar versículos OSIS
  // Exemplo: <verse osisID="Gen.1.1">...</verse>
  const verseRegex = /<verse\s+[^>]*osisID="([^"]+)"[^>]*>([\s\S]*?)<\/verse>/gi;
  
  let match;
  while ((match = verseRegex.exec(content)) !== null) {
    const osisId = match[1]; // Ex: "Gen.1.1"
    const verseContent = match[2];
    
    // Parse do osisID
    const parts = osisId.split('.');
    if (parts.length < 3) {
      console.warn(`[AVISO] osisID inválido: ${osisId}`);
      continue;
    }
    
    const bookCode = parts[0].toLowerCase();
    const chapter = parseInt(parts[1], 10);
    const verse = parseInt(parts[2], 10);
    
    // Buscar livro no mapa
    const book = bookMap.osisIndex[bookCode];
    if (!book) {
      console.warn(`[AVISO] Livro não encontrado: ${bookCode} (${osisId})`);
      continue;
    }
    
    // Extrair texto limpo
    const originalText = extractText(verseContent);
    
    if (!originalText) {
      console.warn(`[AVISO] Texto vazio para: ${osisId}`);
      continue;
    }
    
    verses.push({
      bookNumber: book.bookNumber,
      chapter,
      verse,
      language: sourceConfig.language,
      original_text: originalText,
      source: sourceConfig.name,
    });
  }
  
  return verses;
}

/**
 * Parse de arquivo USFX (alternativo ao OSIS)
 */
function parseUsfxFile(filePath, sourceConfig, bookMap) {
  const verses = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // USFX usa formato diferente
  // <v n="1">texto do versículo</v> dentro de <c n="1">
  
  // Primeiro, encontrar o livro
  const bookMatch = content.match(/<book\s+[^>]*id="([^"]+)"/i);
  if (!bookMatch) {
    console.warn(`[AVISO] Livro não identificado em: ${filePath}`);
    return verses;
  }
  
  const bookCode = bookMatch[1].toLowerCase();
  const book = bookMap.osisIndex[bookCode];
  
  if (!book) {
    console.warn(`[AVISO] Livro não mapeado: ${bookCode}`);
    return verses;
  }
  
  // Processar capítulos e versículos
  const chapterRegex = /<c\s+[^>]*n="(\d+)"[^>]*>([\s\S]*?)(?=<c\s|<\/book>)/gi;
  
  let chapterMatch;
  while ((chapterMatch = chapterRegex.exec(content)) !== null) {
    const chapter = parseInt(chapterMatch[1], 10);
    const chapterContent = chapterMatch[2];
    
    const verseRegex = /<v\s+[^>]*n="(\d+)"[^>]*>([\s\S]*?)(?=<v\s|<\/c>|$)/gi;
    
    let verseMatch;
    while ((verseMatch = verseRegex.exec(chapterContent)) !== null) {
      const verse = parseInt(verseMatch[1], 10);
      const verseContent = verseMatch[2];
      const originalText = extractText(verseContent);
      
      if (originalText) {
        verses.push({
          bookNumber: book.bookNumber,
          chapter,
          verse,
          language: sourceConfig.language,
          original_text: originalText,
          source: sourceConfig.name,
        });
      }
    }
  }
  
  return verses;
}

/**
 * Processa todos os arquivos de uma fonte
 */
function processSource(sourceConfig, bookMap) {
  const sourcePath = path.join(SOURCES_PATH, sourceConfig.path);
  
  if (!fs.existsSync(sourcePath)) {
    console.warn(`[AVISO] Diretório não encontrado: ${sourcePath}`);
    return [];
  }
  
  const files = fs.readdirSync(sourcePath)
    .filter(f => sourceConfig.filePattern.test(f));
  
  console.log(`[INFO] Processando ${sourceConfig.name}: ${files.length} arquivos`);
  
  const allVerses = [];
  
  for (const file of files) {
    const filePath = path.join(sourcePath, file);
    console.log(`  - ${file}`);
    
    try {
      // Detectar formato pelo conteúdo
      const content = fs.readFileSync(filePath, 'utf-8');
      
      let verses;
      if (content.includes('osisID=')) {
        verses = parseOsisFile(filePath, sourceConfig, bookMap);
      } else if (content.includes('<usfx') || content.includes('<book')) {
        verses = parseUsfxFile(filePath, sourceConfig, bookMap);
      } else {
        console.warn(`    [AVISO] Formato não reconhecido: ${file}`);
        continue;
      }
      
      allVerses.push(...verses);
      console.log(`    ✓ ${verses.length} versículos`);
    } catch (err) {
      console.error(`    [ERRO] ${file}: ${err.message}`);
    }
  }
  
  return allVerses;
}

/**
 * Função principal
 */
function main() {
  console.log('='.repeat(60));
  console.log('PARSE OPENBIBLES → JSON NORMALIZADO');
  console.log('='.repeat(60));
  console.log('');
  
  // Carregar mapa de livros
  console.log('[INFO] Carregando book_map.json...');
  const bookMap = loadBookMap();
  console.log(`[INFO] ${bookMap.books.length} livros mapeados`);
  console.log('');
  
  // Processar cada fonte
  const allVerses = [];
  
  for (const sourceConfig of SOURCES_CONFIG) {
    const verses = processSource(sourceConfig, bookMap);
    allVerses.push(...verses);
    console.log(`[INFO] ${sourceConfig.name}: ${verses.length} versículos processados`);
    console.log('');
  }
  
  // Ordenar por livro, capítulo, versículo
  allVerses.sort((a, b) => {
    if (a.bookNumber !== b.bookNumber) return a.bookNumber - b.bookNumber;
    if (a.chapter !== b.chapter) return a.chapter - b.chapter;
    return a.verse - b.verse;
  });
  
  // Salvar JSON
  console.log('[INFO] Salvando original_verses.json...');
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allVerses, null, 2), 'utf-8');
  
  console.log('='.repeat(60));
  console.log(`CONCLUÍDO: ${allVerses.length} versículos normalizados`);
  console.log(`Arquivo: ${OUTPUT_PATH}`);
  console.log('='.repeat(60));
}

// Executar
main();
```

### 3. `scripts/import_to_supabase.js`

```javascript
/**
 * Script para importar versículos normalizados para o Supabase.
 * 
 * USO: 
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/import_to_supabase.js
 * 
 * Ou crie um arquivo .env na raiz:
 *   SUPABASE_URL=https://tvudjsvmquuctdtxrfzr.supabase.co
 *   SUPABASE_ANON_KEY=eyJ...
 */

const fs = require('fs');
const path = require('path');

// Configuração
const INPUT_PATH = path.join(__dirname, '..', 'data_normalized', 'original_verses.json');
const BATCH_SIZE = 100;
const DELAY_MS = 500; // Delay entre batches para evitar rate limit

// Variáveis de ambiente
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[ERRO] Defina SUPABASE_URL e SUPABASE_ANON_KEY');
  console.error('Exemplo:');
  console.error('  SUPABASE_URL=https://xxx.supabase.co SUPABASE_ANON_KEY=eyJ... node scripts/import_to_supabase.js');
  process.exit(1);
}

const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/import-original-verses`;

/**
 * Agrupa versículos por source
 */
function groupBySource(verses) {
  const groups = {};
  for (const verse of verses) {
    if (!groups[verse.source]) {
      groups[verse.source] = [];
    }
    groups[verse.source].push(verse);
  }
  return groups;
}

/**
 * Envia um batch para a Edge Function
 */
async function sendBatch(sourceCode, verses) {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      source_code: sourceCode,
      verses: verses.map(v => ({
        bookNumber: v.bookNumber,
        chapter: v.chapter,
        verse: v.verse,
        language: v.language,
        original_text: v.original_text,
        transliteration: v.transliteration || null,
      })),
    }),
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  
  return response.json();
}

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Função principal
 */
async function main() {
  console.log('='.repeat(60));
  console.log('IMPORTAR VERSÍCULOS ORIGINAIS → SUPABASE');
  console.log('='.repeat(60));
  console.log('');
  
  // Carregar JSON
  console.log('[INFO] Carregando original_verses.json...');
  const content = fs.readFileSync(INPUT_PATH, 'utf-8');
  const verses = JSON.parse(content);
  console.log(`[INFO] ${verses.length} versículos carregados`);
  console.log('');
  
  // Agrupar por fonte
  const groups = groupBySource(verses);
  const sources = Object.keys(groups);
  console.log(`[INFO] Fontes encontradas: ${sources.join(', ')}`);
  console.log('');
  
  // Processar cada fonte
  const results = {
    total: 0,
    inserted: 0,
    notFound: 0,
    errors: 0,
  };
  
  for (const source of sources) {
    const sourceVerses = groups[source];
    console.log(`[INFO] Processando ${source}: ${sourceVerses.length} versículos`);
    
    // Processar em batches
    for (let i = 0; i < sourceVerses.length; i += BATCH_SIZE) {
      const batch = sourceVerses.slice(i, i + BATCH_SIZE);
      const progress = Math.min(i + BATCH_SIZE, sourceVerses.length);
      
      try {
        const result = await sendBatch(source, batch);
        
        results.total += batch.length;
        results.inserted += result.results?.inserted || 0;
        results.notFound += result.results?.notFoundCount || 0;
        results.errors += result.results?.errorsCount || 0;
        
        console.log(`  [${progress}/${sourceVerses.length}] ✓ ${result.results?.inserted || 0} inseridos`);
        
        if (result.results?.notFound?.length > 0) {
          console.log(`    [AVISO] Não encontrados: ${result.results.notFound.slice(0, 5).join(', ')}...`);
        }
        
      } catch (err) {
        console.error(`  [ERRO] Batch ${i}-${progress}: ${err.message}`);
        results.errors += batch.length;
      }
      
      // Delay entre batches
      if (i + BATCH_SIZE < sourceVerses.length) {
        await delay(DELAY_MS);
      }
    }
    
    console.log('');
  }
  
  // Resumo
  console.log('='.repeat(60));
  console.log('RESUMO');
  console.log('='.repeat(60));
  console.log(`Total processado: ${results.total}`);
  console.log(`Inseridos/atualizados: ${results.inserted}`);
  console.log(`Não encontrados: ${results.notFound}`);
  console.log(`Erros: ${results.errors}`);
  console.log('='.repeat(60));
}

// Executar
main().catch(err => {
  console.error('[ERRO FATAL]', err);
  process.exit(1);
});
```

## Como Usar

### 1. Preparar o Repositório OpenBibles

```bash
# Clone o repositório (se ainda não tiver)
git clone https://github.com/openscriptures/openbibles.git
cd openbibles

# Criar estrutura de pastas
mkdir -p data_normalized scripts docs

# Copiar os arquivos acima para as respectivas pastas
```

### 2. Executar a Normalização

```bash
cd openbibles
node scripts/parse_osis_to_json.js
```

Saída esperada:
```
============================================================
PARSE OPENBIBLES → JSON NORMALIZADO
============================================================

[INFO] Carregando book_map.json...
[INFO] 66 livros mapeados

[INFO] Processando wlc: 39 arquivos
  - Gen.xml
    ✓ 1533 versículos
  - Exod.xml
    ✓ 1213 versículos
  ...

[INFO] wlc: 23145 versículos processados

[INFO] Processando sblgnt: 27 arquivos
  - Matt.xml
    ✓ 1071 versículos
  ...

[INFO] sblgnt: 7957 versículos processados

============================================================
CONCLUÍDO: 31102 versículos normalizados
Arquivo: data_normalized/original_verses.json
============================================================
```

### 3. Importar para o Supabase

```bash
# Definir variáveis de ambiente
export SUPABASE_URL="https://tvudjsvmquuctdtxrfzr.supabase.co"
export SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Executar importação
node scripts/import_to_supabase.js
```

### 4. Verificar Importação

Na aplicação, abra qualquer versículo e clique na aba "Original" para verificar se os textos foram importados corretamente.

## Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave anônima (publishable) do Supabase |

## Formato do JSON Normalizado

```json
[
  {
    "bookNumber": 1,
    "chapter": 1,
    "verse": 1,
    "language": "hebrew",
    "original_text": "בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃",
    "source": "wlc"
  },
  {
    "bookNumber": 40,
    "chapter": 1,
    "verse": 1,
    "language": "greek",
    "original_text": "Βίβλος γενέσεως Ἰησοῦ Χριστοῦ υἱοῦ Δαυὶδ υἱοῦ Ἀβραάμ.",
    "source": "sblgnt"
  }
]
```

## Notas Importantes

1. **Textos originais são somente leitura** - O script não modifica arquivos na pasta `/sources`

2. **Sem interpretação** - O script apenas extrai estrutura (livro, capítulo, versículo, texto). Não há análise ou interpretação teológica.

3. **Fontes suportadas** - O script pode ser adaptado para outras fontes/formatos conforme necessário.

4. **Validação** - Após importação, verifique na aplicação se os textos aparecem corretamente na aba "Original".

## Troubleshooting

### "Livro não encontrado"
- Verifique se o código OSIS no arquivo fonte corresponde ao `book_map.json`
- Alguns arquivos podem usar códigos alternativos

### "Versículo não encontrado no Supabase"
- O versículo existe no arquivo fonte mas não na tabela `bible_verses`
- Pode indicar diferença de numeração entre edições

### "Rate limit exceeded"
- Aumente o `DELAY_MS` no script de importação
- Processe menos versículos por vez
