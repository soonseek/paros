/**
 * Confidence Config Tests
 *
 * Story 4.2 Code Review - CRITICAL #1 Fix
 *
 * Tests for centralized confidence threshold configuration and validation:
 * - Configuration constants validation
 * - Confidence score validation (edge cases)
 * - Confidence level determination (boundary values)
 * - Uncertain classification detection
 *
 * @see https://vitest.dev/guide/
 */

import { describe, it, expect } from "vitest";
import {
  CONFIDENCE_THRESHOLDS,
  validateConfidenceScore,
  getConfidenceLevel,
  isUncertainClassification,
} from "./confidence-config";

describe("CONFIDENCE_THRESHOLDS", () => {
  it("[CRITICAL-1] has valid threshold values", () => {
    // Thresholds should be in ascending order
    expect(CONFIDENCE_THRESHOLDS.HIGH).toBeGreaterThan(
      CONFIDENCE_THRESHOLDS.MEDIUM
    );
    expect(CONFIDENCE_THRESHOLDS.MEDIUM).toBeGreaterThan(0);
    expect(CONFIDENCE_THRESHOLDS.UNCERTAIN_LABEL).toBeGreaterThan(0);
  });

  it("[CRITICAL-1] defaults to 0.7 for HIGH threshold", () => {
    expect(CONFIDENCE_THRESHOLDS.HIGH).toBe(0.7);
  });

  it("[CRITICAL-1] defaults to 0.5 for MEDIUM threshold", () => {
    expect(CONFIDENCE_THRESHOLDS.MEDIUM).toBe(0.5);
  });

  it("[CRITICAL-1] defaults to 0.7 for UNCERTAIN_LABEL threshold", () => {
    expect(CONFIDENCE_THRESHOLDS.UNCERTAIN_LABEL).toBe(0.7);
  });

  it("[CRITICAL-1] has HIGH >= UNCERTAIN_LABEL (allows same value)", () => {
    expect(CONFIDENCE_THRESHOLDS.HIGH).toBeGreaterThanOrEqual(
      CONFIDENCE_THRESHOLDS.UNCERTAIN_LABEL
    );
  });
});

describe("validateConfidenceScore", () => {
  describe("valid scores", () => {
    it("[CRITICAL-1] accepts 0.0", () => {
      expect(validateConfidenceScore(0.0)).toBe(0);
    });

    it("[CRITICAL-1] accepts 0.5", () => {
      expect(validateConfidenceScore(0.5)).toBe(0.5);
    });

    it("[CRITICAL-1] accepts 0.7", () => {
      expect(validateConfidenceScore(0.7)).toBe(0.7);
    });

    it("[CRITICAL-1] accepts 0.95", () => {
      expect(validateConfidenceScore(0.95)).toBe(0.95);
    });

    it("[CRITICAL-1] accepts 1.0", () => {
      expect(validateConfidenceScore(1.0)).toBe(1);
    });

    it("[CRITICAL-1] accepts string numbers", () => {
      expect(validateConfidenceScore("0.75")).toBe(0.75);
    });
  });

  describe("invalid scores", () => {
    it("[MEDIUM-6] rejects negative scores", () => {
      expect(validateConfidenceScore(-0.1)).toBeNull();
      expect(validateConfidenceScore(-1.0)).toBeNull();
    });

    it("[MEDIUM-6] rejects scores > 1.0", () => {
      expect(validateConfidenceScore(1.1)).toBeNull();
      expect(validateConfidenceScore(2.0)).toBeNull();
      expect(validateConfidenceScore(1.5)).toBeNull();
    });

    it("[MEDIUM-6] rejects NaN", () => {
      expect(validateConfidenceScore(NaN)).toBeNull();
    });

    it("[MEDIUM-6] rejects Infinity", () => {
      expect(validateConfidenceScore(Infinity)).toBeNull();
      expect(validateConfidenceScore(-Infinity)).toBeNull();
    });

    it("[MEDIUM-6] rejects non-numeric strings", () => {
      expect(validateConfidenceScore("abc")).toBeNull();
      expect(validateConfidenceScore("")).toBeNull();
      expect(validateConfidenceScore("NaN")).toBeNull();
    });

    it("[MEDIUM-6] rejects null", () => {
      expect(validateConfidenceScore(null)).toBeNull();
    });

    it("[MEDIUM-6] rejects undefined", () => {
      expect(validateConfidenceScore(undefined)).toBeNull();
    });
  });
});

describe("getConfidenceLevel", () => {
  describe("HIGH level (>= 0.7)", () => {
    it("[CRITICAL-1] returns HIGH for 0.7 (boundary)", () => {
      expect(getConfidenceLevel(0.7)).toBe("HIGH");
    });

    it("[CRITICAL-1] returns HIGH for 0.95", () => {
      expect(getConfidenceLevel(0.95)).toBe("HIGH");
    });

    it("[CRITICAL-1] returns HIGH for 1.0", () => {
      expect(getConfidenceLevel(1.0)).toBe("HIGH");
    });
  });

  describe("MEDIUM level (0.5 - 0.7)", () => {
    it("[CRITICAL-1] returns MEDIUM for 0.5 (boundary)", () => {
      expect(getConfidenceLevel(0.5)).toBe("MEDIUM");
    });

    it("[CRITICAL-1] returns MEDIUM for 0.6", () => {
      expect(getConfidenceLevel(0.6)).toBe("MEDIUM");
    });

    it("[CRITICAL-1] returns MEDIUM for 0.69", () => {
      expect(getConfidenceLevel(0.69)).toBe("MEDIUM");
    });
  });

  describe("LOW level (< 0.5)", () => {
    it("[CRITICAL-1] returns LOW for 0.49", () => {
      expect(getConfidenceLevel(0.49)).toBe("LOW");
    });

    it("[CRITICAL-1] returns LOW for 0.3", () => {
      expect(getConfidenceLevel(0.3)).toBe("LOW");
    });

    it("[CRITICAL-1] returns LOW for 0.0", () => {
      expect(getConfidenceLevel(0.0)).toBe("LOW");
    });
  });

  describe("invalid scores default to LOW", () => {
    it("[MEDIUM-6] returns LOW for null", () => {
      expect(getConfidenceLevel(null)).toBe("LOW");
    });

    it("[MEDIUM-6] returns LOW for undefined", () => {
      expect(getConfidenceLevel(undefined)).toBe("LOW");
    });
  });
});

describe("isUncertainClassification", () => {
  describe("certain classifications (>= 0.7)", () => {
    it("[CRITICAL-1] returns false for 0.7 (boundary)", () => {
      expect(isUncertainClassification(0.7)).toBe(false);
    });

    it("[CRITICAL-1] returns false for 0.95", () => {
      expect(isUncertainClassification(0.95)).toBe(false);
    });

    it("[CRITICAL-1] returns false for 1.0", () => {
      expect(isUncertainClassification(1.0)).toBe(false);
    });
  });

  describe("uncertain classifications (< 0.7)", () => {
    it("[CRITICAL-1] returns true for 0.69", () => {
      expect(isUncertainClassification(0.69)).toBe(true);
    });

    it("[CRITICAL-1] returns true for 0.5", () => {
      expect(isUncertainClassification(0.5)).toBe(true);
    });

    it("[CRITICAL-1] returns true for 0.3", () => {
      expect(isUncertainClassification(0.3)).toBe(true);
    });

    it("[CRITICAL-1] returns true for 0.0", () => {
      expect(isUncertainClassification(0.0)).toBe(true);
    });
  });

  describe("invalid scores are uncertain", () => {
    it("[MEDIUM-6] returns true for null", () => {
      expect(isUncertainClassification(null)).toBe(true);
    });

    it("[MEDIUM-6] returns true for undefined", () => {
      expect(isUncertainClassification(undefined)).toBe(true);
    });

    it("[MEDIUM-6] returns true for NaN", () => {
      expect(isUncertainClassification(NaN)).toBe(true);
    });

    it("[MEDIUM-6] returns true for negative scores", () => {
      expect(isUncertainClassification(-0.1)).toBe(true);
    });

    it("[MEDIUM-6] returns true for scores > 1.0", () => {
      expect(isUncertainClassification(1.5)).toBe(true);
    });
  });
});
