/**
 * Metrics Module
 *
 * Lightweight metrics collection for Cloudflare Workers.
 * Stores counters in-memory with periodic flush to KV.
 *
 * Features:
 * - Request counters by endpoint and status
 * - Latency histograms
 * - Error tracking
 * - Mining stats
 * - Prometheus-compatible output
 */

// =============================================================================
// TYPES
// =============================================================================

export interface MetricCounter {
  value: number;
  labels: Record<string, string>;
}

export interface MetricHistogram {
  count: number;
  sum: number;
  buckets: Record<string, number>; // "le_X" -> count
}

export interface MetricsSnapshot {
  timestamp: number;
  counters: Record<string, MetricCounter>;
  histograms: Record<string, MetricHistogram>;
}

// =============================================================================
// HISTOGRAM BUCKETS (latency in ms)
// =============================================================================

const LATENCY_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

// =============================================================================
// METRICS COLLECTOR
// =============================================================================

class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, MetricHistogram> = new Map();
  private startTime: number = Date.now();

  /**
   * Increment a counter
   */
  inc(
    name: string,
    labels: Record<string, string> = {},
    value: number = 1,
  ): void {
    const key = this.makeKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  /**
   * Observe a value in a histogram (for latency tracking)
   */
  observe(
    name: string,
    value: number,
    labels: Record<string, string> = {},
  ): void {
    const key = this.makeKey(name, labels);
    let histogram = this.histograms.get(key);

    if (!histogram) {
      histogram = {
        count: 0,
        sum: 0,
        buckets: {},
      };
      // Initialize buckets
      for (const bucket of LATENCY_BUCKETS) {
        histogram.buckets[`le_${bucket}`] = 0;
      }
      histogram.buckets["le_+Inf"] = 0;
      this.histograms.set(key, histogram);
    }

    histogram.count++;
    histogram.sum += value;

    // Update buckets
    for (const bucket of LATENCY_BUCKETS) {
      if (value <= bucket) {
        histogram.buckets[`le_${bucket}`]++;
      }
    }
    histogram.buckets["le_+Inf"]++;
  }

  /**
   * Get current metrics snapshot
   */
  snapshot(): MetricsSnapshot {
    const counters: Record<string, MetricCounter> = {};
    const histograms: Record<string, MetricHistogram> = {};

    for (const [key, value] of this.counters) {
      const { labels } = this.parseKey(key);
      counters[key] = { value, labels };
    }

    for (const [key, histogram] of this.histograms) {
      histograms[key] = { ...histogram };
    }

    return {
      timestamp: Date.now(),
      counters,
      histograms,
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  toPrometheus(): string {
    const lines: string[] = [];
    const now = Date.now();

    // Uptime
    lines.push("# HELP worker_uptime_seconds Worker uptime in seconds");
    lines.push("# TYPE worker_uptime_seconds gauge");
    lines.push(`worker_uptime_seconds ${(now - this.startTime) / 1000}`);
    lines.push("");

    // Counters
    const counterGroups = new Map<string, string[]>();
    for (const [key, value] of this.counters) {
      const { name, labels } = this.parseKey(key);
      if (!counterGroups.has(name)) {
        counterGroups.set(name, []);
      }
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
      counterGroups.get(name)!.push(`${name}{${labelStr}} ${value}`);
    }

    for (const [name, values] of counterGroups) {
      lines.push(`# HELP ${name} Counter metric`);
      lines.push(`# TYPE ${name} counter`);
      lines.push(...values);
      lines.push("");
    }

    // Histograms
    for (const [key, histogram] of this.histograms) {
      const { name, labels } = this.parseKey(key);
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
      const labelPrefix = labelStr ? `${labelStr},` : "";

      lines.push(`# HELP ${name} Histogram metric`);
      lines.push(`# TYPE ${name} histogram`);

      for (const [bucket, count] of Object.entries(histogram.buckets)) {
        const le = bucket.replace("le_", "");
        lines.push(`${name}_bucket{${labelPrefix}le="${le}"} ${count}`);
      }
      lines.push(`${name}_sum{${labelStr}} ${histogram.sum}`);
      lines.push(`${name}_count{${labelStr}} ${histogram.count}`);
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Get summary stats (for JSON endpoint)
   */
  summary(): Record<string, unknown> {
    const snapshot = this.snapshot();

    // Aggregate by metric name
    const requestsByEndpoint: Record<string, number> = {};
    const requestsByStatus: Record<string, number> = {};
    let totalRequests = 0;
    let totalErrors = 0;

    for (const [key, counter] of Object.entries(snapshot.counters)) {
      const { name, labels } = this.parseKey(key);

      if (name === "http_requests_total") {
        totalRequests += counter.value;
        const endpoint = labels.endpoint || "unknown";
        const status = labels.status || "unknown";

        requestsByEndpoint[endpoint] =
          (requestsByEndpoint[endpoint] || 0) + counter.value;
        requestsByStatus[status] =
          (requestsByStatus[status] || 0) + counter.value;

        if (status.startsWith("5") || status === "error") {
          totalErrors += counter.value;
        }
      }
    }

    // Calculate average latency
    let avgLatency = 0;
    let latencyP50 = 0;
    let latencyP99 = 0;

    for (const [, histogram] of Object.entries(snapshot.histograms)) {
      if (histogram.count > 0) {
        avgLatency = histogram.sum / histogram.count;
        // Rough P50/P99 estimation from buckets
        const p50Target = histogram.count * 0.5;
        const p99Target = histogram.count * 0.99;

        for (const bucket of LATENCY_BUCKETS) {
          const bucketCount = histogram.buckets[`le_${bucket}`];
          if (bucketCount >= p50Target && latencyP50 === 0) {
            latencyP50 = bucket;
          }
          if (bucketCount >= p99Target && latencyP99 === 0) {
            latencyP99 = bucket;
          }
        }
      }
    }

    return {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      requests: {
        total: totalRequests,
        byEndpoint: requestsByEndpoint,
        byStatus: requestsByStatus,
        errorRate:
          totalRequests > 0
            ? ((totalErrors / totalRequests) * 100).toFixed(2) + "%"
            : "0%",
      },
      latency: {
        avg: Math.round(avgLatency),
        p50: latencyP50,
        p99: latencyP99,
      },
      mining: {
        proofsSubmitted:
          this.counters.get(this.makeKey("mining_proofs_total", {})) || 0,
        proofsAccepted:
          this.counters.get(this.makeKey("mining_proofs_accepted", {})) || 0,
        proofsRejected:
          this.counters.get(this.makeKey("mining_proofs_rejected", {})) || 0,
      },
      claims: {
        prepared:
          this.counters.get(this.makeKey("claims_prepared_total", {})) || 0,
        completed:
          this.counters.get(this.makeKey("claims_completed_total", {})) || 0,
        failed: this.counters.get(this.makeKey("claims_failed_total", {})) || 0,
      },
      cache: {
        hits: this.counters.get(this.makeKey("cache_hits_total", {})) || 0,
        misses: this.counters.get(this.makeKey("cache_misses_total", {})) || 0,
      },
      rateLimit: {
        triggered:
          this.counters.get(this.makeKey("rate_limit_triggered_total", {})) ||
          0,
      },
    };
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.startTime = Date.now();
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private makeKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  private parseKey(key: string): {
    name: string;
    labels: Record<string, string>;
  } {
    const match = key.match(/^([^{]+)(?:\{(.+)\})?$/);
    if (!match) return { name: key, labels: {} };

    const name = match[1];
    const labels: Record<string, string> = {};

    if (match[2]) {
      for (const pair of match[2].split(",")) {
        const [k, v] = pair.split("=");
        if (k && v) labels[k] = v;
      }
    }

    return { name, labels };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const metrics = new MetricsCollector();

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Record HTTP request metric
 */
export function recordRequest(
  endpoint: string,
  method: string,
  status: number,
  durationMs: number,
): void {
  const statusGroup = `${Math.floor(status / 100)}xx`;

  metrics.inc("http_requests_total", {
    endpoint,
    method,
    status: statusGroup,
  });

  metrics.observe("http_request_duration_ms", durationMs, {
    endpoint,
    method,
  });
}

/**
 * Record mining proof submission
 */
export function recordMiningProof(
  accepted: boolean,
  rejectReason?: string,
): void {
  metrics.inc("mining_proofs_total", {});

  if (accepted) {
    metrics.inc("mining_proofs_accepted", {});
  } else {
    metrics.inc("mining_proofs_rejected", {
      reason: rejectReason || "unknown",
    });
  }
}

/**
 * Record claim operation
 */
export function recordClaim(status: "prepared" | "completed" | "failed"): void {
  metrics.inc(`claims_${status}_total`, {});
}

/**
 * Record cache hit/miss
 */
export function recordCache(hit: boolean, type: string): void {
  if (hit) {
    metrics.inc("cache_hits_total", { type });
  } else {
    metrics.inc("cache_misses_total", { type });
  }
}

/**
 * Record rate limit trigger
 */
export function recordRateLimit(endpoint: string): void {
  metrics.inc("rate_limit_triggered_total", { endpoint });
}
