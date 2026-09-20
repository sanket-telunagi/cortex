package tunnel

import (
	"context"
	"sync"
	"time"
)

// TelemetryMonitor coordinates periodic latency checks across all active registered hops and chains.
type TelemetryMonitor struct {
	engine        *PipelineEngine
	interval      time.Duration
	mu            sync.RWMutex
	trackedHops   map[string]HopConfig
	trackedChains map[string][]HopConfig
	history       map[string][]HopMetric // ring buffer of last 50 metrics per hop
	subscribers   map[chan []HopMetric]struct{}
	ctx           context.Context
	cancel        context.CancelFunc
}

// NewTelemetryMonitor creates a new monitor.
func NewTelemetryMonitor(engine *PipelineEngine, interval time.Duration) *TelemetryMonitor {
	ctx, cancel := context.WithCancel(context.Background())
	return &TelemetryMonitor{
		engine:        engine,
		interval:      interval,
		trackedHops:   make(map[string]HopConfig),
		trackedChains: make(map[string][]HopConfig),
		history:       make(map[string][]HopMetric),
		subscribers:   make(map[chan []HopMetric]struct{}),
		ctx:           ctx,
		cancel:        cancel,
	}
}

// RegisterHop adds or updates a hop for continuous latency tracking.
func (tm *TelemetryMonitor) RegisterHop(hop HopConfig) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	tm.trackedHops[hop.ID] = hop
}

// TrackChain registers a full multi-hop chain for pipeline monitoring.
func (tm *TelemetryMonitor) TrackChain(chainID string, hops []HopConfig) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	tm.trackedChains[chainID] = hops
	for _, hop := range hops {
		tm.trackedHops[hop.ID] = hop
	}
}

// Subscribe opens a channel receiving real-time latency updates across all hops.
func (tm *TelemetryMonitor) Subscribe() chan []HopMetric {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	ch := make(chan []HopMetric, 100)
	tm.subscribers[ch] = struct{}{}
	return ch
}

// Unsubscribe releases a subscriber channel.
func (tm *TelemetryMonitor) Unsubscribe(ch chan []HopMetric) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	delete(tm.subscribers, ch)
	close(ch)
}

// GetHistory returns historical metrics for all monitored hops.
func (tm *TelemetryMonitor) GetHistory() map[string][]HopMetric {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	copied := make(map[string][]HopMetric)
	for k, v := range tm.history {
		cp := make([]HopMetric, len(v))
		copy(cp, v)
		copied[k] = cp
	}
	return copied
}

// Start initiates the background polling loop.
func (tm *TelemetryMonitor) Start() {
	go tm.pollLoop()
}

// Stop terminates the polling loop.
func (tm *TelemetryMonitor) Stop() {
	tm.cancel()
}

func (tm *TelemetryMonitor) pollLoop() {
	ticker := time.NewTicker(tm.interval)
	defer ticker.Stop()

	for {
		select {
		case <-tm.ctx.Done():
			return
		case <-ticker.C:
			tm.mu.RLock()
			hopsToPoll := make([]HopConfig, 0, len(tm.trackedHops))
			for _, h := range tm.trackedHops {
				hopsToPoll = append(hopsToPoll, h)
			}
			tm.mu.RUnlock()

			if len(hopsToPoll) == 0 {
				continue
			}

			// Measure hops in parallel
			var wg sync.WaitGroup
			results := make([]HopMetric, len(hopsToPoll))

			for i, hop := range hopsToPoll {
				wg.Add(1)
				go func(idx int, h HopConfig) {
					defer wg.Done()
					results[idx] = tm.engine.MeasureHopLatency(tm.ctx, h)
				}(i, hop)
			}
			wg.Wait()

			// Update history ring buffer (keep last 50 points)
			tm.mu.Lock()
			for _, metric := range results {
				buf := tm.history[metric.HopID]
				if len(buf) >= 50 {
					buf = buf[1:]
				}
				tm.history[metric.HopID] = append(buf, metric)
			}

			// Broadcast to subscribers
			for sub := range tm.subscribers {
				select {
				case sub <- results:
				default: // do not block if subscriber is slow
				}
			}
			tm.mu.Unlock()
		}
	}
}
