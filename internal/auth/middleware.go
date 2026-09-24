package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

type contextKey string

const SessionContextKey contextKey = "cortex_session"

// RequireAuth middleware verifies the request has a valid Bearer session token or API key.
func RequireAuth(svc *AuthService, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := ExtractBearerToken(r)
		if token == "" {
			// Also check cookie for seamless web UI support
			if cookie, err := r.Cookie("cortex_session"); err == nil {
				token = cookie.Value
			}
		}

		if token == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "authentication required"})
			return
		}

		session, err := svc.ValidateSession(token)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		ctx := context.WithValue(r.Context(), SessionContextKey, session)
		next(w, r.WithContext(ctx))
	}
}

// RequirePermission verifies the authenticated user has the required RBAC permission.
func RequirePermission(svc *AuthService, perm Permission, next http.HandlerFunc) http.HandlerFunc {
	return RequireAuth(svc, func(w http.ResponseWriter, r *http.Request) {
		session, ok := r.Context().Value(SessionContextKey).(*Session)
		if !ok || session == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "unauthorized"})
			return
		}

		if !HasPermission(session.Role, perm) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"error":               "forbidden: insufficient role permissions",
				"required_permission": string(perm),
				"user_role":           string(session.Role),
			})
			return
		}

		next(w, r)
	})
}

// RegisterAuthRoutes mounts the auth endpoints on the provided ServeMux.
func RegisterAuthRoutes(mux *http.ServeMux, svc *AuthService) {
	// GET /api/auth/status - Check whether initial admin is provisioned and list providers
	mux.HandleFunc("/api/auth/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		hasAdmin := svc.HasAdmin()
		totalUsers := svc.TotalUsers()
		providers := svc.ListAuthProviders()

		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"has_admin":   hasAdmin,
			"total_users": totalUsers,
			"providers":   providers,
		})
	})

	// POST /api/auth/setup-admin - Create the initial super-admin (only if no admin exists)
	mux.HandleFunc("/api/auth/setup-admin", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Email    string `json:"email"`
			FullName string `json:"full_name"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "malformed request payload"})
			return
		}

		user, session, err := svc.CreateFirstAdmin(req.Email, req.FullName, req.Password)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "admin_created",
			"user":    user,
			"session": session,
		})
	})

	// POST /api/auth/signup - Normal user account registration
	mux.HandleFunc("/api/auth/signup", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Email    string `json:"email"`
			FullName string `json:"full_name"`
			Password string `json:"password"`
			Role     Role   `json:"role"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "malformed request payload"})
			return
		}

		user, session, err := svc.Register(req.Email, req.FullName, req.Password, req.Role)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"user":    user,
			"session": session,
		})
	})

	// POST /api/auth/login
	mux.HandleFunc("/api/auth/login", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "malformed request payload"})
			return
		}

		user, session, err := svc.Login(req.Email, req.Password)
		if err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"user":    user,
			"session": session,
		})
	})

	// GET /api/auth/me
	mux.HandleFunc("/api/auth/me", RequireAuth(svc, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		session := r.Context().Value(SessionContextKey).(*Session)
		_ = json.NewEncoder(w).Encode(session)
	}))

	// POST /api/auth/logout
	mux.HandleFunc("/api/auth/logout", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		token := ExtractBearerToken(r)
		if token != "" {
			svc.Logout(token)
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "logged_out"})
	})

	// GET /api/auth/users (Admin only)
	mux.HandleFunc("/api/auth/users", RequirePermission(svc, PermUserManage, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodGet {
			users := svc.ListUsers()
			_ = json.NewEncoder(w).Encode(users)
			return
		}
		if r.Method == http.MethodDelete {
			var req struct {
				UserID string `json:"user_id"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				w.WriteHeader(http.StatusBadRequest)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "malformed request payload"})
				return
			}
			if err := svc.DeleteUser(req.UserID); err != nil {
				w.WriteHeader(http.StatusBadRequest)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
			return
		}
		w.WriteHeader(http.StatusMethodNotAllowed)
	}))

	// POST /api/auth/users/role (Admin only)
	mux.HandleFunc("/api/auth/users/role", RequirePermission(svc, PermUserManage, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			UserID  string `json:"user_id"`
			NewRole Role   `json:"new_role"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "malformed request payload"})
			return
		}

		if err := svc.UpdateUserRole(req.UserID, req.NewRole); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		_ = json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
	}))

	// GET & POST & DELETE /api/auth/api-keys (Admin & Engineer for MCP key generation)
	mux.HandleFunc("/api/auth/api-keys", RequireAuth(svc, func(w http.ResponseWriter, r *http.Request) {
		session := r.Context().Value(SessionContextKey).(*Session)
		w.Header().Set("Content-Type", "application/json")

		if r.Method == http.MethodGet {
			keys := svc.ListAPIKeys()
			_ = json.NewEncoder(w).Encode(keys)
			return
		}

		if r.Method == http.MethodPost {
			if !HasPermission(session.Role, PermUserManage) && session.Role != RoleEngineer {
				w.WriteHeader(http.StatusForbidden)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "forbidden"})
				return
			}

			var req struct {
				Name         string   `json:"name"`
				Role         Role     `json:"role"`
				AllowedTools []string `json:"allowed_tools"`
				Days         int      `json:"days"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				w.WriteHeader(http.StatusBadRequest)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "malformed request payload"})
				return
			}

			duration := 30 * 24 * time.Hour
			if req.Days > 0 {
				duration = time.Duration(req.Days) * 24 * time.Hour
			}

			assignedRole := RoleMCPAgent
			if req.Role != "" && (session.Role == RoleAdmin) {
				assignedRole = req.Role
			}

			token, apiKey, err := svc.CreateAPIKey(req.Name, assignedRole, req.AllowedTools, session.Email, duration)
			if err != nil {
				w.WriteHeader(http.StatusBadRequest)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
				return
			}

			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"api_key":   apiKey,
				"raw_token": token, // Displayed once to user upon creation
			})
			return
		}

		if r.Method == http.MethodDelete {
			var req struct {
				ID string `json:"id"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				w.WriteHeader(http.StatusBadRequest)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "malformed request payload"})
				return
			}
			if err := svc.RevokeAPIKey(req.ID); err != nil {
				w.WriteHeader(http.StatusBadRequest)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "revoked"})
			return
		}

		w.WriteHeader(http.StatusMethodNotAllowed)
	}))
}
