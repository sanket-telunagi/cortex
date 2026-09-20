package plugin

import (
	"context"
	"net/http"
)

// Extension defines the core contract for any Cortex Studio extension.
type Extension interface {
	ID() string
	Name() string
	Version() string
	Description() string
	RegisterRoutes(mux *http.ServeMux)
	Stop() error
}

// MCPTool defines an AI-callable tool definition.
type MCPTool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"inputSchema"`
	Handler     func(ctx context.Context, params map[string]interface{}) (interface{}, error)
}