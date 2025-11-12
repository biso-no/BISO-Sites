import 'server-only';
import { extractTextFromPdf } from '@/lib/pdf-text-extractor';
import TurndownService from 'turndown';
import { isSupportedContentType } from './content-types';
import { correctMimeType } from './mime-utils';
import { encode } from 'gpt-tokenizer';

export interface ProcessedDocument {
  content: string;
  metadata: Record<string, any>;
  chunks: DocumentChunk[];
}

export interface DocumentChunk {
  content: string;
  metadata: Record<string, any>;
  chunkIndex: number;
}

// Simple, effective chunking configuration
const CHUNKING_CONFIG = {
  TARGET_CHUNK_SIZE: 512,     // tokens
  MIN_CHUNK_SIZE: 100,        // minimum viable chunk
  MAX_CHUNK_SIZE: 1024,       // maximum before splitting
  OVERLAP_PERCENTAGE: 0.15,   // 15% overlap for context
} as const;

export class DocumentProcessor {
  private turndownService: TurndownService;

  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    });
    this.turndownService.remove(['style', 'script', 'noscript', 'iframe', 'object', 'embed']);
    this.turndownService.addRule('cleanBreaks', {
      filter: ['br'],
      replacement: () => '\n'
    });
  }

  private countTokens(text: string): number {
    return encode(text).length;
  }

  async processDocument(
    buffer: ArrayBuffer,
    contentType: string,
    metadata: Record<string, any>
  ): Promise<ProcessedDocument> {
    const fileName = metadata?.fileName || '';
    const correctedType = correctMimeType(contentType, fileName);
    const ct = correctedType.toLowerCase();

    let content = '';

    if (ct.includes('pdf')) {
      content = await extractTextFromPdf(buffer);
    } else if (ct.includes('word') || ct.includes('docx')) {
      content = await this.extractWordText(buffer);
    } else if (ct.includes('presentation') || ct.includes('pptx')) {
      content = await this.extractPowerPointText(buffer);
    } else if (ct.includes('spreadsheet') || ct.includes('xlsx')) {
      content = await this.extractExcelText(buffer);
    } else if (ct.includes('csv')) {
      content = await this.extractCsvText(buffer);
    } else if (ct.includes('html')) {
      content = await this.extractHtmlText(buffer);
    } else if (ct.includes('text') || ct.includes('markdown')) {
      content = new TextDecoder().decode(buffer);
    } else {
      throw new Error(`Unsupported content type: ${correctedType}`);
    }

    const cleanContent = this.cleanContent(content);
    const chunks = this.createChunks(cleanContent, metadata);
    
    console.log(`📄 ${fileName}: ${cleanContent.length} chars → ${chunks.length} chunks`);
    
    return { content: cleanContent, metadata, chunks };
  }

  private async extractWordText(buffer: ArrayBuffer): Promise<string> {
    const nodeBuffer = Buffer.from(buffer);
    const mammoth = await import('mammoth');
    const result = await mammoth.convertToHtml({ buffer: nodeBuffer });
    return this.turndownService.turndown(result.value || '');
  }

  private async extractPowerPointText(buffer: ArrayBuffer): Promise<string> {
    const JSZip = (await import('jszip')).default;
    const { parseStringPromise } = await import('xml2js');
    const zip = await JSZip.loadAsync(new Uint8Array(buffer));
    const slideFiles = Object.keys(zip.files).filter(f => 
      f.startsWith('ppt/slides/slide') && f.endsWith('.xml')
    );
    
    const slideTexts: string[] = [];
    
    for (const [index, file] of Array.from(slideFiles.entries())) {
      const xml = await zip.file(file)!.async('string');
      const parsed = await parseStringPromise(xml);
      
      const texts: string[] = [];
      const extractTexts = (obj: any) => {
        if (obj?.['a:t']) {
          const text = Array.isArray(obj['a:t']) ? obj['a:t'].join(' ') : String(obj['a:t']);
          texts.push(text);
        }
        if (typeof obj === 'object') {
          Object.values(obj).forEach(extractTexts);
        }
      };
      
      extractTexts(parsed);
      if (texts.length) {
        slideTexts.push(`## Slide ${index + 1}\n\n${texts.join(' ')}`);
      }
    }
    
    return slideTexts.join('\n\n');
  }

  private async extractExcelText(buffer: ArrayBuffer): Promise<string> {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(Buffer.from(buffer), { type: 'buffer' });
    const sheets: string[] = [];
    
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
      
      if (rows.length > 0) {
        const table = this.arrayToMarkdownTable(rows);
        if (table) {
          sheets.push(`# ${sheetName}\n\n${table}`);
        }
      }
    }
    
    return sheets.join('\n\n');
  }

  private async extractCsvText(buffer: ArrayBuffer): Promise<string> {
    const text = new TextDecoder().decode(buffer);
    const lines = text.split('\n').filter(line => line.trim()).slice(0, 1000); // Limit for safety
    
    if (lines.length < 2) return text;
    
    const rows = lines.map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')));
    return this.arrayToMarkdownTable(rows) || text;
  }

  private async extractHtmlText(buffer: ArrayBuffer): Promise<string> {
    const html = new TextDecoder().decode(buffer);
    return this.turndownService.turndown(html);
  }

  private arrayToMarkdownTable(rows: any[][]): string | null {
    if (rows.length === 0) return null;
    
    const header = rows[0].map(cell => String(cell || '').replace(/\|/g, '\\|'));
    const body = rows.slice(1).map(row => row.map(cell => String(cell || '').replace(/\|/g, '\\|')));
    
    if (header.every(cell => !cell)) return null;
    
    const separator = header.map(() => '---');
    return [
      `| ${header.join(' | ')} |`,
      `| ${separator.join(' | ')} |`,
      ...body.map(row => `| ${row.join(' | ')} |`)
    ].join('\n');
  }

  private cleanContent(content: string): string {
    if (!content || typeof content !== 'string') {
      throw new Error('Invalid content: must be non-empty string');
    }

    const cleaned = content
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // Remove control chars
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+$/gm, '') // Remove trailing spaces
      .replace(/\n{4,}/g, '\n\n\n') // Max 3 consecutive newlines
      .trim();

    if (cleaned.length < 10) {
      throw new Error('Content too short after cleaning');
    }

    return cleaned;
  }

  private createChunks(content: string, metadata: Record<string, any>): DocumentChunk[] {
    // Try structure-aware chunking first
    const structuredChunks = this.tryStructuredChunking(content, metadata);
    if (structuredChunks.length > 0 && this.validateChunks(structuredChunks, content.length)) {
      return structuredChunks;
    }

    // Fall back to token-based chunking
    return this.createTokenBasedChunks(content, metadata);
  }

  private tryStructuredChunking(content: string, metadata: Record<string, any>): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    
    // Look for clear document structure
    const sectionRegex = /^(#{1,4}\s+.+|§\s*\d+(?:\.\d+)*\s+.+|\d+\.\s+[A-ZÆØÅ].{10,})$/gm;
    const sections: Array<{ title: string; start: number; end: number }> = [];
    
    let match;
    while ((match = sectionRegex.exec(content)) !== null) {
      sections.push({
        title: match[1].trim(),
        start: match.index,
        end: match.index + match[0].length
      });
    }

    if (sections.length < 2 || sections.length > 50) return [];

    // Create chunks from sections
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const nextSection = sections[i + 1];
      
      const sectionStart = section.start;
      const sectionEnd = nextSection ? nextSection.start : content.length;
      let sectionContent = content.substring(sectionStart, sectionEnd).trim();
      
      if (sectionContent.length < 50) continue;
      
      const tokenCount = this.countTokens(sectionContent);
      
      if (tokenCount > CHUNKING_CONFIG.MAX_CHUNK_SIZE) {
        // Split large sections
        const subChunks = this.splitLargeSection(sectionContent, section.title, chunks.length);
        chunks.push(...subChunks);
      } else {
        chunks.push({
          content: sectionContent,
          metadata: {
            ...metadata,
            chunkIndex: chunks.length,
            sectionTitle: section.title,
            isStructured: true,
            tokenCount,
          },
          chunkIndex: chunks.length,
        });
      }
    }

    return chunks;
  }

  private splitLargeSection(content: string, title: string, baseIndex: number): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const targetSize = CHUNKING_CONFIG.TARGET_CHUNK_SIZE;
    const overlapSize = Math.floor(targetSize * CHUNKING_CONFIG.OVERLAP_PERCENTAGE);
    
    let position = 0;
    let partIndex = 0;
    
    while (position < content.length) {
      const endPos = Math.min(position + targetSize * 4, content.length); // Estimate chars from tokens
      let chunkContent = content.substring(position, endPos);
      
      // Find good boundary
      if (endPos < content.length) {
        const boundaries = [
          chunkContent.lastIndexOf('\n\n'),
          chunkContent.lastIndexOf('. '),
          chunkContent.lastIndexOf('\n'),
        ];
        
        const goodBoundary = boundaries.find(pos => pos > chunkContent.length * 0.7);
        if (goodBoundary && goodBoundary > 0) {
          chunkContent = chunkContent.substring(0, goodBoundary + 1);
        }
      }
      
      chunkContent = chunkContent.trim();
      if (chunkContent.length < 50) break;
      
      chunks.push({
        content: chunkContent,
        metadata: {
          sectionTitle: title,
          isStructured: true,
          partIndex,
          tokenCount: this.countTokens(chunkContent),
        },
        chunkIndex: baseIndex + partIndex,
      });
      
      position += chunkContent.length - overlapSize;
      partIndex++;
      
      if (partIndex > 20) break; // Safety limit
    }
    
    return chunks;
  }

  private createTokenBasedChunks(content: string, metadata: Record<string, any>): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const targetTokens = CHUNKING_CONFIG.TARGET_CHUNK_SIZE;
    const overlapTokens = Math.floor(targetTokens * CHUNKING_CONFIG.OVERLAP_PERCENTAGE);
    
    // Rough char estimates for processing
    const targetChars = targetTokens * 4;
    const overlapChars = overlapTokens * 4;
    
    let startPos = 0;
    let chunkIndex = 0;
    
    while (startPos < content.length) {
      let endPos = Math.min(startPos + targetChars, content.length);
      let chunkContent = content.substring(startPos, endPos);
      
      // Find good boundary
      if (endPos < content.length) {
        const boundaries = [
          { pos: chunkContent.lastIndexOf('\n\n'), type: 'paragraph' },
          { pos: chunkContent.lastIndexOf('. '), type: 'sentence' },
          { pos: chunkContent.lastIndexOf('\n'), type: 'line' },
          { pos: chunkContent.lastIndexOf(' '), type: 'word' },
        ];
        
        const goodBoundary = boundaries.find(b => b.pos > chunkContent.length * 0.6);
        if (goodBoundary && goodBoundary.pos > 0) {
          const adjustment = goodBoundary.type === 'sentence' ? 1 : 0;
          chunkContent = content.substring(startPos, startPos + goodBoundary.pos + adjustment);
          endPos = startPos + goodBoundary.pos + adjustment;
        }
      }
      
      chunkContent = chunkContent.trim();
      const tokenCount = this.countTokens(chunkContent);
      
      if (tokenCount >= CHUNKING_CONFIG.MIN_CHUNK_SIZE) {
        chunks.push({
          content: chunkContent,
          metadata: {
            ...metadata,
            chunkIndex,
            isStructured: false,
            tokenCount,
          },
          chunkIndex,
        });
        chunkIndex++;
      }
      
      if (endPos >= content.length) break;
      
      startPos = Math.max(startPos + 1, endPos - overlapChars);
    }
    
    return chunks;
  }

  private validateChunks(chunks: DocumentChunk[], contentLength: number): boolean {
    if (chunks.length === 0 || chunks.length > 200) return false;
    
    const tokenCounts = chunks.map(chunk => this.countTokens(chunk.content));
    const avgTokens = tokenCounts.reduce((sum, count) => sum + count, 0) / tokenCounts.length;
    
    return avgTokens >= 50 && avgTokens <= 1500 && Math.min(...tokenCounts) >= 20;
  }
}
