package tunnel

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"
	"golang.org/x/net/proxy"
)

// HopType denotes the protocol of an individual node in a chain.
type HopType string

const (
	HopTypeDirect HopType = "direct"
	HopTypeHTTP   HopType = "http_proxy"
	HopTypeSOCKS5 HopType = "socks5_proxy"
	HopTypeSSH    HopType = "ssh_bastion"
)

// HopAuth defines credentials for authenticating with a proxy or SSH bastion.
type HopAuth struct {
	Username       string `json:"username,omitempty"`
	Password       string `json:"password,omitempty"`
	PrivateKeyPEM  string `json:"private_key_pem,omitempty"`
	Passphrase     string `json:"passphrase,omitempty"`
	SkipHostVerify bool   `json:"skip_host_verify,omitempty"`
}

// HopConfig defines a single node inside a multi-hop pipeline.
type HopConfig struct {
	ID      string  `json:"id"`
	Name    string  `json:"name"`
	Type    HopType `json:"type"`
	Host    string  `json:"host"`
	Port    int     `json:"port"`
	Auth    HopAuth `json:"auth,omitempty"`
	Timeout time.Duration `json:"timeout_ms,omitempty"`
}

// Addr returns the host:port string.
func (h *HopConfig) Addr() string {
	return fmt.Sprintf("%s:%d", h.Host, h.Port)
}

// HopMetric records the latency and health of a specific hop in real-time.
type HopMetric struct {
	HopID       string    `json:"hop_id"`
	HopName     string    `json:"hop_name"`
	HopType     HopType   `json:"hop_type"`
	TargetAddr  string    `json:"target_addr"`
	LatencyMs   float64   `json:"latency_ms"`
	Timestamp   time.Time `json:"timestamp"`
	Status      string    `json:"status"` // "online", "degraded", "offline"
	Error       string    `json:"error,omitempty"`
}

// ChainMetric records the end-to-end telemetry across all hops in a pipeline.
type ChainMetric struct {
	ChainID      string      `json:"chain_id"`
	TotalLatency float64     `json:"total_latency_ms"`
	Timestamp    time.Time   `json:"timestamp"`
	Hops         []HopMetric `json:"hops"`
}

// PipelineEngine handles dialing across multi-hop proxy/SSH chains and continuous latency monitoring.
type PipelineEngine struct {
	mu           sync.RWMutex
	sshPool      map[string]*ssh.Client
	telemetrySub map[chan ChainMetric]struct{}
}

// NewPipelineEngine creates a new pipeline engine.
func NewPipelineEngine() *PipelineEngine {
	return &PipelineEngine{
		sshPool:      make(map[string]*ssh.Client),
		telemetrySub: make(map[chan ChainMetric]struct{}),
	}
}

// DialChain dials through a sequential slice of hops, ending at targetAddr.
// If hops is empty, it dials targetAddr directly.
func (p *PipelineEngine) DialChain(ctx context.Context, chainID string, hops []HopConfig, targetAddr string) (net.Conn, *ChainMetric, error) {
	startTime := time.Now()
	chainMetric := &ChainMetric{
		ChainID:   chainID,
		Timestamp: startTime,
		Hops:      make([]HopMetric, 0, len(hops)+1),
	}

	if len(hops) == 0 {
		hopStart := time.Now()
		var d net.Dialer
		conn, err := d.DialContext(ctx, "tcp", targetAddr)
		lat := float64(time.Since(hopStart).Microseconds()) / 1000.0
		status := "online"
		errMsg := ""
		if err != nil {
			status = "offline"
			errMsg = err.Error()
		}
		chainMetric.Hops = append(chainMetric.Hops, HopMetric{
			HopID:      "direct-target",
			HopName:    "Direct Target",
			HopType:    HopTypeDirect,
			TargetAddr: targetAddr,
			LatencyMs:  lat,
			Timestamp:  time.Now(),
			Status:     status,
			Error:      errMsg,
		})
		chainMetric.TotalLatency = lat
		return conn, chainMetric, err
	}

	// Active connection or SSH client bridging to the next hop
	var currentConn net.Conn
	var currentSSH *ssh.Client

	cleanupOnError := func() {
		if currentConn != nil {
			_ = currentConn.Close()
		}
		if currentSSH != nil {
			_ = currentSSH.Close()
		}
	}

	for i, hop := range hops {
		hopStart := time.Now()
		nextTarget := hop.Addr()

		var err error
		var nextConn net.Conn
		var nextSSH *ssh.Client

		switch hop.Type {
		case HopTypeDirect:
			var d net.Dialer
			nextConn, err = d.DialContext(ctx, "tcp", nextTarget)

		case HopTypeHTTP:
			nextConn, err = p.dialHTTPProxy(ctx, currentConn, currentSSH, hop)

		case HopTypeSOCKS5:
			nextConn, err = p.dialSOCKS5Proxy(ctx, currentConn, currentSSH, hop)

		case HopTypeSSH:
			nextSSH, nextConn, err = p.dialSSHBastion(ctx, currentConn, currentSSH, hop)

		default:
			err = fmt.Errorf("unsupported hop type: %s", hop.Type)
		}

		hopLatency := float64(time.Since(hopStart).Microseconds()) / 1000.0
		status := "online"
		errMsg := ""
		if err != nil {
			status = "offline"
			errMsg = err.Error()
		}

		chainMetric.Hops = append(chainMetric.Hops, HopMetric{
			HopID:      hop.ID,
			HopName:    hop.Name,
			HopType:    hop.Type,
			TargetAddr: nextTarget,
			LatencyMs:  hopLatency,
			Timestamp:  time.Now(),
			Status:     status,
			Error:      errMsg,
		})

		if err != nil {
			cleanupOnError()
			chainMetric.TotalLatency = float64(time.Since(startTime).Microseconds()) / 1000.0
			return nil, chainMetric, fmt.Errorf("chain failed at hop %d (%s): %w", i+1, hop.Name, err)
		}

		// Advance state
		if currentConn != nil && hop.Type != HopTypeSSH {
			// Older intermediate tunnel connection handed off
			_ = currentConn
		}
		currentConn = nextConn
		if nextSSH != nil {
			currentSSH = nextSSH
		}
	}

	// Final step: Dial target from last hop
	finalStart := time.Now()
	var finalConn net.Conn
	var finalErr error

	if currentSSH != nil {
		finalConn, finalErr = currentSSH.Dial("tcp", targetAddr)
	} else if currentConn != nil {
		finalConn = currentConn
	} else {
		var d net.Dialer
		finalConn, finalErr = d.DialContext(ctx, "tcp", targetAddr)
	}

	finalLatency := float64(time.Since(finalStart).Microseconds()) / 1000.0
	finalStatus := "online"
	finalErrMsg := ""
	if finalErr != nil {
		finalStatus = "offline"
		finalErrMsg = finalErr.Error()
	}

	chainMetric.Hops = append(chainMetric.Hops, HopMetric{
		HopID:      "target",
		HopName:    "Destination Endpoint",
		HopType:    HopTypeDirect,
		TargetAddr: targetAddr,
		LatencyMs:  finalLatency,
		Timestamp:  time.Now(),
		Status:     finalStatus,
		Error:      finalErrMsg,
	})

	chainMetric.TotalLatency = float64(time.Since(startTime).Microseconds()) / 1000.0
	if finalErr != nil {
		cleanupOnError()
		return nil, chainMetric, fmt.Errorf("failed connecting to destination %s: %w", targetAddr, finalErr)
	}

	return finalConn, chainMetric, nil
}

// dialHTTPProxy initiates an HTTP CONNECT tunnel via current link.
func (p *PipelineEngine) dialHTTPProxy(ctx context.Context, prevConn net.Conn, prevSSH *ssh.Client, hop HopConfig) (net.Conn, error) {
	var conn net.Conn
	var err error

	if prevSSH != nil {
		conn, err = prevSSH.Dial("tcp", hop.Addr())
	} else if prevConn != nil {
		conn = prevConn
	} else {
		var d net.Dialer
		conn, err = d.DialContext(ctx, "tcp", hop.Addr())
	}
	if err != nil {
		return nil, err
	}

	// Send HTTP CONNECT header
	req := fmt.Sprintf("CONNECT %s HTTP/1.1\r\nHost: %s\r\n", hop.Addr(), hop.Addr())
	if hop.Auth.Username != "" {
		basic := base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("%s:%s", hop.Auth.Username, hop.Auth.Password)))
		req += fmt.Sprintf("Proxy-Authorization: Basic %s\r\n", basic)
	}
	req += "\r\n"

	if _, err := conn.Write([]byte(req)); err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("failed sending HTTP CONNECT: %w", err)
	}

	buf := make([]byte, 1024)
	n, err := conn.Read(buf)
	if err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("failed reading HTTP proxy handshake response: %w", err)
	}
	resp := string(buf[:n])
	if !strings.Contains(resp, " 200 ") {
		_ = conn.Close()
		return nil, fmt.Errorf("http proxy handshake failed: %s", strings.TrimSpace(resp))
	}

	return conn, nil
}

// dialSOCKS5Proxy negotiates SOCKS5 tunnel over previous connection.
func (p *PipelineEngine) dialSOCKS5Proxy(ctx context.Context, prevConn net.Conn, prevSSH *ssh.Client, hop HopConfig) (net.Conn, error) {
	var auth *proxy.Auth
	if hop.Auth.Username != "" {
		auth = &proxy.Auth{
			User:     hop.Auth.Username,
			Password: hop.Auth.Password,
		}
	}

	if prevSSH != nil {
		// Custom dialer using SSH connection
		dialer, err := proxy.SOCKS5("tcp", hop.Addr(), auth, &sshProxyDialer{client: prevSSH})
		if err != nil {
			return nil, err
		}
		return dialer.Dial("tcp", hop.Addr())
	}

	dialer, err := proxy.SOCKS5("tcp", hop.Addr(), auth, proxy.Direct)
	if err != nil {
		return nil, err
	}
	return dialer.Dial("tcp", hop.Addr())
}

// dialSSHBastion connects to an SSH server over the current connection.
func (p *PipelineEngine) dialSSHBastion(ctx context.Context, prevConn net.Conn, prevSSH *ssh.Client, hop HopConfig) (*ssh.Client, net.Conn, error) {
	var authMethods []ssh.AuthMethod

	if hop.Auth.PrivateKeyPEM != "" {
		var signer ssh.Signer
		var err error
		if hop.Auth.Passphrase != "" {
			signer, err = ssh.ParsePrivateKeyWithPassphrase([]byte(hop.Auth.PrivateKeyPEM), []byte(hop.Auth.Passphrase))
		} else {
			signer, err = ssh.ParsePrivateKey([]byte(hop.Auth.PrivateKeyPEM))
		}
		if err != nil {
			return nil, nil, fmt.Errorf("invalid ssh private key: %w", err)
		}
		authMethods = append(authMethods, ssh.PublicKeys(signer))
	}

	if hop.Auth.Password != "" {
		authMethods = append(authMethods, ssh.Password(hop.Auth.Password))
	}

	if len(authMethods) == 0 {
		return nil, nil, errors.New("ssh bastion requires password or private key auth")
	}

	clientConfig := &ssh.ClientConfig{
		User:            hop.Auth.Username,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // Configurable per security policy
		Timeout:         10 * time.Second,
	}

	var conn net.Conn
	var err error

	if prevSSH != nil {
		conn, err = prevSSH.Dial("tcp", hop.Addr())
	} else if prevConn != nil {
		conn = prevConn
	} else {
		var d net.Dialer
		conn, err = d.DialContext(ctx, "tcp", hop.Addr())
	}
	if err != nil {
		return nil, nil, fmt.Errorf("failed connecting to ssh bastion %s: %w", hop.Addr(), err)
	}

	sshConn, chans, reqs, err := ssh.NewClientConn(conn, hop.Addr(), clientConfig)
	if err != nil {
		_ = conn.Close()
		return nil, nil, fmt.Errorf("ssh handshake failed with %s: %w", hop.Addr(), err)
	}

	client := ssh.NewClient(sshConn, chans, reqs)
	return client, conn, nil
}

// MeasureHopLatency performs an isolated synthetic probe to evaluate hop RTT and health.
func (p *PipelineEngine) MeasureHopLatency(ctx context.Context, hop HopConfig) HopMetric {
	start := time.Now()
	metric := HopMetric{
		HopID:      hop.ID,
		HopName:    hop.Name,
		HopType:    hop.Type,
		TargetAddr: hop.Addr(),
		Timestamp:  start,
	}

	var d net.Dialer
	timeout := hop.Timeout
	if timeout == 0 {
		timeout = 3 * time.Second
	}
	ctxTimeout, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	conn, err := d.DialContext(ctxTimeout, "tcp", hop.Addr())
	metric.LatencyMs = float64(time.Since(start).Microseconds()) / 1000.0

	if err != nil {
		metric.Status = "offline"
		metric.Error = err.Error()
		return metric
	}
	_ = conn.Close()

	if metric.LatencyMs > 250 {
		metric.Status = "degraded"
	} else {
		metric.Status = "online"
	}
	return metric
}

type sshProxyDialer struct {
	client *ssh.Client
}

func (s *sshProxyDialer) Dial(network, addr string) (net.Conn, error) {
	return s.client.Dial(network, addr)
}

// Suppress unused imports
var _ = tls.Config{}
var _ = http.Client{}
var _ = url.URL{}
