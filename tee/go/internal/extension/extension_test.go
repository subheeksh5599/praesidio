package extension

import (
	"math/big"
	"strings"
	"testing"

	"extension-scaffold/pkg/types"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

// TestRegistryDigestMatchesSolidity proves the hand-rolled 5-word packing in
// registryDigest matches the canonical Solidity encoding the GuardianRegistry
// verifies:
//
//	keccak("\x19Ethereum Signed Message:\n32" || keccak(abi.encode(chainId, guardId, actionType, amount, nonce)))
//
// with Solidity types (uint256, uint256, uint8, uint256, uint64) — all padded
// to 32-byte words by abi.encode.
func TestRegistryDigestMatchesSolidity(t *testing.T) {
	chainId := uint64(114)
	guardId := uint64(7)
	actionType := uint64(1)
	amount := "5000000000000000000" // 5 C2FLR in wei
	nonce := uint64(3)

	uint256Ty, _ := abi.NewType("uint256", "", nil)
	uint8Ty, _ := abi.NewType("uint8", "", nil)
	uint64Ty, _ := abi.NewType("uint64", "", nil)

	canonical, err := abi.Arguments{
		{Type: uint256Ty},
		{Type: uint256Ty},
		{Type: uint8Ty},
		{Type: uint256Ty},
		{Type: uint64Ty},
	}.Pack(
		new(big.Int).SetUint64(chainId),
		new(big.Int).SetUint64(guardId),
		uint8(actionType),
		mustBig(amount),
		nonce,
	)
	if err != nil {
		t.Fatalf("canonical pack: %v", err)
	}

	inner := crypto.Keccak256(canonical)
	prefixed := append([]byte("\x19Ethereum Signed Message:\n32"), inner...)
	expected := crypto.Keccak256Hash(prefixed)

	got := registryDigest(chainId, guardId, actionType, nonce, amount)
	if got != expected {
		t.Fatalf("digest mismatch\n got  %s\n want %s", got.Hex(), expected.Hex())
	}
}

// TestSignTopUpActionRecoversSigner proves the enclave signature is a valid
// ECDSA signature over the exact registry digest, recoverable to the key's
// address, with the nonce, amount and action type bound into the digest.
func TestSignTopUpActionRecoversSigner(t *testing.T) {
	key := "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	t.Setenv("GUARDIAN_KEY", key)
	t.Setenv("CHAIN_ID", "114")

	priv, err := crypto.HexToECDSA(strings.TrimPrefix(key, "0x"))
	if err != nil {
		t.Fatalf("parse key: %v", err)
	}
	wantSigner := crypto.PubkeyToAddress(priv.PublicKey)

	signed, err := signTopUpAction(7, types.ActionVaultTopUp, "5000000000000000000", 3)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	if signed.Signer != wantSigner.Hex() {
		t.Fatalf("signer %s != key address %s", signed.Signer, wantSigner.Hex())
	}
	if signed.Nonce != 3 || signed.GuardId != 7 || signed.ActionType != types.ActionVaultTopUp {
		t.Fatalf("action fields not bound: %+v", signed)
	}

	// Recover the signer from the signature and digest independently.
	// crypto.Sign returns sig[64] as the recovery id (0/1); the registry's
	// _recover normalizes v<27 → v+=27, so both forms are accepted on-chain.
	digest := common.HexToHash(signed.Digest)
	sig := common.FromHex(signed.Signature)
	if len(sig) != 65 {
		t.Fatalf("signature length %d != 65", len(sig))
	}
	recovered, err := crypto.Ecrecover(digest.Bytes(), sig)
	if err != nil {
		t.Fatalf("ecrecover: %v", err)
	}
	addr := common.BytesToAddress(crypto.Keccak256(recovered[1:])[12:])
	if addr != wantSigner {
		t.Fatalf("recovered %s != want %s", addr.Hex(), wantSigner.Hex())
	}
}

// TestFormatPrice checks decimal string formatting from raw FTSO value+decimals.
func TestFormatPrice(t *testing.T) {
	cases := []struct {
		value    string
		decimals int8
		want     string
	}{
		{"1010400", 6, "1.010400"},
		{"123456789", 6, "123.456789"},
		{"5", 0, "5"},
		{"100", 2, "1.00"},
	}
	for _, c := range cases {
		v, ok := new(big.Int).SetString(c.value, 10)
		if !ok {
			t.Fatalf("bad value %s", c.value)
		}
		if got := formatPrice(v, c.decimals); got != c.want {
			t.Fatalf("formatPrice(%s,%d) = %s, want %s", c.value, c.decimals, got, c.want)
		}
	}
}

func mustBig(s string) *big.Int {
	v, ok := new(big.Int).SetString(s, 10)
	if !ok {
		panic("bad big int: " + s)
	}
	return v
}
