"use client";

import Tesseract from 'tesseract.js';

// -----------------------------------------------------------------------------
// OCR Result Interface
// -----------------------------------------------------------------------------

export interface OcrField {
  value: string;
  confidence: number;
  status: 'high' | 'medium' | 'low';
}

export interface OcrExtractedPosition {
  symbol: OcrField;
  quantity?: OcrField;
  entryPrice?: OcrField;
  currency?: OcrField;
}

export interface OcrResult {
  text: string;
  positions: OcrExtractedPosition[];
  overallConfidence: number;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Extract financial data from OCR text using patterns
 */
function extractFinancialData(text: string): OcrExtractedPosition[] {
  const positions: OcrExtractedPosition[] = [];
  
  // Split text into lines
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  // Patterns for matching financial data
  const patterns = {
    // Symbol pattern: AAPL, SAP, BTC, etc.
    symbol: /([A-Z]{2,10}|[A-Z0-9]{2,15})(?:\.(DE|US|UK|L|TO|AX))?/i,
    
    // Quantity pattern: 0.5, 10, 1.234,567
    quantity: /\b(\d+\.?\d*)\b/,
    
    // Price pattern: $17,497.61, €92.80, 178.50
    price: /[\$€£]?\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/,
    
    // Currency pattern
    currency: /[\$€£GBP|EUR|USD|BTC]+/i,
  };

  for (const line of lines) {
    // Try to find symbol in line
    const symbolMatch = line.match(patterns.symbol);
    
    if (symbolMatch) {
      const quantityMatch = line.match(patterns.quantity);
      const priceMatch = line.match(patterns.price);
      const currencyMatch = line.match(patterns.currency);
      
      // Skip if no quantity or price found
      if (!quantityMatch && !priceMatch) continue;
      
      const position: OcrExtractedPosition = {
        symbol: {
          value: symbolMatch[0].toUpperCase(),
          confidence: 70, // Base confidence for regex match
          status: 'medium',
        },
      };
      
      if (quantityMatch) {
        const quantityValue = quantityMatch[1].replace(',', '');
        position.quantity = {
          value: quantityValue,
          confidence: 75,
          status: 'medium',
        };
      }
      
      if (priceMatch) {
        const priceValue = priceMatch[1]
          .replace(/,/g, '')
          .replace(/\.(?=.*\.)/g, ''); // Handle European number format
        position.entryPrice = {
          value: priceValue,
          confidence: 70,
          status: 'medium',
        };
      }
      
      if (currencyMatch) {
        const currencyValue = currencyMatch[0].toUpperCase().replace(/[$€£]/, (match) => {
          if (match === '$') return 'USD';
          if (match === '€') return 'EUR';
          if (match === '£') return 'GBP';
          return match;
        });
        position.currency = {
          value: currencyValue,
          confidence: 80,
          status: 'high',
        };
      }
      
      positions.push(position);
    }
  }
  
  return positions;
}

/**
 * Calculate overall confidence based on field confidences
 */
function calculateOverallConfidence(positions: OcrExtractedPosition[]): number {
  if (positions.length === 0) return 0;
  
  let totalConfidence = 0;
  let fieldCount = 0;
  
  for (const position of positions) {
    totalConfidence += position.symbol.confidence;
    fieldCount++;
    
    if (position.quantity) {
      totalConfidence += position.quantity.confidence;
      fieldCount++;
    }
    
    if (position.entryPrice) {
      totalConfidence += position.entryPrice.confidence;
      fieldCount++;
    }
  }
  
  return fieldCount > 0 ? Math.round(totalConfidence / fieldCount) : 0;
}

// -----------------------------------------------------------------------------
// Main OCR Function
// -----------------------------------------------------------------------------

/**
 * Extract text from an image using Tesseract.js
 */
export async function extractTextFromImage(
  image: File | string
): Promise<string> {
  try {
    console.log('[ocr-service] Starting OCR extraction...');
    
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`[ocr-service] Progress: ${(m.progress * 100).toFixed(0)}%`);
        }
      },
    });
    
    const result = await worker.recognize(image);
    await worker.terminate();
    
    console.log('[ocr-service] OCR extraction completed');
    
    return result.data.text;
  } catch (error) {
    console.error('[ocr-service] OCR extraction failed:', error);
    throw new Error('OCR extraction failed: ' + (error as Error).message);
  }
}

/**
 * Extract financial positions from an image
 */
export async function extractPositionsFromImage(
  image: File | string
): Promise<OcrResult> {
  try {
    const text = await extractTextFromImage(image);
    const positions = extractFinancialData(text);
    const overallConfidence = calculateOverallConfidence(positions);
    
    return {
      text,
      positions,
      overallConfidence,
    };
  } catch (error) {
    console.error('[ocr-service] Position extraction failed:', error);
    throw error;
  }
}

/**
 * Convert OCR result to editable position data
 */
export function ocrResultToEditablePosition(
  ocrPosition: OcrExtractedPosition
): {
  symbol: string;
  quantity?: string;
  entryPrice?: string;
  currency?: string;
} {
  return {
    symbol: ocrPosition.symbol.value,
    quantity: ocrPosition.quantity?.value,
    entryPrice: ocrPosition.entryPrice?.value,
    currency: ocrPosition.currency?.value,
  };
}