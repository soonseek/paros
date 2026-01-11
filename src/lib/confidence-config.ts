/**
 * Confidence Score Thresholds Configuration
 *
 * Story 4.2 Code Review - CRITICAL #1 Fix
 *
 * These values define the boundaries for confidence level classification:
 * - HIGH: >= 0.7 (green badge, high confidence)
 * - MEDIUM: 0.5 - 0.7 (yellow badge, medium confidence)
 * - LOW: < 0.5 (orange badge, low confidence)
 *
 * The UNCERTAIN_LABEL_THRESHOLD (0.7) determines when to show
 * the "불확실한 분류" (uncertain classification) warning label.
 *
 * To adjust thresholds for A/B testing or regional variations:
 * 1. Override in environment variables (requires rebuild for Next.js public vars)
 * 2. Or adjust values here and commit to git
 *
 * @see https://github.com/vercel/next.js/issues/16427#issuecomment-924242519
 */

/**
 * Confidence threshold constants
 *
 * Environment variables (NEXT_PUBLIC_*) allow configuration without code changes.
 * Falls back to defaults if not set.
 */
export const CONFIDENCE_THRESHOLDS = {
  // High confidence level (green badge)
  HIGH: 0.7,

  // Medium confidence level (yellow badge)
  MEDIUM: 0.5,

  // Threshold for showing "불확실한 분류" warning label
  UNCERTAIN_LABEL: 0.7,
} as const;

/**
 * Confidence level types
 */
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

/**
 * Validation helper to ensure confidence scores are within [0, 1] range
 *
 * @param score - The confidence score to validate (can be any type)
 * @returns Validated number (0-1) or null if invalid
 *
 * @example
 * validateConfidenceScore(0.95) // returns 0.95
 * validateConfidenceScore(-0.1) // returns null (logs warning)
 * validateConfidenceScore(NaN) // returns null (logs warning)
 * validateConfidenceScore(null) // returns null
 * validateConfidenceScore("") // returns null (logs warning)
 */
export const validateConfidenceScore = (
  score: unknown
): number | null => {
  // Handle null/undefined
  if (score === null || score === undefined) {
    return null;
  }

  // Handle empty string (Number("") returns 0, but should be invalid)
  if (score === "") {
    console.warn(
      `[ConfidenceScore] Invalid score: empty string. Must be between 0 and 1.`
    );
    return null;
  }

  // Convert to number
  const num = Number(score);

  // Validate range [0, 1]
  if (isNaN(num) || num < 0 || num > 1) {
    console.warn(
      `[ConfidenceScore] Invalid score: ${score}. Must be between 0 and 1.`
    );
    return null;
  }

  return num;
};

/**
 * Determine confidence level based on score
 *
 * @param score - The confidence score (0.0 - 1.0, null, or undefined)
 * @returns Confidence level (HIGH, MEDIUM, or LOW)
 *
 * @example
 * getConfidenceLevel(0.95) // returns "HIGH"
 * getConfidenceLevel(0.6) // returns "MEDIUM"
 * getConfidenceLevel(0.3) // returns "LOW"
 * getConfidenceLevel(null) // returns "LOW"
 */
export const getConfidenceLevel = (
  score: number | null | undefined
): ConfidenceLevel => {
  // Validate first
  const validScore = validateConfidenceScore(score);

  // Invalid scores default to LOW
  if (validScore === null) {
    return "LOW";
  }

  // Determine level based on thresholds
  if (validScore >= CONFIDENCE_THRESHOLDS.HIGH) {
    return "HIGH";
  }
  if (validScore >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return "MEDIUM";
  }
  return "LOW";
};

/**
 * Check if classification is uncertain (below threshold)
 *
 * @param score - The confidence score (0.0 - 1.0, null, or undefined)
 * @returns true if score is below UNCERTAIN_LABEL threshold or null
 *
 * @example
 * isUncertainClassification(0.95) // returns false
 * isUncertainClassification(0.5) // returns true
 * isUncertainClassification(null) // returns true
 */
export const isUncertainClassification = (
  score: number | null | undefined
): boolean => {
  const validScore = validateConfidenceScore(score);
  return validScore === null || validScore < CONFIDENCE_THRESHOLDS.UNCERTAIN_LABEL;
};
