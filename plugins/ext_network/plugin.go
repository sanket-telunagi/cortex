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

// NetworkExtension manages SSH connections, proxies, multi-hop chains, and live telemetry streaming.
type NetworkExtension struct {
	engine   *tunnel.PipelineEngine
	monitor  *tunnel.TelemetryMonitor
	bus      *kernel.EventBus
	mu       sync.RWMutex
	chains   map[string]ChainDefinition
	hops     map[string]tunnel.HopConfig
}

func NewNetworkExtension(engine *tunnel.PipelineEngine, monitor *tunnel.TelemetryMonitor) *NetworkExtension {
	ext := &NetworkExtension{
		engine:  engine,
		monitor: monitor,
		chains:  make(map[string]ChainDefinition),
		hops:    make(map[string]tunnel.HopConfig),
	}

	// Pre-populate with realistic starter demo nodes
	ext.registerDefaultHops()
	return ext
}

func (n *NetworkExtension) ID() string          { return "ext_network" }
func (n *NetworkExtension) Name() string        { return "Universal Network & Chaining Hub" }
func (n *NetworkExtension) Version() string     { return "0.1.0" }
func (n *NetworkExtension) Description() string { return "Multi-hop SSH and Proxy tunnel engine with per-hop latency telemetry" }

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
	mux.HandleFunc("/api/network/chains", n.handleChains)
	mux.HandleFunc("/api/network/test-chain", n.handleTestChain)
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

	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
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

func (n *NetworkExtension) registerDefaultHops() {
	defaultHops := []tunnel.HopConfig{
		{
			ID:   "hop-edge-proxy",
			Name: "Cloudflare/Edge SOCKS5 Proxy",
			Type: tunnel.HopTypeSOCKS5,
			Host: "1.1.1.1",
			Port: 1080,
		},
		{
			ID:   "hop-aws-bastion",
			Name: "AWS VPC Bastion (us-east-1)",
			Type: tunnel.HopTypeSSH,
			Host: "10.0.1.50",
			Port: 22,
			Auth: tunnel.HopAuth{Username: "ec2-user"},
		},
		{
			ID:   "hop-k8s-jump",
			Name: "Internal K8s Jump Host (eu-central)",
			Type: tunnel.HopTypeSSH,
			Host: "192.168.1.100",
			Port: 2222,
			Auth: tunnel.HopAuth{Username: "devops"},
		},
		{
			ID:   "hop-db-direct",
			Name: "Core Production Database (RDS Postgres)",
			Type: tunnel.HopTypeDirect,
			Host: "10.0.12.99",
			Port: 5432,
		},
	}

	for _, h := range defaultHops {
		n.hops[h.ID] = h
		n.monitor.RegisterHop(h)
	}

	n.chains["chain-prod-db"] = ChainDefinition{
		ID:          "chain-prod-db",
		Name:        "Production RDS Access Pipeline",
		Description: "Multi-hop chain traversing edge SOCKS5 proxy into AWS bastion into internal RDS Postgres",
		Hops:        []tunnel.HopConfig{defaultHops[0], defaultHops[1]},
		TargetAddr:  "10.0.12.99:5432",
	}
	n.monitor.TrackChain("chain-prod-db", n.chains["chain-prod-db"].Hops)
}
