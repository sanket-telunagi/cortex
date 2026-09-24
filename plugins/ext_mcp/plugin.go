package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/cortex-studio/cortex/internal/auth"
	"github.com/cortex-studio/cortex/internal/kernel"
)

// MCPExtension acts as the bridge exposing all tools from all active extensions to AI coding agents with RBAC scoping.
type MCPExtension struct {
	registry    *kernel.Registry
	authService *auth.AuthService
}

func NewMCPExtension(registry *kernel.Registry, authService *auth.AuthService) *MCPExtension {
	return &MCPExtension{
		registry:    registry,
		authService: authService,
	}
}

func (m *MCPExtension) ID() string          { return "ext_mcp" }
func (m *MCPExtension) Name() string        { return "Model Context Protocol Gateway" }
func (m *MCPExtension) Version() string     { return "0.2.0" }
func (m *MCPExtension) Description() string { return "Exposes infrastructure tools, databases, and tunnels to AI coding agents via MCP with RBAC tool governance" }

func (m *MCPExtension) Init(ctx context.Context, bus *kernel.EventBus) error { return nil }
func (m *MCPExtension) Stop() error                                          { return nil }

func (m *MCPExtension) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/mcp/tools", m.handleListTools)
	mux.HandleFunc("/api/mcp/call", m.handleCallTool)
}

func isToolAllowed(toolName string, allowedTools []string) bool {
	if len(allowedTools) == 0 {
		return false
	}
	for _, a := range allowedTools {
		if a == "*" || strings.EqualFold(a, toolName) {
			return true
		}
	}
	return false
}

func (m *MCPExtension) handleListTools(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Collect all registered tools across extensions
	var allTools []kernel.MCPToolDefinition
	for _, ext := range m.registry.All() {
		allTools = append(allTools, ext.MCPTools()...)
	}

	// If token provided, filter by RBAC and AllowedTools
	token := auth.ExtractBearerToken(r)
	if token != "" && m.authService != nil {
		session, err := m.authService.ValidateSession(token)
		if err == nil && session != nil {
			var filtered []kernel.MCPToolDefinition
			for _, t := range allTools {
				if isToolAllowed(t.Name, session.AllowedTools) {
					filtered = append(filtered, t)
				}
			}
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"tools": filtered,
				"caller": map[string]interface{}{
					"role":          session.Role,
					"allowed_tools": session.AllowedTools,
				},
			})
			return
		}
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{"tools": allTools})
}

func (m *MCPExtension) handleCallTool(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Name      string                 `json:"name"`
		Arguments map[string]interface{} `json:"arguments"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"isError": true, "error": "malformed request payload"})
		return
	}

	// RBAC Validation
	token := auth.ExtractBearerToken(r)
	if token != "" && m.authService != nil {
		session, err := m.authService.ValidateSession(token)
		if err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"isError": true, "error": "unauthorized: " + err.Error()})
			return
		}

		if !auth.HasPermission(session.Role, auth.PermMCPExecute) {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"isError": true,
				"error":   fmt.Sprintf("role '%s' is not authorized to execute MCP tools", session.Role),
			})
			return
		}

		if !isToolAllowed(req.Name, session.AllowedTools) {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"isError": true,
				"error":   fmt.Sprintf("tool '%s' is not in the allowed access list for this token", req.Name),
			})
			return
		}
	}

	for _, ext := range m.registry.All() {
		for _, tool := range ext.MCPTools() {
			if tool.Name == req.Name {
				result, err := tool.Handler(r.Context(), req.Arguments)
				if err != nil {
					_ = json.NewEncoder(w).Encode(map[string]interface{}{"isError": true, "error": err.Error()})
					return
				}
				_ = json.NewEncoder(w).Encode(map[string]interface{}{
					"content": []map[string]interface{}{
						{"type": "text", "text": fmt.Sprintf("%v", result)},
					},
				})
				return
			}
		}
	}

	w.WriteHeader(http.StatusNotFound)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"isError": true, "error": fmt.Sprintf("tool '%s' not found", req.Name)})
}

func (m *MCPExtension) MCPTools() []kernel.MCPToolDefinition {
	return nil // Meta-provider
}
