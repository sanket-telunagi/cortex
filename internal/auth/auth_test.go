package auth

import (
	"testing"
	"time"
)

func TestAuthService_AdminBootstrapAndRBAC(t *testing.T) {
	svc := NewAuthService()

	// 1. Initial State: No admin should exist
	if svc.HasAdmin() {
		t.Fatalf("expected HasAdmin to be false on fresh start")
	}

	// 2. Setup Initial Administrator
	adminUser, adminSession, err := svc.CreateFirstAdmin("admin@cortex.internal", "Cluster Admin", "CortexAdmin2026!")
	if err != nil {
		t.Fatalf("failed to create first admin: %v", err)
	}
	if !svc.HasAdmin() {
		t.Fatalf("expected HasAdmin to be true after admin setup")
	}
	if adminUser.Role != RoleAdmin || adminSession.Role != RoleAdmin {
		t.Fatalf("expected RoleAdmin, got %v", adminUser.Role)
	}

	// Cannot create second first-admin
	if _, _, err := svc.CreateFirstAdmin("duplicate@cortex.internal", "Fake Admin", "AnotherPassword123!"); err == nil {
		t.Fatalf("expected error when trying to create a second first-admin")
	}

	// 3. Test RBAC permissions for Admin
	if !HasPermission(adminSession.Role, PermUserManage) {
		t.Errorf("admin should have PermUserManage")
	}
	if !HasPermission(adminSession.Role, PermDatabaseAdmin) {
		t.Errorf("admin should have PermDatabaseAdmin")
	}

	// 4. Register a standard Engineer
	engUser, engSession, err := svc.Register("engineer@corp.com", "Jane Dev", "SecurePassword123!", RoleEngineer)
	if err != nil {
		t.Fatalf("failed to register engineer: %v", err)
	}
	if engUser.Role != RoleEngineer {
		t.Fatalf("expected RoleEngineer, got %v", engUser.Role)
	}

	// 5. Test RBAC permissions for Engineer
	if !HasPermission(engSession.Role, PermTunnelWrite) {
		t.Errorf("engineer should have PermTunnelWrite")
	}
	if HasPermission(engSession.Role, PermUserManage) {
		t.Errorf("engineer should NOT have PermUserManage")
	}

	// 6. Test Registering a Viewer
	viewerUser, viewerSession, err := svc.Register("viewer@corp.com", "Bob Analyst", "ViewerPassword123!", RoleViewer)
	if err != nil {
		t.Fatalf("failed to register viewer: %v", err)
	}
	if viewerUser.Role != RoleViewer {
		t.Fatalf("expected RoleViewer, got %v", viewerUser.Role)
	}
	if HasPermission(viewerSession.Role, PermTunnelWrite) {
		t.Errorf("viewer should NOT have PermTunnelWrite")
	}
	if !HasPermission(viewerSession.Role, PermTunnelRead) {
		t.Errorf("viewer should have PermTunnelRead")
	}

	// 7. Test MCP API Key Generation with Granular Tool Permissions
	rawToken, apiKey, err := svc.CreateAPIKey("claude-architect", RoleMCPAgent, []string{"cortex_run_query", "cortex_check_health"}, adminUser.Email, 30*24*time.Hour)
	if err != nil {
		t.Fatalf("failed to create MCP API key: %v", err)
	}
	if apiKey == nil || rawToken == "" {
		t.Fatalf("expected valid token and apiKey struct")
	}

	// Validate MCP token session
	mcpSession, err := svc.ValidateSession(rawToken)
	if err != nil {
		t.Fatalf("failed to validate MCP token session: %v", err)
	}
	if mcpSession.Role != RoleMCPAgent {
		t.Errorf("expected MCP agent role, got %v", mcpSession.Role)
	}
	if len(mcpSession.AllowedTools) != 2 || mcpSession.AllowedTools[0] != "cortex_run_query" {
		t.Errorf("expected allowed tools list, got %v", mcpSession.AllowedTools)
	}

	// 8. Test role update and logout
	if err := svc.UpdateUserRole(viewerUser.ID, RoleEngineer); err != nil {
		t.Fatalf("failed to update user role: %v", err)
	}
	updatedSession, err := svc.ValidateSession(viewerSession.Token)
	if err != nil {
		t.Fatalf("failed to validate updated session: %v", err)
	}
	if updatedSession.Role != RoleEngineer {
		t.Errorf("expected role to be updated to RoleEngineer, got %v", updatedSession.Role)
	}

	svc.Logout(engSession.Token)
	if _, err := svc.ValidateSession(engSession.Token); err == nil {
		t.Errorf("expected session to be invalid after logout")
	}
}
