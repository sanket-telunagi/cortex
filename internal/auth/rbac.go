package auth

import "errors"

// Role represents a user's authorization level in Cortex Studio.
type Role string

const (
	RoleAdmin     Role = "ADMIN"      // Full access to tunnels, databases, vault, and user management
	RoleEngineer  Role = "ENGINEER"   // Access to assigned tunnels, databases, and scoped vault handles
	RoleViewer    Role = "VIEWER"     // Read-only access to latency telemetry and public metadata
	RoleMCPAgent  Role = "MCP_AGENT"  // Machine service account constrained strictly to surrogate tokens
)

// Permission defines a discrete action within Cortex Studio.
type Permission string

const (
	PermTunnelRead     Permission = "tunnel:read"
	PermTunnelWrite    Permission = "tunnel:write"
	PermTunnelDelete   Permission = "tunnel:delete"

	PermDatabaseQuery  Permission = "database:query"
	PermDatabaseAdmin  Permission = "database:admin"

	PermVaultRead      Permission = "vault:read"
	PermVaultWrite     Permission = "vault:write"
	PermVaultAdmin     Permission = "vault:admin"

	PermUserManage     Permission = "user:manage"
	PermMCPExecute     Permission = "mcp:execute"
)

// rolePermissions maps each role to its set of granted permissions.
var rolePermissions = map[Role][]Permission{
	RoleAdmin: {
		PermTunnelRead, PermTunnelWrite, PermTunnelDelete,
		PermDatabaseQuery, PermDatabaseAdmin,
		PermVaultRead, PermVaultWrite, PermVaultAdmin,
		PermUserManage, PermMCPExecute,
	},
	RoleEngineer: {
		PermTunnelRead, PermTunnelWrite,
		PermDatabaseQuery,
		PermVaultRead, PermVaultWrite,
		PermMCPExecute,
	},
	RoleViewer: {
		PermTunnelRead,
		PermVaultRead,
	},
	RoleMCPAgent: {
		PermTunnelRead,
		PermDatabaseQuery,
		PermVaultRead,
		PermMCPExecute,
	},
}

// HasPermission checks whether a given role holds a specific permission.
func HasPermission(role Role, perm Permission) bool {
	perms, exists := rolePermissions[role]
	if !exists {
		return false
	}
	for _, p := range perms {
		if p == perm {
			return true
		}
	}
	return false
}

// ValidateRole ensures a role string is one of the valid Cortex roles.
func ValidateRole(r Role) error {
	switch r {
	case RoleAdmin, RoleEngineer, RoleViewer, RoleMCPAgent:
		return nil
	default:
		return errors.New("invalid role specified")
	}
}
