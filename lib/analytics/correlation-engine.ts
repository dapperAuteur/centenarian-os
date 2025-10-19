/* eslint-disable @typescript-eslint/no-explicit-any */
// File: lib/analytics/correlation-engine.ts

import { createClient } from '@/lib/supabase/client';

/**
 * Correlation insight structure
 */
export interface Correlation {
  id: string;
  category: 'nutrition' | 'focus' | 'pain' | 'completion' | 'energy';
  insight: string;
  confidence: number; // 0-100
  sample_size: number;
  metric_a: string;
  metric_b: string;
  improvement_percentage: number;
  suggestion: string;
}

/**
 * Correlation Engine
 * 
 * Automatically detects patterns across modules.
 * 
 * **How it works:**
 * 1. Queries pre-computed correlation_candidates view
 * 2. Applies statistical thresholds (sample size, effect size)
 * 3. Generates human-readable insights
 * 4. Calculates confidence scores
 * 
 * **Example Output:**
 * "Green NCV days correlate with 18% higher energy (4.2 vs 3.6). 
 *  Based on 23 days of data (87% confidence)."
 */
export class CorrelationEngine {
  private supabase = createClient();

  /**
   * Find all significant correlations
   */
  async findCorrelations(): Promise<Correlation[]> {
    const correlations: Correlation[] = [];

    try {
      // Get correlation candidates
      const { data: candidates, error } = await this.supabase
        .from('correlation_candidates')
        .select('*')
        .single();

      if (error || !candidates) {
        console.error('Failed to fetch correlations:', error);
        return [];
      }

      // 1. Green NCV → Energy
      if (this.isSignificant(candidates.green_day_count, 5)) {
        const improvement = this.calculateImprovement(
          candidates.green_day_avg_energy,
          candidates.non_green_day_avg_energy
        );

        if (Math.abs(improvement) > 10) {
          correlations.push({
            id: 'ncv-energy',
            category: 'nutrition',
            insight: `Green NCV days average ${candidates.green_day_avg_energy?.toFixed(1)}/5 energy vs ${candidates.non_green_day_avg_energy?.toFixed(1)}/5 on other days`,
            confidence: this.calculateConfidence(candidates.green_day_count, 30),
            sample_size: candidates.green_day_count,
            metric_a: 'Green NCV Score',
            metric_b: 'Energy Rating',
            improvement_percentage: improvement,
            suggestion: improvement > 0 
              ? 'Prioritize green ingredients for sustained energy'
              : 'Consider reevaluating your green protocols'
          });
        }
      }

      // 2. High Focus → Task Completion
      if (this.isSignificant(candidates.high_focus_day_count, 5)) {
        const improvement = this.calculateImprovement(
          candidates.high_focus_completion_rate,
          candidates.low_focus_completion_rate
        );

        if (Math.abs(improvement) > 10) {
          correlations.push({
            id: 'focus-completion',
            category: 'focus',
            insight: `Days with 3+ hours focused work have ${improvement.toFixed(0)}% higher task completion (${candidates.high_focus_completion_rate?.toFixed(0)}% vs ${candidates.low_focus_completion_rate?.toFixed(0)}%)`,
            confidence: this.calculateConfidence(candidates.high_focus_day_count, 30),
            sample_size: candidates.high_focus_day_count,
            metric_a: 'Focus Time (3+ hrs)',
            metric_b: 'Task Completion Rate',
            improvement_percentage: improvement,
            suggestion: improvement > 0
              ? 'Schedule deep work blocks for high-priority goals'
              : 'Long focus sessions may need better breaks'
          });
        }
      }

      // 3. Pain → Focus Capacity
      if (this.isSignificant(candidates.high_pain_day_count, 5)) {
        const painFocusDiff = (candidates.low_pain_avg_focus || 0) - (candidates.high_pain_avg_focus || 0);
        const percentageDiff = ((painFocusDiff / (candidates.low_pain_avg_focus || 1)) * 100);

        if (Math.abs(percentageDiff) > 15) {
          correlations.push({
            id: 'pain-focus',
            category: 'pain',
            insight: `High pain days (4+) reduce focus capacity by ${Math.abs(percentageDiff).toFixed(0)}% (${candidates.high_pain_avg_focus?.toFixed(0)} vs ${candidates.low_pain_avg_focus?.toFixed(0)} minutes)`,
            confidence: this.calculateConfidence(candidates.high_pain_day_count, 30),
            sample_size: candidates.high_pain_day_count,
            metric_a: 'Pain Score (4+)',
            metric_b: 'Focus Minutes',
            improvement_percentage: -percentageDiff,
            suggestion: 'Prioritize corrective protocols on high-pain days'
          });
        }
      }

      // 4. Restaurant Meals → Task Completion
      if (this.isSignificant(candidates.restaurant_day_count, 5)) {
        const improvement = this.calculateImprovement(
          candidates.no_restaurant_completion_rate,
          candidates.restaurant_day_completion_rate
        );

        if (Math.abs(improvement) > 10) {
          correlations.push({
            id: 'restaurant-completion',
            category: 'completion',
            insight: `Days without restaurant meals show ${Math.abs(improvement).toFixed(0)}% ${improvement > 0 ? 'higher' : 'lower'} task completion (${candidates.no_restaurant_completion_rate?.toFixed(0)}% vs ${candidates.restaurant_day_completion_rate?.toFixed(0)}%)`,
            confidence: this.calculateConfidence(candidates.restaurant_day_count, 30),
            sample_size: candidates.restaurant_day_count,
            metric_a: 'Home-Cooked Meals',
            metric_b: 'Task Completion',
            improvement_percentage: improvement,
            suggestion: improvement > 0
              ? 'Meal prep on Sundays to reduce restaurant dependency'
              : 'Restaurant meals may not be the issue - investigate other factors'
          });
        }
      }

      // Sort by confidence
      return correlations.sort((a, b) => b.confidence - a.confidence);

    } catch (error) {
      console.error('Correlation engine error:', error);
      return [];
    }
  }

  /**
   * Get module-specific stats
   */
  async getModuleStats(days: number = 30): Promise<{
    planner: any;
    fuel: any;
    engine: any;
    body: any;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: aggregates } = await this.supabase
      .from('daily_aggregates')
      .select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (!aggregates) {
      return this.emptyStats();
    }

    return {
      planner: {
        avg_completion_rate: this.average(aggregates.map(d => d.completion_rate)),
        total_tasks_completed: this.sum(aggregates.map(d => d.tasks_completed)),
        total_tasks: this.sum(aggregates.map(d => d.tasks_total)),
        best_day: this.maxBy(aggregates, 'completion_rate'),
        worst_day: this.minBy(aggregates, 'completion_rate'),
        streak: this.calculateStreak(aggregates, 'completion_rate', 90),
      },
      fuel: {
        avg_ncv_score: this.average(aggregates.map(d => d.avg_ncv_numeric)),
        green_days_percentage: (aggregates.filter(d => d.ncv_score_mode === 'Green').length / aggregates.length) * 100,
        total_meals: this.sum(aggregates.map(d => d.meal_count)),
        restaurant_percentage: (this.sum(aggregates.map(d => d.restaurant_meal_count)) / this.sum(aggregates.map(d => d.meal_count))) * 100,
        total_cost: this.sum(aggregates.map(d => d.daily_food_cost)),
      },
      engine: {
        total_focus_hours: this.sum(aggregates.map(d => d.focus_minutes)) / 60,
        avg_focus_per_day: this.average(aggregates.map(d => d.focus_minutes)),
        avg_sessions_per_day: this.average(aggregates.map(d => d.focus_session_count)),
        avg_energy_rating: this.average(aggregates.filter(d => d.energy_rating > 0).map(d => d.energy_rating)),
      },
      body: {
        avg_pain_score: this.average(aggregates.filter(d => d.pain_score > 0).map(d => d.pain_score)),
        pain_free_days: aggregates.filter(d => d.pain_score <= 1).length,
        pain_free_percentage: (aggregates.filter(d => d.pain_score <= 1).length / aggregates.length) * 100,
      }
    };
  }

  // ===== Helper Methods =====

  private isSignificant(sampleSize: number, threshold: number): boolean {
    return sampleSize >= threshold;
  }

  private calculateImprovement(valueA: number | null, valueB: number | null): number {
    if (!valueA || !valueB) return 0;
    return ((valueA - valueB) / valueB) * 100;
  }

  private calculateConfidence(sampleSize: number, target: number): number {
    if (sampleSize < 5) return 0;
    if (sampleSize < 10) return 30;
    if (sampleSize < 15) return 50;
    if (sampleSize < 20) return 70;
    const ratio = Math.min(sampleSize / target, 1);
    return Math.round(70 + (ratio * 25));
  }

  private average(arr: number[]): number {
    const valid = arr.filter(n => n != null && !isNaN(n));
    if (valid.length === 0) return 0;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }

  private sum(arr: number[]): number {
    return arr.reduce((a, b) => (a || 0) + (b || 0), 0);
  }

  private maxBy(arr: any[], key: string): any {
    return arr.reduce((max, obj) => obj[key] > (max[key] || 0) ? obj : max, arr[0]);
  }

  private minBy(arr: any[], key: string): any {
    return arr.reduce((min, obj) => obj[key] < (min[key] || Infinity) ? obj : min, arr[0]);
  }

  private calculateStreak(arr: any[], key: string, threshold: number): number {
    let streak = 0;
    for (const item of arr) {
      if (item[key] >= threshold) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  private emptyStats() {
    return {
      planner: { avg_completion_rate: 0, total_tasks_completed: 0, total_tasks: 0, best_day: null, worst_day: null, streak: 0 },
      fuel: { avg_ncv_score: 0, green_days_percentage: 0, total_meals: 0, restaurant_percentage: 0, total_cost: 0 },
      engine: { total_focus_hours: 0, avg_focus_per_day: 0, avg_sessions_per_day: 0, avg_energy_rating: 0 },
      body: { avg_pain_score: 0, pain_free_days: 0, pain_free_percentage: 0 }
    };
  }
}