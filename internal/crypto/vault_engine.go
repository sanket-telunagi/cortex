package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/argon2"
)

type SecretType string

const (
	SecretEnvVar      SecretType = "env_var"
	SecretDatabaseURL SecretType = "database_url"
	SecretSSHPrivate  SecretType = "ssh_private_key"
	SecretAPIToken    SecretType = "api_token"
	SecretConfigFile  SecretType = "config_file"
)

type EncryptedPayload struct {
	Version    string `json:"version"`
	Salt       string `json:"salt"`
	Nonce      string `json:"nonce"`
	Ciphertext string `json:"data"`
}

type SecretMetadata struct {
	ID          string     `json:"id"`
	KeyName     string     `json:"key_name"`
	Type        SecretType `json:"type"`
	Description string     `json:"description"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type SurrogateHandle string

type VaultEngine struct {
	mu           sync.RWMutex
	store        map[string]EncryptedPayload
	metadata     map[string]SecretMetadata
	ephemeralRAM map[SurrogateHandle][]byte
	handleToID   map[SurrogateHandle]string
	idToHandle   map[string]SurrogateHandle
}

func NewVaultEngine() *VaultEngine {
	return &VaultEngine{
		store:        make(map[string]EncryptedPayload),
		metadata:     make(map[string]SecretMetadata),
		ephemeralRAM: make(map[SurrogateHandle][]byte),
		handleToID:   make(map[SurrogateHandle]string),
		idToHandle:   make(map[string]SurrogateHandle),
	}
}

func DeriveKey(passphrase string, salt []byte) []byte {
	return argon2.IDKey([]byte(passphrase), salt, 4, 64*1024, 4, 32)
}

func Encrypt(key []byte, plaintext []byte) (*EncryptedPayload, error) {
	if len(key) != 32 {
		return nil, errors.New("encryption key must be exactly 32 bytes (256-bit)")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	salt := make([]byte, 16)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return nil, err
	}

	ciphertext := gcm.Seal(nil, nonce, plaintext, nil)

	return &EncryptedPayload{
		Version:    "v1",
		Salt:       base64.StdEncoding.EncodeToString(salt),
		Nonce:      base64.StdEncoding.EncodeToString(nonce),
		Ciphertext: base64.StdEncoding.EncodeToString(ciphertext),
	}, nil
}

func Decrypt(key []byte, payload *EncryptedPayload) ([]byte, error) {
	if len(key) != 32 {
		return nil, errors.New("decryption key must be exactly 32 bytes (256-bit)")
	}

	nonce, err := base64.StdEncoding.DecodeString(payload.Nonce)
	if err != nil {
		return nil, errors.New("invalid base64 nonce")
	}

	ciphertext, err := base64.StdEncoding.DecodeString(payload.Ciphertext)
	if err != nil {
		return nil, errors.New("invalid base64 ciphertext")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, errors.New("decryption failed: incorrect key or corrupted payload")
	}

	return plaintext, nil
}

func (v *VaultEngine) RegisterSecret(meta SecretMetadata, payload EncryptedPayload) SurrogateHandle {
	v.mu.Lock()
	defer v.mu.Unlock()

	randBytes := make([]byte, 8)
	_, _ = rand.Read(randBytes)
	handle := SurrogateHandle(fmt.Sprintf("$CORTEX_HANDLE:%s_%x$", strings.ToLower(meta.KeyName), randBytes))

	meta.CreatedAt = time.Now()
	meta.UpdatedAt = time.Now()

	v.metadata[meta.ID] = meta
	v.store[meta.ID] = payload
	v.handleToID[handle] = meta.ID
	v.idToHandle[meta.ID] = handle

	return handle
}

func (v *VaultEngine) ListMetadataForLLM() []map[string]interface{} {
	v.mu.RLock()
	defer v.mu.RUnlock()

	result := make([]map[string]interface{}, 0, len(v.metadata))
	for id, meta := range v.metadata {
		handle := v.idToHandle[id]
		result = append(result, map[string]interface{}{
			"key_name":         meta.KeyName,
			"surrogate_handle": string(handle),
			"type":             string(meta.Type),
			"description":      meta.Description,
		})
	}
	return result
}

func (v *VaultEngine) UnlockForSession(secretID string, clientKey []byte) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	payload, exists := v.store[secretID]
	if !exists {
		return errors.New("secret not found in vault")
	}

	plaintext, err := Decrypt(clientKey, &payload)
	if err != nil {
		return err
	}

	handle := v.idToHandle[secretID]
	v.ephemeralRAM[handle] = plaintext
	return nil
}

func (v *VaultEngine) DetokenizeAndExecute(input string) (string, error) {
	v.mu.RLock()
	defer v.mu.RUnlock()

	output := input
	for handle, plaintext := range v.ephemeralRAM {
		handleStr := string(handle)
		if strings.Contains(output, handleStr) {
			output = strings.ReplaceAll(output, handleStr, string(plaintext))
		}
	}
	return output, nil
}

func (v *VaultEngine) ScrubResponse(response string) string {
	v.mu.RLock()
	defer v.mu.RUnlock()

	scrubbed := response
	for handle, plaintext := range v.ephemeralRAM {
		rawVal := string(plaintext)
		if len(rawVal) > 4 && strings.Contains(scrubbed, rawVal) {
			scrubbed = strings.ReplaceAll(scrubbed, rawVal, string(handle)+"[REDACTED]")
		}
		// Also scrub extracted password component if URI
		if strings.Contains(rawVal, "://") && strings.Contains(rawVal, "@") {
			parts := strings.Split(rawVal, "@")[0]
			if colonIdx := strings.LastIndex(parts, ":"); colonIdx != -1 {
				pass := parts[colonIdx+1:]
				if len(pass) > 4 && strings.Contains(scrubbed, pass) {
					scrubbed = strings.ReplaceAll(scrubbed, pass, "[REDACTED]")
				}
			}
		}
	}
	return scrubbed
}

func (v *VaultEngine) ZeroMemory() {
	v.mu.Lock()
	defer v.mu.Unlock()

	for handle, val := range v.ephemeralRAM {
		for i := range val {
			val[i] = 0
		}
		delete(v.ephemeralRAM, handle)
	}
}