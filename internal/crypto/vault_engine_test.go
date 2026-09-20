package crypto

import (
	"bytes"
	"fmt"
	"strings"
	"testing"
)

func TestVaultEngine_ZeroKnowledgeAndSurrogateTokens(t *testing.T) {
	key := DeriveKey("SuperSecretMasterPassphrase123!", []byte("unique_salt_1234"))
	if len(key) != 32 {
		t.Fatalf("expected 32 byte key, got %d", len(key))
	}

	rawSecret := []byte("postgres://admin:TopSecretPassword999@internal-db.corp:5432/production")
	payload, err := Encrypt(key, rawSecret)
	if err != nil {
		t.Fatalf("encryption failed: %v", err)
	}

	// Verify ciphertext does NOT contain plain text
	if strings.Contains(payload.Ciphertext, "TopSecretPassword999") {
		t.Fatal("ciphertext contains plaintext password!")
	}

	decrypted, err := Decrypt(key, payload)
	if err != nil {
		t.Fatalf("decryption failed: %v", err)
	}
	if !bytes.Equal(decrypted, rawSecret) {
		t.Fatalf("expected %s, got %s", rawSecret, decrypted)
	}

	// Test Surrogate Handle Isolation for LLMs
	vault := NewVaultEngine()
	handle := vault.RegisterSecret(SecretMetadata{
		ID:          "sec-1",
		KeyName:     "PROD_DATABASE_URL",
		Type:        SecretDatabaseURL,
		Description: "Production database connection string",
	}, *payload)

	// Verify what LLM receives
	llmView := vault.ListMetadataForLLM()
	if len(llmView) != 1 {
		t.Fatalf("expected 1 item for LLM, got %d", len(llmView))
	}

	jsonRep := fmt.Sprintf("%v", llmView)
	if strings.Contains(jsonRep, "TopSecretPassword999") {
		t.Fatal("LLM view leaked plaintext secret!")
	}
	if !strings.Contains(jsonRep, string(handle)) {
		t.Fatalf("LLM view missing surrogate handle: %s", handle)
	}

	// Unlock in volatile memory for actual connection
	err = vault.UnlockForSession("sec-1", key)
	if err != nil {
		t.Fatalf("failed unlocking session: %v", err)
	}

	// Simulate dialer with surrogate handle
	dialString := fmt.Sprintf("CONNECT TO %s", handle)
	actualDial, err := vault.DetokenizeAndExecute(dialString)
	if err != nil {
		t.Fatalf("detokenize failed: %v", err)
	}
	if !strings.Contains(actualDial, "TopSecretPassword999") {
		t.Fatalf("failed detokenizing handle: got %s", actualDial)
	}

	// Simulate DB error output scrubbing
	accidentEcho := "Error executing query on postgres://admin:TopSecretPassword999@internal-db: timeout"
	scrubbed := vault.ScrubResponse(accidentEcho)
	if strings.Contains(scrubbed, "TopSecretPassword999") {
		t.Fatalf("scrubbing failed! Leaked secret: %s", scrubbed)
	}
	if !strings.Contains(scrubbed, "[REDACTED]") {
		t.Fatalf("scrubbed output missing [REDACTED]: %s", scrubbed)
	}

	// Clean volatile RAM
	vault.ZeroMemory()
}