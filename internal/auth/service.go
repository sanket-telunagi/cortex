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
	CreatedAt    time.Time `json:"created_at"`
	LastLoginAt  time.Time `json:"last_login_at"`
}

// Session represents an active authenticated user session.
type Session struct {
	Token     string    `json:"token"`
	UserID    string    `json:"user_id"`
	Email     string    `json:"email"`
	FullName  string    `json:"full_name"`
	Role      Role      `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

// AuthService manages user registration, login, and RBAC token sessions.
type AuthService struct {
	mu        sync.RWMutex
	users     map[string]*User    // email -> User
	usersByID map[string]*User   // id -> User
	sessions  map[string]*Session // token -> Session
}

// NewAuthService creates a new initialized AuthService.
func NewAuthService() *AuthService {
	svc := &AuthService{
		users:     make(map[string]*User),
		usersByID: make(map[string]*User),
		sessions:  make(map[string]*Session),
	}

	// Seed default administrator
	_ = svc.SeedDefaultAdmin("admin@cortex.internal", "Admin User", "CortexAdmin2026!")
	return svc
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

// SeedDefaultAdmin creates the initial system administrator.
func (s *AuthService) SeedDefaultAdmin(email, fullName, password string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	email = strings.ToLower(strings.TrimSpace(email))
	if _, exists := s.users[email]; exists {
		return nil
	}

	saltBytes := make([]byte, 16)
	if _, err := rand.Read(saltBytes); err != nil {
		return err
	}
	salt := base64.RawStdEncoding.EncodeToString(saltBytes)
	hash := hashPassword(password, saltBytes)

	user := &User{
		ID:           "usr-admin-01",
		Email:        email,
		FullName:     fullName,
		PasswordHash: hash,
		Salt:         salt,
		Role:         RoleAdmin,
		CreatedAt:    time.Now().UTC(),
		LastLoginAt:  time.Now().UTC(),
	}

	s.users[email] = user
	s.usersByID[user.ID] = user
	return nil
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

	role := RoleEngineer
	if len(s.users) == 0 {
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
		Token:     token,
		UserID:    user.ID,
		Email:     user.Email,
		FullName:  user.FullName,
		Role:      user.Role,
		CreatedAt: time.Now().UTC(),
		ExpiresAt: time.Now().UTC().Add(7 * 24 * time.Hour),
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
		Token:     token,
		UserID:    user.ID,
		Email:     user.Email,
		FullName:  user.FullName,
		Role:      user.Role,
		CreatedAt: time.Now().UTC(),
		ExpiresAt: time.Now().UTC().Add(7 * 24 * time.Hour),
	}
	s.sessions[token] = session

	return user, session, nil
}

// ValidateSession verifies a token and returns the active Session.
func (s *AuthService) ValidateSession(token string) (*Session, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	session, exists := s.sessions[token]
	if !exists {
		return nil, errors.New("invalid session token")
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