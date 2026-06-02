import { SimulationEngine, SimulationResult } from './SimulationEngine';
import type { Transaction } from '../../types';

interface KimiResponse {
  scenario: string;
  adjustments: {
    category: string;
    multiplier: number;
    reason: string;
  }[];
  insights: string[];
}

export class KimiSimulationService {
  private apiKey: string;
  private baseUrl = 'https://api.moonshot.cn/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async processScenario(
    scenario: string, 
    transactions: Transaction[], 
    categories: any[]
  ): Promise<SimulationResult> {
    const engine = new SimulationEngine(transactions, categories);
    const baseResult = engine.generateForecast(scenario);
    
    try {
      const aiResponse = await this.callKimiAPI(scenario, baseResult);
      return this.mergeResults(baseResult, aiResponse);
    } catch (error) {
      console.warn('Kimi API failed, using local analysis:', error);
      return baseResult;
    }
  }

  private async callKimiAPI(scenario: string, baseResult: SimulationResult): Promise<KimiResponse> {
    const prompt = this.buildPrompt(scenario, baseResult);
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'kimi-k2-latest',
        messages: [
          {
            role: 'system',
            content: `Du bist ein deutscher Finanzberater. Analysiere die folgende Ausgaben-Situation und gib konkrete, realistische Prognosen für die Auswirkungen des genannten Szenarios. Antworte auf Deutsch.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`Kimi API error: ${response.status}`);
    }

    const data = await response.json();
    return this.parseKimiResponse(data.choices[0]?.message?.content || '');
  }

  private buildPrompt(scenario: string, baseResult: SimulationResult): string {
    const fixedExpenses = baseResult.fixedExpenses
      .map(e => `${e.name}: ${e.amount}€ (${e.frequency})`)
      .join(', ');
    
    const variableCategories = baseResult.variableExpenses
      .map(v => `${v.category}: aktuell ${v.currentAvg.toFixed(2)}€`)
      .join(', ');

    return `Szenario: ${scenario}

Aktuelle feste Ausgaben: ${fixedExpenses || 'Keine erkannt'}
Aktuelle variable Ausgaben: ${variableCategories || 'Keine erkannt'}

Analysiere die Auswirkungen dieses Szenarios auf die Ausgabenstruktur.`;
  }

  private parseKimiResponse(content: string): KimiResponse {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return {
        scenario: 'Parsed from text',
        adjustments: [],
        insights: [content]
      };
    } catch {
      return {
        scenario: 'Fallback',
        adjustments: [],
        insights: [content]
      };
    }
  }

  private mergeResults(baseResult: SimulationResult, aiResponse: KimiResponse): SimulationResult {
    const adjustedVariables = baseResult.variableExpenses.map(v => {
      const adjustment = aiResponse.adjustments.find(a => 
        a.category.toLowerCase() === v.category.toLowerCase()
      );
      
      if (adjustment) {
        return {
          ...v,
          projectedAvg: v.currentAvg * adjustment.multiplier,
          change: (adjustment.multiplier - 1) * 100,
          confidence: 0.85
        };
      }
      
      return v;
    });

    const allInsights = [...baseResult.insights, ...aiResponse.insights];

    return {
      ...baseResult,
      variableExpenses: adjustedVariables,
      insights: allInsights,
      totalForecast: this.recalculateForecast(baseResult, adjustedVariables)
    };
  }

  private recalculateForecast(baseResult: SimulationResult, variables: any[]) {
    const totalFixedExpenses = baseResult.fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalFixedIncome = baseResult.fixedIncome.reduce((sum, i) => sum + i.amount, 0);
    const totalVariable = variables.reduce((sum, v) => sum + v.projectedAvg, 0);

    return {
      optimistic: totalFixedIncome - (totalFixedExpenses + totalVariable * 0.8),
      realistic: totalFixedIncome - (totalFixedExpenses + totalVariable),
      pessimistic: totalFixedIncome - (totalFixedExpenses + totalVariable * 1.2)
    };
  }
}