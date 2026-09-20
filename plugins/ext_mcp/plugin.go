package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/cortex-studio/cortex/internal/kernel"
)

// MCPExtension acts as the bridge exposing all tools from all active extensions to AI coding agents.
type MCPExtension struct {
	registry *kernel.Registry
}

func NewMCPExtension(registry *kernel.Registry) *MCPExtension {
	return &MCPExtension{registry: registry}
}

func (m *MCPExtension) ID() string          { return "ext_mcp" }
func (m *MCPExtension) Name() string        { return "Model Context Protocol Gateway" }
func (m *MCPExtension) Version() string     { return "0.1.0" }
func (m *MCPExtension) Description() string { return "Exposes infrastructure tools, databases, and tunnels to AI coding agents via MCP" }

func (m *MCPExtension) Init(ctx context.Context, bus *kernel.EventBus) error { return nil }
func (m *MCPExtension) Stop() error                                          { return nil }

func (m *MCPExtension) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/mcp/tools", m.handleListTools)
	mux.HandleFunc("/api/mcp/call", m.handleCallTool)
}

func (m *MCPExtension) handleListTools(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var allTools []kernel.MCPToolDefinition
	for _, ext := range m.registry.All() {
		allTools = append(allTools, ext.MCPTools()...)
	}
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"tools": allTools})
}

func (m *MCPExtension) handleCallTool(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Name      string                 `json:"name"`
		Arguments map[string]interface{} `json:"arguments"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	for _, ext := range m.registry.All() {
		for _, tool := range ext.MCPTools() {
			if tool.Name == req.Name {
				result, err := tool.Handler(r.Context(), req.Arguments)
				w.Header().Set("Content-Type", "application/json")
				if err != nil {
					_ = json.NewEncoder(w).Encode(map[string]interface{}{"isError": true, "error": err.Error()})
					return
				}
				_ = json.NewEncoder(w).Encode(map[string]interface{}{"content": []map[string]interface{}{{"type": "text", "text": fmt.Sprintf("%v", result)}}})
				return
			}
		}
	}

	http.Error(w, fmt.Sprintf("tool '%s' not found", req.Name), http.StatusNotFound)
}

func (m *MCPExtension) MCPTools() []kernel.MCPToolDefinition {
	return nil // Meta-provider
}
