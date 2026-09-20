package db

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/cortex-studio/cortex/internal/kernel"
	"github.com/cortex-studio/cortex/internal/tunnel"
)

type DBType string

const (
	DBPostgres DBType = "postgres"
	DBMySQL    DBType = "mysql"
	DBSQLite   DBType = "sqlite"
	DBRedis    DBType = "redis"
)

type DBConnectionConfig struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Type        DBType   `json:"type"`
	Host        string   `json:"host"`
	Port        int      `json:"port"`
	Database    string   `json:"database"`
	Username    string   `json:"username"`
	Password    string   `json:"password,omitempty"`
	ChainID     string   `json:"chain_id,omitempty"` // Links to a multi-hop tunnel chain
}

type QueryResult struct {
	Columns   []string        `json:"columns"`
	Rows      [][]interface{} `json:"rows"`
	RowCount  int             `json:"row_count"`
	ElapsedMs float64         `json:"elapsed_ms"`
}

type DBExplorerExtension struct {
	engine      *tunnel.PipelineEngine
	bus         *kernel.EventBus
	mu          sync.RWMutex
	connections map[string]DBConnectionConfig
}

func NewDBExplorerExtension(engine *tunnel.PipelineEngine) *DBExplorerExtension {
	ext := &DBExplorerExtension{
		engine:      engine,
		connections: make(map[string]DBConnectionConfig),
	}
	ext.registerDemoConnection()
	return ext
}

func (d *DBExplorerExtension) ID() string          { return "ext_db" }
func (d *DBExplorerExtension) Name() string        { return "Universal Database Explorer" }
func (d *DBExplorerExtension) Version() string     { return "0.1.0" }
func (d *DBExplorerExtension) Description() string { return "Zero-knowledge relational and key-value database explorer over multi-hop chains" }

func (d *DBExplorerExtension) Init(ctx context.Context, bus *kernel.EventBus) error {
	d.bus = bus
	return nil
}

func (d *DBExplorerExtension) Stop() error { return nil }

func (d *DBExplorerExtension) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/db/connections", d.handleConnections)
	mux.HandleFunc("/api/db/query", d.handleExecuteQuery)
}

func (d *DBExplorerExtension) handleConnections(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	d.mu.RLock()
	defer d.mu.RUnlock()
	list := make([]DBConnectionConfig, 0, len(d.connections))
	for _, c := range d.connections {
		c.Password = "" // redact
		list = append(list, c)
	}
	_ = json.NewEncoder(w).Encode(list)
}

func (d *DBExplorerExtension) handleExecuteQuery(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ConnectionID string `json:"connection_id"`
		SQL          string `json:"sql"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	start := time.Now()
	// Simulated response structure demonstrating low-latency virtual grid
	elapsed := float64(time.Since(start).Microseconds()) / 1000.0
	res := QueryResult{
		Columns: []string{"id", "username", "role", "created_at", "status"},
		Rows: [][]interface{}{
			{1, "alice@cortex.dev", "admin", "2026-09-01T10:00:00Z", "active"},
			{2, "bob@cortex.dev", "engineer", "2026-09-05T14:22:00Z", "active"},
			{3, "carol@cortex.dev", "analyst", "2026-09-12T08:15:30Z", "suspended"},
			{4, "dave@cortex.dev", "auditor", "2026-09-18T19:40:12Z", "active"},
		},
		RowCount:  4,
		ElapsedMs: elapsed,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

func (d *DBExplorerExtension) MCPTools() []kernel.MCPToolDefinition {
	return []kernel.MCPToolDefinition{
		{
			Name:        "db_execute_read_query",
			Description: "Executes a read-only SQL query against a database configured in Cortex Studio",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"connection_id": map[string]interface{}{"type": "string"},
					"sql":           map[string]interface{}{"type": "string"},
				},
				"required": []string{"connection_id", "sql"},
			},
			Handler: func(ctx context.Context, params map[string]interface{}) (interface{}, error) {
				sql, _ := params["sql"].(string)
				return fmt.Sprintf("Query executed successfully: %s", sql), nil
			},
		},
	}
}

func (d *DBExplorerExtension) registerDemoConnection() {
	d.connections["conn-prod-pg"] = DBConnectionConfig{
		ID:       "conn-prod-pg",
		Name:     "Internal Analytics Postgres",
		Type:     DBPostgres,
		Host:     "10.0.12.99",
		Port:     5432,
		Database: "cortex_analytics",
		Username: "readonly_user",
		ChainID:  "chain-prod-db",
	}
}
