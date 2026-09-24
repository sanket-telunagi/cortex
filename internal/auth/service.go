package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/argon2"
)

// User represents an authenticated identity in Cortex Studio.
type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	FullName     string    `json:"full_name"`
	PasswordHash string    `json:"-"`
	Salt         string    `json:"-"`
	Role         Role      `json:"role"`
	AuthProvider string    `json:"auth_provider"` // "local", "microsoft", "github", "google", "oidc"
	ProviderID   string    `json:"provider_id,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	LastLoginAt  time.Time `json:"last_login_at"`
}

// Session represents an active authenticated user session or API token.
type Session struct {
	Token        string    `json:"token"`
	UserID       string    `json:"user_id"`
	Email        string    `json:"email"`
	FullName     string    `json:"full_name"`
	Role         Role      `json:"role"`
	AllowedTools []string  `json:"allowed_tools,omitempty"` // For MCP agents & API keys ("*" or specific tool names)
	IsAPIKey     bool      `json:"is_api_key,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	ExpiresAt    time.Time `json:"expires_at"`
}

// APIKey represents a long-lived machine or MCP agent credential.
type APIKey struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	KeyPrefix    string    `json:"key_prefix"` // e.g. "ctx_live_a1b2..."
	Role         Role      `json:"role"`
	AllowedTools []string  `json:"allowed_tools"`
	CreatedBy    string    `json:"created_by"`
	CreatedAt    time.Time `json:"created_at"`
	ExpiresAt    time.Time `json:"expires_at"`
	LastUsedAt   time.Time `json:"last_used_at,omitempty"`
}

// AuthProviderConfig holds configuration for external OAuth2 / SSO providers (e.g. MSAuth).
type AuthProviderConfig struct {
	Name         string `json:"name"`         // "microsoft", "github", "google", "oidc"
	DisplayName  string `json:"display_name"` // "Microsoft Entra ID"
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"-"`
	AuthURL      string `json:"auth_url"`
	TokenURL     string `json:"token_url"`
	UserInfoURL  string `json:"user_info_url"`
	TenantID     string `json:"tenant_id,omitempty"` // For Microsoft Entra ID
	Enabled      bool   `json:"enabled"`
}

// AuthService manages user registration, login, API keys, and RBAC token sessions.
type AuthService struct {
	mu           sync.RWMutex
	users        map[string]*User               // email -> User
	usersByID    map[string]*User              // id -> User
	sessions     map[string]*Session            // token -> Session
	apiKeys      map[string]*APIKey             // keyID -> APIKey
	providers    map[string]*AuthProviderConfig // providerName -> AuthProviderConfig
}

// NewAuthService creates a new initialized AuthService without mock users.
func NewAuthService() *AuthService {
	return &AuthService{
		users:     make(map[string]*User),
		usersByID: make(map[string]*User),
		sessions:  make(map[string]*Session),
		apiKeys:   make(map[string]*APIKey),
		providers: make(map[string]*AuthProviderConfig),
	}
}

func hashPassword(password string, salt []byte) string {
	hash := argon2.IDKey([]byte(password), salt, 1, 64*1024, 4, 32)
	return base64.RawStdEncoding.EncodeToString(hash)
}

func generateToken(length int) (string, error) {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// HasAdmin checks whether an initial system administrator has been provisioned.
func (s *AuthService) HasAdmin() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, u := range s.users {
		if u.Role == RoleAdmin {
			return true
		}
	}
	return false
}

// TotalUsers returns the number of registered users.
func (s *AuthService) TotalUsers() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.users)
}

// CreateFirstAdmin creates the initial super administrator. Only allowed if no admin exists.
func (s *AuthService) CreateFirstAdmin(email, fullName, password string) (*User, *Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, u := range s.users {
		if u.Role == RoleAdmin {
			return nil, nil, errors.New("an administrator account is already provisioned")
		}
	}

	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" || !strings.Contains(email, "@") {
		return nil, nil, errors.New("invalid email address")
	}
	if len(password) < 8 {
		return nil, nil, errors.New("admin password must be at least 8 characters")
	}

	saltBytes := make([]byte, 16)
	if _, err := rand.Read(saltBytes); err != nil {
		return nil, nil, err
	}
	salt := base64.RawStdEncoding.EncodeToString(saltBytes)
	hash := hashPassword(password, saltBytes)

	userID := fmt.Sprintf("usr-admin-%d", time.Now().UnixNano())
	user := &User{
		ID:           userID,
		Email:        email,
		FullName:     fullName,
		PasswordHash: hash,
		Salt:         salt,
		Role:         RoleAdmin,
		AuthProvider: "local",
		CreatedAt:    time.Now().UTC(),
		LastLoginAt:  time.Now().UTC(),
	}

	s.users[email] = user
	s.usersByID[user.ID] = user

	token, err := generateToken(32)
	if err != nil {
		return nil, nil, err
	}

	session := &Session{
		Token:        token,
		UserID:       user.ID,
		Email:        user.Email,
		FullName:     user.FullName,
		Role:         user.Role,
		AllowedTools: []string{"*"},
		CreatedAt:    time.Now().UTC(),
		ExpiresAt:    time.Now().UTC().Add(7 * 24 * time.Hour),
	}
	s.sessions[token] = session

	return user, session, nil
}

// Register creates a new user account.
func (s *AuthService) Register(email, fullName, password string, requestedRole Role) (*User, *Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" || !strings.Contains(email, "@") {
		return nil, nil, errors.New("invalid email address")
	}
	if len(password) < 8 {
		return nil, nil, errors.New("password must be at least 8 characters")
	}
	if _, exists := s.users[email]; exists {
		return nil, nil, errors.New("a user with this email already exists")
	}

	// First user ever created automatically becomes ADMIN if none exists
	hasAnyAdmin := false
	for _, u := range s.users {
		if u.Role == RoleAdmin {
			hasAnyAdmin = true
			break
		}
	}

	role := RoleEngineer
	if !hasAnyAdmin {
		role = RoleAdmin
	} else if requestedRole != "" {
		if err := ValidateRole(requestedRole); err == nil && requestedRole != RoleAdmin {
			role = requestedRole
		}
	}

	saltBytes := make([]byte, 16)
	if _, err := rand.Read(saltBytes); err != nil {
		return nil, nil, err
	}
	salt := base64.RawStdEncoding.EncodeToString(saltBytes)
	hash := hashPassword(password, saltBytes)

	userID := fmt.Sprintf("usr-%d", time.Now().UnixNano())
	user := &User{
		ID:           userID,
		Email:        email,
		FullName:     fullName,
		PasswordHash: hash,
		Salt:         salt,
		Role:         role,
		AuthProvider: "local",
		CreatedAt:    time.Now().UTC(),
		LastLoginAt:  time.Now().UTC(),
	}

	s.users[email] = user
	s.usersByID[user.ID] = user

	token, err := generateToken(32)
	if err != nil {
		return nil, nil, err
	}

	session := &Session{
		Token:        token,
		UserID:       user.ID,
		Email:        user.Email,
		FullName:     user.FullName,
		Role:         user.Role,
		AllowedTools: []string{"*"},
		CreatedAt:    time.Now().UTC(),
		ExpiresAt:    time.Now().UTC().Add(7 * 24 * time.Hour),
	}
	s.sessions[token] = session

	return user, session, nil
}

// Login authenticates a user and returns an active session token.
func (s *AuthService) Login(email, password string) (*User, *Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	email = strings.ToLower(strings.TrimSpace(email))
	user, exists := s.users[email]
	if !exists {
		return nil, nil, errors.New("invalid email or password")
	}

	saltBytes, err := base64.RawStdEncoding.DecodeString(user.Salt)
	if err != nil {
		return nil, nil, errors.New("failed to decode user salt")
	}

	computedHash := hashPassword(password, saltBytes)
	if subtle.ConstantTimeCompare([]byte(computedHash), []byte(user.PasswordHash)) != 1 {
		return nil, nil, errors.New("invalid email or password")
	}

	user.LastLoginAt = time.Now().UTC()

	token, err := generateToken(32)
	if err != nil {
		return nil, nil, err
	}

	session := &Session{
		Token:        token,
		UserID:       user.ID,
		Email:        user.Email,
		FullName:     user.FullName,
		Role:         user.Role,
		AllowedTools: []string{"*"},
		CreatedAt:    time.Now().UTC(),
		ExpiresAt:    time.Now().UTC().Add(7 * 24 * time.Hour),
	}
	s.sessions[token] = session

	return user, session, nil
}

// CreateAPIKey creates an authorized machine / MCP agent token with scoped tool permissions.
func (s *AuthService) CreateAPIKey(name string, role Role, allowedTools []string, createdBy string, duration time.Duration) (string, *APIKey, error) {
	if err := ValidateRole(role); err != nil {
		return "", nil, err
	}
	if name == "" {
		return "", nil, errors.New("API key name is required")
	}
	if duration <= 0 {
		duration = 365 * 24 * time.Hour
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	rawSecret, err := generateToken(24)
	if err != nil {
		return "", nil, err
	}
	fullToken := fmt.Sprintf("ctx_mcp_%s", rawSecret)
	keyID := fmt.Sprintf("key-%d", time.Now().UnixNano())

	prefix := fullToken[:12] + "..."

	if len(allowedTools) == 0 {
		allowedTools = []string{"*"}
	}

	apiKey := &APIKey{
		ID:           keyID,
		Name:         name,
		KeyPrefix:    prefix,
		Role:         role,
		AllowedTools: allowedTools,
		CreatedBy:    createdBy,
		CreatedAt:    time.Now().UTC(),
		ExpiresAt:    time.Now().UTC().Add(duration),
	}

	s.apiKeys[keyID] = apiKey

	// Also index into session validator for instantaneous lookups
	session := &Session{
		Token:        fullToken,
		UserID:       keyID,
		Email:        name,
		FullName:     fmt.Sprintf("MCP Agent (%s)", name),
		Role:         role,
		AllowedTools: allowedTools,
		IsAPIKey:     true,
		CreatedAt:    time.Now().UTC(),
		ExpiresAt:    time.Now().UTC().Add(duration),
	}
	s.sessions[fullToken] = session

	return fullToken, apiKey, nil
}

// ListAPIKeys returns all active API / MCP keys.
func (s *AuthService) ListAPIKeys() []*APIKey {
	s.mu.RLock()
	defer s.mu.RUnlock()

	list := make([]*APIKey, 0, len(s.apiKeys))
	for _, k := range s.apiKeys {
		list = append(list, k)
	}
	return list
}

// RevokeAPIKey invalidates an API key.
func (s *AuthService) RevokeAPIKey(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	key, exists := s.apiKeys[id]
	if !exists {
		return errors.New("API key not found")
	}

	delete(s.apiKeys, id)

	// Remove from active sessions
	for token, sess := range s.sessions {
		if sess.UserID == key.ID {
			delete(s.sessions, token)
		}
	}
	return nil
}

// ValidateSession verifies a token and returns the active Session.
func (s *AuthService) ValidateSession(token string) (*Session, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	session, exists := s.sessions[token]
	if !exists {
		return nil, errors.New("invalid or revoked session token")
	}
	if time.Now().UTC().After(session.ExpiresAt) {
		return nil, errors.New("session has expired")
	}
	return session, nil
}

// Logout revokes an active session token.
func (s *AuthService) Logout(token string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, token)
}

// ListUsers returns all users in the system (Admin only).
func (s *AuthService) ListUsers() []*User {
	s.mu.RLock()
	defer s.mu.RUnlock()

	list := make([]*User, 0, len(s.users))
	for _, u := range s.users {
		list = append(list, u)
	}
	return list
}

// UpdateUserRole changes a user's authorization role.
func (s *AuthService) UpdateUserRole(userID string, newRole Role) error {
	if err := ValidateRole(newRole); err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	user, exists := s.usersByID[userID]
	if !exists {
		return errors.New("user not found")
	}

	user.Role = newRole
	for _, session := range s.sessions {
		if session.UserID == userID {
			session.Role = newRole
		}
	}
	return nil
}

// DeleteUser removes a user account from the system (Admin only).
func (s *AuthService) DeleteUser(userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	user, exists := s.usersByID[userID]
	if !exists {
		return errors.New("user not found")
	}

	// Prevent deleting the last remaining admin
	if user.Role == RoleAdmin {
		adminCount := 0
		for _, u := range s.users {
			if u.Role == RoleAdmin {
				adminCount++
			}
		}
		if adminCount <= 1 {
			return errors.New("cannot delete the only remaining cluster administrator")
		}
	}

	delete(s.users, user.Email)
	delete(s.usersByID, userID)

	for token, sess := range s.sessions {
		if sess.UserID == userID {
			delete(s.sessions, token)
		}
	}
	return nil
}

// ConfigureAuthProvider registers an external OAuth/MSAuth provider configuration.
func (s *AuthService) ConfigureAuthProvider(cfg AuthProviderConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.providers[cfg.Name] = &cfg
}

// ListAuthProviders returns available authentication providers.
func (s *AuthService) ListAuthProviders() []map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	providers := []map[string]interface{}{
		{
			"name":         "local",
			"display_name": "Email & Password",
			"enabled":      true,
		},
		{
			"name":         "microsoft",
			"display_name": "Microsoft Entra ID (MSAuth)",
			"enabled":      s.providers["microsoft"] != nil && s.providers["microsoft"].Enabled,
		},
		{
			"name":         "github",
			"display_name": "GitHub OAuth",
			"enabled":      s.providers["github"] != nil && s.providers["github"].Enabled,
		},
		{
			"name":         "google",
			"display_name": "Google Workspace SSO",
			"enabled":      s.providers["google"] != nil && s.providers["google"].Enabled,
		},
	}
	return providers
}

// ExtractBearerToken parses the Bearer authorization header from an HTTP request.
func ExtractBearerToken(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return ""
	}
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		return strings.TrimSpace(parts[1])
	}
	return ""
}
