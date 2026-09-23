package auth

import (
	"testing"
)

func TestAuthService_LifecycleAndRBAC(t *testing.T) {
	svc := NewAuthService()

	// 1. Verify default admin seed
	adminUser, adminSession, err := svc.Login("admin@cortex.internal", "CortexAdmin2026!")
	if err != nil {
		t.Fatalf("failed to login with default admin: %v", err)
	}
	if adminUser.Role != RoleAdmin || adminSession.Role != RoleAdmin {
		t.Fatalf("expected RoleAdmin, got %v", adminUser.Role)
	}

	// 2. Test RBAC permissions for Admin
	if !HasPermission(adminSession.Role, PermUserManage) {
		t.Errorf("admin should have PermUserManage")
	}
	if !HasPermission(adminSession.Role, PermDatabaseAdmin) {
		t.Errorf("admin should have PermDatabaseAdmin")
	}

	// 3. Register a new Engineer
	engUser, engSession, err := svc.Register("engineer@corp.com", "Jane Dev", "SecurePassword123!", RoleEngineer)
	if err != nil {
		t.Fatalf("failed to register engineer: %v", err)
	}
	if engUser.Role != RoleEngineer {
		t.Fatalf("expected RoleEngineer, got %v", engUser.Role)
	}

	// 4. Test RBAC permissions for Engineer
	if !HasPermission(engSession.Role, PermTunnelWrite) {
		t.Errorf("engineer should have PermTunnelWrite")
	}
	if HasPermission(engSession.Role, PermUserManage) {
		t.Errorf("engineer should NOT have PermUserManage")
	}

	// 5. Test Registering a Viewer
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

	// 6. Test updating user role
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

	// 7. Test Logout
	svc.Logout(engSession.Token)
	if _, err := svc.ValidateSession(engSession.Token); err == nil {
		t.Errorf("expected session to be invalid after logout")
	}
}