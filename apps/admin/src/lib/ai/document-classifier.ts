/**
 * Document classifier for language detection, version parsing, and authority ranking
 */

export interface DocumentClassification {
    language: 'norwegian' | 'english' | 'mixed' | 'unknown';
    version: {
      detected: boolean;
      version: string;
      major: number;
      minor?: number;
      patch?: number;
    };
    authority: {
      isAuthoritative: boolean;
      isLatest: boolean;
      isTranslation: boolean;
      priority: number; // Higher = more authoritative
    };
    path: {
      isInLanguageFolder: boolean;
      languageFolder?: 'norwegian' | 'english';
      category?: string; // 'statutes', 'local-laws', etc.
    };
  }
  
  export class DocumentClassifier {
    
    /**
     * Classify a document based on filename, path, and content patterns
     */
    classifyDocument(
      fileName: string, 
      filePath: string, 
      content?: string
    ): DocumentClassification {
      const language = this.detectLanguage(fileName, filePath, content);
      const version = this.parseVersion(fileName);
      const path = this.analyzePath(filePath);
      const authority = this.determineAuthority(language, version, path, fileName);
  
      return {
        language,
        version,
        authority,
        path,
      };
    }
  
    /**
     * Compare two documents to determine which is more authoritative
     */
    compareAuthority(docA: DocumentClassification, docB: DocumentClassification): number {
      // Higher priority score wins
      return docB.authority.priority - docA.authority.priority;
    }
  
    /**
     * Find the most authoritative version among a group of related documents
     */
    findAuthoritativeDocument(documents: Array<{
      fileName: string;
      filePath: string;
      content?: string;
      lastModified?: string;
    }>): { index: number; classification: DocumentClassification } | null {
      if (documents.length === 0) return null;
  
      const classified = documents.map((doc, index) => ({
        index,
        classification: this.classifyDocument(doc.fileName, doc.filePath, doc.content),
        lastModified: doc.lastModified,
      }));
  
      // Sort by authority priority (descending)
      classified.sort((a, b) => {
        // First, compare authority priority
        const authorityDiff = b.classification.authority.priority - a.classification.authority.priority;
        if (authorityDiff !== 0) return authorityDiff;
  
        // If same priority, prefer more recent
        if (a.lastModified && b.lastModified) {
          return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
        }
  
        return 0;
      });
  
      return classified[0];
    }
  
    private detectLanguage(fileName: string, filePath: string, content?: string): 'norwegian' | 'english' | 'mixed' | 'unknown' {
      const fileNameLower = fileName.toLowerCase();
      const filePathLower = filePath.toLowerCase();
  
      // Explicit language indicators in filename
      const norwegianIndicators = ['nor', 'norsk', 'norwegian'];
      const englishIndicators = ['eng', 'english', 'engelsk'];
  
      const hasNorwegianInName = norwegianIndicators.some(indicator => 
        fileNameLower.includes(indicator));
      const hasEnglishInName = englishIndicators.some(indicator => 
        fileNameLower.includes(indicator));
  
      // Path-based detection
      const pathSegments = filePathLower.split('/').map(s => s.trim());
      const hasNorwegianPath = pathSegments.some(segment => 
        ['norsk', 'norwegian', 'no'].includes(segment));
      const hasEnglishPath = pathSegments.some(segment => 
        ['english', 'eng', 'en'].includes(segment));
  
      // Content-based detection (if available)
      let contentLanguage: 'norwegian' | 'english' | 'mixed' | 'unknown' = 'unknown';
      if (content) {
        contentLanguage = this.detectContentLanguage(content);
      }
  
      // Decision logic
      if (hasNorwegianInName || hasNorwegianPath) {
        return 'norwegian';
      }
      if (hasEnglishInName || hasEnglishPath) {
        return 'english';
      }
      if (contentLanguage !== 'unknown') {
        return contentLanguage;
      }
  
      // Default: assume Norwegian for regulatory documents (as per statute)
      return 'norwegian';
    }
  
    private detectContentLanguage(content: string): 'norwegian' | 'english' | 'mixed' | 'unknown' {
      const sampleText = content.substring(0, 2000).toLowerCase();
      
      // Norwegian indicators
      const norwegianWords = ['vedtekter', 'paragraf', 'avsnitt', 'landsmøte', 'styret', 'tillitsverv', 'på', 'og', 'til', 'fra', 'med', 'som', 'skal', 'kan', 'må'];
      const englishWords = ['statutes', 'paragraph', 'section', 'meeting', 'board', 'position', 'and', 'the', 'to', 'from', 'with', 'shall', 'may', 'must'];
  
      const norwegianMatches = norwegianWords.filter(word => sampleText.includes(word)).length;
      const englishMatches = englishWords.filter(word => sampleText.includes(word)).length;
  
      if (norwegianMatches > englishMatches * 1.5) return 'norwegian';
      if (englishMatches > norwegianMatches * 1.5) return 'english';
      if (norwegianMatches > 0 && englishMatches > 0) return 'mixed';
      
      return 'unknown';
    }
  
    private parseVersion(fileName: string): DocumentClassification['version'] {
      // Patterns for version detection
      const versionPatterns = [
        /v(\d+)\.(\d+)\.(\d+)/i,  // v1.2.3
        /v(\d+)\.(\d+)/i,         // v1.2
        /v(\d+)/i,                // v1
        /version\s*(\d+)\.(\d+)\.(\d+)/i,
        /version\s*(\d+)\.(\d+)/i,
        /version\s*(\d+)/i,
      ];
  
      for (const pattern of versionPatterns) {
        const match = fileName.match(pattern);
        if (match) {
          const major = parseInt(match[1]);
          const minor = match[2] ? parseInt(match[2]) : undefined;
          const patch = match[3] ? parseInt(match[3]) : undefined;
          
          return {
            detected: true,
            version: match[0],
            major,
            minor,
            patch,
          };
        }
      }
  
      return {
        detected: false,
        version: '',
        major: 0,
      };
    }
  
    private analyzePath(filePath: string): DocumentClassification['path'] {
      const pathLower = filePath.toLowerCase();
      const segments = pathLower.split('/').map(s => s.trim());
  
      // Check for language folders
      const hasNorwegianFolder = segments.some(segment => 
        ['norsk', 'norwegian', 'no'].includes(segment));
      const hasEnglishFolder = segments.some(segment => 
        ['english', 'eng', 'en'].includes(segment));
  
      // Determine document category
      let category: string | undefined;
      if (pathLower.includes('statute') || pathLower.includes('vedtekter')) {
        category = 'statutes';
      } else if (pathLower.includes('local') && pathLower.includes('law')) {
        category = 'local-laws';
      } else if (pathLower.includes('business') && pathLower.includes('relation')) {
        category = 'business-relations';
      } else if (pathLower.includes('organisation')) {
        category = 'organizational';
      }
  
      return {
        isInLanguageFolder: hasNorwegianFolder || hasEnglishFolder,
        languageFolder: hasNorwegianFolder ? 'norwegian' : hasEnglishFolder ? 'english' : undefined,
        category,
      };
    }
  
    private determineAuthority(
      language: DocumentClassification['language'],
      version: DocumentClassification['version'],
      path: DocumentClassification['path'],
      fileName: string
    ): DocumentClassification['authority'] {
      let priority = 0;
      let isAuthoritative = true;
      let isTranslation = false;
  
      // Language priority (Norwegian is authoritative as per statute)
      if (language === 'norwegian') {
        priority += 100;
      } else if (language === 'english') {
        priority += 50;
        isTranslation = true; // English is likely a translation
      } else if (language === 'mixed') {
        priority += 75;
      }
  
      // Version priority (higher versions are more authoritative)
      if (version.detected) {
        priority += version.major * 10;
        if (version.minor !== undefined) priority += version.minor;
        if (version.patch !== undefined) priority += version.patch * 0.1;
      } else {
        // No version detected, might be less authoritative
        priority -= 5;
      }
  
      // Path-based priority
      if (path.isInLanguageFolder && path.languageFolder === 'norwegian') {
        priority += 20;
      } else if (path.isInLanguageFolder && path.languageFolder === 'english') {
        priority += 10;
        isTranslation = true;
      }
  
      // File name patterns that indicate authority
      const fileNameLower = fileName.toLowerCase();
      if (fileNameLower.includes('current') || fileNameLower.includes('gjeldende')) {
        priority += 15;
      }
      if (fileNameLower.includes('draft') || fileNameLower.includes('utkast')) {
        priority -= 20;
        isAuthoritative = false;
      }
      if (fileNameLower.includes('old') || fileNameLower.includes('previous') || fileNameLower.includes('gammel')) {
        priority -= 15;
        isAuthoritative = false;
      }
  
      // Determine if this is the latest version (simplified heuristic)
      const isLatest = version.detected ? version.major >= 5 : true; // Rough heuristic
  
      return {
        isAuthoritative,
        isLatest,
        isTranslation,
        priority,
      };
    }
  
    /**
     * Detect the language of a user query
     */
    detectQueryLanguage(query: string): 'norwegian' | 'english' | 'mixed' {
      const queryLower = query.toLowerCase();
      
      // Norwegian query indicators
      const norwegianWords = ['hva', 'hvordan', 'hvor', 'når', 'hvem', 'hvilken', 'står', 'paragraf', 'avsnitt', 'vedtektene', 'om', 'og', 'til', 'fra', 'med', 'som', 'skal', 'kan', 'må', 'er', 'har', 'blir'];
      const englishWords = ['what', 'how', 'where', 'when', 'who', 'which', 'paragraph', 'section', 'statutes', 'about', 'and', 'the', 'to', 'from', 'with', 'that', 'shall', 'can', 'must', 'is', 'has', 'will'];
  
      const norwegianMatches = norwegianWords.filter(word => queryLower.includes(word)).length;
      const englishMatches = englishWords.filter(word => queryLower.includes(word)).length;
  
      if (norwegianMatches > englishMatches) return 'norwegian';
      if (englishMatches > norwegianMatches) return 'english';
      
      // Check for specific Norwegian characters
      if (/[æøå]/.test(queryLower)) return 'norwegian';
      
      return 'mixed';
    }
  }
  
  // Export singleton instance
  export const documentClassifier = new DocumentClassifier();