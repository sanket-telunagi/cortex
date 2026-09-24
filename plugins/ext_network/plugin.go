package network

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/cortex-studio/cortex/internal/kernel"
	"github.com/cortex-studio/cortex/internal/tunnel"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // Accessible across CORS
}

// ChainDefinition represents a user-configured multi-hop routing pipeline.
type ChainDefinition struct {
	ID          string             `json:"id"`
	Name        string             `json:"name"`
	Description string             `json:"description"`
	Hops        []tunnel.HopConfig `json:"hops"`
	TargetAddr  string             `json:"target_addr"`
}

// ActiveSession represents an open proxy or bastion forwarding session.
type ActiveSession struct {
	SessionID   string    `json:"session_id"`
	ChainID     string    `json:"chain_id"`
	TargetAddr  string    `json:"target_addr"`
	ConnectedAt time.Time `json:"connected_at"`
	BytesTx     int64     `json:"bytes_tx"`
	BytesRx     int64     `json:"bytes_rx"`
	LatencyMs   float64   `json:"latency_ms"`
	Status      string    `json:"status"`
}

// NetworkExtension manages SSH connections, proxies, multi-hop chains, and live telemetry streaming.
type NetworkExtension struct {
	engine   *tunnel.PipelineEngine
	monitor  *tunnel.TelemetryMonitor
	bus      *kernel.EventBus
	mu       sync.RWMutex
	chains   map[string]ChainDefinition
	hops     map[string]tunnel.HopConfig
	sessions map[string]*ActiveSession
}

func NewNetworkExtension(engine *tunnel.PipelineEngine, monitor *tunnel.TelemetryMonitor) *NetworkExtension {
	return &NetworkExtension{
		engine:   engine,
		monitor:  monitor,
		chains:   make(map[string]ChainDefinition),
		hops:     make(map[string]tunnel.HopConfig),
		sessions: make(map[string]*ActiveSession),
	}
}

func (n *NetworkExtension) ID() string      { return "ext_network" }
func (n *NetworkExtension) Name() string    { return "Universal Network & Chaining Hub" }
func (n *NetworkExtension) Version() string { return "0.2.0" }
func (n *NetworkExtension) Description() string {
	return "Multi-hop SSH and Proxy tunnel engine with per-hop latency telemetry"
}

func (n *NetworkExtension) Init(ctx context.Context, bus *kernel.EventBus) error {
	n.bus = bus
	n.monitor.Start()
	return nil
}

func (n *NetworkExtension) Stop() error {
	n.monitor.Stop()
	return nil
}

func (n *NetworkExtension) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/network/hops", n.handleHops)
	mux.HandleFunc("/api/network/hops/probe", n.handleProbeHop)
	mux.HandleFunc("/api/network/chains", n.handleChains)
	mux.HandleFunc("/api/network/test-chain", n.handleTestChain)
	mux.HandleFunc("/api/network/tunnels/sessions", n.handleTunnelSessions)
	mux.HandleFunc("/api/network/telemetry/ws", n.handleTelemetryWS)
}

func (n *NetworkExtension) handleHops(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == http.MethodGet {
		n.mu.RLock()
		defer n.mu.RUnlock()
		list := make([]tunnel.HopConfig, 0, len(n.hops))
		for _, h := range n.hops {
			// Redact credentials in response
			h.Auth.Password = ""
			h.Auth.PrivateKeyPEM = ""
			list = append(list, h)
		}
		_ = json.NewEncoder(w).Encode(list)
		return
	}

	if r.Method == http.MethodPost {
		var hop tunnel.HopConfig
		if err := json.NewDecoder(r.Body).Decode(&hop); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		n.mu.Lock()
		n.hops[hop.ID] = hop
		n.monitor.RegisterHop(hop)
		n.mu.Unlock()
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "registered", "id": hop.ID})
		return
	}

	if r.Method == http.MethodDelete {
		var req struct {
			ID string `json:"id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		n.mu.Lock()
		delete(n.hops, req.ID)
		n.mu.Unlock()
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "deleted", "id": req.ID})
		return
	}

	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func (n *NetworkExtension) handleProbeHop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		HopID string `json:"hop_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	n.mu.RLock()
	hop, exists := n.hops[req.HopID]
	n.mu.RUnlock()
	if !exists {
		http.Error(w, "hop not found", http.StatusNotFound)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	metric := n.engine.MeasureHopLatency(ctx, hop)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(metric)
}

func (n *NetworkExtension) handleChains(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == http.MethodGet {
		n.mu.RLock()
		defer n.mu.RUnlock()
		list := make([]ChainDefinition, 0, len(n.chains))
		for _, c := range n.chains {
			list = append(list, c)
		}
		_ = json.NewEncoder(w).Encode(list)
		return
	}

	if r.Method == http.MethodPost {
		var chain ChainDefinition
		if err := json.NewDecoder(r.Body).Decode(&chain); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		n.mu.Lock()
		n.chains[chain.ID] = chain
		n.monitor.TrackChain(chain.ID, chain.Hops)
		n.mu.Unlock()
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "saved", "id": chain.ID})
		return
	}

	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func (n *NetworkExtension) handleTestChain(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Hops       []tunnel.HopConfig `json:"hops"`
		TargetAddr string             `json:"target_addr"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	conn, metric, err := n.engine.DialChain(ctx, "ad-hoc-test", req.Hops, req.TargetAddr)
	if conn != nil {
		_ = conn.Close()
	}

	w.Header().Set("Content-Type", "application/json")
	resp := map[string]interface{}{
		"success": err == nil,
		"metric":  metric,
	}
	if err != nil {
		resp["error"] = err.Error()
	}
	_ = json.NewEncoder(w).Encode(resp)
}

func (n *NetworkExtension) handleTunnelSessions(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	n.mu.RLock()
	defer n.mu.RUnlock()

	sessionsList := make([]*ActiveSession, 0, len(n.sessions))
	for _, s := range n.sessions {
		sessionsList = append(sessionsList, s)
	}
	_ = json.NewEncoder(w).Encode(sessionsList)
}

func (n *NetworkExtension) handleTelemetryWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	// Send historical snapshot first
	history := n.monitor.GetHistory()
	_ = conn.WriteJSON(map[string]interface{}{
		"type":    "snapshot",
		"history": history,
	})

	sub := n.monitor.Subscribe()
	defer n.monitor.Unsubscribe(sub)

	done := make(chan struct{})
	go func() {
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				close(done)
				return
			}
		}
	}()

	for {
		select {
		case <-done:
			return
		case metrics, ok := <-sub:
			if !ok {
				return
			}
			if err := conn.WriteJSON(map[string]interface{}{
				"type":    "telemetry_tick",
				"metrics": metrics,
			}); err != nil {
				return
			}
		}
	}
}

func (n *NetworkExtension) MCPTools() []kernel.MCPToolDefinition {
	return []kernel.MCPToolDefinition{
		{
			Name:        "network_list_chains",
			Description: "Lists all configured multi-hop SSH and Proxy connection chains with current latency metrics",
			InputSchema: map[string]interface{}{
				"type": "object",
			},
			Handler: func(ctx context.Context, params map[string]interface{}) (interface{}, error) {
				n.mu.RLock()
				defer n.mu.RUnlock()
				return n.chains, nil
			},
		},
		{
			Name:        "network_test_hop_latency",
			Description: "Measures instantaneous round-trip latency to a specific proxy or SSH bastion node",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"hop_id": map[string]interface{}{"type": "string"},
				},
				"required": []string{"hop_id"},
			},
			Handler: func(ctx context.Context, params map[string]interface{}) (interface{}, error) {
				hopID, _ := params["hop_id"].(string)
				n.mu.RLock()
				hop, exists := n.hops[hopID]
				n.mu.RUnlock()
				if !exists {
					return nil, http.ErrMissingFile
				}
				metric := n.engine.MeasureHopLatency(ctx, hop)
				return metric, nil
			},
		},
	}
}
