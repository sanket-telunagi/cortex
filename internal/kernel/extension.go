package kernel

import (
	"context"
	"net/http"
	"sync"
)

// Extension defines the standard interface for any modular Cortex plugin.
type Extension interface {
	ID() string
	Name() string
	Version() string
	Description() string
	Init(ctx context.Context, bus *EventBus) error
	RegisterRoutes(mux *http.ServeMux)
	MCPTools() []MCPToolDefinition
	Stop() error
}

// MCPToolDefinition specifies an AI tool exposed to external LLMs.
type MCPToolDefinition struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"inputSchema"`
	Handler     func(ctx context.Context, params map[string]interface{}) (interface{}, error)
}

// EventBus provides publish-subscribe messaging between decoupled extensions.
type EventBus struct {
	mu          sync.RWMutex
	subscribers map[string][]chan interface{}
}

func NewEventBus() *EventBus {
	return &EventBus{
		subscribers: make(map[string][]chan interface{}),
	}
}

func (b *EventBus) Subscribe(topic string) <-chan interface{} {
	b.mu.Lock()
	defer b.mu.Unlock()
	ch := make(chan interface{}, 50)
	b.subscribers[topic] = append(b.subscribers[topic], ch)
	return ch
}

func (b *EventBus) Publish(topic string, payload interface{}) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for _, ch := range b.subscribers[topic] {
		select {
		case ch <- payload:
		default:
		}
	}
}

// Registry manages the lifecycle of all active extensions.
type Registry struct {
	mu         sync.RWMutex
	extensions map[string]Extension
	bus        *EventBus
}

func NewRegistry(bus *EventBus) *Registry {
	return &Registry{
		extensions: make(map[string]Extension),
		bus:        bus,
	}
}

func (r *Registry) Register(ext Extension) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if err := ext.Init(context.Background(), r.bus); err != nil {
		return err
	}
	r.extensions[ext.ID()] = ext
	return nil
}

func (r *Registry) Get(id string) (Extension, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	ext, exists := r.extensions[id]
	return ext, exists
}

func (r *Registry) All() []Extension {
	r.mu.RLock()
	defer r.mu.RUnlock()
	list := make([]Extension, 0, len(r.extensions))
	for _, ext := range r.extensions {
		list = append(list, ext)
	}
	return list
}

func (r *Registry) RegisterAllRoutes(mux *http.ServeMux) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, ext := range r.extensions {
		ext.RegisterRoutes(mux)
	}
}
