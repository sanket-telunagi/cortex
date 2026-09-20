package tunnel

import (
	"context"
	"net"
	"testing"
	"time"
)

func TestPipelineEngine_DirectDial(t *testing.T) {
	// Start a mock local listener
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to create listener: %v", err)
	}
	defer listener.Close()

	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			_ = conn.Close()
		}
	}()

	engine := NewPipelineEngine()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	conn, metric, err := engine.DialChain(ctx, "test-chain-1", nil, listener.Addr().String())
	if err != nil {
		t.Fatalf("unexpected direct dial error: %v", err)
	}
	defer conn.Close()

	if metric.TotalLatency <= 0 {
		t.Errorf("expected positive total latency, got %f", metric.TotalLatency)
	}
	if len(metric.Hops) != 1 {
		t.Errorf("expected 1 hop metric, got %d", len(metric.Hops))
	}
}

func TestTelemetryMonitor(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to start listener: %v", err)
	}
	defer listener.Close()

	tcpAddr := listener.Addr().(*net.TCPAddr)
	engine := NewPipelineEngine()
	monitor := NewTelemetryMonitor(engine, 100*time.Millisecond)

	monitor.RegisterHop(HopConfig{
		ID:   "local-hop",
		Name: "Local Test Hop",
		Type: HopTypeDirect,
		Host: tcpAddr.IP.String(),
		Port: tcpAddr.Port,
	})

	sub := monitor.Subscribe()
	defer monitor.Unsubscribe(sub)

	monitor.Start()
	defer monitor.Stop()

	select {
	case metrics := <-sub:
		if len(metrics) != 1 {
			t.Fatalf("expected 1 metric, got %d", len(metrics))
		}
		if metrics[0].Status != "online" {
			t.Errorf("expected status 'online', got %s", metrics[0].Status)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for telemetry metric")
	}
}
